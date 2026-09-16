import fs from 'node:fs';
import path from 'node:path';
import { BACKEND_ROOT } from './paths.js';

/** Minimal .env reader so the app keeps its zero-dependency promise. */
function readEnvFile() {
  /* Both locations, because a deployment team will put .env beside the
     repository's README as often as beside the server. Looking in only one and
     ignoring the other fails silently: the app boots happily on defaults and
     binds to localhost, so the container answers nothing and there is no error
     to read. backend/.env wins a key that appears in both. */
  const files = [path.join(BACKEND_ROOT, '..', '.env'), path.join(BACKEND_ROOT, '.env')];
  const out = {};
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
  }
  return out;
}

const fileEnv = readEnvFile();

function read(key, fallback) {
  const value = process.env[key] ?? fileEnv[key];
  return value === undefined || value === '' ? fallback : value;
}

function readBool(key, fallback) {
  const value = read(key, null);
  if (value === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const env = {
  port: Number(read('PORT', 4173)),
  /* CDN prefix for everything under /uploads. Empty means serve from disk,
     which is what local work and the offline presentation both rely on — so
     this can be set in production without changing a single stored path.
     Trailing slash trimmed, because every stored path already begins with one. */
  mediaBaseUrl: String(read('MEDIA_BASE_URL', '')).replace(/\/+$/, ''),
  /* 0.0.0.0, because the deployment needs it and defaulting to loopback made
     that a thing somebody had to know: a container bound to 127.0.0.1 accepts
     nothing from outside itself and gives no error explaining why. */
  host: read('HOST', '0.0.0.0'),
  sessionTtlHours: Number(read('SESSION_TTL_HOURS', 12)),
  maxUploadBytes: Number(read('MAX_UPLOAD_MB', 32)) * 1024 * 1024,
  maxVideoBytes: Number(read('MAX_VIDEO_MB', 400)) * 1024 * 1024,
  ffmpegPath: read('FFMPEG_PATH', null),
  /* Off unless asked for. This prints working admin and presenter passwords,
     and /api/auth/me serves them to anonymous callers — defaulting it on meant
     a public deployment published its own credentials unless somebody
     remembered a variable. It was found doing exactly that. Set
     SHOW_LOGIN_HINT=1 for local work. */
  showLoginHint: readBool('SHOW_LOGIN_HINT', false),
  /* Read here, not from process.env at the point of use: http.js was checking
     process.env directly, so COOKIE_SECURE=1 in a .env file was silently
     ignored and the cookie went out without Secure on an HTTPS deployment. */
  cookieSecure: readBool('COOKIE_SECURE', false),
  seedUsers: {
    admin: {
      email: read('ADMIN_EMAIL', 'admin@org.local'),
      password: read('ADMIN_PASSWORD', 'Admin@123'),
      name: 'Content Admin',
    },
    presenter: {
      email: read('PRESENTER_EMAIL', 'presenter@org.local'),
      password: read('PRESENTER_PASSWORD', 'Present@123'),
      name: 'Presenter',
    },
  },
};

export const SESSION_COOKIE = 'op_session';
