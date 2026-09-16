import { h } from '../utils/dom.js';
import { icon } from '../utils/icons.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * A course prospectus, paged.
 *
 * The AI Ready Engineer flyer is two dense A4 pages — the offer, six reasons it
 * stands out, sixteen modules, eight benefits, a close. None of that fits one
 * 16:9 slide at a size a room can read, and cutting it down would throw away
 * the part a college actually asks about. So the whole flyer lives in one block
 * as a set of frames and the presenter walks them with the key that already
 * turns the page.
 *
 * Partner and tool names are set as type, never drawn. There are no official
 * Claude, OpenAI, Gemini or Copilot logo files in this library, and a
 * hand-traced vendor mark on a partnership slide is worse than no mark at all —
 * it is wrong in a way the vendor will notice. Send the official SVGs and these
 * become real lockups.
 */
export function CourseDeck(block, { editing = false } = {}) {
  const frames = block.frames || [];
  const hasHero = block.titleLines?.length || block.standfirst;
  if (!frames.length && !hasHero) {
    return h('div', { class: 'cd-root cd-root--empty ph-root' }, 'No course content yet.');
  }

  const root = h('div', { class: 'cd-root ph-root' });
  const built = [];

  /* ------------------------------------------------------------------ hero */
  if (hasHero) {
    const heroFrame = h('section', { class: 'cd-frame cd-frame--hero' },
      h('div', { class: 'cd-inner' },
        block.eyebrow ? h('p', { class: 'cd-eyebrow' }, block.eyebrow) : null,
        h('h1', { class: 'cd-title' },
          ...(block.titleLines || []).map((line) => h('span', { class: 'cd-title__line' }, line)),
        ),
        block.standfirst ? h('p', { class: 'cd-standfirst' }, block.standfirst) : null,
        block.stats?.length || block.credential
          ? h('div', { class: 'cd-stats' },
              ...block.stats.map((s) => h('div', { class: 'cd-stat' },
                h('span', { class: 'cd-stat__value' }, s.value),
                s.label ? h('span', { class: 'cd-stat__label' }, s.label) : null,
              )),
              /* Set as type, not traced. The seal on the flyer is Anthropic's
                 artwork; drawing an approximation of somebody's certification
                 mark is the one thing worse than not showing it. */
              block.credential
                ? h('div', { class: 'cd-stat cd-seal' },
                    block.credential.ring
                      ? h('span', { class: 'cd-seal__ring' }, block.credential.ring)
                      : null,
                    h('span', { class: 'cd-seal__name' }, block.credential.name),
                    block.credential.note
                      ? h('span', { class: 'cd-seal__note' }, block.credential.note)
                      : null,
                  )
                : null,
            )
          : null,
        block.partners?.length
          ? h('div', { class: 'cd-partners' },
              h('span', { class: 'cd-partners__label' }, 'Our AI Partners'),
              h('div', { class: 'cd-partners__row' },
                ...block.partners.map((p) => h('span', { class: 'cd-partner' },
                  h('span', { class: 'cd-partner__name' }, p.name),
                  p.note ? h('span', { class: 'cd-partner__note' }, p.note) : null,
                )),
              ),
            )
          : null,
      ),
    );
    built.push(heroFrame);
  }

  /* ---------------------------------------------------------------- frames */
  for (const frame of frames) {
    const head = h('div', { class: 'cd-head' },
      frame.eyebrow ? h('p', { class: 'cd-eyebrow' }, frame.eyebrow) : null,
      frame.title ? h('h2', { class: 'cd-heading' }, frame.title) : null,
      frame.subtitle ? h('p', { class: 'cd-sub' }, frame.subtitle) : null,
    );

    let body = null;

    if (frame.kind === 'modules') {
      // Numbered here rather than in the data: the number is the position in
      // the curriculum, so storing it would let the two drift apart.
      const cols = frame.columns || 2;
      body = h('ol', {
        class: 'cd-modules',
        // The row count has to be explicit for the grid to fill downwards; it is
        // the item count spread over the columns, rounded up.
        style: { '--cd-cols': String(cols), '--cd-rows': String(Math.ceil(frame.items.length / cols)) },
      },
        ...frame.items.map((item, i) => h('li', { class: 'cd-module' },
          h('span', { class: 'cd-module__n' }, String(i + 1).padStart(2, '0')),
          h('span', { class: 'cd-module__title' }, item.title),
        )),
      );
    } else if (frame.kind === 'close') {
      body = h('div', { class: 'cd-close' },
        frame.chips?.length
          ? h('div', { class: 'cd-chips' },
              ...frame.chips.map((c) => h('span', { class: 'cd-chip' }, c)))
          : null,
        frame.stats?.length
          ? h('div', { class: 'cd-stats cd-stats--close' },
              ...frame.stats.map((s) => h('div', { class: 'cd-stat' },
                h('span', { class: 'cd-stat__value' }, s.value),
                s.label ? h('span', { class: 'cd-stat__label' }, s.label) : null,
              )))
          : null,
        frame.lines?.length
          ? h('div', { class: 'cd-lines' },
              ...frame.lines.map((l, i) =>
                h('p', { class: `cd-line${i === frame.lines.length - 1 ? ' cd-line--last' : ''}` }, l)))
          : null,
        frame.contact?.length
          ? h('div', { class: 'cd-contact' },
              ...frame.contact.map((c) => h('span', { class: 'cd-contact__item' },
                icon(c.icon || 'link', { class: 'ic ic--xs' }),
                h('span', {}, c.label),
              )))
          : null,
      );
    } else {
      body = h('div', { class: 'cd-cards', style: { '--cd-cols': String(frame.columns || 2) } },
        ...frame.items.map((item) => h('div', { class: 'cd-card' },
          h('span', { class: 'cd-card__mark' }, icon(item.icon || 'sparkles', { class: 'ic' })),
          h('div', {},
            h('h3', { class: 'cd-card__title' }, item.title),
            item.body ? h('p', { class: 'cd-card__body' }, item.body) : null,
          ),
        )),
      );
    }

    built.push(h('section', { class: `cd-frame cd-frame--${frame.kind}` },
      h('div', { class: 'cd-inner' }, head, body)));
  }

  built.forEach((node) => root.appendChild(node));

  /* ------------------------------------------------------------- the steps */
  let at = 0;
  const counter = h('div', { class: 'cd-progress' },
    ...built.map(() => h('span', { class: 'cd-progress__dot' })));
  root.appendChild(counter);

  const show = (next) => {
    at = next;
    built.forEach((node, i) => {
      node.classList.toggle('is-on', i === at);
      node.setAttribute('aria-hidden', String(i !== at));
    });
    [...counter.children].forEach((dot, i) => dot.classList.toggle('is-on', i === at));
  };

  if (!editing && built.length > 1) {
    registerStepper((delta) => {
      const next = at + (delta > 0 ? 1 : -1);
      if (next < 0 || next >= built.length) return false;
      show(next);
      return true;
    });
  }

  show(0);
  return root;
}
