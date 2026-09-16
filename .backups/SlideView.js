import { h } from '../utils/dom.js';
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
      'ai-ready-engineer', 'course-deck', 'drift-wall', 'platforms', 'coe-wall', 'story-wall', 'program-deck', 'testimonial-wall', 'placement-wall', 'event-reel', 'video-resume', 'certification-wall'].includes(section.blocks[0].type);
  const canvas = BlockCanvas(section.blocks || [], { editing: false });

  const emptyState = h(
    'div',
    { class: 'slide-empty' },
    h('strong', {}, 'This section is blank'),
    h('span', {}, 'Its content has not been designed yet.'),
  );

  return h(
    'section',
    {
      class: ['slide', hasHero ? 'slide--hero' : ''].filter(Boolean).join(' '),
      dataset: { sectionId: section.id },
    },
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
