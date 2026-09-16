/**
 * One tooltip for the whole product.
 *
 * The native `title` box is a grey OS rectangle in the system font, it ignores the
 * brand, and it waits about a second before appearing. There are seventy-odd of them
 * across the components, so rather than rewriting every call site this adopts them:
 * on the first hover the `title` is moved to `data-tip` and the styled tip takes over.
 * Anything that already carries `data-tip` is used directly.
 *
 * A single node parented to `<body>`, not a `::after` on each element:
 *
 *  - Pseudo-elements do not render on replaced elements, so `img`, `input` and `svg`
 *    could never have had one.
 *  - Half the controls here live inside `overflow: auto` panes — the section list, the
 *    rail — and a tip parented to the button is clipped by them.
 *  - `FitSlide` scales the deck with a transform, which makes it the containing block
 *    for anything positioned inside it; a tip on a slide control would be scaled with
 *    the slide and land in the wrong place.
 *
 * Position is measured per hover and flips above or below depending on the room, so it
 * works in the top bar (where there is nothing above) and on a slide alike.
 */
const SIDE_GAP = 10;
const EDGE = 8;

/* Elements that can host a tip. A `title` on an image is a caption, not a control, and
   converting it would swallow the browser's own behaviour for no gain. */
const HOSTS = 'button, a, [role="button"], label, summary, .snav-release, .nav-tree__parent';

let tip = null;
let current = null;

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

function node() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tipx';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}

/** Moves a native `title` across the first time we see the element. */
function label(el) {
  const own = el.getAttribute('data-tip');
  if (own) return own;
  const native = el.getAttribute('title');
  if (!native) return null;
  el.setAttribute('data-tip', native);
  // Keep the accessible name, then drop `title` so the OS box cannot also appear.
  if (!el.getAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', native);
  el.removeAttribute('title');
  return native;
}

function show(el) {
  const text = label(el);
  if (!text) return;
  current = el;
  const t = node();
  t.textContent = text;
  t.hidden = false;
  t.classList.remove('is-on');

  // Measured after the text is in, so the width is the real one.
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;

  /* Above by preference — that is where the supplied design puts it — and below when
     there is not room, which is the case for everything in the top bar. */
  const above = r.top - h - SIDE_GAP >= EDGE;
  const top = above ? r.top - h - SIDE_GAP : r.bottom + SIDE_GAP;

  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));

  t.dataset.side = above ? 'top' : 'bottom';
  t.style.top = `${Math.round(top)}px`;
  t.style.left = `${Math.round(left)}px`;
  /* The caret follows the element rather than the pill: when the pill has been pushed
     off centre to stay on screen, a centred caret would point at nothing. */
  const caret = Math.max(12, Math.min(r.left + r.width / 2 - left, w - 12));
  t.style.setProperty('--tip-caret', `${Math.round(caret)}px`);

  // One frame, so the class change animates instead of applying instantly.
  requestAnimationFrame(() => t.classList.add('is-on'));
}

function hide() {
  current = null;
  if (!tip) return;
  tip.classList.remove('is-on');
  // Long enough for the fade; harmless if another hover arrives first.
  window.setTimeout(() => {
    if (!tip.classList.contains('is-on')) tip.hidden = true;
  }, reduced.matches ? 0 : 160);
}

/** Call once at start-up. Safe to call again; it only ever installs one set. */
export function installTooltips() {
  if (document.documentElement.dataset.tips === 'on') return;
  document.documentElement.dataset.tips = 'on';

  const host = (event) => {
    const el = event.target instanceof Element ? event.target.closest(HOSTS) : null;
    if (!el) return null;
    return el.hasAttribute('data-tip') || el.hasAttribute('title') ? el : null;
  };

  document.addEventListener('pointerover', (event) => {
    const el = host(event);
    if (!el || el === current) return;
    show(el);
  });

  document.addEventListener('pointerout', (event) => {
    if (!current) return;
    const to = event.relatedTarget;
    if (to instanceof Element && current.contains(to)) return;
    hide();
  });

  // Keyboard users get the same label, and a click should not leave it hanging.
  document.addEventListener('focusin', (event) => {
    const el = event.target instanceof Element ? event.target.closest(HOSTS) : null;
    if (el && (el.hasAttribute('data-tip') || el.hasAttribute('title'))) show(el);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  /* The router replaces the DOM on every navigation, which can leave the tip pointing
     at an element that no longer exists. */
  document.addEventListener('click', hide);
}
