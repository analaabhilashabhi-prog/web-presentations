import { h, render, enableDragSort, moveItem } from '../utils/dom.js';
import { UploadDropzone, chooseFiles, upload } from './ImageUploader.js';
import {
  ICON_CHOICES,
  BUTTON_VARIANTS,
  BOX_BACKGROUNDS,
  SPACING_CHOICES,
  HERO_HEIGHTS,
  ALIGNMENTS,
  emptyCard,
  emptyKpi,
  emptyButton,
} from '../utils/blocks.js';

/**
 * The edit form for a single block. Rendered inside the block toolbar's Edit
 * dialog, so the canvas stays the primary editing surface.
 *
 * `onChange` receives the whole updated block on every keystroke.
 */
export const BLOCK_LABELS = {
  text: 'Text box',
  image: 'Image box',
  video: 'Video box',
  profile: 'Profile image',
  heading: 'Heading',
  paragraph: 'Paragraph',
  bullets: 'Bullet list',
  quote: 'Quote',
  stats: 'Stat counters',
  cards: 'Card grid',
  gallery: 'Image gallery',
  divider: 'Divider',
  hero: 'Hero',
  kpi: 'KPI cards',
  icon: 'Icon',
  buttons: 'Buttons / links',
  logo: 'Logo',
  box: 'Layout box',
};

const CARD_VARIANTS = [
  ['plain', 'Plain cards'],
  ['team', 'Team / trainers'],
  ['partner', 'Partners / MOUs'],
  ['program', 'Programs / courses'],
  ['placement', 'Placements'],
  ['certification', 'Certifications'],
];

export { emptyCard };

const field = (label, control, hint) =>
  h(
    'label',
    { class: 'field' },
    h('span', { class: 'field__label' }, label),
    control,
    hint ? h('span', { class: 'field__hint' }, hint) : null,
  );

const textInput = (value, oninput, placeholder = '') =>
  h('input', { class: 'input', value: value ?? '', placeholder, oninput: (e) => oninput(e.target.value) });

const textArea = (value, oninput, placeholder = '', rows = 5) =>
  h('textarea', {
    class: 'textarea',
    rows: String(rows),
    placeholder,
    oninput: (e) => oninput(e.target.value),
    text: value ?? '',
  });

const select = (options, current, onchange) =>
  h(
    'select',
    { class: 'select', onchange: (e) => onchange(e.target.value) },
    ...options.map(([value, label]) => h('option', { value, selected: current === value }, label)),
  );

/** Upload-or-replace row for the single-asset block types. */
function assetRow(block, emit, repaint, { label, accept = 'image' }) {
  const asset = block.asset;
  const isVideo = accept === 'video';

  const pick = async () => {
    const files = await chooseFiles({ multiple: false, accept });
    const assets = await upload(files);
    if (assets[0]) {
      block.assetId = assets[0].id;
      block.asset = assets[0];
      emit();
      repaint();
    }
  };

  return h(
    'div',
    { class: 'asset-row' },
    asset?.url
      ? isVideo
        ? h('video', { class: 'asset-row__preview', src: asset.url, muted: true, controls: true })
        : h('img', { class: 'asset-row__preview', src: asset.url, alt: '' })
      : h('div', { class: 'asset-row__empty' }, isVideo ? '▷' : '▣'),
    h(
      'div',
      { class: 'asset-row__actions' },
      h('button', { class: 'btn btn--primary btn--sm', type: 'button', onclick: pick },
        asset?.url ? `Replace ${label}` : `Upload ${label}`),
      asset?.url
        ? h(
            'button',
            {
              class: 'btn btn--danger btn--sm',
              type: 'button',
              onclick: () => {
                block.assetId = null;
                block.asset = null;
                emit();
                repaint();
              },
            },
            'Remove',
          )
        : null,
      asset?.note ? h('p', { class: 'media-note' }, asset.note) : null,
    ),
  );
}

/** Glyph picker: the curated set as clickable chips, plus a free-text escape. */
function iconPicker(current, onPick) {
  const chips = ICON_CHOICES.map((glyph) =>
    h(
      'button',
      {
        class: `icon-chip${current === glyph ? ' is-active' : ''}`,
        type: 'button',
        title: glyph,
        onclick: (event) => {
          event.preventDefault();
          onPick(glyph);
        },
      },
      glyph,
    ),
  );

  return h(
    'div',
    { class: 'icon-picker' },
    h('div', { class: 'icon-picker__grid' }, ...chips),
    h('input', {
      class: 'input input--icon',
      value: current || '',
      maxlength: '4',
      placeholder: 'Or paste any character / emoji',
      oninput: (e) => onPick(e.target.value),
    }),
  );
}

/**
 * Editor for a list of buttons — shared by the hero and the buttons block, so
 * a call to action behaves the same wherever it is placed.
 */
function buttonListEditor(list, { onChange, repaint, allowClear = true }) {
  const rows = list.map((item, i) =>
    h(
      'div',
      { class: 'subcard' },
      h(
        'div',
        { class: 'subcard__head' },
        h('span', { class: 'block-card__handle', title: 'Drag to reorder' }, '⠿'),
        h('span', {}, item.label || `Button ${i + 1}`),
        allowClear || list.length > 1
          ? h('button', {
              class: 'btn btn--danger btn--sm', type: 'button',
              onclick: () => { list.splice(i, 1); onChange(); repaint(); },
            }, 'Remove')
          : null,
      ),
      h(
        'div',
        { class: 'grid-2' },
        field('Label', textInput(item.label, (v) => { list[i].label = v; onChange(); })),
        field(
          'Link',
          textInput(item.href, (v) => { list[i].href = v.trim(); onChange(); },
            'https://… , mailto:… or tel:…'),
          'Left blank, the button still shows but does nothing.',
        ),
        field('Style', select(BUTTON_VARIANTS, item.variant || 'primary', (v) => {
          list[i].variant = v;
          onChange();
        })),
        field('Icon (optional)', textInput(item.icon, (v) => { list[i].icon = v; onChange(); }, '→')),
      ),
    ),
  );

  enableDragSort(rows, (from, to) => {
    const moved = moveItem(list, from, to);
    list.splice(0, list.length, ...moved);
    onChange();
    repaint();
  }, { handle: '.block-card__handle' });

  return [
    ...rows,
    h('button', {
      class: 'btn btn--ghost btn--sm', type: 'button',
      onclick: () => { list.push(emptyButton()); onChange(); repaint(); },
    }, '+ Add button'),
  ];
}

export function BlockFields(block, onChange) {
  const host = h('div', { class: 'block-fields' });
  const emit = () => onChange(block);
  const repaint = () => paint();

  function paint() {
    const rows = [];

    switch (block.type) {
      case 'text':
        rows.push(
          field('Heading (optional)', textInput(block.heading, (v) => { block.heading = v; emit(); })),
          field(
            'Heading size',
            select([['2', 'Large'], ['3', 'Small']], String(block.level || 2), (v) => {
              block.level = Number(v);
              emit();
            }),
          ),
          field(
            'Body text',
            textArea(block.body, (v) => { block.body = v; emit(); },
              'One or more paragraphs. Leave a blank line between them.', 7),
            'Supports **bold** and *italic*.',
          ),
          field(
            'Bullet points (one per line)',
            textArea((block.items || []).join('\n'), (v) => {
              block.items = v.split('\n').map((s) => s.trim()).filter(Boolean);
              emit();
            }, 'Each line becomes a bullet', 4),
          ),
          field(
            'Alignment',
            select([['left', 'Left'], ['center', 'Centred']], block.align || 'left', (v) => {
              block.align = v;
              emit();
            }),
          ),
        );
        break;

      case 'image':
        rows.push(
          assetRow(block, emit, repaint, { label: 'image', accept: 'image' }),
          field('Title (shown above the image)', textInput(block.title, (v) => { block.title = v; emit(); })),
          field('Caption (shown below the image)', textInput(block.caption, (v) => { block.caption = v; emit(); })),
          field(
            'Alt text',
            textInput(block.alt, (v) => { block.alt = v; emit(); }, 'Describe the image for screen readers'),
            'Left blank, the title is used.',
          ),
          h(
            'div',
            { class: 'grid-2' },
            field(
              'Fit inside the box',
              select([['contain', 'Show the whole image'], ['cover', 'Fill the box (crops the edges)']], block.fit || 'contain', (v) => {
                block.fit = v;
                emit();
              }),
            ),
            field(
              'Corners',
              select([['none', 'Square'], ['sm', 'Slight'], ['md', 'Rounded'], ['lg', 'Very rounded'], ['pill', 'Circle / pill']],
                block.radius || 'md', (v) => { block.radius = v; emit(); }),
            ),
          ),
        );
        break;

      case 'video': {
        const usingUrl = block.source === 'url';
        rows.push(
          field(
            'Where is the video?',
            select(
              [['upload', 'Upload a video file'], ['url', 'Use a link (YouTube, Vimeo, Drive or direct file)']],
              usingUrl ? 'url' : 'upload',
              (v) => {
                block.source = v;
                emit();
                repaint();
              },
            ),
          ),
          usingUrl
            ? field(
                'Video link',
                textInput(block.videoUrl, (v) => { block.videoUrl = v.trim(); emit(); },
                  'https://www.youtube.com/watch?v=… or https://…/clip.mp4'),
                'YouTube, Vimeo and Google Drive share links play in an embed; .mp4/.webm/.ogv/.mov links play directly. Both support the fullscreen button with Back.',
              )
            : assetRow(block, emit, repaint, { label: 'video', accept: 'video' }),
          usingUrl && block.videoUrl
            ? h('p', { class: 'media-note' },
                block.link
                  ? `Recognised as ${block.link.label}. Save to see it on the slide.`
                  : block.linkError || 'Save to check this link.')
            : null,
          field('Caption (optional)', textInput(block.caption, (v) => { block.caption = v; emit(); })),
          h(
            'div',
            { class: 'checkbox-grid' },
            h('label', { class: 'checkbox-row' },
              h('input', {
                type: 'checkbox', checked: block.muted,
                onchange: (e) => { block.muted = e.target.checked; emit(); },
              }), 'Start muted'),
            h('label', { class: 'checkbox-row' },
              h('input', {
                type: 'checkbox', checked: block.loop,
                onchange: (e) => { block.loop = e.target.checked; emit(); },
              }), 'Loop'),
            h('label', { class: 'checkbox-row' },
              h('input', {
                type: 'checkbox', checked: block.autoplay,
                onchange: (e) => { block.autoplay = e.target.checked; if (e.target.checked) block.muted = true; emit(); repaint(); },
              }), 'Autoplay (browsers require muted)'),
          ),
          usingUrl
            ? h('p', { class: 'field__hint' },
                'Muted / loop / autoplay apply to direct file links. Embedded players (YouTube, Vimeo, Drive) use their own controls.')
            : null,
        );
        break;
      }

      case 'profile':
        rows.push(
          assetRow(block, emit, repaint, { label: 'profile photo', accept: 'image' }),
          field('Name', textInput(block.name, (v) => { block.name = v; emit(); })),
          field('Role / designation', textInput(block.role, (v) => { block.role = v; emit(); })),
          field('Short note (optional)', textArea(block.blurb, (v) => { block.blurb = v; emit(); }, '', 3)),
          field(
            'Frame shape',
            select([['portrait', 'Portrait 4:5'], ['square', 'Square 1:1']], block.frame || 'portrait', (v) => {
              block.frame = v;
              emit();
            }),
          ),
          field(
            'Crop focus',
            select([['top', 'Face near the top'], ['center', 'Centre'], ['bottom', 'Lower part']], block.focus || 'center', (v) => {
              block.focus = v;
              emit();
            }),
            'The photo is auto-cropped to the frame around this band.',
          ),
        );
        break;

      case 'heading':
        rows.push(
          field('Heading text', textInput(block.text, (v) => { block.text = v; emit(); })),
          field('Size', select([['2', 'Large'], ['3', 'Small']], String(block.level || 2), (v) => {
            block.level = Number(v);
            emit();
          })),
        );
        break;

      case 'paragraph':
        rows.push(field('Paragraph', textArea(block.text, (v) => { block.text = v; emit(); }, '', 6),
          'Supports **bold** and *italic*.'));
        break;

      case 'bullets':
        rows.push(field('Bullets (one per line)', textArea((block.items || []).join('\n'), (v) => {
          block.items = v.split('\n').map((s) => s.trim()).filter(Boolean);
          emit();
        }, '', 6)));
        break;

      case 'quote':
        rows.push(
          field('Quote', textArea(block.text, (v) => { block.text = v; emit(); }, '', 4)),
          field('Author', textInput(block.author, (v) => { block.author = v; emit(); })),
          field('Role', textInput(block.role, (v) => { block.role = v; emit(); })),
          h(
            'div',
            { class: 'asset-row' },
            block.image?.url ? h('img', { class: 'asset-row__preview asset-row__preview--round', src: block.image.url, alt: '' }) : null,
            h(
              'div',
              { class: 'asset-row__actions' },
              h('button', {
                class: 'btn btn--ghost btn--sm', type: 'button',
                onclick: async () => {
                  const assets = await upload(await chooseFiles({ multiple: false, accept: 'image' }));
                  if (assets[0]) {
                    block.imageAssetId = assets[0].id;
                    block.image = assets[0];
                    emit();
                    repaint();
                  }
                },
              }, block.image?.url ? 'Replace portrait' : 'Upload portrait'),
            ),
          ),
        );
        break;

      case 'stats': {
        const statRows = (block.items || []).map((item, i) =>
          h(
            'div',
            { class: 'subcard' },
            h(
              'div',
              { class: 'subcard__head' },
              h('span', { class: 'block-card__handle', title: 'Drag to reorder' }, '⠿'),
              h('span', {}, `Stat ${i + 1}`),
              h('button', {
                class: 'btn btn--danger btn--sm', type: 'button',
                onclick: () => { block.items.splice(i, 1); emit(); repaint(); },
              }, 'Remove'),
            ),
            h(
              'div',
              { class: 'grid-2' },
              field('Number', h('input', {
                class: 'input', type: 'number', value: String(item.value ?? 0),
                oninput: (e) => { block.items[i].value = Number(e.target.value) || 0; emit(); },
              })),
              field('Prefix', textInput(item.prefix, (v) => { block.items[i].prefix = v; emit(); }, '₹')),
              field('Suffix', textInput(item.suffix, (v) => { block.items[i].suffix = v; emit(); }, '+ or %')),
              field('Label', textInput(item.label, (v) => { block.items[i].label = v; emit(); })),
            ),
          ),
        );
        enableDragSort(statRows, (from, to) => {
          block.items = moveItem(block.items, from, to);
          emit();
          repaint();
        }, { handle: '.block-card__handle' });
        rows.push(...statRows, h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => {
            block.items = [...(block.items || []), { value: 0, prefix: '', suffix: '', label: '' }];
            emit();
            repaint();
          },
        }, '+ Add stat'));
        break;
      }

      case 'cards': {
        rows.push(field('Card style', select(CARD_VARIANTS, block.variant || 'plain', (v) => {
          block.variant = v;
          emit();
        })));
        const cardRows = (block.items || []).map((card, i) =>
          h(
            'div',
            { class: 'subcard' },
            h(
              'div',
              { class: 'subcard__head' },
              h('span', { class: 'block-card__handle', title: 'Drag to reorder' }, '⠿'),
              h('span', {}, card.title || `Card ${i + 1}`),
              h('button', {
                class: 'btn btn--danger btn--sm', type: 'button',
                onclick: () => { block.items.splice(i, 1); emit(); repaint(); },
              }, 'Remove'),
            ),
            h(
              'div',
              { class: 'grid-2' },
              field('Title', textInput(card.title, (v) => { block.items[i].title = v; emit(); })),
              field('Subtitle', textInput(card.subtitle, (v) => { block.items[i].subtitle = v; emit(); })),
              field('Meta line', textInput(card.meta, (v) => { block.items[i].meta = v; emit(); })),
              field('Tags (comma separated)', textInput((card.tags || []).join(', '), (v) => {
                block.items[i].tags = v.split(',').map((t) => t.trim()).filter(Boolean);
                emit();
              })),
            ),
            field('Description', textArea(card.body, (v) => { block.items[i].body = v; emit(); }, '', 3)),
            h(
              'div',
              { class: 'asset-row' },
              card.image?.url ? h('img', { class: 'asset-row__preview', src: card.image.url, alt: '' }) : null,
              h(
                'div',
                { class: 'asset-row__actions' },
                h('button', {
                  class: 'btn btn--ghost btn--sm', type: 'button',
                  onclick: async () => {
                    const assets = await upload(await chooseFiles({ multiple: false, accept: 'image' }));
                    if (assets[0]) {
                      block.items[i].imageAssetId = assets[0].id;
                      block.items[i].image = assets[0];
                      emit();
                      repaint();
                    }
                  },
                }, card.image?.url ? 'Replace image' : 'Upload image'),
              ),
            ),
          ),
        );
        enableDragSort(cardRows, (from, to) => {
          block.items = moveItem(block.items, from, to);
          emit();
          repaint();
        }, { handle: '.block-card__handle' });
        rows.push(...cardRows, h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => { block.items = [...(block.items || []), emptyCard()]; emit(); repaint(); },
        }, '+ Add card'));
        break;
      }

      case 'gallery': {
        const images = block.images || [];
        // Titles are stored positionally next to the asset ids; keep both in step.
        const syncGallery = () => {
          block.assetIds = block.images.map((img) => img.id);
          block.titles = block.images.map((img) => img.title || '');
        };

        const thumbs = images.map((image, i) =>
          h(
            'div',
            { class: 'thumb thumb--titled' },
            h('img', { src: image.url, alt: image.title || image.name || '', title: 'Drag to reorder' }),
            h('input', {
              class: 'thumb__title',
              value: image.title || '',
              placeholder: 'Image title',
              // Keep focus: update the model without repainting the strip.
              oninput: (e) => {
                block.images[i].title = e.target.value;
                syncGallery();
                emit();
              },
            }),
            h('button', {
              class: 'thumb__remove', type: 'button', title: 'Remove',
              onclick: () => {
                block.images.splice(i, 1);
                syncGallery();
                emit();
                repaint();
              },
            }, '✕'),
          ),
        );
        enableDragSort(thumbs, (from, to) => {
          block.images = moveItem(block.images, from, to);
          syncGallery();
          emit();
          repaint();
        });
        rows.push(
          field('Gallery caption', textInput(block.caption, (v) => { block.caption = v; emit(); })),
          field(
            'How images fill their tile',
            select([['contain', 'Show the whole image'], ['cover', 'Fill the tile (crops to a uniform grid)']],
              block.fit || 'contain', (v) => { block.fit = v; emit(); }),
            'Use “show the whole image” when the picture carries text that must not be cut off.',
          ),
          images.length ? h('div', { class: 'thumb-strip' }, ...thumbs) : null,
          h('p', { class: 'field__hint' },
            `${images.length} image${images.length === 1 ? '' : 's'} · laid out 5 per row with the last row centred. Each title shows under its image and is used as its alt text.`),
          UploadDropzone({
            accept: 'image',
            onUploaded: (assets) => {
              block.images = [...(block.images || []), ...assets.map((a) => ({ ...a, title: '' }))];
              syncGallery();
              emit();
              repaint();
            },
          }),
        );
        break;
      }

      /* ---------------------------------------------- page-builder elements */
      case 'hero': {
        const mediaKind = block.media || 'color';
        rows.push(
          field('Kicker (small line above)', textInput(block.kicker, (v) => { block.kicker = v; emit(); })),
          field('Heading', textInput(block.heading, (v) => { block.heading = v; emit(); })),
          field('Subheading', textArea(block.subheading, (v) => { block.subheading = v; emit(); }, '', 3),
            'Supports **bold** and *italic*.'),
          field(
            'Background',
            select(
              [['color', 'Brand colour'], ['image', 'Image'], ['video', 'Video']],
              mediaKind,
              (v) => { block.media = v; emit(); repaint(); },
            ),
          ),
          mediaKind === 'image'
            ? assetRow(block, emit, repaint, { label: 'background image', accept: 'image' })
            : null,
          mediaKind === 'image'
            ? field('Alt text', textInput(block.alt, (v) => { block.alt = v; emit(); },
                'Describe the background for screen readers'))
            : null,
          mediaKind === 'video'
            ? field(
                'Where is the video?',
                select([['upload', 'Upload a video file'], ['url', 'Use a link']],
                  block.source === 'url' ? 'url' : 'upload',
                  (v) => { block.source = v; emit(); repaint(); }),
              )
            : null,
          mediaKind === 'video' && block.source === 'url'
            ? field('Video link', textInput(block.videoUrl, (v) => { block.videoUrl = v.trim(); emit(); },
                'https://…/clip.mp4 or a YouTube / Vimeo link'),
                'Background video always plays muted and looped.')
            : null,
          mediaKind === 'video' && block.source !== 'url'
            ? assetRow(block, emit, repaint, { label: 'background video', accept: 'video' })
            : null,
          mediaKind === 'video' && block.source === 'url' && block.linkError
            ? h('p', { class: 'media-note' }, block.linkError)
            : null,
          mediaKind !== 'color'
            ? field(
                `Darken the background — ${block.overlay ?? 45}%`,
                h('input', {
                  class: 'range', type: 'range', min: '0', max: '90', step: '5',
                  value: String(block.overlay ?? 45),
                  oninput: (e) => { block.overlay = Number(e.target.value); emit(); },
                  onchange: () => repaint(),
                }),
                'Enough contrast to keep the headline readable over a busy photo.',
              )
            : null,
          h(
            'div',
            { class: 'grid-2' },
            field('Height', select(HERO_HEIGHTS, block.height || 'md', (v) => { block.height = v; emit(); })),
            field('Alignment', select(ALIGNMENTS, block.align || 'left', (v) => { block.align = v; emit(); })),
          ),
          h('div', { class: 'field__label' }, 'Call-to-action buttons'),
          ...buttonListEditor(block.buttons || (block.buttons = []), { onChange: emit, repaint }),
        );
        break;
      }

      case 'kpi': {
        rows.push(
          h(
            'div',
            { class: 'grid-2' },
            field('Card style', select([['card', 'Filled cards'], ['outline', 'Outlined cards'], ['plain', 'No card']],
              block.variant || 'card', (v) => { block.variant = v; emit(); })),
            field('Per row', select([['auto', 'Fit automatically'], ['2', '2'], ['3', '3'], ['4', '4']],
              String(block.columns || 'auto'), (v) => { block.columns = v; emit(); }),
              'Cards always rebalance to fit the screen width.'),
          ),
        );

        const kpiRows = (block.items || []).map((item, i) =>
          h(
            'div',
            { class: 'subcard' },
            h(
              'div',
              { class: 'subcard__head' },
              h('span', { class: 'block-card__handle', title: 'Drag to reorder' }, '⠿'),
              h('span', {}, item.label || `KPI ${i + 1}`),
              h('button', {
                class: 'btn btn--danger btn--sm', type: 'button',
                onclick: () => { block.items.splice(i, 1); emit(); repaint(); },
              }, 'Remove'),
            ),
            h(
              'div',
              { class: 'grid-2' },
              field('Label', textInput(item.label, (v) => { block.items[i].label = v; emit(); },
                'Number of employees')),
              field('Number', h('input', {
                class: 'input', type: 'number', value: String(item.value ?? 0),
                oninput: (e) => { block.items[i].value = Number(e.target.value) || 0; emit(); },
              })),
              field('Prefix', textInput(item.prefix, (v) => { block.items[i].prefix = v; emit(); }, '₹')),
              field('Suffix', textInput(item.suffix, (v) => { block.items[i].suffix = v; emit(); }, '+ or %')),
            ),
            field('Note under the label (optional)', textInput(item.note, (v) => { block.items[i].note = v; emit(); })),
            field('Icon (optional)', iconPicker(item.icon, (glyph) => {
              block.items[i].icon = glyph;
              emit();
              repaint();
            })),
          ),
        );
        enableDragSort(kpiRows, (from, to) => {
          block.items = moveItem(block.items, from, to);
          emit();
          repaint();
        }, { handle: '.block-card__handle' });

        rows.push(...kpiRows, h('button', {
          class: 'btn btn--ghost btn--sm', type: 'button',
          onclick: () => { block.items = [...(block.items || []), emptyKpi()]; emit(); repaint(); },
        }, '+ Add KPI card'));
        break;
      }

      case 'icon':
        rows.push(
          field('Icon', iconPicker(block.glyph, (glyph) => { block.glyph = glyph; emit(); repaint(); })),
          field('Label (optional)', textInput(block.label, (v) => { block.label = v; emit(); })),
          field('Note (optional)', textArea(block.note, (v) => { block.note = v; emit(); }, '', 2)),
          h(
            'div',
            { class: 'grid-2' },
            field('Size', select([['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large']], block.size || 'md', (v) => {
              block.size = v;
              emit();
            })),
            field('Shape', select([['circle', 'Circle'], ['square', 'Rounded square'], ['none', 'Bare glyph']],
              block.shape || 'circle', (v) => { block.shape = v; emit(); })),
            field('Tone', select([['accent', 'Accent'], ['primary', 'Primary'], ['muted', 'Muted']],
              block.tone || 'accent', (v) => { block.tone = v; emit(); })),
          ),
        );
        break;

      case 'buttons':
        rows.push(
          field('Alignment', select(ALIGNMENTS, block.align || 'left', (v) => { block.align = v; emit(); })),
          ...buttonListEditor(block.items || (block.items = []), { onChange: emit, repaint }),
        );
        break;

      case 'logo':
        rows.push(
          assetRow(block, emit, repaint, { label: 'logo', accept: 'image' }),
          field('Title / organization name', textInput(block.title, (v) => { block.title = v; emit(); })),
          field('Alt text', textInput(block.alt, (v) => { block.alt = v; emit(); },
            'Describe the logo for screen readers'), 'Left blank, the title is used.'),
          field('Link (optional)', textInput(block.href, (v) => { block.href = v.trim(); emit(); },
            'https://partner.example')),
          h(
            'div',
            { class: 'grid-2' },
            field('Backing', select(
              [['surface', 'White tile'], ['none', 'Transparent'], ['soft', 'Soft brand tint'], ['dark', 'Dark tile']],
              block.background || 'surface', (v) => { block.background = v; emit(); },
            )),
            field('Padding', select(SPACING_CHOICES, block.pad || 'md', (v) => { block.pad = v; emit(); })),
          ),
          h('p', { class: 'field__hint' },
            'A logo is never cropped — it is fitted inside the tile, so wordmarks and emblems line up in the same row.'),
        );
        break;

      case 'box':
        rows.push(
          h('p', { class: 'field__hint' },
            `This box holds ${(block.children || []).length} element${(block.children || []).length === 1 ? '' : 's'}. `
            + 'Close this dialog and use “+ Inside” on the box to add elements, then drag them around within it.'),
          field('Label (editor only)', textInput(block.label, (v) => { block.label = v; emit(); },
            'e.g. “Left column”'), 'Shown while editing to keep long pages navigable.'),
          h(
            'div',
            { class: 'grid-2' },
            field('Background', select(BOX_BACKGROUNDS, block.background || 'surface', (v) => {
              block.background = v;
              emit();
            })),
            field('Padding', select(SPACING_CHOICES, block.padding || 'md', (v) => { block.padding = v; emit(); })),
            field('Inner spacing', select(SPACING_CHOICES, block.gap || 'md', (v) => { block.gap = v; emit(); })),
            field('Corners', select([['none', 'Square'], ['sm', 'Slight'], ['md', 'Rounded'], ['lg', 'Very rounded']],
              block.radius || 'md', (v) => { block.radius = v; emit(); })),
          ),
          h('label', { class: 'checkbox-row' },
            h('input', {
              type: 'checkbox', checked: block.border !== false,
              onchange: (e) => { block.border = e.target.checked; emit(); },
            }), 'Show a border'),
        );
        break;

      default:
        rows.push(h('p', { class: 'field__hint' }, 'This block has no settings.'));
    }

    render(host, ...rows.filter(Boolean));
  }

  paint();
  return host;
}
