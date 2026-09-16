import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { upload } from '../utils/media.js';
import { openLightbox } from './Lightbox.js';
import { justifyRows } from './PlacementWall.js';

/**
 * The trainings, as a bookshelf — and, one press deeper, as a page each.
 *
 * Two states. **The shelf**: the programmes stand as books above a plank, the
 * chosen one large and square on, the rest ranged to its right; under the plank,
 * a band with that programme's number, name, what it covers and its syllabus.
 * The row moves one book at a time — the arrow pill, the wheel, the arrow keys
 * — and pressing a book that is not at the front brings it there.
 *
 * **Open**: press the front book (or the band's Open) and the shelf closes
 * around it. That book grows and travels to the left of the slide, and the
 * right side carries everything about the programme, set large: what it is,
 * what we teach in it, and any further points supplied. If the programme has
 * photographs, the page scrolls down to them; if it has none, it does not
 * scroll at all. Back — or Escape — returns it to the shelf.
 *
 * The book's journey is a FLIP: the big book is laid out where it will end up,
 * then given the transform that maps it back onto the shelf book's rectangle,
 * and that transform is released. Nothing is measured mid-flight, and the shelf
 * underneath never moves — it only fades, which is what lets the return trip
 * land exactly where it left.
 *
 * The row is one eased offset in a rAF loop rather than a CSS transition per
 * book, and its layout is a continuous function of that offset: each book's
 * width follows from how near the front it is, and its position is the sum of
 * the widths before it. A step function in there put a 78px jump in every
 * transition once, and it is not coming back.
 */

/* The shelf. A book is 300 wide at the front of the row and the ones behind it
   step back to 74% of that. */
const BOOK_W = 300;
const BOOK_H = 430;
const GAP = 26;
const BACK_SCALE = 0.74;
/* One training's worth of travel past either end, for the extrapolation. */
const STEP = BOOK_W * BACK_SCALE + GAP;

const EASE_TAU = 0.16;   // seconds — the settle
/* One notch of a mouse wheel is one book. A trackpad delivers a hundred events
   for the gesture a mouse delivers in one, so the step is gated on a cooldown
   rather than counted. */
const WHEEL_THRESHOLD = 24;
const WHEEL_COOLDOWN = 420;
/* The open and close journeys, matched to the stylesheet's transitions. */
const MORPH_MS = 720;

/* The photographs under an open programme: a justified wall, rows solved so
   nothing is ever cropped. */
const PHOTO_ROW = 300;
const PHOTO_GAP = 14;
const PHOTO_WIDTH = 1600 - 2 * 58;

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

export function TrainingShelf(block = {}) {
  const all = (block.trainings || []).filter((t) => t && t.name);
  const root = h('section', { class: 'ts-root' });
  if (!all.length) return root;

  const shelf = all;
  const base = String(block.base || 'Trainings').replace(/^\/+|\/+$/g, '');

  // -------------------------------------------------------------------- head
  const head = h(
    'div',
    { class: 'ts-head' },
    block.eyebrow ? h('p', { class: 'ts-eyebrow', text: block.eyebrow }) : null,
    h('h2', { class: 'ts-title', text: block.title || 'Trainings' }),
    block.lead ? h('p', { class: 'ts-lead', text: block.lead }) : null,
  );

  // ------------------------------------------------------------------- books
  /* The cover and its parts, shared by the books on the shelf and the big one
     on the open page — same markup, so the one can become the other. */
  function bookBody(training) {
    return h(
      'span',
      { class: 'ts-book__body' },
      h('span', { class: 'ts-book__spine', 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'ts-book__cover' },
        training.track ? h('span', { class: 'ts-book__track', text: training.track }) : null,
        h('span', { class: 'ts-book__name', text: training.name }),
        h('span', { class: 'ts-book__rule', 'aria-hidden': 'true' }),
        training.duration ? h('span', { class: 'ts-book__meta', text: training.duration }) : null,
      ),
      h('span', { class: 'ts-book__pages', 'aria-hidden': 'true' }),
    );
  }

  const row = h('div', { class: 'ts-row' });
  const stage = h('div', { class: 'ts-stage', role: 'list', tabindex: '0' }, row);

  const books = all.map((training, i) => {
    const el = h('button', {
      class: 'ts-book',
      type: 'button',
      role: 'listitem',
      'aria-label': training.name,
      style: { '--ts-tint': training.tint || null, '--ts-i': String(i) },
      /* The front book opens; any other comes to the front first. Two presses
         on a book behind is therefore open, which is what a hand expects. */
      onclick: () => {
        const at = shelf.indexOf(training);
        if (at === landing() && Math.abs(target - offset) < 0.02) openDetail(training);
        else select(at);
      },
    }, bookBody(training), h('span', { class: 'ts-book__cast', 'aria-hidden': 'true' }));
    row.append(el);
    return { el, training };
  });

  // ------------------------------------------------------------- the shelf
  const plank = h('div', { class: 'ts-shelf', 'aria-hidden': 'true' },
    h('span', { class: 'ts-shelf__top' }),
    h('span', { class: 'ts-shelf__edge' }),
    h('span', { class: 'ts-shelf__under' }));

  // ---------------------------------------------------- the band underneath
  const info = h('div', { class: 'ts-info' });
  const under = h('div', { class: 'ts-under' }, info);

  // ------------------------------------------------------------- the controls
  const readout = h('span', { class: 'ts-nav__count' });
  const navBtn = (dir, label, glyph) => h('button', {
    class: 'ts-nav__btn',
    type: 'button',
    'aria-label': label,
    onclick: (event) => { event.stopPropagation(); walk(dir); },
  }, icon(glyph, { class: 'ic' }));
  const nav = h('div', { class: 'ts-nav' },
    navBtn(-1, 'Previous programme', 'chevron-left'),
    readout,
    navBtn(1, 'Next programme', 'chevron-right'));

  // ------------------------------------------------------------ the open page
  const big = h('div', { class: 'ts-big', 'aria-hidden': 'true' });
  const detailInfo = h('div', { class: 'ts-detail__info' });
  const detailPhotos = h('div', { class: 'ts-detail__photos' });
  const detailReadout = h('span', { class: 'ts-nav__count' });
  const detail = h(
    'div',
    { class: 'ts-detail', tabindex: '-1', 'aria-label': 'Programme' },
    h(
      'div',
      { class: 'ts-detail__bar' },
      h('button', {
        class: 'ts-detail__back',
        type: 'button',
        onclick: () => closeDetail(),
      }, icon('chevron-left', { class: 'ic' }), h('span', { text: block.backLabel || 'Back to the shelf' })),
      h('div', { class: 'ts-nav ts-nav--detail' },
        navBtn(-1, 'Previous programme', 'chevron-left'),
        detailReadout,
        navBtn(1, 'Next programme', 'chevron-right')),
    ),
    h('div', { class: 'ts-detail__grid' }, big, detailInfo),
    detailPhotos,
  );

  root.append(h('div', { class: 'ts-top' }, head, stage, nav), plank, under, detail);

  // --------------------------------------------------------------- the motion
  let target = 0;
  let offset = 0;
  let raf = 0;
  let last = 0;
  let painted = null;
  let open = false;

  const clampIndex = (i) => Math.max(0, Math.min(i, shelf.length - 1));
  /* The one index everything reads from: the book the row is heading for. */
  const landing = () => clampIndex(Math.round(target));

  function kick() {
    if (raf) return;
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    raf = 0;
    /* Real elapsed time, not a nominal frame. `kick` is called from the end of
       this function, so resetting the clock here would make every frame worth
       16ms however long the browser actually spent on it. */
    const gap = last ? now - last : 0;
    const dt = gap > 0 && gap < 200 ? Math.min(0.05, gap / 1000) : 0.016;
    last = now;
    offset += (target - offset) * (1 - Math.exp(-dt / EASE_TAU));
    place();
    if (Math.abs(target - offset) > 0.001) kick();
    else { offset = target; place(); }
  }

  /* Where every book sits, as a CONTINUOUS function of the row's offset. Each
     book's width follows from how near the front it is — smoothstep, so the
     growth eases at both ends — and its position is the sum of the widths
     before it, so nothing in here has a step and nothing on screen can jump. */
  function place() {
    const n = shelf.length;
    const geo = shelf.map((t, i) => {
      const f = Math.max(0, 1 - Math.abs(i - offset));
      const front = f * f * (3 - 2 * f);
      return { front, scale: BACK_SCALE + (1 - BACK_SCALE) * front };
    });
    const centres = [];
    let cursor = 0;
    geo.forEach((g) => {
      const w = BOOK_W * g.scale;
      centres.push(cursor + w / 2);
      cursor += w + GAP;
    });
    let anchor = 0;
    if (n) {
      if (offset <= 0) anchor = centres[0] + offset * STEP;
      else if (offset >= n - 1) anchor = centres[n - 1] + (offset - (n - 1)) * STEP;
      else {
        const lo = Math.floor(offset);
        anchor = centres[lo] + (centres[lo + 1] - centres[lo]) * (offset - lo);
      }
    }
    books.forEach(({ el, training }) => {
      const i = shelf.indexOf(training);
      const d = i - offset;
      const { front, scale } = geo[i];
      el.style.transform = `translate3d(${(centres[i] - anchor).toFixed(2)}px, ${((1 - front) * 16).toFixed(2)}px, 0)`
        + ` scale(${scale.toFixed(4)})`;
      el.style.zIndex = String(200 - Math.round(Math.abs(d) * 10));
      el.classList.toggle('is-front', i === landing());
      el.classList.toggle('is-gone', d < -1.4 || d > 5.2);
    });
    paintInfo();
  }

  // ----------------------------------------------------- the band underneath
  function paintInfo() {
    const i = landing();
    const training = shelf[i];
    readout.textContent = `${i + 1} / ${shelf.length}`;
    if (!training || training === painted) return;
    painted = training;

    const subjects = (training.subjects || []).filter(Boolean);
    info.textContent = '';
    info.append(
      h('span', { class: 'ts-info__rule', 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'ts-info__lede', style: { '--ts-tint': training.tint || null } },
        h('p', { class: 'ts-info__index' },
          h('span', { class: 'ts-info__num', text: String(i + 1).padStart(2, '0') }),
          training.track ? h('span', { class: 'ts-info__kind', text: training.track }) : null),
        h('h3', { class: 'ts-info__name', text: training.name }),
        /* The way in, spelled out. The front book opens on a press too, but a
           book is not obviously a button and a room is not going to guess. */
        h('button', {
          class: 'ts-info__open',
          type: 'button',
          onclick: () => openDetail(training),
        }, h('span', { text: block.openLabel || 'Open the programme' }), icon('arrow-right', { class: 'ic ic--sm' })),
      ),
      h(
        'div',
        { class: 'ts-info__body', style: { '--ts-tint': training.tint || null } },
        training.blurb ? h('p', { class: 'ts-info__blurb', text: training.blurb }) : null,
        subjects.length
          ? h('p', { class: 'ts-info__subjects' }, ...subjects.flatMap((subject, n) => (n
            ? [h('span', { class: 'ts-info__dot', 'aria-hidden': 'true' }), h('span', { text: subject })]
            : [h('span', { text: subject })])))
          : null,
      ),
    );
  }

  // ------------------------------------------------------------ the open page
  /* Everything about one programme, set large. Rebuilt rather than retyped,
     because the entrance lives on the elements and only new nodes replay it. */
  function fillDetail(training) {
    const i = shelf.indexOf(training);
    const subjects = (training.subjects || []).filter(Boolean);
    const highlights = (training.highlights || []).filter((x) => x && x.text);
    const photos = (training.photos || []).filter((p) => p && p.src && p.w && p.h);

    big.style.setProperty('--ts-tint', training.tint || '');
    big.textContent = '';
    big.append(bookBody(training));

    detailReadout.textContent = `${i + 1} / ${shelf.length}`;
    detailInfo.style.setProperty('--ts-tint', training.tint || '');
    detailInfo.textContent = '';
    /* Filtered before `append`: `h()` drops a null child, `Element.append()`
       writes the word "null" into the page. Skill Sprint has no syllabus and
       nothing has highlights yet, and both sat under the list as text. */
    detailInfo.append(...[
      h('p', { class: 'ts-detail__index' },
        h('span', { class: 'ts-info__num', text: String(i + 1).padStart(2, '0') }),
        training.track ? h('span', { class: 'ts-info__kind', text: training.track }) : null),
      h('h3', { class: 'ts-detail__name', text: training.name }),
      training.blurb ? h('p', { class: 'ts-detail__blurb', text: training.blurb }) : null,
      subjects.length
        ? h('section', { class: 'ts-detail__teach' },
          h('p', { class: 'ts-detail__label', text: block.teachLabel || 'What we teach' }),
          h('ol', { class: 'ts-detail__subjects' }, ...subjects.map((subject, n) => h('li', {},
            h('span', { class: 'ts-detail__n', text: String(n + 1).padStart(2, '0') }),
            h('span', { class: 'ts-detail__subject', text: subject })))))
        : null,
      /* Further points, when they have been supplied — what a programme is for,
         who it is for, what it ends in. Nothing is drawn unless the content
         exists; an empty section with a heading is a promise the slide cannot
         keep. */
      highlights.length
        ? h('section', { class: 'ts-detail__more' }, ...highlights.map((x) => h('div', { class: 'ts-detail__point' },
          x.label ? h('p', { class: 'ts-detail__label', text: x.label }) : null,
          h('p', { class: 'ts-detail__text', text: x.text }))))
        : null,
    ].filter(Boolean));

    /* The photographs, if there are any. Rows solved to the page's width so
       nothing is cropped — the same wall the galleries use. Without any, the
       page has nothing below the fold and does not scroll. */
    detailPhotos.textContent = '';
    detail.classList.toggle('has-photos', photos.length > 0);
    if (photos.length) {
      const urls = photos.map((p) => ({ url: upload(`${base}/${p.src}`), name: p.alt || training.name }));
      const rows = justifyRows(photos, PHOTO_WIDTH, PHOTO_ROW, PHOTO_GAP, 520);
      detailPhotos.append(h('p', { class: 'ts-detail__label', text: block.photosLabel || 'From the programme' }));
      let k = 0;
      rows.forEach((r) => {
        const rowEl = h('div', { class: `ts-detail__row${r.full ? ' is-full' : ''}` });
        r.items.forEach((it) => {
          const at = k++;
          rowEl.append(h('button', {
            class: 'ts-detail__photo',
            type: 'button',
            style: { width: `${it.dw.toFixed(1)}px`, height: `${it.dh.toFixed(1)}px` },
            'aria-label': it.alt || training.name,
            onclick: () => openLightbox(urls, at),
          }, h('img', { src: upload(`${base}/${it.src}`), alt: it.alt || '', loading: 'lazy', decoding: 'async', draggable: 'false' })));
        });
        detailPhotos.append(rowEl);
      });
    }
    scrollTarget = 0;
    detail.scrollTop = 0;
  }

  const frontBody = () => books[landing()]?.el.querySelector('.ts-book__body');
  /* Screen pixels to the slide's own: FitSlide scales the whole slide, and a
     transform written in unscaled px has to be given unscaled distances. */
  const unscale = () => (root.getBoundingClientRect().width / root.offsetWidth) || 1;

  function openDetail(training) {
    if (open) return;
    open = true;
    fillDetail(training);
    root.classList.add('is-open');
    /* FLIP. The big book is already where it will end up; this is the transform
       that puts it back onto the shelf book, released a frame later so the
       stylesheet's transition carries it across. */
    const src = frontBody();
    if (src && !REDUCED?.matches) {
      const from = src.getBoundingClientRect();
      const to = big.getBoundingClientRect();
      const k = unscale();
      big.style.transition = 'none';
      big.style.transform = `translate(${((from.left - to.left) / k).toFixed(2)}px, ${((from.top - to.top) / k).toFixed(2)}px)`
        + ` scale(${(from.width / to.width).toFixed(4)}, ${(from.height / to.height).toFixed(4)})`;
      big.getBoundingClientRect();
      requestAnimationFrame(() => { big.style.transition = ''; big.style.transform = ''; });
    }
    detail.focus({ preventScroll: true });
  }

  let closing = 0;
  function closeDetail() {
    if (!open) return;
    open = false;
    const src = frontBody();
    if (src && !REDUCED?.matches) {
      const from = big.getBoundingClientRect();
      const to = src.getBoundingClientRect();
      const k = unscale();
      big.style.transform = `translate(${((to.left - from.left) / k).toFixed(2)}px, ${((to.top - from.top) / k).toFixed(2)}px)`
        + ` scale(${(to.width / from.width).toFixed(4)}, ${(to.height / from.height).toFixed(4)})`;
    }
    root.classList.add('is-closing');
    clearTimeout(closing);
    closing = setTimeout(() => {
      root.classList.remove('is-open', 'is-closing');
      big.style.transition = 'none';
      big.style.transform = '';
      big.getBoundingClientRect();
      big.style.transition = '';
      stage.focus({ preventScroll: true });
    }, REDUCED?.matches ? 0 : MORPH_MS);
  }

  // ------------------------------------------------------------------ driving
  function select(i) {
    target = clampIndex(i);
    kick();
  }
  function walk(dir) {
    const next = clampIndex(landing() + dir);
    if (next === landing()) return;
    select(next);
    /* Open, the arrows turn the page rather than moving a shelf nobody can
       see. The shelf follows underneath so Back lands on the right book. */
    if (open) {
      detail.classList.remove('is-turning');
      detail.getBoundingClientRect();
      detail.classList.add('is-turning');
      fillDetail(shelf[next]);
    }
  }

  let wheelAccum = 0;
  let wheelLock = 0;
  stage.addEventListener('wheel', (event) => {
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    // The deck does not scroll; without this a flick drags the page behind it.
    event.preventDefault();
    const now = event.timeStamp;
    if (now - wheelLock < WHEEL_COOLDOWN) { wheelAccum = 0; return; }
    if (Math.sign(delta) !== Math.sign(wheelAccum)) wheelAccum = 0;
    wheelAccum += delta;
    if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
    wheelAccum = 0;
    wheelLock = now;
    walk(delta > 0 ? 1 : -1);
  }, { passive: false });

  /* The open page scrolls only when there is something below the fold. Scrolled
     by hand and eased, never with `scroll-behavior: smooth` — reading
     `scrollTop` back mid-animation is how a wall stops scrolling. */
  let scrollTarget = 0;
  let scrollRaf = 0;
  /* scrollTop is kept in whole pixels, so a step under a pixel moves nothing and
     the loop would spin a few pixels short of the target for ever (found on the
     Project Week wall, which uses the same ease). Inside a pixel it lands; a
     step under a pixel is made a pixel. */
  function scrollFrame() {
    scrollRaf = 0;
    const cur = detail.scrollTop;
    const left = scrollTarget - cur;
    if (Math.abs(left) < 1) { detail.scrollTop = scrollTarget; return; }
    const step = left * 0.22;
    detail.scrollTop = cur + (Math.abs(step) < 1 ? Math.sign(step) : step);
    scrollRaf = requestAnimationFrame(scrollFrame);
  }
  detail.addEventListener('wheel', (event) => {
    event.preventDefault();
    if (!detail.classList.contains('has-photos')) return;
    const max = detail.scrollHeight - detail.clientHeight;
    scrollTarget = Math.max(0, Math.min(scrollTarget + event.deltaY, max));
    if (!scrollRaf) scrollRaf = requestAnimationFrame(scrollFrame);
  }, { passive: false });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); event.preventDefault(); closeDetail(); return; }
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    /* Stopped as well as prevented: presenting binds the arrows to the whole
       deck, so without this an arrow pressed here walks the shelf *and* leaves
       the slide. */
    event.stopPropagation();
    event.preventDefault();
    walk(forward ? 1 : -1);
  });

  place();
  requestAnimationFrame(() => { place(); kick(); });
  return root;
}
