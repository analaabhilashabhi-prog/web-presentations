/* Minimal CDP client over a hand-rolled WebSocket — the deck ships no runtime
   dependencies and the test harness keeps to the same rule. */
const http = require('http');
const crypto = require('crypto');
const net = require('net');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJSON(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function frame(payload) {
  const data = Buffer.from(payload);
  const len = data.length;
  const mask = crypto.randomBytes(4);
  let head;
  if (len < 126) head = Buffer.from([0x81, 0x80 | len]);
  else if (len < 65536) {
    head = Buffer.alloc(4); head[0] = 0x81; head[1] = 0x80 | 126; head.writeUInt16BE(len, 2);
  } else {
    head = Buffer.alloc(10); head[0] = 0x81; head[1] = 0x80 | 127; head.writeBigUInt64BE(BigInt(len), 2);
  }
  const body = Buffer.alloc(len);
  for (let i = 0; i < len; i++) body[i] = data[i] ^ mask[i % 4];
  return Buffer.concat([head, mask, body]);
}

async function connect(port) {
  const targets = await getJSON(port, '/json/list');
  const page = targets.find((t) => t.type === 'page') || targets[0];
  const url = new URL(page.webSocketDebuggerUrl);
  const sock = net.connect(Number(url.port || port), url.hostname);
  await new Promise((r) => sock.once('connect', r));

  const key = crypto.randomBytes(16).toString('base64');
  sock.write([
    `GET ${url.pathname} HTTP/1.1`, `Host: ${url.host}`,
    'Upgrade: websocket', 'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`, 'Sec-WebSocket-Version: 13', '', '',
  ].join('\r\n'));

  let buf = Buffer.alloc(0);
  await new Promise((resolve) => {
    const onData = (d) => {
      buf = Buffer.concat([buf, d]);
      const end = buf.indexOf('\r\n\r\n');
      if (end === -1) return;
      buf = buf.subarray(end + 4);
      sock.off('data', onData);
      resolve();
    };
    sock.on('data', onData);
  });

  let id = 0;
  const pending = new Map();
  const listeners = new Map();

  sock.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const len0 = buf[1] & 0x7f;
      let off = 2; let len = len0;
      if (len0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const payload = buf.subarray(off, off + len).toString();
      buf = buf.subarray(off + len);
      let msg; try { msg = JSON.parse(payload); } catch { continue; }
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
      else if (msg.method && listeners.has(msg.method)) listeners.get(msg.method).forEach((f) => f(msg.params));
    }
  });

  return {
    send(method, params = {}) {
      const mid = ++id;
      return new Promise((resolve, reject) => {
        pending.set(mid, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
        sock.write(frame(JSON.stringify({ id: mid, method, params })));
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    close() { sock.destroy(); },
  };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', {
    expression, awaitPromise: true, returnByValue: true,
  });
  return r?.result?.value;
}

module.exports = { connect, evaluate, sleep };
