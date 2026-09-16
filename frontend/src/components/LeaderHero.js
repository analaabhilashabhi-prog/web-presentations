import { h, svg, render } from '../utils/dom.js';
import { inlineRich } from '../utils/format.js';
import { icon } from '../utils/icons.js';

/* Berths measured against the cutout's own silhouette, not spaced evenly down
   the column. The figure is only ~28% of the column wide at the head and swells
   to ~96% at the arms, so a constant inset that hugs him at the waist leaves the
   upper pills stranded in empty ground. The top three therefore sit well inboard
   to meet the head and neck; the lower two ride the shoulder line, which is
   where the reference has them overlap the photo.
   Order matches the stored tag order.

   Every pill is anchored by the edge that faces the figure — `right` on the left
   side, `left` on the right side — so a longer label grows away from him instead
   of creeping over the head. Anchoring by the outer edge made the gap a function
   of the label's length, which is why the upper pills drifted.

   The numbers below are read off the asset's own alpha, sampled every 2% of its
   height, then mapped through the box the portrait actually occupies in this
   column (109.3% of its width, top at 2.5%, see the wrapper rule in app.css):

     row 16%  silhouette 35.0 → 63.0   (temple)
     row 21%              33.0 → 64.5   (jaw, widest point of the head)
     row 38%              32.0 → 66.5   (neck, just before the shoulders flare)
     row 52%              11.1 → 88.0   (shoulder line)
     row 77%               4.2 → 96.0   (upper arm)

   The two lower pills are held off the block's right edge rather than off the
   silhouette: at 96% he is nearly column-wide, and honouring the gap there would
   push them past the edge, where `overflow: hidden` would slice the rounded end
   off. They ride the arm instead, which is where the reference has them. */
const TAG_SPOTS = [
  // Beside the temple — silhouette starts at 33.8% of the column here.
  { side: 'left', right: '69%', top: '16.4%' },
  // Off the far shoulder — silhouette ends at 66.1%.
  { side: 'right', left: '68.5%', top: '21.4%' },
  // At the neck, before the shoulders flare.
  { side: 'left', right: '71%', top: '38.5%' },
  /* These two overlap the upper arm by design; he is near column-wide here, so
     they are set off the block's right edge instead — and off the same edge, so
     the pair reads as one margin rather than two near-misses. */
  { side: 'right', left: '79%', top: '52.6%' },
  { side: 'right', left: '75%', top: '77.7%' },
];

/* The name is drawn, not typed: an outline strokes itself on, then the solid
   letterform fades in over it. That needs real SVG text — stroke-dasharray has
   no effect on an HTML element. */
const NAME_SIZE = 130; // user units; the viewBox is fitted to the glyphs below
const NAME_BASELINE = 100;
const NAME_BOX_H = 118;

/**
 * Sizes the viewBox from the glyphs actually rasterised rather than from a
 * width measured against Oswald. The display face is whatever survived the
 * fallback chain, so a hardcoded viewBox would either crop the surname or
 * leave a gap before the portrait. Both name parts keep one shared cap height
 * because each SVG carries the same viewBox height and takes its width from
 * the intrinsic ratio.
 */
function fitNameBox(svgEl, textEl) {
  let box;
  try {
    box = textEl.getBBox();
  } catch {
    return; // not laid out yet (detached, or display:none) — leave the estimate
  }
  if (!box || !box.width) return;
  const pad = 2; // the stroke sits astride the outline, so it overhangs the bbox
  svgEl.setAttribute('viewBox', `${box.x - pad} 0 ${box.width + pad * 2} ${NAME_BOX_H}`);
}

/**
 * Sets the watermark's size from the block it spans rather than from a viewport
 * clamp, so the surname reaches both edges whatever its length and however wide
 * the slide is. Measured off a probe size and scaled, because the glyph widths
 * of the fallback serif are not knowable ahead of time.
 */
const WATERMARK_PROBE = 200;

function fitWatermark(host, inner) {
  if (!host.clientWidth) return;
  /* Clear last run's correction first. This fires on rAF, on fonts.ready and on
     every resize, and the offset below is derived from where the text sits — so
     measuring while the previous translate is still applied makes each run
     cancel the one before it. */
  inner.style.transform = 'none';
  inner.style.fontSize = `${WATERMARK_PROBE}px`;
  const measured = inner.getBoundingClientRect().width;
  if (!measured) return;
  // Both rects are post-transform, so the slide's scale cancels in the ratio.
  const hostBox = host.getBoundingClientRect();
  const ratio = hostBox.width ? measured / hostBox.width : 0;
  if (!ratio) return;
  inner.style.fontSize = `${Math.round((WATERMARK_PROBE / ratio) * 0.98)}px`;

  /* Optical centring. Centring the line box is not centring the letters: a
     surname with no descender has all its ink above the baseline — "Neelam"
     measures a 305px ascent against a 6px descent — which leaves the word
     sitting ~5% of the block high. Shift by the measured gap between the ink
     centre and the block centre.
     Everything here is kept in unscaled CSS pixels: TextMetrics reports those,
     while getBoundingClientRect reports post-scale, and mixing the two silently
     bakes the slide's scale into the offset. */
  const scale = hostBox.width / host.clientWidth;
  if (!scale) return;
  const cs = getComputedStyle(inner);
  const ctx = (fitWatermark.ctx ||= document.createElement('canvas').getContext('2d'));
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const ink = ctx.measureText(inner.textContent || '');
  if (!(ink.actualBoundingBoxAscent >= 0)) return; // unsupported — leave it boxed

  /* Everything is measured against the line box, never the block. The entrance
     animation holds the watermark 16px low through its delay, and an ancestor
     transform shifts any block-relative reading by that much — which silently
     lands in the offset. The baseline and the line box move together, so their
     difference is immune to it. */
  const lineBox = inner.getBoundingClientRect();
  const probe = document.createElement('span');
  probe.textContent = 'x';
  probe.style.cssText = 'display:inline-block;width:0;overflow:hidden';
  inner.appendChild(probe);
  const baselineInBox = (probe.getBoundingClientRect().bottom - lineBox.top) / scale;
  probe.remove();

  // align-items already centres the line box on the block, so closing the gap
  // between the ink centre and the line-box centre is what centres the letters.
  const inkCentreInBox = baselineInBox - (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2;
  const delta = lineBox.height / scale / 2 - inkCentreInBox;
  if (!Number.isFinite(delta)) return;

  /* A correction this size only ever closes the gap between the line box and
     the ink inside it, so it cannot exceed the line box. Bounding it means a
     font whose metrics arrive wrong — or a measurement taken on a frame where
     the block was mid-transform — nudges the watermark rather than throwing it
     off the top of the slide. */
  const bound = lineBox.height / scale;
  inner.style.transform = `translateY(${Math.round(Math.max(-bound, Math.min(bound, delta)))}px)`;
}

function watermark(text) {
  const inner = h('span', { class: 'leader-hero__watermark-text' }, text);
  const node = h('div', { class: 'leader-hero__watermark', 'aria-hidden': 'true' }, inner);

  const fit = () => {
    const host = node.closest('.leader-hero__stage');
    if (host) fitWatermark(host, inner);
  };
  requestAnimationFrame(fit);
  if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});
  // Presenting rescales the slide, and the pane resizes with the nav.
  if (typeof ResizeObserver === 'function') {
    const ro = new ResizeObserver(fit);
    requestAnimationFrame(() => {
      const host = node.closest('.leader-hero__stage');
      if (host) ro.observe(host);
    });
  }

  return node;
}

function nameLine(text, { tone, strokeDelay, fillDelay }) {
  const shared = {
    x: 0,
    y: NAME_BASELINE,
    'font-size': NAME_SIZE,
    'letter-spacing': '.01em',
  };

  const stroke = svg('text', {
    ...shared,
    class: 'leader-hero__draw-stroke',
    stroke: tone,
    'stroke-width': 1.5,
    fill: 'none',
    style: { animationDelay: strokeDelay },
  }, text);

  const fill = svg('text', {
    ...shared,
    class: 'leader-hero__draw-fill',
    fill: tone,
    style: { animationDelay: fillDelay },
  }, text);

  // A condensed cap runs roughly half its point size wide; corrected on load.
  const estimate = Math.max(1, text.length) * NAME_SIZE * 0.52;
  const node = svg(
    'svg',
    {
      class: 'leader-hero__draw',
      viewBox: `0 0 ${estimate} ${NAME_BOX_H}`,
      preserveAspectRatio: 'xMinYMid meet',
      role: 'img',
      'aria-label': text,
    },
    stroke,
    fill,
  );

  // Fonts land after first paint, and a substituted face changes every advance
  // width, so fit once the real face is in and again on the next frame in case
  // the block was still detached.
  const fit = () => fitNameBox(node, fill);
  requestAnimationFrame(fit);
  if (document.fonts?.ready) document.fonts.ready.then(fit).catch(() => {});

  return node;
}

/**
 * Hosts that refuse to be shown inside another site.
 *
 * Measured, not guessed: Instagram and Facebook answer with X-Frame-Options: DENY,
 * YouTube with SAMEORIGIN, LinkedIn blocks framing (and answers a bot with HTTP 999),
 * and academy.oracle.com 403s a direct fetch.
 *
 * Checked before the frame is built rather than after. The obvious approach - create the
 * frame, wait for `load`, fall back if it never fires - does not work: Chrome loads its
 * own error page into the refused frame and fires `load` for that, so the frame sits
 * there showing a broken-document icon and looks like a fault in the deck. Deciding up
 * front means the panel is right immediately, with no blank second.
 *
 * A host is only here because it was checked. Take one out and it gets a real frame.
 */
const REFUSES_FRAMING = [
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'academy.oracle.com',
];

const framingRefused = (href) => {
  let host;
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { return false; }
  return REFUSES_FRAMING.some((h) => host === h || host.endsWith('.' + h));
};

export function LeaderHero(block, { editing = false } = {}) {
  const tags = (block.tags || []).slice(0, TAG_SPOTS.length);
  const portraitUrl = block.asset?.url || '/uploads/babji_hero_crop.png';

  const eyebrow = h(
    'div',
    { class: 'leader-hero__eyebrow' },
    block.index ? h('span', { class: 'leader-hero__index' }, block.index) : null,
    h('span', { class: 'leader-hero__rule' }),
    block.kicker ? h('span', { class: 'leader-hero__kicker' }, block.kicker) : null,
  );

  // Given name in ink, surname in the organization's lead colour.
  const name = h(
    'div',
    { class: 'leader-hero__name' },
    block.firstName
      ? h('div', { class: 'leader-hero__name-line' }, nameLine(block.firstName.toUpperCase(), {
          tone: 'var(--leader-ink)',
          strokeDelay: '0s',
          fillDelay: '1.45s',
        }))
      : null,
    block.lastName
      ? h('div', { class: 'leader-hero__name-line' }, nameLine(block.lastName.toUpperCase(), {
          tone: 'var(--leader-accent)',
          strokeDelay: '.4s',
          fillDelay: '1.9s',
        }))
      : null,
  );

  /* ------------------------------------------------------------- the links
     Each one opens in place with a back button, rather than throwing the presenter
     out to a browser tab mid-deck.

     What it opens is a local card, not the live site. Every one of these five refuses
     to be framed - measured, not assumed: Instagram and Facebook send
     X-Frame-Options: DENY, YouTube sends SAMEORIGIN, LinkedIn answers a bot with 999
     and blocks framing anyway, and academy.oracle.com 403s. An iframe would be five
     blank rectangles. And the deck presents with no network at all, so even a
     permissive site would be blank on the night.

     So the panel carries what is worth saying about the destination and offers the
     real URL for anyone with a connection. The interaction is the one asked for; the
     content is the part that can survive a room with no internet. */
  const viewer = h('div', { class: 'lh-view', hidden: true });
  let openLink = null;

  const closeViewer = () => {
    openLink = null;
    viewer.classList.remove('is-open');
    /* Drop the src, not just the panel: a frame left loaded keeps the site running -
       audio, timers, network - behind a slide the presenter has already moved past. */
    const frame = viewer.querySelector('.lh-view__frame');
    if (frame) frame.removeAttribute('src');
    window.setTimeout(() => { if (!viewer.classList.contains('is-open')) viewer.hidden = true; }, 240);
  };

  const openViewer = (link) => {
    openLink = link;
    const host = (() => {
      try { return new URL(link.href).hostname.replace(/^www\./, ''); } catch { return link.href; }
    })();

    /* A real frame onto the site, built the same way the Platforms stage builds its
       one: same sandbox, same referrer policy, same New-tab escape. allow-same-origin
       is in the list because without it the site cannot set its own cookie and any
       login inside the frame fails.

       Worth knowing what it will do: all five of these destinations send a header that
       forbids framing - Instagram and Facebook DENY, YouTube SAMEORIGIN, LinkedIn
       blocks it outright, academy.oracle.com 403s - so the frame will come up empty
       for them, and there is no network at presentation time either. The strip under
       the frame says so, and New tab is the way out. Any URL that does permit framing
       renders here properly. */
    const refused = framingRefused(link.href);

    /* What the site will not let us do, said plainly, with the control that does work.
       No empty frame and no waiting: the host list above is checked first. */
    const blockedPanel = () => h(
      'div',
      { class: 'lh-view__blocked' + (link.wide ? ' lh-view__blocked-word' : '') },
      linkGlyph(link, 'ic'),
      h('h3', {}, link.label || host),
      h(
        'p',
        {},
        (link.note ? link.note + ' ' : '')
          + host + ' does not allow its pages to be shown inside another site, '
          + 'so it opens in a browser instead.',
      ),
      h(
        'a',
        {
          class: 'lh-view__out',
          href: link.href,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        icon('arrow-up-right', { class: 'ic ic--xs' }),
        h('span', {}, 'Open ' + host),
      ),
      h('p', { class: 'lh-view__url' }, link.href),
    );

    const frame = refused ? null : h('iframe', {
      class: 'lh-view__frame',
      title: link.label || host,
      src: link.href,
      sandbox: 'allow-same-origin allow-scripts allow-forms allow-popups'
        + ' allow-top-navigation-by-user-activation',
      referrerpolicy: 'no-referrer-when-downgrade',
      loading: 'lazy',
    });

    render(
      viewer,
      h(
        'div',
        { class: 'lh-view__bar' },
        h(
          'button',
          { class: 'lh-view__back', type: 'button', 'data-tip': 'Back to the profile', onclick: closeViewer },
          icon('chevron-left', { class: 'ic ic--sm' }),
          h('span', {}, 'Back'),
        ),
        h('span', {
          class: 'lh-view__mark lh-view__mark--sm'
            + (link.wide ? ' lh-view__mark--word' : ''),
        }, linkGlyph(link, 'ic--xs')),
        h('span', { class: 'lh-view__crumb' }, link.label || host),
        h('span', { class: 'lh-view__host' }, host),
        h(
          'a',
          {
            class: 'lh-view__out',
            href: link.href,
            target: '_blank',
            rel: 'noopener noreferrer',
            'data-tip': 'Open in a new tab if the site refuses to run in a frame',
          },
          icon('arrow-up-right', { class: 'ic ic--xs' }),
          h('span', {}, 'New tab'),
        ),
      ),
      h('div', { class: 'lh-view__stage' }, frame || blockedPanel()),
      h('p', { class: 'lh-view__hint' }, link.note || ''),
    );
    viewer.hidden = false;
    requestAnimationFrame(() => viewer.classList.add('is-open'));

    /* A backstop for a host that is not on the list but still refuses, or is simply
       unreachable - which every one of them is at presentation time, since the deck
       runs with no network. Chrome fires `load` for its own error page, so a frame that
       loaded is not proof of anything; what this catches is the frame that never
       resolves at all. */
    if (frame) {
      let landed = false;
      frame.addEventListener('load', () => { landed = true; });
      window.setTimeout(() => {
        if (landed || openLink !== link) return;
        const stage = viewer.querySelector('.lh-view__stage');
        if (stage) render(stage, blockedPanel());
      }, 2600);
    }
  };

  /* The supplied brand artwork if there is any, the library glyph if not. Drawn as an
     image rather than masked to the accent: masking would flatten LinkedIn blue,
     YouTube red and Instagram's gradient to one flat colour, which is the opposite of
     what supplying a real logo is for. */
  const linkGlyph = (link, size) => (link.logo
    ? h('img', {
        class: 'lh-logo',
        src: `/uploads/${link.logo.split('/').map(encodeURIComponent).join('/')}`,
        alt: '',
        loading: 'lazy',
        decoding: 'async',
      })
    : icon(link.icon || 'link', { class: 'ic ' + size }));

  const socials = (block.links || []).length
    ? h(
        'div',
        { class: 'leader-hero__follow' },
        h('span', { class: 'leader-hero__follow-label' }, 'Follow'),
        h(
          'div',
          { class: 'leader-hero__socials' },
          /* One click, one destination. A host that can be framed opens here, in the
             panel, with a back button. A host that cannot is a plain link that goes
             straight to the page — there is no point standing a panel in front of it
             whose only content is a second button saying "open this page".

             So the element itself differs: an anchor for the ones that leave, a button
             for the ones that stay. Not a button that sometimes navigates, which reads
             wrong to a keyboard and to a screen reader both. */
          ...block.links.map((link) => {
            const glyph = linkGlyph(link, 'ic--sm');
            const cls = 'leader-hero__social ph-social'
              + (link.wide ? ' leader-hero__social--word' : '');
            const tip = link.label || 'Profile';

            if (framingRefused(link.href)) {
              return h(
                'a',
                {
                  class: cls,
                  href: link.href,
                  target: '_blank',
                  rel: 'noopener noreferrer',
                  'data-tip': tip,
                  'aria-label': tip,
                },
                glyph,
              );
            }

            return h(
              'button',
              {
                class: cls,
                type: 'button',
                'data-tip': tip,
                'aria-label': tip,
                onclick: () => (openLink === link ? closeViewer() : openViewer(link)),
              },
              glyph,
            );
          }),
        ),
      )
    : null;

  const figure = h(
    'div',
    { class: 'leader-hero__figure' },

    /* The portrait is an alpha cutout, so the same PNG doubles as a mask: every
       layer below is shaped by the silhouette. Two ground-coloured blurs behind
       it feather the cut edge into the page, and a rim light plus a foot shadow
       sit over it so the figure is lit rather than pasted. */
    h(
      'div',
      {
        class: 'leader-hero__portrait-wrapper',
        style: { '--portrait': `url("${encodeURI(portraitUrl)}")` },
      },
      h('div', { class: 'leader-hero__glow', 'aria-hidden': 'true' }),
      h('div', { class: 'leader-hero__layer leader-hero__feather--tight', 'aria-hidden': 'true' }),
      h('div', { class: 'leader-hero__layer leader-hero__feather--soft', 'aria-hidden': 'true' }),
      h('img', {
        class: 'leader-hero__portrait',
        src: portraitUrl,
        alt: block.alt || `${block.firstName || ''} ${block.lastName || ''}`.trim() || 'Portrait',
      }),
      h('div', { class: 'leader-hero__layer leader-hero__rim', 'aria-hidden': 'true' }),
      h('div', { class: 'leader-hero__layer leader-hero__shade', 'aria-hidden': 'true' }),
    ),

    // Floating pill badges
    ...tags.map((tag, index) => {
      const spot = TAG_SPOTS[index];
      // The tail is a lead-in rule pointing back at the figure, so it hangs off
      // whichever edge faces the portrait.
      const tail = h('span', { class: 'leader-hero__tag-tail', 'aria-hidden': 'true' });
      const glyph = icon(tag.icon || 'arrow-right', { class: 'ic ic--xs' });
      const label = h('span', {}, tag.label);
      const parts = spot.side === 'right' ? [tail, glyph, label] : [glyph, label, tail];

      return h(
        'span',
        {
          class: `leader-hero__tag leader-hero__tag--${spot.side}${
            tag.solid ? ' leader-hero__tag--solid' : ''
          }`,
          style: {
            '--tag-delay': `${1.1 + index * 0.15}s`,
            top: spot.top,
            left: spot.left,
            right: spot.right,
          },
        },
        ...parts,
      );
    }),
  );

  const pane = h(
    'div',
    { class: 'leader-hero__pane' },
    eyebrow,
    name,
    block.tagline
      ? h('div', { class: 'leader-hero__copy' },
          h('p', { class: 'leader-hero__tagline' }, block.tagline),
          block.body ? h('p', { class: 'leader-hero__body', html: inlineRich(block.body) }) : null,
        )
      : null,
    socials,
  );

  /* The composition lives in a stage with a floored aspect rather than in the
     block itself. Presenting stretches the slide to the screen's shape, and the
     portrait is `contain`-fitted into a column whose width does not grow with
     it — so below roughly 1.43 the column turns taller than the cutout's own
     ratio, `contain` starts fitting by width instead of height, and the figure
     shrinks and slides down the column while the pills, anchored to the column,
     stay where they were. That is the gap between the head and the tags.

     Flooring the stage at 16:10 keeps the shape on the safe side of that
     crossover at any screen. It is inert at 16:9 and at 16:10 — the two shapes
     a deck is actually shown at — and on anything taller the stage centres
     itself and the block's own cream carries on past it, so there is no band to
     see. The alternative, sizing the portrait against both axes, only moves the
     same failure into the tag geometry. */
  const stage = h('div', { class: 'leader-hero__stage' },
    // Spans the whole stage, behind both columns — not the right column alone.
    block.watermark ? watermark(block.watermark) : null,
    pane,
    figure,
  );

  return h('div', { class: 'leader-hero ph-root' }, stage, viewer);
}
