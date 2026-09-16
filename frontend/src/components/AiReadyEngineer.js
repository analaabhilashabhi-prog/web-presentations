import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { openLightbox } from './Lightbox.js';

/**
 * AI READY ENGINEER — Neatly aligned PDF showcase component.
 * Displays rendered PDF pages in high-resolution cards with lightbox zoom & PDF downloads.
 */

const DEFAULT_DOCUMENTS = [
  {
    title: 'Program Brochure — Architecture & Curriculum',
    subtitle: '2-Page Detailed Specification',
    pdfUrl: '/uploads/media__1786111501576.pdf',
    pages: [
      {
        url: '/uploads/ai_ready_engineer_brochure_page_1.png',
        name: 'AI Ready Engineer — Page 1 (Foundations & Partners)',
        caption: 'Program Overview, 16 Modules, Partners & Key Features',
        docTitle: 'Brochure Page 1',
      },
      {
        url: '/uploads/ai_ready_engineer_brochure_page_2.png',
        name: 'AI Ready Engineer — Page 2 (Curriculum & Student Benefits)',
        caption: '16 Modules End-to-End & Student Benefits',
        docTitle: 'Brochure Page 2',
      },
    ],
  },
  {
    title: 'College Ecosystem & Placement Overview',
    subtitle: '1-Page Executive Summary',
    pdfUrl: '/uploads/media__1786111502988.pdf',
    pages: [
      {
        url: '/uploads/ai_ready_engineer_overview_page_1.png',
        name: 'AI Ready Engineer — College Benefits & Placements',
        caption: 'Feature Hexagon, 16 Modules, College Ecosystem & Placement Statistics',
        docTitle: 'Ecosystem Overview',
      },
    ],
  },
];

export function AiReadyEngineer(block, options = {}) {
  const docs = block.pdfDocuments && block.pdfDocuments.length > 0 ? block.pdfDocuments : DEFAULT_DOCUMENTS;

  // Flatten all pages for full-screen Lightbox stepping
  const allPages = docs.flatMap((doc) => doc.pages || []);

  const root = h('div', { class: 'are-root ph-root' });

  // ------------------------------------------------------------- Header Hero
  const header = h('header', { class: 'are-hero' },
    h('div', { class: 'are-hero__top' },
      h('span', { class: 'are-kicker' }, icon('sparkles', { class: 'ic ic--xs' }), ' TECHNICAL HUB · IN ASSOCIATION WITH TORII'),
      h('div', { class: 'are-partners-chips' },
        h('span', { class: 'are-partner-chip' }, icon('shield', { class: 'ic ic--xs' }), ' Claude Partner Member'),
        h('span', { class: 'are-partner-chip' }, icon('sparkles', { class: 'ic ic--xs' }), ' OpenAI Select Partner'),
      ),
    ),
    h('h1', { class: 'are-hero__title' },
      h('span', { class: 'are-title-highlight' }, 'AI READY'),
      ' ENGINEER',
    ),
    h('p', { class: 'are-hero__sub' },
      block.subtitle || 'An intensive, hands-on journey from language-model foundations to shipping production-grade, agentic AI products.',
    ),
    h('div', { class: 'are-stats-bar' },
      h('div', { class: 'are-stat-badge' }, h('strong', {}, '16'), h('span', {}, 'MODULES')),
      h('div', { class: 'are-stat-badge' }, h('strong', {}, 'CLAUDE'), h('span', {}, 'CERTIFIED ASSOCIATE')),
      h('div', { class: 'are-stat-badge' }, h('strong', {}, '50+'), h('span', {}, 'AI TOOLS & PLATFORMS')),
      h('div', { class: 'are-stat-badge' }, h('strong', {}, '16,000+'), h('span', {}, 'CERTIFIED STUDENTS')),
    ),
  );

  // --------------------------------------------------- PDF Documents Grid
  const grid = h('div', { class: 'are-grid' });
  let globalPageIndex = 0;

  docs.forEach((doc) => {
    (doc.pages || []).forEach((page) => {
      const pageIdx = globalPageIndex++;

      const imageEl = h('img', {
        src: page.url,
        alt: page.name,
        class: 'are-card__img',
        loading: 'lazy',
      });

      const card = h('article', { class: 'are-card' },
        h('div', { class: 'are-card__header' },
          h('div', { class: 'are-card__title-wrap' },
            h('span', { class: 'are-card__badge' }, page.docTitle || `Page ${pageIdx + 1}`),
            h('h3', { class: 'are-card__title' }, doc.title),
          ),
          doc.pdfUrl ? h('a', {
            href: doc.pdfUrl,
            download: '',
            target: '_blank',
            class: 'are-btn-download-sm',
            title: 'Download Original PDF',
          }, icon('upload', { class: 'ic ic--xs' }), ' PDF') : null,
        ),
        h('div', {
          class: 'are-card__frame',
          onclick: () => openLightbox(allPages, pageIdx),
        },
          imageEl,
          h('div', { class: 'are-card__overlay' },
            h('span', { class: 'are-zoom-btn' },
              icon('eye', { class: 'ic ic--sm' }),
              ' Expand Page in 4K',
            ),
          ),
        ),
        h('div', { class: 'are-card__footer' },
          h('p', { class: 'are-card__caption' }, page.caption || page.name),
          h('div', { class: 'are-card__actions' },
            h('button', {
              type: 'button',
              class: 'are-btn-expand',
              onclick: () => openLightbox(allPages, pageIdx),
            }, icon('eye', { class: 'ic ic--xs' }), ' Fullscreen View'),
            doc.pdfUrl ? h('a', {
              href: doc.pdfUrl,
              target: '_blank',
              download: '',
              class: 'are-btn-pdf',
            }, icon('document', { class: 'ic ic--xs' }), ' Open PDF') : null,
          ),
        ),
      );

      grid.appendChild(card);
    });
  });

  root.appendChild(header);
  root.appendChild(grid);
  return root;
}
