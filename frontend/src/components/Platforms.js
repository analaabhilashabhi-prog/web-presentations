import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { media as mediaUrl } from '../utils/media.js';
import { toastSuccess, toastError } from './Toast.js';
import { dockMagnify } from '../utils/dock.js';
import { videoControls } from '../utils/videoControls.js';

/**
 * The platform wall: a rotating 3D stack of browser windows, and opening one
 * runs the real product inside the slide.
 *
 * The swap is the React Bits CardSwap motion rebuilt on CSS transforms. GSAP is
 * not an option here — the deck ships with zero runtime dependencies and is
 * presented with no internet — so the timeline is reproduced with transitions
 * and scheduled steps: the front window drops away, the rest promote forward,
 * and the dropped one swings back onto the tail of the stack.
 *
 * Credentials are never printed. A presenter is standing in front of a room
 * with a projector, and a password on a 3-metre screen is a password given
 * away. The stage exposes only what each login *is* — "Admin", "Super Admin" —
 * behind copy buttons that put the value on the clipboard and nowhere else.
 *
 * What this still cannot do is fill the login form for you. The browser forbids
 * a page from touching the DOM of a frame on another origin, and every platform
 * here is another origin. No setting changes that; it is the rule that stops
 * any site reading your bank's login form.
 */

/* Media lives at /uploads/platforms/<shot>.<ext>, served straight from
   backend/uploads. A screen recording is tried first and a still second; a
   platform with neither is not broken, it falls back to a designed panel, so
   the section works before the files arrive. */
const SHOT_DIR = '/uploads/platforms';
const VIDEO_EXT = ['mp4', 'webm'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp'];

const slugOf = (o) => (o.shot || o.item?.name || o.name || '')
  .toString().toLowerCase().trim()
  .replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const hostOf = (url) => String(url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)');

async function copy(value, label) {
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
    else {
      // execCommand is deprecated but is the only route without a secure
      // context, and a deck is sometimes served over plain http on a LAN.
      const scratch = h('textarea', { style: { position: 'fixed', opacity: '0' } }, value);
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

/**
 * The media for one window: a screen recording if there is one, a still if
 * there is not, and nothing at all rather than a broken-image glyph on a
 * projector.
 *
 * Only the window at the front of the stack ever plays. Five recordings
 * running at once is 33MB of video decoding behind cards nobody can read, and
 * on the hosted copy it is 33MB downloaded before the slide settles — so each
 * one loads the first time it reaches the front and pauses when it leaves.
 */
function shotMedia(item, mount, onMissing) {
  const slug = slugOf(item);
  if (!slug) { onMissing(); return { play() {}, pause() {} }; }

  const still = () => {
    let at = 0;
    const img = h('img', {
      class: 'pf-win__img', alt: '', loading: 'lazy', decoding: 'async',
      src: mediaUrl(`${SHOT_DIR}/${slug}.${IMAGE_EXT[0]}`),
    });
    img.addEventListener('error', () => {
      at += 1;
      if (at < IMAGE_EXT.length) img.src = mediaUrl(`${SHOT_DIR}/${slug}.${IMAGE_EXT[at]}`);
      else { img.remove(); onMissing(); }
    });
    mount.appendChild(img);
  };

  const video = h('video', {
    class: 'pf-win__img pf-win__video',
    // 'metadata', not 'none': it costs a few KB per file and settles whether
    // the recording exists at load time. With 'none' a missing file only fails
    // when its window reaches the front, so the fallback appears on screen
    // mid-rotation instead of never being seen at all.
    muted: true, loop: true, playsinline: true, preload: 'metadata',
    tabindex: '-1', 'aria-hidden': 'true',
  }, ...VIDEO_EXT.map((ext) => h('source', {
    src: mediaUrl(`${SHOT_DIR}/${slug}.${ext}`), type: `video/${ext}`,
  })));
  video.muted = true; // The attribute alone does not satisfy autoplay policy.

  let usable = true;
  /* The bar belongs to the recording, so a file that fails takes its controls
     with it rather than leaving buttons hovering over a still image. */
  const bar = videoControls(video);
  video.addEventListener('error', () => {
    usable = false; video.remove(); bar?.remove(); still();
  }, true);
  mount.appendChild(video);
  if (bar) mount.appendChild(bar);

  return {
    play() {
      if (!usable) return;
      const go = video.play();
      if (go?.catch) go.catch(() => { /* autoplay refused: the poster frame stands in */ });
    },
    pause() { if (usable) video.pause(); },
  };
}

/* ------------------------------------------------------------------ a window */

/**
 * The views of one platform. Most have a single face; TAG and the AI Ready
 * Engineer LMS have two, because the people who sign in through the portal and
 * the people who sign in through /admin are different people looking at a
 * different product.
 */
function viewsOf(item) {
  if (item.views?.length) {
    return item.views.map((v) => ({
      label: v.label || '',
      url: v.url,
      shot: v.shot || item.shot,
      logins: v.logins?.length ? v.logins : [],
      item,
    }));
  }
  return [{ label: '', url: item.url, shot: item.shot, logins: item.logins || [], item }];
}

function platformWindow(pane, index) {
  const { item, label } = pane;
  const shell = h('div', { class: 'pf-win__shell' });
  const fallback = () => shell.appendChild(h('div', { class: 'pf-win__blank' },
    h('span', { class: 'pf-win__mark' }, icon(item.icon || 'grid-4', { class: 'ic' })),
    h('span', { class: 'pf-win__blankname' }, item.name),
    item.blurb ? h('span', { class: 'pf-win__blankblurb' }, item.blurb) : null,
  ));
  const media = shotMedia(pane, shell, fallback);

  const el = h('button', {
    class: 'pf-win',
    type: 'button',
    'data-index': String(index),
    title: `Open ${item.name}${label ? ` — ${label}` : ''}`,
  },
    h('span', { class: 'pf-win__bar' },
      h('span', { class: 'pf-win__dots' },
        h('i', {}), h('i', {}), h('i', {})),
      // The view is named once, in the foot. Repeating it here put a solid
      // accent pill on every window in the fan and the stack read as blobs.
      h('span', { class: 'pf-win__host' }, hostOf(pane.url)),
    ),
    shell,
    h('span', { class: 'pf-win__foot' },
      h('span', { class: 'pf-win__name' }, item.name),
      label ? h('span', { class: 'pf-win__sub' }, label) : null,
      h('span', { class: 'pf-win__open' }, 'Open', icon('arrow-up-right', { class: 'ic ic--xs' })),
    ),
  );
  el.media = media;
  return el;
}

/* ------------------------------------------------------------- the card swap */

/**
 * Positions for a stack of `total` cards. Index 0 is the front; each one behind
 * steps right, up and away, so the whole stack reads as a fanned deck.
 */
const slotFor = (i, total, dx, dy) => ({
  x: i * dx,
  y: -i * dy,
  z: -i * dx * 0.5,
  zIndex: total - i,
});

/* The step shrinks as the deck grows: seven windows at a five-window step runs
   the tail of the stack off the top of the slide. Rise and distance are close
   together on purpose — the windows behind should show along the top edge just
   as much as they do down the right. */
const stepFor = (n) => (n >= 7 ? { distance: 30, rise: 36 } : { distance: 46, rise: 46 });

/* A rotation about the vertical axis, not a shear. skewY drags one side of the
   card down and the horizontal edges run diagonally across the slide; rotateY
   turns the window like a door, so its vertical edges stay upright and only
   perspective narrows the far side. */
function cardSwap(cards, { tilt = -9, delay = 4200 } = {}) {
  const { distance, rise } = stepFor(cards.length);
  const total = cards.length;
  const order = cards.map((_, i) => i);
  let timer = null;
  let steps = [];

  /* The stack grows right and up from its front card, so its bounding box is
     not centred on the deck origin. Shifting every slot by half the total run
     puts the *stack* in the middle of its column rather than the front card —
     which is what left a wedge of empty slide under the tail. Derived from the
     step, so it stays correct if the number of windows changes. */
  const originX = ((total - 1) * distance) / 2;
  const originY = ((total - 1) * rise) / 2;

  const place = (el, slot, dropped = false) => {
    el.style.zIndex = String(slot.zIndex);
    el.style.transform = `translate(-50%, -50%) translate3d(${slot.x - originX}px, ${
      (dropped ? slot.y + 460 : slot.y) + originY}px, ${slot.z}px) rotateY(${tilt}deg)`;
    el.style.opacity = dropped ? '0.15' : '1';
  };

  const settle = () => order.forEach((idx, i) => {
    cards[idx].style.transition = 'transform .85s cubic-bezier(.22,1,.36,1), opacity .5s ease';
    place(cards[idx], slotFor(i, total, distance, rise));
  });

  const clearSteps = () => { steps.forEach(clearTimeout); steps = []; };

  /* Only the readable window plays; the rest are pinned frames behind it. */
  const promoteMedia = () => cards.forEach((el, i) => {
    if (i === order[0]) el.media?.play();
    else el.media?.pause();
  });

  const pauseAll = () => cards.forEach((el) => el.media?.pause());

  const swap = () => {
    if (total < 2) return;
    clearSteps();
    /* The window that is about to fall is the one that was playing. Decoding
       video through a 460px drop is the single most expensive frame in the
       cycle; the new front picks playback up at the promote step instead. */
    pauseAll();
    const front = order[0];
    const rest = order.slice(1);
    const frontEl = cards[front];
    const backSlot = slotFor(total - 1, total, distance, rise);

    // 1. the front window falls away
    frontEl.style.transition = 'transform .62s cubic-bezier(.55,.06,.68,.19), opacity .62s ease';
    place(frontEl, slotFor(0, total, distance, rise), true);

    // 2. the stack promotes forward, each a beat after the one in front
    steps.push(setTimeout(() => {
      promoteMedia();
      rest.forEach((idx, i) => {
        const el = cards[idx];
        const slot = slotFor(i, total, distance, rise);
        el.style.zIndex = String(slot.zIndex);
        el.style.transitionDelay = `${i * 70}ms`;
        el.style.transition = 'transform .8s cubic-bezier(.22,1,.36,1), opacity .4s ease';
        place(el, slot);
        setTimeout(() => { el.style.transitionDelay = '0ms'; }, 900);
      });
    }, 260));

    // 3. the fallen window swings back onto the tail
    steps.push(setTimeout(() => {
      frontEl.style.zIndex = String(backSlot.zIndex);
      frontEl.style.transition = 'transform .85s cubic-bezier(.22,1,.36,1), opacity .5s ease';
      place(frontEl, backSlot);
    }, 430));

    order.push(order.shift());
  };

  /** Bring a specific card to the front — a presenter jumping to a platform. */
  const focus = (index) => {
    const at = order.indexOf(index);
    if (at <= 0) return;
    clearSteps();
    order.splice(at, 1);
    order.unshift(index);
    settle();
    promoteMedia();
  };

  const stop = () => { clearInterval(timer); timer = null; clearSteps(); };
  const start = () => {
    stop();
    promoteMedia();
    if (REDUCED?.matches) return;
    timer = setInterval(swap, delay);
  };

  /**
   * Entrance: the windows fly in one at a time from off the bottom-right and
   * settle into the fan, deepest first, so the stack visibly builds towards
   * the viewer and the front window is the last thing to land.
   *
   * Nothing plays and nothing rotates until the last one is home. Decoding
   * video while seven cards are still moving is exactly the moment the frame
   * budget is thinnest, and it is what made the recordings stutter.
   */
  const STAGGER = 230;
  const ENTER_MS = 900;

  const enter = () => {
    cards.forEach((el, i) => {
      const slot = slotFor(i, total, distance, rise);
      el.style.transition = 'none';
      el.style.zIndex = String(slot.zIndex);
      el.style.opacity = '0';
      // Parked off the bottom-right corner and further away, so the arc into
      // place reads as the window flying up onto the deck.
      el.style.transform = `translate(-50%, -50%) translate3d(${slot.x - originX + 720}px, ${slot.y + originY + 560}px, ${slot.z - 420}px) rotateY(${tilt}deg)`;
    });

    // Deepest card first: index total-1 back to 0.
    cards.forEach((el, i) => {
      const slot = slotFor(i, total, distance, rise);
      const step = (total - 1 - i);
      setTimeout(() => requestAnimationFrame(() => {
        el.style.transition = `transform ${ENTER_MS}ms cubic-bezier(.16,.84,.34,1), opacity 420ms ease`;
        place(el, slot);
      }), 140 + step * STAGGER);
    });

    return 140 + (total - 1) * STAGGER + ENTER_MS;
  };

  let entering = 0;
  if (REDUCED?.matches) {
    cards.forEach((el, i) => { el.style.transition = 'none'; el.style.opacity = '1'; place(el, slotFor(i, total, distance, rise)); });
  } else {
    entering = enter();
  }

  /** The rotation only begins once the deck has finished assembling itself. */
  const begin = () => {
    if (!entering) { start(); return () => {}; }
    const handle = setTimeout(start, entering + 260);
    return () => clearTimeout(handle);
  };

  return { start, stop, focus, pauseAll, begin, order: () => order[0] };
}

/* ------------------------------------------------------------------- exports */

export function Platforms(block, { editing = false } = {}) {
  const items = (block.items || []).filter((p) => p.name && p.url);
  if (!items.length) {
    return h('div', { class: 'pf-root pf-root--empty ph-root' }, 'No platforms yet.');
  }

  const root = h('div', { class: 'pf-root ph-root' });

  /* ----------------------------------------------------------- the run stage */
  const frameTitle = h('span', { class: 'pf-stage__name' });
  const frameUrl = h('span', { class: 'pf-stage__url' });
  const frame = h('iframe', {
    class: 'pf-stage__frame',
    title: 'Platform',
    // Another origin: this is a window onto it, not a page we script.
    // allow-same-origin is required or its own login cannot set a cookie.
    sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation-by-user-activation',
    referrerpolicy: 'no-referrer-when-downgrade',
  });
  const openOut = h('a', {
    class: 'pf-stage__out', target: '_blank', rel: 'noopener noreferrer',
    title: 'Open in a new tab if the platform refuses to run in a frame',
  }, icon('arrow-up-right', { class: 'ic ic--xs' }), h('span', {}, 'New tab'));

  const keysPanel = h('div', { class: 'pf-keys', hidden: true });
  const keysBtn = h('button', {
    class: 'pf-stage__keys', type: 'button', 'aria-expanded': 'false',
    onclick: () => {
      const open = keysPanel.hasAttribute('hidden');
      keysPanel.toggleAttribute('hidden', !open);
      keysBtn.setAttribute('aria-expanded', String(open));
      keysBtn.classList.toggle('is-on', open);
    },
  }, icon('shield', { class: 'ic ic--xs' }), h('span', {}, 'Show credentials'));

  const goTo = (url) => {
    frame.src = url;
    frameUrl.textContent = hostOf(url);
    openOut.setAttribute('href', url);
  };

  /** One login: what it is, and two buttons — never the value itself. */
  const loginRow = (login, activeUrl) => h('div', { class: 'pf-key' },
    h('div', { class: 'pf-key__top' },
      h('span', { class: 'pf-key__role' }, login.role || 'Login'),
      login.url && login.url !== activeUrl
        ? h('button', {
            class: 'pf-key__jump', type: 'button', title: 'Open this login page',
            onclick: () => goTo(login.url),
          }, 'Go to this login')
        : null,
    ),
    h('div', { class: 'pf-key__acts' },
      h('button', {
        class: 'pf-key__btn', type: 'button',
        onclick: () => copy(login.user, 'Username'),
      }, icon('copy', { class: 'ic ic--xs' }), 'Copy username'),
      h('button', {
        class: 'pf-key__btn', type: 'button',
        onclick: () => copy(login.pass, 'Password'),
      }, icon('copy', { class: 'ic ic--xs' }), 'Copy password'),
    ),
  );

  const close = () => {
    root.classList.remove('is-open');
    frame.removeAttribute('src');
    keysPanel.setAttribute('hidden', '');
    keysBtn.classList.remove('is-on');
    keysBtn.setAttribute('aria-expanded', 'false');
    swap?.start();
  };

  const switcher = h('div', { class: 'pf-switch', hidden: true });

  const stage = h('div', { class: 'pf-stage' },
    h('div', { class: 'pf-stage__bar' },
      h('button', { class: 'pf-stage__back', type: 'button', onclick: close },
        icon('chevron-left', { class: 'ic ic--xs' }), h('span', {}, 'All platforms')),
      h('div', { class: 'pf-stage__id' }, frameTitle, frameUrl),
      switcher,
      h('div', { class: 'pf-stage__tools' }, keysBtn, openOut, keysPanel),
    ),
    h('div', { class: 'pf-stage__body' }, frame),
  );

  const open = (pane) => {
    // Nothing behind the frame should keep decoding video.
    swap?.stop();
    swap?.pauseAll();
    const { item, label } = pane;
    frameTitle.replaceChildren(
      item.name,
      label ? h('em', { class: 'pf-stage__view' }, label) : null,
    );
    keysPanel.setAttribute('hidden', '');
    keysBtn.classList.remove('is-on');
    keysBtn.setAttribute('aria-expanded', 'false');

    /* Sibling views of the same platform, so the portal and the admin sign-in
       are one click apart instead of a trip back to the wall. */
    const siblings = viewsOf(item);
    switcher.replaceChildren(...(siblings.length > 1
      ? siblings.map((v) => h('button', {
          class: `pf-switch__btn${v.url === pane.url ? ' is-on' : ''}`,
          type: 'button',
          onclick: () => { if (v.url !== pane.url) open(v); },
        }, v.label || 'Portal'))
      : []));
    switcher.toggleAttribute('hidden', siblings.length < 2);

    const logins = pane.logins || [];
    keysPanel.replaceChildren(
      h('p', { class: 'pf-keys__head' },
        `${logins.length} login${logins.length === 1 ? '' : 's'} — ${item.name}${label ? ` ${label}` : ''}`),
      ...logins.map((login) => loginRow(login, pane.url)),
      h('p', { class: 'pf-keys__note' },
        'Copy, then paste into the platform’s own form. Nothing is shown on screen.'),
    );
    goTo(pane.url);
    root.classList.add('is-open');
  };

  /* --------------------------------------------------------------- the deck */
  /* One window per view, not per platform — the admin side of TAG is a
     different product to the coordinator's portal and has its own recording. */
  const panes = items.flatMap(viewsOf);

  const cards = panes.map((pane, i) => {
    const card = platformWindow(pane, i);
    card.addEventListener('click', () => open(pane));
    return card;
  });

  const deck = h('div', { class: 'pf-deck' }, ...cards);

  /* Marks only, names on hover — the dock this is modelled on carries no
     standing labels either. Two views of the same product would be
     indistinguishable from their marks alone, so the tooltip names the view as
     well as the platform, and says how many sign-ins are waiting. */
  const chips = panes.map((pane, i) => {
    const { item, label } = pane;
    const tile = h('span', { class: `pf-row__tile pf-row__tile--${item.tone || 'light'}` });
    if (item.logo) {
      /* The product's own mark. The generic line icon stays as the fallback:
         these were cut from the products' own screens, and a platform nobody has
         supplied artwork for should not get a lookalike drawn for it. */
      tile.appendChild(h('img', {
        src: mediaUrl(`/uploads/${item.logo.split('/').map(encodeURIComponent).join('/')}`),
        alt: '', loading: 'lazy', decoding: 'async',
        onerror: (e) => {
          e.currentTarget.remove();
          tile.appendChild(icon(item.icon || 'grid-4', { class: 'ic ic--sm' }));
        },
      }));
    } else {
      tile.appendChild(icon(item.icon || 'grid-4', { class: 'ic ic--sm' }));
    }

    const count = (pane.logins || []).length;
    return h('button', {
      class: 'pf-row', type: 'button',
      /* The product's own colour, used only by the active card. Set as a custom
         property so the stylesheet decides where it lands. */
      style: item.tint ? { '--tint': item.tint } : {},
      /* The accessible name has to carry what the tooltip does. A button whose
         only content is an untitled image announces nothing to a screen reader,
         and the tooltip is decoration as far as one is concerned. */
      'aria-label': `${item.name}${label ? ` — ${label}` : ''}, ${count} sign-in${count === 1 ? '' : 's'}`,
      onclick: () => {
        chips.forEach((c) => c.classList.remove('is-on'));
        chips[i].classList.add('is-on');
        swap.focus(i); swap.stop(); swap.start();
      },
      ondblclick: () => open(pane),
    },
      /* Text leads; the mark appears on the card that is open. The rail reads as
         a list of names until one is chosen, which is the pattern in the
         reference — a column of labelled rows, one of them expanded. */
      h('span', { class: 'pf-row__tip' },
        h('b', {}, item.name),
        label ? h('i', {}, label) : null,
        h('em', {}, `${count} login${count === 1 ? '' : 's'}`),
      ),
      tile,
    );
  });

  if (chips.length) chips[0].classList.add('is-on');
  const chipRail = h('div', { class: 'pf-chips' }, ...chips);
  /* The dock, vertical. `transform: false` because a full-width row scaled up
     runs out of its own column — the stylesheet reads --dock-k and grows the
     mark while leaning the row outward instead. Started on the next frame
     because it measures each row's rect, and the slide is not in the document
     yet at this point. Nothing to dispose: the loop parks itself once the
     pointer leaves, and the listeners go with the rail. */
  requestAnimationFrame(() => {
    dockMagnify(chipRail, { radius: 132, transform: false });
  });

  const wall = h('div', { class: 'pf-wall' },
    h('div', { class: 'pf-intro' },
      block.eyebrow ? h('p', { class: 'pf-eyebrow' }, block.eyebrow) : null,
      block.title ? h('h2', { class: 'pf-title' }, block.title) : null,
      block.subtitle ? h('p', { class: 'pf-sub' }, block.subtitle) : null,
      /* The standing instruction is gone. It told the room what the presenter is
         about to do anyway, and the dock names each mark on hover, so the line
         was explaining an interface that now explains itself. */
    ),
    h('div', { class: 'pf-stagearea' }, deck),
  );

  /* The rail spans the whole foot rather than sitting in the intro column: seven
     pills need about 700px and that column is barely 300, so inside it the bar
     wrapped onto three lines. */
  wall.appendChild(h('div', { class: 'pf-railrow' }, chipRail));

  const swap = cardSwap(cards, { delay: 5200 });
  swap.begin();

  root.appendChild(wall);
  root.appendChild(stage);
  return root;
}
