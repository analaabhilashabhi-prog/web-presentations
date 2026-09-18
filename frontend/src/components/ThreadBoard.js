import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { letterRevealPreset } from '../utils/letterReveal.js';

/**
 * A film, then a board of photographs pinned along a thread.
 *
 * Built to a reference image the user supplied: a pale grey sheet of graph
 * paper, a headline top-left, and below it numbered white cards leaning a few
 * degrees each way, joined one to the next by a dashed thread that runs pin to
 * pin. The reference is a page and reads downward; this is a slide and reads
 * across — the cards alternate high and low along a horizontal band and the
 * thread weaves between the two rows. Where the reference's cards carry
 * copy, these carry photographs, one each, and a small running number.
 *
 * Two screens, one above the other. The first is the film, full-bleed and
 * muted, with the section's name over it; the wheel, the pill or the arrow
 * keys bring the board up from below. On the board the wheel drives the band
 * sideways, one eased offset in a rAF loop — never `scroll-behavior: smooth`,
 * never a transition per card — and the wheel turned back at the start of the
 * band, after a beat of quiet, returns to the film.
 *
 * The thread reveals itself in order. When the board first comes into view
 * the start pin appears, the first segment draws itself, the first card
 * fades up onto its pins, the next segment draws to the second card, and so
 * on across whatever is in view. Cards further along wait, and each arrives
 * the same way — segment, then card — as the band brings it into view, on a
 * quicker beat so a presenter scrolling is never left waiting for the line.
 *
 * Nothing is cropped: a card is as wide as its photograph is at the row's
 * height, so a square and a 16:9 stand side by side at their own shapes, the
 * way prints pinned to a board do. Every card opens the shared viewer on its
 * own photograph.
 */

/* Geometry, on the nominal 1600x860 canvas. */
const IMG_H = 200;          // every photograph stands this tall
const PAD = 14;             // the card's white border
const HEAD = 26;            // the row above the photograph, for the number
const CARD_H = IMG_H + PAD * 2 + HEAD;
const MIN_W = 160;          // a portrait, if one ever arrives
const MAX_W = 356;          // 16:9 at 200 tall, exactly
const GAP = 100;            // between cards, along the band
const HIGH_TOP = 92;
const LOW_TOP = HIGH_TOP + CARD_H + 90;
const TRACK_LEAD = 96;      // from the band's edge to the first card
const PIN_INSET = 16;       // a pin sits this far inside the card's corner
const TILT = 2.2;           // degrees, alternating
const NOTE_W = 300;

/* Timing. */
const LINE_MS = 560;        // a segment draws itself in this
const CHAIN_STEP = 640;     // between cards on the first, watched, reveal
const SCROLL_STEP = 240;    // between cards revealed by scrolling
const PAGE_EASE = 0.14;
const BAND_EASE = 0.2;
const WHEEL_QUIET = 450;    // ms of stillness before a wheel-up can leave the board
const PAGE_SETTLE = 700;    // ms after a page turn before the wheel drives the band

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ThreadBoard(block = {}) {
  const photos = (block.photos || []).filter((p) => p && p.src && p.w && p.h);
  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (src) => upload(base ? `${base}/${src}` : src);
  const root = h('section', { class: 'tb-root', tabindex: '0', 'aria-label': block.videoTitle || block.title || 'Project Street' });
  const pages = h('div', { class: 'tb-pages' });
  root.append(pages);

  // ------------------------------------------------------------------ the film
  let video = null;
  const film = h('div', { class: 'tb-film' });
  if (block.video) {
    /* `videoStart` (2026-09-17, on request: Project Street's film is to begin at
       0:13 with nothing to show it was moved). Three things make the join
       invisible. The file is OPENED at the offset — a `#t=` media fragment on
       the src is what the browser fetches from first, so the frames before it
       are never decoded, let alone painted. A `loadedmetadata` seek backs that
       up, because a fragment is advisory and a cached file can ignore it. And
       the element is held at opacity 0 until it is actually at the offset and
       playing, then eased in over the film's own dark ground — so the room sees
       a film beginning, never a first frame being replaced. With an offset the
       `loop` attribute comes off (it always returns to zero) and `ended`
       repeats from the offset instead. At 0 none of this engages. */
    const start = Math.max(0, Number(block.videoStart) || 0);
    video = h('video', {
      class: `tb-film__media${start ? ' is-seeking' : ''}`,
      src: urlOf(block.video) + (start ? `#t=${start}` : ''),
      autoplay: true,
      muted: true,
      loop: !start,
      playsinline: true,
      preload: 'auto',
      'aria-hidden': 'true',
    });
    // Autoplay only sticks when the element is muted before it loads.
    video.muted = true;
    if (start) {
      const atStart = () => video.currentTime >= start - 0.35;
      const reveal = () => {
        if (!atStart()) return;
        video.classList.remove('is-seeking');
        video.removeEventListener('timeupdate', reveal);
        video.removeEventListener('seeked', reveal);
        video.removeEventListener('playing', reveal);
      };
      video.addEventListener('loadedmetadata', () => {
        if (video.currentTime < start - 0.05) video.currentTime = start;
      }, { once: true });
      video.addEventListener('seeked', reveal);
      video.addEventListener('playing', reveal);
      video.addEventListener('timeupdate', reveal);
      video.addEventListener('ended', () => {
        video.currentTime = start;
        video.play().catch(() => {});
      });
    }
    film.append(video, h('div', { class: 'tb-film__scrim', 'aria-hidden': 'true' }));
  }
  const filmCopy = h('div', { class: 'tb-film__copy' });
  if (block.videoEyebrow) filmCopy.append(h('p', { class: 'tb-pill tb-pill--light', text: block.videoEyebrow }));
  if (block.videoTitle) {
    filmCopy.append(letterRevealPreset(block.videoTitle, 'heading', {
      as: 'h2', className: 'tb-film__title', trigger: true,
    }).node);
  }
  filmCopy.append(h('button', {
    class: 'tb-cta tb-cta--light',
    type: 'button',
    onclick: () => goPage(1),
  }, h('span', { text: block.videoCta || 'Walk the street' }), chevron('down')));
  film.append(filmCopy);
  pages.append(film);

  // ----------------------------------------------------------------- the board
  const board = h('div', { class: 'tb-board' });
  const intro = h('div', { class: 'tb-intro' });
  if (block.eyebrow) intro.append(h('p', { class: 'tb-pill', text: block.eyebrow }));
  const introTitle = h('div', { class: 'tb-intro__title' });
  intro.append(introTitle);
  if (block.lead) intro.append(h('p', { class: 'tb-intro__lead', text: block.lead }));
  board.append(intro);

  /* Lay the cards out along the band. Every position is a plain number here
     and a plain px there, so nothing depends on the root's height — which is
     860 on the canvas and `--slide-h` in the room. */
  const cards = photos.map((p, i) => {
    const imgW = clamp(Math.round(IMG_H * (p.w / p.h)), MIN_W, MAX_W);
    return { i, p, w: imgW + PAD * 2, h: CARD_H, imgW, high: i % 2 === 0, x: 0, y: i % 2 === 0 ? HIGH_TOP : LOW_TOP };
  });
  let x = TRACK_LEAD;
  cards.forEach((c) => { c.x = x; x += c.w + GAP; });
  const noteX = x;
  const trackW = photos.length ? noteX + NOTE_W + 80 : 800;

  /* Pins. A high card is pinned along its bottom edge and a low card along
     its top, so the thread lives in the corridor between the two rows and
     never crosses a photograph. `in` is where the thread arrives, `out` where
     it leaves for the next card. */
  const pinsOf = (c) => {
    const y = c.high ? c.y + c.h - PIN_INSET : c.y + PIN_INSET;
    return { in: { x: c.x + PIN_INSET, y }, out: { x: c.x + c.w - PIN_INSET, y } };
  };
  const startPin = { x: 26, y: (HIGH_TOP + CARD_H + LOW_TOP) / 2 };
  const notePin = photos.length ? { x: noteX + 8, y: (HIGH_TOP + CARD_H + LOW_TOP) / 2 } : null;

  /* One S-curve between two pins: horizontal tangents at both ends, so the
     thread leaves a card level and arrives at the next level. */
  const curve = (a, b) => {
    const dx = (b.x - a.x) * 0.5;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };

  const band = h('div', { class: 'tb-band' });
  const track = h('div', { class: 'tb-track', style: { width: `${trackW}px` } });
  band.append(track);

  const thread = svgEl('svg', { class: 'tb-thread', width: trackW, height: 860, viewBox: `0 0 ${trackW} 860`, 'aria-hidden': 'true' });
  track.append(thread);

  /* Segment i arrives at card i (segment 0 comes from the start pin); the
     last segment runs on from the last card to the note. */
  const segments = [];
  const pinEls = [];
  const pin = (pt, extra = '') => {
    const el = h('span', { class: `tb-pin${extra}`, style: { left: `${pt.x}px`, top: `${pt.y}px` }, 'aria-hidden': 'true' });
    track.append(el);
    return el;
  };
  const startPinEl = pin(startPin);
  let prev = startPin;
  cards.forEach((c) => {
    const pins = pinsOf(c);
    const seg = svgEl('path', { class: 'tb-seg', d: curve(prev, pins.in) });
    thread.append(seg);
    segments.push(seg);
    pinEls.push([pin(pins.in), pin(pins.out)]);
    prev = pins.out;
  });

  const all = photos.map((p) => ({ url: urlOf(p.src), name: p.name || '' }));
  const cardEls = cards.map((c) => {
    const el = h('button', {
      class: `tb-card ${c.high ? 'tb-card--high' : 'tb-card--low'}`,
      type: 'button',
      'aria-label': c.p.name || `Photograph ${c.i + 1}`,
      style: { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px`, '--tb-tilt': `${c.high ? -TILT : TILT}deg` },
      onclick: () => openLightbox(all, c.i),
    }, h('span', { class: 'tb-card__paper' },
      h('span', { class: 'tb-card__head' },
        h('span', { class: 'tb-card__num', text: String(c.i + 1).padStart(2, '0') }),
        c.p.name ? h('span', { class: 'tb-card__name', text: c.p.name }) : null),
      h('span', { class: 'tb-card__shot', style: { width: `${c.imgW}px`, height: `${IMG_H}px` } },
        h('img', {
          src: urlOf(c.p.src),
          alt: c.p.name || '',
          draggable: 'false',
          loading: 'lazy',
          decoding: 'async',
          onerror: (event) => { event.currentTarget.closest('.tb-card')?.classList.add('is-broken'); },
        }))));
    track.append(el);
    return el;
  });

  /* The note the thread ends on — the reference signs off with a handwritten
     line and an underline drawn in one stroke. */
  let noteSeg = null;
  let noteEl = null;
  if (notePin && block.note) {
    noteSeg = svgEl('path', { class: 'tb-seg', d: curve(prev, notePin) });
    thread.append(noteSeg);
    pinEls.push([pin(notePin)]);
    noteEl = h('div', { class: 'tb-note', style: { left: `${notePin.x + 22}px`, top: `${notePin.y - 34}px`, width: `${NOTE_W - 40}px` } },
      h('span', { class: 'tb-note__text', text: block.note }));
    const under = svgEl('svg', { class: 'tb-note__under', viewBox: '0 0 220 14', 'aria-hidden': 'true' });
    under.append(svgEl('path', { d: 'M 3 9 C 40 3, 90 12, 130 6 S 200 4, 217 8', fill: 'none' }));
    noteEl.append(under);
    track.append(noteEl);
  }

  /* The pill in the corner: one card either way. */
  const nav = h('div', { class: 'tb-nav' },
    h('button', { class: 'tb-nav__btn', type: 'button', 'aria-label': 'Previous', onclick: () => step(-1) }, chevron('left')),
    h('button', { class: 'tb-nav__btn', type: 'button', 'aria-label': 'Next', onclick: () => step(1) }, chevron('right')));
  board.append(band, nav);
  pages.append(board);

  // ------------------------------------------------------------ the reveal
  /* A card is revealed in two beats: its segment draws, then it fades up onto
     its pins. Reveals queue and play in order — on the first showing at the
     pace of a thread being followed, afterwards at the pace of a scroll. */
  const seen = new Set();
  const queued = new Set();
  const queue = [];
  let pumping = false;
  let firstChainDone = false;
  const reduced = reduceMotion();

  const showCard = (i) => {
    seen.add(i);
    segments[i]?.classList.add('is-seen');
    const land = () => {
      cardEls[i].classList.add('is-seen');
      pinEls[i].forEach((p) => p.classList.add('is-seen'));
      if (i === cards.length - 1 && noteSeg) {
        setTimeout(() => {
          noteSeg.classList.add('is-seen');
          setTimeout(() => { pinEls[cards.length]?.forEach((p) => p.classList.add('is-seen')); noteEl?.classList.add('is-seen'); }, reduced ? 0 : LINE_MS);
        }, reduced ? 0 : 200);
      }
    };
    if (reduced) land(); else setTimeout(land, LINE_MS - 80);
  };
  function pump() {
    if (pumping) return;
    if (!queue.length) { firstChainDone = true; return; }
    pumping = true;
    const i = queue.shift();
    showCard(i);
    setTimeout(() => { pumping = false; pump(); }, reduced ? 0 : (firstChainDone ? SCROLL_STEP : CHAIN_STEP));
  }
  const enqueue = (i) => {
    if (seen.has(i) || queued.has(i)) return;
    queued.add(i);
    queue.push(i);
    pump();
  };

  let boardShown = false;
  function showBoard() {
    if (boardShown) return;
    boardShown = true;
    /* The headline is built now rather than at mount, because the reveal lives
       on the element and would otherwise have played to nobody, one screen up. */
    String(block.title || '').split('\n').filter(Boolean).forEach((line) => {
      introTitle.append(letterRevealPreset(line, 'heading', { as: 'span', className: 'tb-intro__line', trigger: true }).node);
    });
    intro.classList.add('is-seen');
    startPinEl.classList.add('is-seen');
    checkReveals(true);
  }
  function checkReveals(force = false) {
    if (!boardShown) return;
    const bandW = band.clientWidth || (1600 - 500);
    cards.forEach((c) => {
      if (force || c.x - bandX < bandW - 40) enqueue(c.i);
    });
    /* `force` only queues what the first screen shows; the rest wait for the
       band to bring them in. */
    if (force) {
      queue.length = 0; queued.clear();
      cards.filter((c) => c.x < bandW - 40).forEach((c) => enqueue(c.i));
    }
  }

  // ------------------------------------------------------------- the motion
  let page = 0;          // 0 the film, 1 the board
  let pageY = 0;
  let bandX = 0;
  let bandTarget = 0;
  let raf = 0;
  let lastWheel = 0;
  let pageTurnedAt = 0;
  const pageH = () => root.clientHeight || 860;
  const maxBand = () => Math.max(0, trackW - (band.clientWidth || 1100));

  function frame() {
    raf = 0;
    const H = pageH();
    const py = page * H;
    pageY += (py - pageY) * PAGE_EASE;
    if (Math.abs(py - pageY) < 0.5) pageY = py;
    bandX += (bandTarget - bandX) * BAND_EASE;
    if (Math.abs(bandTarget - bandX) < 0.3) bandX = bandTarget;
    pages.style.transform = `translate3d(0, ${-pageY}px, 0)`;
    track.style.transform = `translate3d(${-bandX}px, 0, 0)`;
    if (page === 1 && pageY > H * 0.4) showBoard();
    checkReveals();
    if (pageY !== py || bandX !== bandTarget) raf = requestAnimationFrame(frame);
    else if (video) {
      /* The film keeps decoding a screen away for nothing; pause it there and
         pick it up where it was when the presenter comes back. */
      if (page === 1 && !video.paused) video.pause();
      if (page === 0 && video.paused) video.play().catch(() => {});
    }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function goPage(n) {
    if (n === page) return;
    page = n;
    pageTurnedAt = performance.now();
    root.classList.toggle('is-board', page === 1);
    kick();
  }
  function step(dir) {
    if (page === 0) { if (dir > 0) goPage(1); return; }
    const starts = cards.map((c) => c.x - TRACK_LEAD + 40);
    const next = dir > 0
      ? starts.find((s) => s > bandTarget + 1)
      : [...starts].reverse().find((s) => s < bandTarget - 1);
    bandTarget = clamp(next ?? (dir > 0 ? maxBand() : 0), 0, maxBand());
    kick();
  }

  root.addEventListener('wheel', (event) => {
    event.preventDefault();
    const now = performance.now();
    const d = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (page === 0) {
      if (d > 8 && now - pageTurnedAt > PAGE_SETTLE) goPage(1);
      lastWheel = now;
      return;
    }
    /* A wheel turned back at the very start of the band, after a beat of
       stillness, is a request for the film — a trackpad's tail after reaching
       the start is not, which is what the beat is for. */
    if (bandTarget <= 0 && bandX < 1 && d < -8 && now - lastWheel > WHEEL_QUIET && now - pageTurnedAt > PAGE_SETTLE) {
      goPage(0);
      lastWheel = now;
      return;
    }
    lastWheel = now;
    if (now - pageTurnedAt < PAGE_SETTLE) return;
    bandTarget = clamp(bandTarget + d, 0, maxBand());
    kick();
  }, { passive: false });

  root.addEventListener('keydown', (event) => {
    const k = event.key;
    let handled = true;
    if (k === 'ArrowDown') goPage(1);
    else if (k === 'ArrowUp') { if (page === 1 && bandTarget <= 0) goPage(0); else if (page === 1) { bandTarget = 0; kick(); } }
    else if (k === 'ArrowRight') step(1);
    else if (k === 'ArrowLeft') step(-1);
    else handled = false;
    if (!handled) return;
    /* Stopped as well as prevented: presenting binds the arrows to the whole
       deck, so without this an arrow pressed here walks the band *and* leaves
       the slide. */
    event.stopPropagation();
    event.preventDefault();
  });

  // The transform is written by the loop; make sure it is written once even
  // before anything moves, so the first frame is not a jump.
  kick();
  return root;
}

function chevron(dir) {
  const rot = { down: 0, up: 180, left: 90, right: -90 }[dir] || 0;
  const s = svgEl('svg', { class: 'tb-chev', viewBox: '0 0 24 24', 'aria-hidden': 'true', style: `transform: rotate(${rot}deg)` });
  s.append(svgEl('path', { d: 'M6 9l6 6 6-6', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return s;
}
