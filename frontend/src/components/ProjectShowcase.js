import { h } from '../utils/dom.js';
import { upload } from '../utils/media.js';
import { toastSuccess, toastError } from './Toast.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * Torii Minds — Project Showcase.
 *
 * A port of the page the user supplied, kept as close to the original as a
 * component in this deck can be: the same markup, the same class names, the
 * same geometry, the same timings. A 1920x1080 canvas cover-fitted into the
 * slide; the brand mark and the project title behind a desk rig whose monitor
 * is put in perspective by one `matrix3d`; the projects as paper "files" on the
 * left that open one at a time and drop the rest into a dock.
 *
 * Four things had to change, and only these:
 *
 *   1. **The root's class.** The original is `.hero`, which is this deck's
 *      full-bleed hero block; every other class name is kept, and the whole
 *      stylesheet is scoped under `.ps-root` instead. The supplied CSS also set
 *      `--ink`, `--line`, `--card`, `--font`, `--mono` and `--orange` on
 *      `:root`, which are the deck's own variables — they live on `.ps-root`
 *      now, so the rest of the deck is untouched. The keyframes are prefixed
 *      for the same reason: `@keyframes` names are global.
 *   2. **No web fonts.** There is no internet at presentation time, so the
 *      Google Fonts link is gone. The families are still named first in the
 *      stack and fall through to the system faces the original already listed.
 *   3. **The arrow keys are stopped, not only prevented.** Presenting binds the
 *      arrows to the whole deck, so the original's `document` listener would
 *      have walked the projects *and* left the slide. It is bound to the root,
 *      which takes focus.
 *   4. **Open website.** A project may carry a `site`; the button added to the
 *      opened file's header swaps the monitor from its film to that site in an
 *      iframe — inside the same screen, under the same perspective transform,
 *      and live, so it can be driven from there. Pressing it again returns to
 *      the film. A project may also carry demo `logins`; each is a chip that
 *      copies its username or its password to the clipboard. The values are
 *      never drawn — `Platforms.js` set that rule and it holds here: a password
 *      on a three-metre screen is a password given away.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  return el;
};

/** Put a value on the clipboard and nowhere else. */
async function copy(value, label) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      /* execCommand is deprecated and is still the only route without a secure
         context — a deck is sometimes served over plain http on a LAN. */
      const scratch = document.createElement('textarea');
      scratch.value = value;
      scratch.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(scratch);
      scratch.select();
      document.execCommand('copy');
      scratch.remove();
    }
    toastSuccess(`${label} copied`);
  } catch {
    toastError(`Could not copy the ${label.toLowerCase()}`);
  }
}

/* The viewport a site is laid out for inside the monitor — a laptop's — before
   being scaled down into the screen. 1280 rather than 1440 (2026-09-17): still
   every site's desktop layout, and 12% fewer CSS pixels squeezed into the same
   screen, so its type is 12% larger. With the rig's own 23% that is about 39%
   larger than it was. */
const SITE_VIEWPORT_W = 1280;

/* The canvas the whole thing is drawn on, and the grid of files on it. */
const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GRID = { x: 96, y: 190, w: 200, h: 250, gapX: 28, gapY: 28, cols: 3 };
/* Where the dock rests, and how tall it is, in canvas pixels. */
const DOCK_TOP = 934;
const DOCK_H = 40;

export function ProjectShowcase(block = {}) {
  const projects = (block.projects || []).filter((p) => p && p.name);
  const root = h('section', { class: 'ps-root', tabindex: '0', 'aria-label': block.brand || 'Project showcase' });
  if (!projects.length) return root;

  const DEFAULT_TITLE = block.defaultTitle || block.brand || 'Torii Minds';
  const base = String(block.base || '').replace(/^\/+|\/+$/g, '');
  const urlOf = (src) => {
    const s = String(src || '');
    if (!s) return '';
    // An absolute URL is the user's own; anything else is a file in the library.
    if (/^(https?:)?\/\//i.test(s) || s.startsWith('/')) return s;
    return upload(base ? `${base}/${s}` : s);
  };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

  // ---------------------------------------------------------------- markup
  const canvas = h('div', { class: 'canvas' });
  /* The deck bar's clearance, measured rather than read. `--deck-bar-clear` is
     a `calc()`, and a custom property holding a calc() reads back as its
     unresolved token string — `parseFloat` on it is NaN. Given to a real
     property on a probe, the browser resolves it and `offsetHeight` is the
     answer, in the slide's own pixels. */
  const probe = h('div', { class: 'ps-probe', 'aria-hidden': 'true' });
  root.append(probe, canvas);

  /* The mark: the organization's own artwork when the block carries one, else
     the gate the stylesheet draws with borders. The drawn one is a fair likeness
     and it is not the logo — the real file went in on request (2026-09-17). */
  canvas.append(h('div', { class: 'brand' },
    block.logo
      ? h('img', { class: 'brand__mark', src: urlOf(block.logo), alt: '', decoding: 'async' })
      : h('i', { 'aria-hidden': 'true' }),
    h('span', { text: block.brand || 'Torii Minds' })));

  const title = h('h1', { class: 'title', 'aria-live': 'polite' });
  canvas.append(title);

  /* The rig, exactly as supplied: the desk panel, the neck and plate, and the
     monitor whose perspective is one matrix3d. */
  const media = h('div', { class: 'media' });
  const nmK = h('div', { class: 'k' });
  const nmH = h('div', { class: 'h' });
  const stEmpty = h('div', { class: 'state' },
    h('div', { class: 'orb' }),
    h('div', {},
      h('div', { class: 'k', text: `${block.brand || 'Torii Minds'} · Showcase` }),
      h('div', { class: 'h' }, h('span', { class: 'arrow' }), 'Select a project'),
      h('div', { class: 'sub', text: 'Open a file on the left to preview it here' }),
      h('div', { class: 'bar' })));
  const stNoMedia = h('div', { class: 'state' },
    h('div', { class: 'orb' }),
    h('div', {}, nmK, nmH,
      h('div', { class: 'sub', text: 'Demo is being prepared' }),
      h('div', { class: 'bar' })));
  const screen = h('div', { class: 'screen' }, media, stEmpty, stNoMedia);

  canvas.append(h('div', { class: 'rig', 'aria-hidden': 'true' },
    h('div', { class: 'desk' }, h('div', { class: 'panel' })),
    h('div', { class: 'display' },
      h('div', { class: 'neck' }),
      h('div', { class: 'plate' }),
      h('div', { class: 'monitor' }, screen))));

  const count = h('span', {});
  const hName = h('div', { class: 'name' });
  const hTag = h('div', { class: 'tag' });
  const closeBtn = h('button', { class: 'close', type: 'button' }, 'Back to All Projects');
  /* On request (2026-09-18): a presenter walks the products in order, and
     having to go back to the list between each one is a press nobody needs. */
  const nextBtn = h('button', { class: 'nextp', type: 'button' }, 'Next Project');
  /* The way into the site itself. Hidden until a project that has one is open. */
  const siteBtn = h('button', { class: 'site', type: 'button' },
    h('span', { class: 'site__label', text: 'Open Website' }),
    h('span', { class: 'site__mark', 'aria-hidden': 'true', text: '↗' }));
  /* THE OPENED PROJECT IS ITS MARK AND THREE BUTTONS, nothing else
     (2026-09-18, on request). The eyebrow, the name and the tag are built and
     kept because `renderDetail` and the monitor's title swap both read them,
     and because a project whose mark is missing falls back to its name — they
     are simply not drawn in the sheet. Everything that used to fill it — the
     description, the features, the stack, the links and the demo logins — is
     gone from the view; the logins are still on the block and still never
     printed, which was always the rule. */
  const head = h('div', { class: 'head' },
    h('div', { class: 'head__actions' }, closeBtn, nextBtn, siteBtn));
  const detail = h('div', { class: 'detail' });
  const dockStack = h('span', { class: 'stack' });
  const dockText = h('span', {});
  const chev = svgEl('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  chev.append(svgEl('path', { d: 'm6 15 6-6 6 6' }));
  const dock = h('button', { class: 'dock', type: 'button', 'aria-expanded': 'false' }, dockStack, dockText, chev);
  const files = h('div', { class: 'files' },
    h('div', { class: 'list-head' }, h('span', { text: 'Projects' }), count),
    head, detail,
    h('div', { class: 'dock-label', text: 'Other projects' }),
    dock);
  canvas.append(files);

  // ----------------------------------------------------------------- state
  let active = -1;
  let dockOpen = false;
  let swapping = false;
  let onSite = false;

  /* Cover-fit the 1920x1080 canvas into whatever the slide gives us — 1600x860
     on the admin canvas, 1600 x --slide-h in the room. */
  function fit() {
    const w = root.clientWidth;
    const hh = root.clientHeight;
    if (!w || !hh) return;
    const s = Math.max(w / CANVAS_W, hh / CANVAS_H);
    canvas.style.setProperty('--s', s.toFixed(5));
    canvas.style.setProperty('--ox', `${((w - CANVAS_W * s) / 2).toFixed(2)}px`);
    canvas.style.setProperty('--oy', `${((hh - CANVAS_H * s) / 2).toFixed(2)}px`);
    /* The dock is the one control at the floor of the canvas, and presenting
       floats the deck bar over exactly that band. `--deck-bar-clear` is in the
       slide's nominal pixels and the canvas is scaled by `s` on top of that, so
       the bar is `clear / s` canvas pixels tall — the dock is lifted only by as
       much of that as it actually needs. */
    const clear = probe.offsetHeight || 0;
    const floor = CANVAS_H - clear / s - DOCK_H - 16;
    canvas.style.setProperty('--ps-dock-top', `${Math.round(Math.min(DOCK_TOP, floor))}px`);
  }
  const ro = new ResizeObserver(fit);
  ro.observe(root);
  fit();

  // ----------------------------------------------------------------- title
  function setTitleText(text) {
    title.innerHTML = '';
    title.setAttribute('aria-label', text);
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = `ch${c === ' ' ? ' space' : ''}`;
      s.textContent = c === ' ' ? ' ' : c;
      s.style.animationDelay = reduced ? '0ms' : `${i * 22}ms`;
      title.appendChild(s);
    });
    title.style.fontSize = '300px';
    const avail = CANVAS_W - 770 - 40;
    const w = title.scrollWidth;
    if (w > avail) title.style.fontSize = `${Math.max(150, Math.floor((300 * avail) / w))}px`;
  }
  function swapTitle(text) {
    if (swapping) return;
    swapping = true;
    title.classList.remove('swap-in');
    title.classList.add('swap-out');
    setTimeout(() => {
      setTitleText(text);
      title.classList.remove('swap-out');
      title.classList.add('swap-in');
      setTimeout(() => { swapping = false; }, 700);
    }, reduced ? 0 : 340);
  }
  setTitleText(DEFAULT_TITLE);
  requestAnimationFrame(() => title.classList.add('in'));

  // ---------------------------------------------------------------- screen
  function showState(el) {
    [stEmpty, stNoMedia].forEach((s) => s.classList.toggle('show', s === el));
  }
  /** The film, or the state card when a project has no film yet. */
  function setMedia(p) {
    onSite = false;
    root.classList.remove('on-site');
    siteBtn.querySelector('.site__label').textContent = 'Open Website';
    media.classList.remove('show');
    setTimeout(() => {
      media.innerHTML = '';
      media.classList.toggle('media--video', !!(p && p.media && p.media.src && p.media.type === 'video'));
      if (p && p.media && p.media.src) {
        let el;
        if (p.media.type === 'video') {
          el = document.createElement('video');
          el.src = urlOf(p.media.src);
          el.autoplay = true;
          el.muted = true;
          el.loop = true;
          el.playsInline = true;
          // Autoplay only sticks when the element is muted before it loads.
          el.setAttribute('muted', '');
        } else {
          el = document.createElement('img');
          el.src = urlOf(p.media.src);
          el.alt = `${p.name} preview`;
        }
        media.appendChild(el);
        requestAnimationFrame(() => media.classList.add('show'));
        showState(null);
      } else if (p) {
        nmH.textContent = p.name;
        nmK.textContent = p.tag || 'Preview';
        showState(stNoMedia);
      } else {
        showState(stEmpty);
      }
    }, 250);
  }
  /** The site itself, in the same screen and under the same perspective. */
  function setSite(p) {
    onSite = true;
    root.classList.add('on-site');
    siteBtn.querySelector('.site__label').textContent = 'Back to preview';
    media.classList.remove('show');
    setTimeout(() => {
      media.innerHTML = '';
      media.classList.remove('media--video');
      const frame = document.createElement('iframe');
      frame.src = urlOf(p.site);
      frame.title = `${p.name} — live`;
      /* Laid out at a laptop's width and scaled to the screen: the site then
         shows its desktop layout, at the size it has on a desk, not its narrow
         breakpoint magnified. The screen's own box is measured rather than
         assumed, because the monitor's padding takes a few pixels of it. */
      const sw = screen.clientWidth || 503;
      const sh = screen.clientHeight || 338;
      frame.style.width = `${SITE_VIEWPORT_W}px`;
      frame.style.height = `${Math.round(SITE_VIEWPORT_W * (sh / sw))}px`;
      frame.style.transform = `scale(${(sw / SITE_VIEWPORT_W).toFixed(5)})`;
      /* The point of this button is that the site can be driven from the
         screen, so nothing here blocks the pointer. */
      frame.setAttribute('loading', 'eager');
      media.appendChild(frame);
      requestAnimationFrame(() => media.classList.add('show'));
      showState(null);
    }, 250);
  }

  // ----------------------------------------------------------------- files
  const nodes = projects.map((p, i) => {
    const f = h('div', { class: 'file', role: 'button', tabindex: '0', 'aria-label': p.name });
    const logo = p.logo
      ? `<img src="${urlOf(p.logo)}" alt="">`
      : p.name.trim()[0].toUpperCase();
    /* `has-art` turns the orange initial-disc into a white plate the wordmark
       sits on whole — see the stylesheet. The disc stays for a project with no
       logo, so the two never look like one of them is broken. */
    /* A MARK AND A NAME, AND NOTHING ELSE (2026-09-18, on request). The card
       used to carry its number, a one-line description and a vertical "Project"
       label down its edge. At the size a card is on this shelf none of the
       three could be read from a room, and the two that could be were the only
       two worth reading. */
    f.innerHTML = `<div class="file-inner" style="--d:${i * 90}ms">
        <div class="logo${p.logo ? ' has-art' : ''}">${logo}</div>
        <div class="meta"><span class="name"></span></div>
      </div>`;
    // Set by hand rather than interpolated: a project's name is content.
    f.querySelector('.meta .name').textContent = p.name;
    f.addEventListener('click', () => onFile(i));
    f.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onFile(i); }
    });
    files.appendChild(f);
    return f;
  });
  count.textContent = String(projects.length).padStart(2, '0');
  dockStack.innerHTML = projects.slice(0, 4).map(() => '<i></i>').join('');

  // ---------------------------------------------------------------- layout
  const place = (f, x, y, s, r) => {
    f.style.transform = `translate(${x}px,${y}px) scale(${s}) rotate(${r || 0}deg)`;
  };
  function layout() {
    const others = projects.map((_, i) => i).filter((i) => i !== active);
    const rows = Math.ceil(projects.length / GRID.cols);
    const gs = Math.min(1, (890 - GRID.y) / (rows * (GRID.h + GRID.gapY)));
    nodes.forEach((f, i) => {
      f.classList.toggle('selected', i === active);
      f.classList.toggle('mini', active >= 0 && i !== active);
      f.style.zIndex = i === active ? 6 : 5;
      if (active < 0) {
        const c = i % GRID.cols;
        const r = Math.floor(i / GRID.cols);
        place(f, GRID.x + c * (GRID.w + GRID.gapX) * gs, GRID.y + r * (GRID.h + GRID.gapY) * gs, gs, 0);
        f.style.opacity = 1;
        return;
      }
      if (i === active) {
        /* The open project's own card is NOT drawn (2026-09-18, on request:
           "after opening the project I can still see the file in the top
           left"). It is still placed, because coming back out is a transition
           from this rectangle to the grid; it is only invisible. Hidden here
           rather than in the stylesheet because the grid branch writes
           `opacity` inline, and an inline style beats any rule without
           `!important` — two places saying the same thing, with one of them
           losing, is the bug this replaces. */
        place(f, 96, 150, 0.5, 0);
        f.style.opacity = 0;
        return;
      }
      const k = others.indexOf(i);
      if (dockOpen) { place(f, 96 + k * 126, 740, 0.55, 0); f.style.opacity = 1; }
      else { place(f, 96 + k * 7, 940 - 2 * k, 0.11, -6 + k * 3); f.style.opacity = 0; }
    });
    root.classList.toggle('has-selection', active >= 0);
    root.classList.toggle('dock-open', dockOpen && active >= 0);
    dock.setAttribute('aria-expanded', dockOpen ? 'true' : 'false');
    dockText.textContent = dockOpen ? 'Hide' : `All projects · ${String(projects.length).padStart(2, '0')}`;
  }

  function renderDetail(p) {
    /* One mark, as large as the sheet allows. A project with no file of its own
       is set in its own name instead — the deck's standing fallback, and the
       reason the name is still carried here: AI Anchor has no logo, and a blank
       sheet would say less than a word. */
    detail.replaceChildren(
      p.logo
        ? h('img', { class: 'mark', src: urlOf(p.logo), alt: p.name, decoding: 'async' })
        : h('span', { class: 'mark mark--type', text: p.name }),
      /* The name under the mark (2026-09-18, on request). Not drawn for a
         product with no file of its own, whose mark IS its name set large —
         printing it twice would read as a mistake. */
      p.logo ? h('span', { class: 'mark-name', text: p.name }) : null,
    );
    hName.textContent = p.name;
    hTag.textContent = p.tag || '';
    siteBtn.hidden = !p.site;
  }

  function select(i) {
    const p = projects[i];
    detail.classList.remove('show');
    setTimeout(() => { renderDetail(p); detail.classList.add('show'); }, active >= 0 ? 220 : 60);
    active = i;
    dockOpen = false;
    layout();
    swapTitle(p.name);
    setMedia(p);
  }
  function clear() {
    active = -1;
    dockOpen = false;
    detail.classList.remove('show');
    layout();
    swapTitle(DEFAULT_TITLE);
    setMedia(null);
  }
  function onFile(i) {
    if (active < 0) select(i);
    else if (i === active) clear();
    else if (dockOpen) select(i);
    else { dockOpen = true; layout(); }
  }

  /* The arrows are bound to the root, so the root has to be the thing holding
     focus — a press anywhere on the slide arms them. A click inside the site's
     iframe does not reach here, so driving the site never steals its focus. */
  root.addEventListener('pointerdown', () => root.focus({ preventScroll: true }));

  nextBtn.addEventListener('click', () => {
    /* Wraps, so the last project leads back to the first rather than to a dead
       button at the end of the shelf. */
    select(active < 0 ? 0 : (active + 1) % projects.length);
  });
  dock.addEventListener('click', () => { dockOpen = !dockOpen; layout(); });
  closeBtn.addEventListener('click', clear);
  siteBtn.addEventListener('click', () => {
    const p = projects[active];
    if (!p || !p.site) return;
    if (onSite) setMedia(p); else setSite(p);
  });

  /* Bound to the root and stopped, never to the document: presenting binds the
     arrows to the whole deck. */
  root.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Escape') {
      if (dockOpen) { dockOpen = false; layout(); }
      else if (active >= 0) clear();
      else return;
      e.stopPropagation(); e.preventDefault();
      return;
    }
    /* The arrows are not handled here (2026-09-18) — see the stepper below.
       They used to wrap round the files for ever, which meant the forward key
       could never leave this tab, and they doubled up and down onto the same
       job the deck now uses to change tab. */
  });

  /* Left and right walk the files; the deck turns the tab once there is no
     further to go. Not wrapped any more: a run that comes back to where it
     started has no end for the deck to spill out of. Nothing is selected when
     the slide arrives, so the first forward press opens the first file. */
  registerStepper((delta) => {
    const next = active < 0 ? (delta > 0 ? 0 : projects.length - 1) : active + delta;
    if (next < 0 || next >= projects.length) return false;
    select(next);
    return true;
  });

  layout();
  setTimeout(() => showState(stEmpty), reduced ? 0 : 1700);

  /* The router rebuilds the page on every navigation; stop observing when this
     copy leaves the document. */
  const mo = new MutationObserver(() => {
    if (!root.isConnected) { ro.disconnect(); mo.disconnect(); }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  return root;
}
