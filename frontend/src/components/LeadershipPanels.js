import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * LEADERSHIP JOURNEY — Full-screen 7-panel interactive editorial spread.
 * Overlaid title on vertical panels that fades when a chapter opens.
 */

const DEFAULT_HERO = {
  titleTop: 'Leadership Journey',
  titleBottom: 'Babji Neelam',
  tagline: 'A Decade Covering 3 Continents',
};

const DEFAULT_STAGES = [
  {
    id: 'engineer',
    icon: 'cpu',
    title: 'Enterprise Engineer',
    chapter: 'The Foundation',
    year: '20XX',
    role: 'Enterprise Systems Engineer',
    summary:
      'Where it began. He built the technical bedrock — architecting and scaling enterprise systems, and mastering the craft that every later chapter is built on.',
    quote: 'Great systems are invisible — you only notice them when they hold.',
    highlights: [
      'Architected resilient, enterprise-grade systems',
      'Turned complex requirements into shipped software',
      'Earned a name for solving what others couldn’t',
    ],
  },
  {
    id: 'tech-leader',
    icon: 'globe',
    title: 'Global Technology Leader',
    chapter: 'Scaling Up',
    year: '20XX',
    role: 'Global Technology Leader',
    summary:
      'He stepped from building systems to building teams — leading technology across regions and setting direction at a global scale.',
    quote: 'Leadership scales what talent alone can’t reach.',
    highlights: [
      'Led cross-border engineering teams',
      'Set technical strategy across markets',
      'Delivered platforms serving users worldwide',
    ],
  },
  {
    id: 'entrepreneur',
    icon: 'lightbulb',
    title: 'Visionary Entrepreneur',
    chapter: 'The Leap',
    year: '20XX',
    role: 'Founder & Entrepreneur',
    summary:
      'He traded a secure seat for a blank page — betting on a vision and turning it into a company.',
    quote: 'The safest bet I made was on an idea nobody had funded yet.',
    highlights: [
      'Spotted an unmet need in the market',
      'Built the first product and the first team',
      'Turned an idea into a going concern',
    ],
  },
  {
    id: 'technical-hub',
    icon: 'rocket',
    title: 'Founder of TECHNICAL HUB',
    chapter: 'The Flagship',
    year: '20XX',
    role: 'Founder & CEO, TECHNICAL HUB',
    summary:
      'The centerpiece. He founded a place where talent is trained, technology is built, and opportunity is created at scale.',
    quote: 'Build the place you wish had existed when you started.',
    highlights: [
      'Established the company from the ground up',
      'United training, product, and innovation under one roof',
      'Created a launchpad for the next generation of engineers',
    ],
  },
  {
    id: 'education',
    icon: 'graduation-cap',
    title: 'Education Innovator',
    chapter: 'Teaching at Scale',
    year: '20XX',
    role: 'Education Innovator',
    summary:
      'He reimagined how skills are taught — closing the gap between what students learn and what industry actually needs.',
    quote: 'Teach the skill the market needs tomorrow, not the one it rewarded yesterday.',
    highlights: [
      'Designed industry-aligned learning programs',
      'Mentored thousands into careers in tech',
      'Bridged the classroom-to-career divide',
    ],
  },
  {
    id: 'ai',
    icon: 'sparkles',
    title: 'AI Transformation Leader',
    chapter: 'The New Frontier',
    year: '20XX',
    role: 'AI Transformation Leader',
    summary:
      'He put AI to work — transforming how organizations and learners operate in an intelligent-first world.',
    quote: 'AI doesn’t replace people — it raises what people can do.',
    highlights: [
      'Led AI adoption across products and teams',
      'Reskilled the workforce for an AI era',
      'Turned emerging tech into real outcomes',
    ],
  },
  {
    id: 'impact',
    icon: 'award',
    title: 'Global Impact Creator',
    chapter: 'The Legacy',
    year: '20XX',
    role: 'Global Impact Creator',
    summary:
      'He measures success in lives changed — carrying the work beyond a single company toward lasting, global impact.',
    quote: 'Measure a career by the doors it opens for others.',
    highlights: [
      'Scaled impact across regions and communities',
      'Built institutions that outlast any one project',
      'Turned a career into a movement',
    ],
  },
];

const COLORS = [
  /* One ramp, all of it the brand green, darkest first.
   
     It used to run near-black, charcoal, green, green, then three greys - five of the
     seven tones were neutral, so a section about this organization's leadership opened
     looking like it belonged to a different deck. These are Technical Hub's #008638
     stepped down to #003C19 and up to a pale wash, so the rail reads as one colour
     family and each card is a different depth of it rather than a different colour.
   
     `on` stays white until the tone is light enough that it would not read - the last
     two carry the ink instead. `deep` is the ground a photograph is blended onto and
     `tint` the wash behind an empty one. */
  { accent: '#003C19', deep: '#001F0D', tint: '#D8EADF', on: '#FFFFFF' },
  { accent: '#005C27', deep: '#003C19', tint: '#DCECE2', on: '#FFFFFF' },
  { accent: '#008638', deep: '#005C27', tint: '#E2F3E9', on: '#FFFFFF' },
  { accent: '#0A9E48', deep: '#003C19', tint: '#E5F5EB', on: '#FFFFFF' },
  { accent: '#2FB463', deep: '#008638', tint: '#E9F7EE', on: '#FFFFFF' },
  { accent: '#71BD1F', deep: '#003C19', tint: '#EDF6E4', on: '#16281C' },
  { accent: '#C7E3CE', deep: '#005C27', tint: '#F1F7F2', on: '#0E2A18' },
];

const BRAND = '#12A150';

export function LeadershipPanels(block, { editing = false } = {}) {
  const panels = (block.panels && block.panels.length > 0) ? block.panels : DEFAULT_STAGES;
  const titleTop = block.titleTop || DEFAULT_HERO.titleTop;
  const titleBottom = block.titleBottom || DEFAULT_HERO.titleBottom;
  const tagline = block.tagline || DEFAULT_HERO.tagline;

  let active = null;
  const root = h('div', { class: 'lj-root ph-root all-closed' });

  const overlay = h('div', { class: 'lj-overlay', 'aria-hidden': 'false' },
    h('h1', { class: 'lj-name' },
      h('span', { class: 'lj-name-top' }, titleTop),
      h('span', { class: 'lj-sep', 'aria-hidden': 'true' }, ' - '),
      h('span', { class: 'lj-name-bottom' }, titleBottom),
    ),
    h('span', { class: 'lj-rule', 'aria-hidden': 'true' }),
    h('p', { class: 'lj-tagline' }, tagline),
  );

  const cards = [];

  const setActive = (next) => {
    active = next;
    root.classList.toggle('all-closed', active === null);
    root.classList.toggle('has-open', active !== null);
    overlay.setAttribute('aria-hidden', String(active !== null));
    cards.forEach((card, i) => {
      const open = i === active;
      card.el.classList.toggle('is-open', open);
      card.el.classList.toggle('is-closed', !open);
      card.spine.setAttribute('aria-selected', String(open));
      card.spine.setAttribute('aria-expanded', String(open));
      card.body.setAttribute('aria-hidden', String(!open));
      card.body.querySelectorAll('a, button').forEach((el) => {
        el.tabIndex = open ? 0 : -1;
      });
    });
  };

  const rail = h('div', { class: 'lj-rail', role: 'tablist', 'aria-label': 'Leadership journey chapters' });

  panels.forEach((panel, i) => {
    const t = COLORS[i % COLORS.length];
    const glyph = panel.icon || 'sparkles';
    const num = String(i + 1).padStart(2, '0');

    const spine = h('button', {
      class: 'lj-spine',
      type: 'button',
      role: 'tab',
      'aria-selected': 'false',
      'aria-expanded': 'false',
      'aria-label': `${panel.title}, chapter ${i + 1}`,
      onclick: () => setActive(active === i ? null : i),
    },
      h('span', { class: 'lj-num' }, num),
      h('span', { class: 'lj-spine-title' }, panel.title),
      h('span', { class: 'lj-spine-icon', 'aria-hidden': 'true' }, icon(glyph, { class: 'ic ic--sm' })),
    );

    /**
     * Fills the column, unless filling it would destroy the picture.
     *
     * The media column is tall and narrow and `cover` crops to fit it. That is
     * right for a portrait and ruinous for a 16:9 card: the OpenAI partnership
     * slide lost Babji off the left edge, cut "TECHNICAL HUB" mid-word and
     * dropped the Select Partner badge entirely. So the decision is made from
     * the picture rather than fixed in the stylesheet — anything that would
     * lose more than a third of its width is shown whole instead, on the
     * panel's own colour.
     */
    const fitToPanel = (img) => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      /* Shown whole, never cropped. Turning the panel on its side for wide
         pictures — media as a band on top, copy beneath — does frame a 16:9
         card exactly, but it pushed the summary 80–132px past the panel and
         made the slide letterbox itself at three of four screen sizes. Not
         worth trading a working page for tighter framing; left as a letterbox
         until the stacked layout can be given the room it needs. */
      void ratio;
      img.classList.add('lj-photo--whole');
    };

    const media = h('div', { class: 'lj-media' },
      panel.asset?.url || panel.image
        ? (() => {
            const img = h('img', { class: 'lj-photo', src: panel.asset?.url || panel.image, alt: panel.title });
            const check = () => fitToPanel(img);
            if (img.complete) requestAnimationFrame(check);
            else img.addEventListener('load', () => requestAnimationFrame(check), { once: true });
            // Opening a panel changes the column's width, which changes the answer.
            if (typeof ResizeObserver === 'function') {
              requestAnimationFrame(() => new ResizeObserver(check).observe(img.parentElement || img));
            }
            return img;
          })()
        /* "add photo" is a note to whoever is building the page, not something
           a room should be shown. Without a photograph the panel keeps its own
           colour and mark, which reads as a deliberate plate rather than a
           missing image. */
        : h('div', { class: 'lj-photo lj-photo--empty' },
            icon(glyph, { class: 'ic ic--xl' }),
            editing
              ? h('span', { class: 'lj-photo-hint' },
                  icon('image', { class: 'ic ic--xs' }),
                  ' add photo',
                )
              : null,
          ),
      /* No chip without a year. `'20XX'` was the sketch's placeholder, and it
         was being published: the AI Ready Engineer pillars have no date, so
         every one of them wore a "20XX" badge over the photograph. A panel that
         has no year should show nothing rather than show a stand-in. */
      panel.year
        ? h('span', { class: 'lj-chip' },
            icon(glyph, { class: 'ic ic--xs' }),
            ' ',
            panel.year,
          )
        : null,
    );

    const closeBtn = h('button', {
      class: 'lj-close',
      type: 'button',
      'aria-label': 'Collapse chapter',
      onclick: (e) => {
        e.stopPropagation();
        setActive(null);
      },
    }, icon('close', { class: 'ic ic--sm' }));

    const contentChildren = [
      h('span', { class: 'lj-ghost', 'aria-hidden': 'true' }, num),
      closeBtn,
      h('p', { class: 'lj-eyebrow' }, `Chapter ${num} — ${panel.chapter || 'Overview'}`),
      h('h2', { class: 'lj-role' }, panel.role || panel.title),
      panel.summary ? h('p', { class: 'lj-summary' }, panel.summary) : null,
      panel.quote
        ? h('blockquote', { class: 'lj-quote' },
            icon('quote', { class: 'ic lj-quote-mark' }),
            ' ',
            panel.quote,
          )
        : null,
      panel.highlights && panel.highlights.length
        ? h('ul', { class: 'lj-list' },
            ...panel.highlights.map((hText, k) =>
              h('li', { style: { '--d': `${(0.14 + k * 0.09).toFixed(2)}s` } },
                icon('arrow-up-right', { class: 'ic ic--xs' }),
                h('span', {}, hText),
              ),
            ),
          )
        : null,
    ];

    const prevBtn = i > 0
      ? h('button', {
          class: 'lj-nav',
          type: 'button',
          onclick: () => setActive(i - 1),
        },
          icon('chevron-left', { class: 'ic ic--xs' }),
          h('span', {}, panels[i - 1].title),
        )
      : h('span', {});

    const nextBtn = i < panels.length - 1
      ? h('button', {
          class: 'lj-nav lj-nav--next',
          type: 'button',
          onclick: () => setActive(i + 1),
        },
          h('span', {}, panels[i + 1].title),
          icon('chevron-right', { class: 'ic ic--xs' }),
        )
      : h('span', {});

    const foot = h('div', { class: 'lj-foot' },
      prevBtn,
      h('span', { class: 'lj-step' }, num, h('i', {}, '/'), String(panels.length).padStart(2, '0')),
      nextBtn,
    );

    contentChildren.push(foot);

    const body = h('div', { class: 'lj-body', 'aria-hidden': 'true' },
      media,
      h('div', { class: 'lj-content' }, ...contentChildren),
    );

    const el = h('article', {
      class: 'lj-card is-closed',
      style: {
        '--accent': t.accent,
        '--deep': t.deep,
        '--tint': t.tint,
        '--on': t.on,
        '--brand': BRAND,
      },
    }, spine, body);

    cards.push({ el, spine, body });
    rail.appendChild(el);
  });

  if (!editing) {
    registerStepper((delta) => {
      if (delta > 0) {
        const next = active === null ? 0 : active + 1;
        if (next >= panels.length) return false;
        setActive(next);
        return true;
      }
      if (active === null) return false;
      setActive(active === 0 ? null : active - 1);
      return true;
    });
  }

  root.appendChild(overlay);
  root.appendChild(rail);

  setActive(null);
  return root;
}
