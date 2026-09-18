import { h } from '../utils/dom.js';
import { letterRevealPreset, fitToWidth } from '../utils/letterReveal.js';
import { BlockCanvas } from './BlockRenderer.js';

/**
 * One presentation slide: kicker, title, accent rule, then the block canvas.
 *
 * The portal is a viewer. Section content is authored in code, so there are no
 * add, arrange or edit controls anywhere on a slide.
 */
export function SlideView(section, org, { showStatus = false } = {}) {
  if (!section) {
    return h(
      'section',
      { class: 'slide' },
      h('div', { class: 'empty-note' }, 'This organization has no visible sections yet.'),
    );
  }

  // A block that carries its own head takes the slide full-bleed; drawing the
  // section head above it would title the page twice.
  const hasHero = section.blocks?.length > 0
    && ['hero', 'leader-hero', 'milestone-timeline', 'leadership-panels', 'gallery-wall',
      'ai-ready-engineer', 'course-deck', 'drift-wall', 'platforms', 'coe-wall', 'story-wall', 'program-deck', 'testimonial-wall', 'placement-wall', 'event-reel', 'video-resume', 'certification-wall', 'council-grid', 'roster', 'hub', 'stat-wall', 'book-shelf', 'paper-tabs', 'alliance-accordion', 'skew-carousel', 'tilted-tiles', 'card-fan', 'training-shelf', 'photo-collage', 'event-wheel', 'photo-folder', 'project-showcase', 'thread-board', 'event-orbit', 'photo-ring', 'curriculum-deck'].includes(section.blocks[0].type);
  /* A thunk: with a title card the blocks are built later, and a block that
     registers a stepper or starts a loop as it is constructed has to do so when
     it is actually going on the page. Called once either way. */
  const canvas = () => BlockCanvas(section.blocks || [], { editing: false });

  const emptyState = h(
    'div',
    { class: 'slide-empty' },
    h('strong', {}, 'This section is blank'),
    h('span', {}, 'Its content has not been designed yet.'),
  );

  /* The title card. It is laid over the slide rather than inside the flow, so
     it adds no height and cannot change whether FitSlide decides to fill the
     display. `slide--intro` is what holds the page back: it publishes the hold
     as a custom property that every entrance animation on the slide adds to its
     own delay, so the content arrives only once the card has gone. */
  const intro = String(section.intro || '').trim();

  /* With a title card, the page is not built until the card is most of the way
     through (2026-09-17). The card's keyframes hold it opaque to 76% of its run
     and fade it over the last quarter, so the canvas is constructed at 66%: the
     entrances begin a beat before the fade starts and are arriving as the card
     lifts — which is the whole point of having a card. Every kind of entrance
     gets this, CSS or JS, because none of them exists until then; a CSS delay
     alone was honoured only by the animations written to read it, and the rest
     played to an opaque card. The delay is read off the card's own computed
     animation rather than written here twice, so reduced-motion's shorter card
     gets a proportionally earlier mount for free.
     Guarded on the slide still being in the document: the deck rebuilds on every
     navigation, and a slide left before its card finished must not build its
     blocks into the registry of the slide that replaced it. */
  const holding = Boolean(intro);
  const mountLate = (slide, build) => {
    const card = slide.querySelector('.slide-intro');
    const run = parseFloat(getComputedStyle(card).animationDuration) || 3;
    setTimeout(() => {
      if (!slide.isConnected) return;
      slide.classList.remove('is-holding');
      slide.appendChild(build());
      /* FitSlide listens for this and re-fits: the content it measured at mount
         was a card over nothing. */
      slide.dispatchEvent(new CustomEvent('slide-content', { bubbles: true }));
    }, run * 1000 * 0.66);
  };

  const slide = h(
    'section',
    {
      class: ['slide', hasHero ? 'slide--hero' : '', intro ? 'slide--intro is-holding' : ''].filter(Boolean).join(' '),
      dataset: { sectionId: section.id },
    },
    intro
      ? h(
          'div',
          { class: 'slide-intro', 'aria-hidden': 'true' },
          /* The title card is the entrance text of the whole deck, so it
             arrives letter by letter rather than as a block. The card still
             fades in and out around it; this runs inside that. `trigger: true`
             because the card is mounted already revealed — the observer would
             not fire for an element that never crosses the viewport edge. */
          (() => {
            const title = letterRevealPreset(intro, 'heading', {
              as: 'span',
              className: 'slide-intro__text',
              trigger: true,
            }).node;
            /* Sized to the card rather than to a fixed value: whatever fills
               the screen for a short title overflows for a long one, so the
               type is scaled by measured width and every title lands at the
               same optical size. */
            fitToWidth(title);
            return title;
          })(),
        )
      : null,
    !hasHero
      ? h(
          'header',
          { class: 'slide__head' },
          h(
            'div',
            { class: 'row-actions' },
            h('span', { class: 'slide__kicker' }, section.subtitle || org?.name || ''),
            showStatus && section.status !== 'published'
              ? h('span', { class: 'badge badge--draft' }, 'Draft')
              : null,
            showStatus && section.hidden ? h('span', { class: 'badge badge--hidden' }, 'Hidden') : null,
          ),
          h('h1', { class: 'slide__title' }, section.title),
          h('div', { class: 'slide__rule' }),
        )
      : null,
    holding ? null : (canvas() || emptyState),
  );

  if (holding) mountLate(slide, () => canvas() || emptyState);
  return slide;
}
