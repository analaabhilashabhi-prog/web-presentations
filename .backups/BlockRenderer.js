import { h } from '../utils/dom.js';
import { inlineRich } from '../utils/format.js';
import { ImageGrid } from './ImageGrid.js';
import { StatBand } from './StatBand.js';
import { CardGrid } from './CardGrid.js';
import { KpiGrid } from './KpiGrid.js';
import { HeroBox } from './HeroBox.js';
import { LeaderHero } from './LeaderHero.js';
import { MilestoneTimeline } from './MilestoneTimeline.js';
import { LeadershipPanels } from './LeadershipPanels.js';
import { LeadershipRoad } from './LeadershipRoad.js';
import { GalleryWall } from './GalleryWall.js';
import { CourseDeck } from './CourseDeck.js';
import { DriftWall } from './DriftWall.js';
import { Platforms } from './Platforms.js';
import { CentersOfExcellence } from './CentersOfExcellence.js';
import { StoryWall } from './StoryWall.js';
import { ProgramDeck } from './ProgramDeck.js';
import { TestimonialWall } from './TestimonialWall.js';
import { PlacementWall } from './PlacementWall.js';
import { EventReel } from './EventReel.js';
import { CertificationWall } from './CertificationWall.js';
import { VideoResumes } from './VideoResumes.js';
import { AiReadyEngineer } from './AiReadyEngineer.js';
import { ButtonRow, IconBox, LogoBox } from './Elements.js';
import { TextBox, ImageBox, ProfileBox } from './MediaBoxes.js';
import { VideoBox } from './VideoBox.js';
import {
  inReadingOrder,
  layoutOf,
  applyGridStyle,
  canvasRows,
  ensureLayouts,
  ROW_HEIGHT,
  GAP,
} from '../utils/layout.js';

/**
 * Turns stored blocks into the presentation layout. The admin types content and
 * positions boxes; this decides typography, spacing and media framing.
 */
export function renderBlock(block, options = {}) {
  switch (block.type) {
    case 'text':
      return TextBox(block);

    case 'image':
      return ImageBox(block, options);

    case 'video':
      return VideoBox(block, options);

    case 'profile':
      return ProfileBox(block, options);

    case 'heading':
      return h(
        block.level === 3 ? 'h3' : 'h2',
        { class: `block-heading${block.level === 3 ? ' block-heading--3' : ''}` },
        block.text || '',
      );

    case 'paragraph':
      return block.text ? h('p', { class: 'prose', html: inlineRich(block.text) }) : null;

    case 'bullets':
      return block.items?.length
        ? h('ul', { class: 'bullets' }, ...block.items.map((item) => h('li', { html: inlineRich(item) })))
        : null;

    case 'quote':
      return h(
        'blockquote',
        { class: 'quote' },
        block.image?.url
          ? h('img', { class: 'quote__portrait', src: block.image.url, alt: block.author || 'Portrait' })
          : null,
        h(
          'div',
          {},
          h('div', { class: 'quote__mark' }, '“'),
          h('p', { class: 'quote__text', html: inlineRich(block.text || '') }),
          block.author ? h('div', { class: 'quote__author' }, block.author) : null,
          block.role ? h('div', { class: 'quote__role' }, block.role) : null,
        ),
      );

    case 'stats':
      return StatBand(block.items);

    case 'cards':
      return CardGrid(block.items, block.variant || 'plain');

    case 'gallery':
      return ImageGrid(block.images, { caption: block.caption, fit: block.fit });

    case 'divider':
      return h('div', { class: 'divider' });

    /* ------------------------------------------------ page-builder elements */
    case 'hero':
      return HeroBox(block, options);

    case 'leader-hero':
      return LeaderHero(block, options);

    case 'milestone-timeline':
      return MilestoneTimeline(block, options);

    case 'leadership-panels':
      /* The road, not the accordion. LeadershipPanels is still in the tree and still
         reads the same block, so switching this one line back restores the bars. */
      return LeadershipRoad(block, options);

    case 'gallery-wall':
      return GalleryWall(block, options);

    case 'course-deck':
      return CourseDeck(block, options);

    case 'drift-wall':
      return DriftWall(block, options);

    case 'platforms':
      return Platforms(block, options);

    case 'coe-wall':
      return CentersOfExcellence(block, options);

    case 'story-wall':
      return StoryWall(block, options);

    case 'program-deck':
      return ProgramDeck(block, options);

    case 'testimonial-wall':
      return TestimonialWall(block, options);
    case 'placement-wall':
      return PlacementWall(block, options);

    case 'event-reel':
      return EventReel(block, options);

    case 'certification-wall':
      return CertificationWall(block, options);

    case 'video-resume':
      return VideoResumes(block, options);

    case 'ai-ready-engineer':
      return AiReadyEngineer(block, options);

    case 'kpi':
      return KpiGrid(block, options);

    case 'icon':
      return IconBox(block);

    case 'buttons':
      return ButtonRow(block.items, { align: block.align || 'left', editing: options.editing });

    case 'logo':
      return LogoBox(block, options);

    case 'box':
      return BoxContainer(block, options);

    default:
      return null;
  }
}

/** Class list for a layout box, shared by the viewer and the editor shell. */
export function boxClasses(block, extra = '') {
  return [
    'layout-box',
    `layout-box--bg-${block.background || 'surface'}`,
    `layout-box--pad-${block.padding || 'md'}`,
    `layout-box--gap-${block.gap || 'md'}`,
    `layout-box--radius-${block.radius || 'md'}`,
    block.border === false ? '' : 'layout-box--bordered',
    extra,
  ].filter(Boolean).join(' ');
}

/**
 * A layout box: an empty container the admin nests other elements into. Its
 * children live on their own 12-column grid, so a box can hold a two-up split
 * or a stack without touching the outer canvas.
 */
export function BoxContainer(block, options = {}) {
  const children = BlockCanvas(block.children || [], { ...options, nested: true });

  return h(
    'div',
    { class: boxClasses(block) },
    // The label names the box for the person arranging the page; presenters
    // should see the content, not the scaffolding.
    block.label && options.editing ? h('div', { class: 'layout-box__label' }, block.label) : null,
    children
      || (options.editing
        ? h('div', { class: 'layout-box__empty' }, 'Empty box — drop elements inside it')
        : null),
  );
}

/**
 * The block canvas. Blocks are placed on a 12-column grid by their saved
 * coordinates; rows grow to fit content so nothing can overlap or clip. Below
 * the stacking breakpoint the CSS drops every block to full width, and DOM
 * order is reading order, so the stacked result still makes sense.
 */
export function BlockCanvas(blocks = [], options = {}) {
  const ordered = inReadingOrder(ensureLayouts(blocks));
  if (!ordered.length) return null;

  const canvas = h('div', { class: `canvas${options.nested ? ' canvas--nested' : ''}` });
  canvas.style.setProperty('--row-height', `${options.nested ? Math.round(ROW_HEIGHT * 0.9) : ROW_HEIGHT}px`);
  canvas.style.setProperty('--canvas-gap', `${options.nested ? Math.round(GAP * 0.75) : GAP}px`);
  canvas.style.setProperty('--canvas-rows', String(canvasRows(blocks)));

  ordered.forEach((block, index) => {
    const node = renderBlock(block, options);
    if (!node) return;
    const cell = h('div', { class: `canvas-block canvas-block--${block.type}` }, node);
    cell.style.setProperty('--i', String(index));
    applyGridStyle(cell, layoutOf(block, index));
    canvas.append(cell);
  });

  return canvas.children.length ? canvas : null;
}
