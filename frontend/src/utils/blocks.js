/**
 * One place that knows what a block of each type looks like when it is brand
 * new. The canvas editor, the sample layouts and the template picker all build
 * blocks through here, so a new field only has to be added once.
 */
import { DEFAULT_SIZE } from './layout.js';

export const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

/** Curated glyph set — unicode only, so nothing is fetched at presentation time. */
export const ICON_CHOICES = [
  '★', '✓', '◆', '●', '▲', '✦', '❖', '➤',
  '👥', '🎓', '🏆', '📈', '🛡️', '⚙️', '🔬', '💡',
  '🏭', '🤝', '📍', '✉️', '📞', '🌐', '🕒', '📄',
  '🏅', '🎯', '🧭', '🔧', '📊', '🧪', '🚀', '♻️',
];

export const BUTTON_VARIANTS = [
  ['primary', 'Solid (brand)'],
  ['outline', 'Outline'],
  ['ghost', 'Quiet'],
  ['dark', 'Dark fill'],
];

export const BOX_BACKGROUNDS = [
  ['none', 'Transparent'],
  ['surface', 'White card'],
  ['soft', 'Soft brand tint'],
  ['brand', 'Brand fill'],
  ['dark', 'Dark fill'],
];

export const SPACING_CHOICES = [
  ['none', 'None'],
  ['sm', 'Small'],
  ['md', 'Medium'],
  ['lg', 'Large'],
];

export const HERO_HEIGHTS = [
  ['sm', 'Compact'],
  ['md', 'Standard'],
  ['lg', 'Tall'],
  ['full', 'Full screen'],
];

export const ALIGNMENTS = [
  ['left', 'Left'],
  ['center', 'Centre'],
  ['right', 'Right'],
];

export function emptyCard() {
  return { id: uid('crd'), title: '', subtitle: '', meta: '', body: '', tags: [], imageAssetId: null, image: null };
}

export function emptyKpi(overrides = {}) {
  return { id: uid('kpi'), icon: '', value: 0, prefix: '', suffix: '', label: '', note: '', ...overrides };
}

export function emptyButton(overrides = {}) {
  return { id: uid('btn'), label: 'Learn more', href: '', variant: 'primary', icon: '', ...overrides };
}

/** A brand-new block of `type`, with every field the editor and renderer expect. */
export function newBlock(type, overrides = {}) {
  const base = { id: uid('blk'), type };
  const made = (fields) => ({ ...base, ...fields });

  switch (type) {
    case 'text':
      return made({ heading: '', level: 2, body: '', items: [], align: 'left' });
    case 'image':
      return made({ assetId: null, asset: null, title: '', caption: '', alt: '', fit: 'contain', radius: 'md' });
    case 'video':
      return made({
        source: 'upload',
        assetId: null,
        asset: null,
        videoUrl: '',
        caption: '',
        autoplay: false,
        loop: false,
        muted: true,
      });
    case 'profile':
      return made({ assetId: null, asset: null, name: '', role: '', blurb: '', focus: 'center', frame: 'portrait' });
    case 'heading':
      return made({ text: 'New heading', level: 2 });
    case 'paragraph':
      return made({ text: '' });
    case 'bullets':
      return made({ items: [''] });
    case 'quote':
      return made({ text: '', author: '', role: '', imageAssetId: null, image: null });
    case 'stats':
      return made({ items: [{ value: 0, prefix: '', suffix: '', label: '' }] });
    case 'cards':
      return made({ variant: 'plain', items: [emptyCard()] });
    case 'gallery':
      return made({ caption: '', assetIds: [], titles: [], images: [], fit: 'contain' });
    case 'divider':
      return made({});

    /* ------------------------------------------------ page-builder elements */
    case 'hero':
      return made({
        kicker: '',
        heading: 'A headline that earns the next five minutes',
        subheading: '',
        media: 'color',
        source: 'upload',
        assetId: null,
        asset: null,
        videoUrl: '',
        alt: '',
        overlay: 45,
        align: 'left',
        height: 'md',
        buttons: [emptyButton({ label: 'Get in touch' })],
      });
    case 'kpi':
      return made({
        items: [emptyKpi({ label: 'Number of employees', value: 0 })],
        columns: 'auto',
        variant: 'card',
      });
    case 'icon':
      return made({ glyph: '★', label: '', note: '', size: 'md', shape: 'circle', tone: 'accent' });
    case 'buttons':
      return made({ items: [emptyButton()], align: 'left' });
    case 'logo':
      return made({
        assetId: null,
        asset: null,
        title: '',
        alt: '',
        href: '',
        background: 'surface',
        pad: 'md',
      });
    case 'box':
      return made({
        label: '',
        children: [],
        background: 'surface',
        padding: 'md',
        gap: 'md',
        border: true,
        radius: 'md',
      });
    default:
      return base;
  }
}

/**
 * Builds a block with an explicit grid position — the shorthand the sample
 * layouts are written in.
 */
export function at(type, [x, y, w, h], overrides = {}) {
  const size = DEFAULT_SIZE[type] || { w: 12, h: 4 };
  return {
    ...newBlock(type),
    ...overrides,
    layout: { x, y, w: w ?? size.w, h: h ?? size.h },
  };
}

/**
 * Ready-made rows.
 *
 * A layout box holds other elements, but building the common ones by hand —
 * a logo beside a title, a picture beside a paragraph — means dropping two
 * elements and resizing both. These insert the finished arrangement in one go,
 * already sized so the pieces sit side by side. Everything inside stays fully
 * editable: move it, resize it, swap it, delete it.
 */
export const ROW_PRESETS = [
  {
    id: 'header-row',
    label: 'Logo + title',
    icon: '⬒',
    description: 'A logo beside a heading and tagline.',
    build: () => ({
      ...newBlock('box'),
      label: 'Header',
      background: 'none',
      border: false,
      padding: 'none',
      layout: { x: 0, y: 0, w: 12, h: 5 },
      children: [
        at('logo', [0, 0, 2, 5], { background: 'none', pad: 'none' }),
        at('heading', [2, 0, 10, 2], { text: 'Organization name' }),
        at('paragraph', [2, 2, 10, 3], { text: 'Tagline or a one-line description.' }),
      ],
    }),
  },
  {
    id: 'image-text-row',
    label: 'Image + text',
    icon: '◫',
    description: 'A picture on the left, a heading and copy on the right.',
    build: () => ({
      ...newBlock('box'),
      label: 'Image and text',
      background: 'none',
      border: false,
      padding: 'none',
      layout: { x: 0, y: 0, w: 12, h: 8 },
      children: [
        at('image', [0, 0, 5, 8], { title: '', caption: '' }),
        at('text', [5, 0, 7, 8], { heading: 'Heading', body: 'Write the copy that goes beside this picture.' }),
      ],
    }),
  },
  {
    id: 'two-columns',
    label: 'Two empty columns',
    icon: '⬓',
    description: 'Two side-by-side boxes to fill with anything.',
    build: () => ({
      ...newBlock('box'),
      label: 'Two columns',
      background: 'none',
      border: false,
      padding: 'none',
      layout: { x: 0, y: 0, w: 12, h: 8 },
      children: [
        at('box', [0, 0, 6, 8], { label: 'Left', children: [] }),
        at('box', [6, 0, 6, 8], { label: 'Right', children: [] }),
      ],
    }),
  },
];

export const PRESET_PREFIX = 'preset:';

export function presetById(id) {
  return ROW_PRESETS.find((preset) => preset.id === id) || null;
}

/** Fresh ids for a block tree — used by duplicate, templates and paste. */
export function reid(block) {
  const copy = structuredClone(block);
  const walk = (node) => {
    node.id = uid('blk');
    if (Array.isArray(node.children)) node.children.forEach(walk);
    if (Array.isArray(node.items)) {
      node.items.forEach((item) => {
        if (item && typeof item === 'object' && item.id) item.id = uid('itm');
      });
    }
    if (Array.isArray(node.buttons)) {
      node.buttons.forEach((item) => {
        if (item && typeof item === 'object' && item.id) item.id = uid('btn');
      });
    }
  };
  walk(copy);
  return copy;
}
