import { h } from '../utils/dom.js';

/**
 * A shelf of books, ported from ThreeUI's `BestsellersBookShowcase`.
 *
 * Source: https://threeui.com/landing-pages/bestsellers-book-showcase.html
 * SHA-256 7c1ed1ca4a4c58f1c33956c84edd8f7ba450ea0312df718701e634a207568138,
 * verified against the fetched bytes before a line of this was written. The
 * markup below is the authored markup — the same elements, in the same order,
 * carrying the same classes (namespaced `bs-`) — and the behaviour below is the
 * authored behaviour: the same parallax, the same detail-mode orbit, the same
 * cover-motion gating, the same easing and the same durations. The stylesheet
 * is vendored whole at `frontend/public/styles/bookshelf.css` and its header
 * records the three edits made to it.
 *
 * What was deliberately dropped, because the brief asked for the books and
 * their sheets and nothing else: the fixed top bar (wordmark, menu, "The
 * Collection"), the giant word behind the shelf, the slide-over menu, the
 * toast, and — inside the panel — the description, the "Getting started"
 * steps, the prompt block, the closing note, the star rating, the year line
 * and the whole rail of pills. The CSS for all of it is still in the vendored
 * sheet, unused; restoring any piece means rendering its node again.
 *
 * Two things had to be adapted rather than copied, both because the showcase
 * no longer owns the window:
 *
 *   - Pointer position is measured against the stage's own rectangle instead
 *     of the viewport. A slide is laid out at a nominal 1600×900 and then
 *     transform-scaled, so window coordinates and slide coordinates are not
 *     the same space. Measuring inside the stage keeps the authored feel and
 *     is identical arithmetic whenever the stage fills the screen.
 *   - Every listener is bound inside the root. The original binds pointer and
 *     key handlers to `window` and `document`, which is correct for a page
 *     that is the whole document and a leak in a deck that swaps slides.
 */

/* The authored blossom field — nine flowers drifting down once a book opens —
   is not built at all. It was the one piece of the showcase that was pure
   decoration rather than structure, and a college's programme sheet is not a
   place for falling petals. Its CSS is still in the vendored sheet, unused. */

/** The book, spine to fore-edge: shadow, board, page block, fan, cover. */
function buildBook(book, index) {
  const cover = book.cover?.url || '';
  const motion = book.motion?.url || '';

  const video = motion
    ? h(
      'video',
      {
        class: 'bs-cover-motion',
        autoplay: true,
        muted: true,
        loop: true,
        playsinline: true,
        preload: 'metadata',
      },
      h('source', { src: motion, type: book.motion?.mime || 'video/mp4' }),
    )
    : null;
  // `muted` has to be set as a property too; the attribute alone does not
  // satisfy the autoplay policy in Chrome, and the loop silently never starts.
  if (video) video.muted = true;

  const card = h(
    'button',
    {
      class: 'bs-book-card',
      type: 'button',
      'data-book': String(index + 1),
      'aria-label': `Open ${book.title}`,
    },
    h(
      'span',
      { class: 'bs-book', 'aria-hidden': 'true' },
      h('span', { class: 'bs-book-shadow' }),
      h('span', { class: 'bs-book-back' }),
      h('span', { class: 'bs-page-block' }),
      h(
        'span',
        { class: 'bs-page-fan' },
        h('i'), h('i'), h('i'), h('i'),
      ),
      h(
        'span',
        { class: 'bs-front-cover' },
        video,
        h(
          'span',
          { class: 'bs-cover-copy' },
          book.kicker ? h('span', { class: 'bs-cover-kicker' }, book.kicker) : null,
          h('span', { class: 'bs-cover-title' }, book.title),
          book.subtitle ? h('span', { class: 'bs-cover-subtitle' }, book.subtitle) : null,
          h('span'),
          book.footer ? h('span', { class: 'bs-cover-footer' }, book.footer) : null,
        ),
      ),
      h('span', { class: 'bs-open-badge' }, 'Read'),
    ),
  );

  if (book.coverColor) card.style.setProperty('--cover-color', book.coverColor);
  if (cover) card.style.setProperty('--cover', `url('${cover}')`);
  return card;
}

/** The sheet off the book's own page — its columns, its rows, its total. */
function buildSheet(book) {
  const head = book.columns.length
    ? h(
      'thead',
      {},
      h('tr', {}, ...book.columns.map((column) => h('th', { scope: 'col' }, column))),
    )
    : null;

  const body = h(
    'tbody',
    {},
    ...book.rows.map((row, index) => h(
      'tr',
      {
        'data-total': row.total ? 'true' : null,
        style: { '--row': String(index) },
      },
      ...row.cells.map((cell) => h('td', {}, cell)),
    )),
  );

  return h(
    'div',
    {},
    h('table', { class: 'bs-sheet' }, head, body),
    book.note ? h('p', { class: 'bs-sheet-note' }, book.note) : null,
  );
}

export function BookShelf(block) {
  const books = Array.isArray(block.books) ? block.books.slice(0, 3) : [];

  const cards = books.map((book, index) => buildBook(book, index));
  const gallery = h('section', { class: 'bs-gallery', 'aria-label': 'Volumes' }, ...cards);

  const detailTitle = h('h2', { class: 'bs-detail-title' });
  const detailScroll = h('div', {
    class: 'bs-detail-scroll',
    tabindex: '0',
    'aria-label': 'Sheet',
  });
  const detailPanel = h(
    'section',
    {
      class: 'bs-detail-panel',
      'aria-live': 'polite',
      'aria-hidden': 'true',
    },
    detailTitle,
    detailScroll,
  );
  detailPanel.inert = true;

  const closeButton = h('button', {
    class: 'bs-close-button',
    type: 'button',
    'aria-label': 'Close',
    tabindex: '-1',
  }, '×');

  const stage = h(
    'main',
    { class: 'bs-stage' },
    gallery,
    detailPanel,
    closeButton,
  );

  const root = h('div', { class: 'bs-root', 'data-mode': 'gallery' }, stage);
  const shell = h('div', { class: 'bs-shell' }, root);

  /* ------------------------------------------------------------------ state */
  const reducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false, addEventListener: null, addListener: null };
  const coverVideos = [...root.querySelectorAll('.bs-cover-motion')];
  let selectedCard = null;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pointerClientX = -10000;
  let pointerClientY = -10000;
  let pointerInside = false;

  /* A cover only plays where it can be seen: all three on the shelf, the
     chosen one alone once a book is open. Nothing plays when the tab is
     hidden — three looping videos behind a hidden slide is pure battery. */
  function syncCoverMotion() {
    coverVideos.forEach((video) => {
      const card = video.closest('.bs-book-card');
      const isVisibleBook = root.dataset.mode === 'gallery'
        || (root.dataset.mode === 'detail' && card === selectedCard);
      const shouldPlay = !reducedMotion.matches && !document.hidden && isVisibleBook;

      if (!shouldPlay) {
        video.pause();
        return;
      }

      const playRequest = video.play();
      if (playRequest) playRequest.catch(() => {});
    });
  }

  function updateParallax() {
    frame = 0;
    if (reducedMotion.matches) return;

    const stageBox = stage.getBoundingClientRect();
    if (!stageBox.width || !stageBox.height) return;

    if (root.dataset.mode === 'detail' && selectedCard) {
      const bounds = selectedCard.getBoundingClientRect();
      const bookCenterX = bounds.left + bounds.width / 2;
      const bookCenterY = bounds.top + bounds.height / 2;
      const horizontalReach = pointerClientX < bookCenterX
        ? Math.max(bookCenterX - stageBox.left, 1)
        : Math.max(stageBox.right - bookCenterX, 1);
      const verticalReach = pointerClientY < bookCenterY
        ? Math.max(bookCenterY - stageBox.top, 1)
        : Math.max(stageBox.bottom - bookCenterY, 1);
      const viewportX = pointerInside
        ? Math.max(-1, Math.min(1, (pointerClientX - bookCenterX) / horizontalReach))
        : -5 / 16;
      const viewportY = pointerInside
        ? Math.max(-1, Math.min(1, (pointerClientY - bookCenterY) / verticalReach))
        : 0;
      selectedCard.style.setProperty('--detail-yaw', `${viewportX * 16}deg`);
      selectedCard.style.setProperty('--detail-pitch', `${viewportY * -10}deg`);
      selectedCard.dataset.orbiting = String(pointerInside);
      return;
    }

    if (root.dataset.mode !== 'gallery') return;

    root.style.setProperty('--mx', `${pointerX * 11}px`);
    root.style.setProperty('--my', `${pointerY * 8}px`);

    // The centre volume rides the pointer fully; the two leaning in sit back.
    cards.forEach((card, index) => {
      const depth = index === 1 ? 1 : 0.58;
      card.style.setProperty('--local-x', `${pointerX * 15 * depth}px`);
      card.style.setProperty('--local-y', `${pointerY * 9 * depth}px`);
    });
  }

  function selectBook(card, book) {
    if (root.dataset.mode === 'detail') return;

    selectedCard = card;
    selectedCard.style.setProperty('--detail-yaw', '-5deg');
    selectedCard.style.setProperty('--detail-pitch', '0deg');
    selectedCard.dataset.orbiting = 'false';
    detailTitle.textContent = book.title;
    detailScroll.replaceChildren(buildSheet(book));
    detailScroll.scrollTop = 0;
    cards.forEach((item) => item.classList.toggle('bs-selected', item === card));
    cards.forEach((item) => { item.tabIndex = -1; });
    root.dataset.mode = 'detail';
    syncCoverMotion();
    detailPanel.setAttribute('aria-hidden', 'false');
    detailPanel.inert = false;
    closeButton.tabIndex = 0;
    window.setTimeout(() => {
      closeButton.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 700);
  }

  function closeDetail() {
    if (root.dataset.mode !== 'detail') return;
    root.dataset.mode = 'gallery';
    syncCoverMotion();
    detailPanel.setAttribute('aria-hidden', 'true');
    detailPanel.inert = true;
    closeButton.tabIndex = -1;
    const lastCard = selectedCard;
    lastCard?.style.setProperty('--detail-yaw', '-5deg');
    lastCard?.style.setProperty('--detail-pitch', '0deg');
    if (lastCard) lastCard.dataset.orbiting = 'false';
    window.setTimeout(() => {
      cards.forEach((card) => card.classList.remove('bs-selected'));
      cards.forEach((card) => { card.tabIndex = 0; });
      selectedCard = null;
      lastCard?.focus({ preventScroll: true });
    }, reducedMotion.matches ? 0 : 700);
  }

  /* ----------------------------------------------------------------- wiring */
  cards.forEach((card, index) => {
    card.addEventListener('click', () => selectBook(card, books[index]));
    card.addEventListener('pointerenter', () => { card.dataset.hovered = 'true'; });
    card.addEventListener('pointerleave', () => { card.dataset.hovered = 'false'; });
  });

  coverVideos.forEach((video) => {
    const revealVideo = () => { video.dataset.ready = 'true'; };
    if (video.readyState >= 2) revealVideo();
    else video.addEventListener('loadeddata', revealVideo, { once: true });
  });

  document.addEventListener('visibilitychange', syncCoverMotion);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncCoverMotion);
  else if (reducedMotion.addListener) reducedMotion.addListener(syncCoverMotion);
  syncCoverMotion();

  root.addEventListener('pointermove', (event) => {
    const box = stage.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pointerX = (event.clientX - box.left) / box.width - 0.5;
    pointerY = (event.clientY - box.top) / box.height - 0.5;
    pointerClientX = event.clientX;
    pointerClientY = event.clientY;
    pointerInside = true;
    if (!frame) frame = window.requestAnimationFrame(updateParallax);
  }, { passive: true });

  root.addEventListener('pointerleave', () => {
    pointerX = 0;
    pointerY = 0;
    pointerClientX = -10000;
    pointerClientY = -10000;
    pointerInside = false;
    if (!frame) frame = window.requestAnimationFrame(updateParallax);
  });

  closeButton.addEventListener('click', closeDetail);

  // Bound to the root, not the document: focus is always inside the shelf
  // while a book is open (the close button takes it, and hands it back to the
  // card), so Escape is caught here without leaving a listener on the page
  // after the presenter moves to the next slide.
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });

  return shell;
}
