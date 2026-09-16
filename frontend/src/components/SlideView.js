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
      'ai-ready-engineer', 'course-deck', 'drift-wall', 'platforms', 'coe-wall', 'story-wall', 'program-deck', 'testimonial-wall', 'placement-wall', 'event-reel', 'video-resume', 'certification-wall', 'council-grid', 'roster', 'hub', 'stat-wall', 'book-shelf', 'paper-tabs', 'alliance-accordion', 'skew-carousel', 'tilted-tiles', 'card-fan', 'training-shelf', 'photo-collage', 'thread-board', 'event-orbit'].includes(section.blocks[0].type);
  const canvas = BlockCanvas(section.blocks || [], { editing: false });

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

  return h(
    'section',
    {
      class: ['slide', hasHero ? 'slide--hero' : '', intro ? 'slide--intro' : ''].filter(Boolean).join(' '),
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
    canvas || emptyState,
  );
}
