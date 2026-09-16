import { h, svg } from '../utils/dom.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * The Leadership Journey as a process arc.
 *
 * The slide opens as the arc and its titles, nothing else. Clicking a segment brings that
 * chapter's card in on a dotted leader; clicking another brings the next one in and leaves the
 * first where it is, so a presenter builds the picture up and the whole journey is on screen by
 * the end.
 *
 * Everything is solved from one circle rather than placed by hand: the band, the titles, the
 * card anchors and the leaders all come from the same centre, radius and angle list, and each
 * card is turned to its own segment so the content leans the way the band does. Positions are
 * written as percentages of the viewBox, which is what lets HTML cards sit against an SVG band
 * through the slide scaling without being told the scale.
 */

const VB = { w: 1600, h: 860 };
const C = { x: 800, y: 1150 };
const R = 690;

/* A thin band. The titles have to live inside it, so it cannot go much below this. */
const BAND = 62;

/* Every card is the same size — five cards that agree read as one set where five different
   heights read as five loose notes. The content is fitted to this box at runtime rather than the
   box growing to the content. */
const CARD = { w: 252, h: 322 };
const EDGE = 14;

/* The clear air between the band's outer edge and a card's near edge — the length the dotted
   leader has to draw itself in. Measured to the edge, not to the centre: a card is 322 tall, so
   a reach measured to its middle put the card back over the band it was pointing at. */
const LEAD = 56;

/* The air a card leaves around a title it would otherwise sit on, and around its neighbours.
   Kept small: five open cards very nearly fill the stage once each one's lean is counted, so a
   generous gap is the difference between the pass settling and giving up. */
const CLEAR = 8;

/* How far a card may lean. Following the tangent exactly puts the end segments past sixty
   degrees, which is hard to read; and a lean is expensive — a turned card occupies a box far
   larger than itself, so at twenty degrees five open cards need more stage than exists and the
   last two have nowhere to go. Thirteen still reads as leaning with the band. */
const TILT_MAX = 13;

/* The visible sweep, in degrees clockwise from east with y pointing down: 208 is the lower
   left, 332 the lower right, 270 the top of the arc. */
const FROM = 208;
const TO = 332;
const GAP = 2.1;

const rad = (deg) => (deg * Math.PI) / 180;
/* How far a leaning card reaches along one direction — the support function of its box. A card
   turned thirteen degrees and seen along the radius presents neither its width nor its height
   but a mix of the two, and that is what has to clear the band. */
const reachOf = (deg, tilt) => {
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  const c = Math.cos(rad(tilt));
  const sn = Math.sin(rad(tilt));
  return (Math.abs(ux * c + uy * sn) * CARD.w + Math.abs(uy * c - ux * sn) * CARD.h) / 2;
};
const pt = (r, deg) => [C.x + Math.cos(rad(deg)) * r, C.y + Math.sin(rad(deg)) * r];
const n2 = (v) => Math.round(v * 100) / 100;

/** An annular sector: out along one edge, back along the other. */
function sector(from, to, rOuter, rInner) {
  const [ax, ay] = pt(rOuter, from);
  const [bx, by] = pt(rOuter, to);
  const [cx, cy] = pt(rInner, to);
  const [dx, dy] = pt(rInner, from);
  const big = to - from > 180 ? 1 : 0;
  return `M${n2(ax)} ${n2(ay)}A${rOuter} ${rOuter} 0 ${big} 1 ${n2(bx)} ${n2(by)}`
    + `L${n2(cx)} ${n2(cy)}A${rInner} ${rInner} 0 ${big} 0 ${n2(dx)} ${n2(dy)}Z`;
}

/* Points for a card: split where the writer already broke the thought. How much of each one
   survives is settled by `fitToCard` once the card exists. */
function points(panel) {
  const raw = String(panel.summary || '').trim();
  if (!raw) return panel.role ? [panel.role] : [];
  const parts = raw.split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [raw];
}

/* Where a ray leaving a turned card's centre crosses its border — the leader stops there rather
   than disappearing under the card. Worked in the card's own frame, where the box is square to
   the axes, then turned back. */
function edgeOf(cx, cy, tilt, w, hgt, tx, ty) {
  const a = rad(tilt);
  const dx = tx - cx;
  const dy = ty - cy;
  const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
  const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
  const k = Math.min(Math.abs((w / 2) / (lx || 1e-6)), Math.abs((hgt / 2) / (ly || 1e-6)));
  const ex = lx * k;
  const ey = ly * k;
  return [cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a)];
}

/* Fit a card's words to the card.
 *
 * The cards are all one size, so the text gives rather than the box. This drops trailing words
 * until nothing overflows, halving the interval instead of walking word by word — a long
 * chapter would otherwise cost forty reflows. What is cut ends in an ellipsis, so a shortened
 * point reads as shortened. */
function fitToCard(card, items, words) {
  const total = words.reduce((n, w) => n + w.length, 0);
  const render = (k) => {
    let left = k;
    let last = -1;
    items.forEach((li, i) => {
      const take = Math.max(0, Math.min(words[i].length, left));
      left -= take;
      if (take) last = i;
      li.hidden = take === 0;
      li.textContent = take ? words[i].slice(0, take).join(' ') : '';
    });
    if (k < total && last >= 0) {
      items[last].textContent = `${items[last].textContent.replace(/[\s.,;:—-]+$/, '')}…`;
    }
  };
  const fits = () => card.scrollHeight <= card.clientHeight;

  render(total);
  if (fits()) return;
  let lo = 0;
  let hi = total;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    render(mid);
    if (fits()) lo = mid;
    else hi = mid - 1;
  }
  render(lo);
}

export function LeadershipRoad(block, { editing = false } = {}) {
  const panels = (block.panels || []).filter(Boolean);
  if (!panels.length) {
    return h('div', { class: 'ja-root ja-root--empty ph-root' }, 'No chapters yet.');
  }

  const count = panels.length;
  const span = (TO - FROM - GAP * (count - 1)) / count;
  const seg = (i) => {
    const from = FROM + i * (span + GAP);
    return { from, to: from + span, mid: from + span / 2 };
  };

  const rOuter = R + BAND / 2;
  const rInner = R - BAND / 2;

  /* Build curved path defs for each segment arc so text curves along the inverted U arc */
  const defs = svg('defs', {},
    ...panels.map((panel, i) => {
      const s = seg(i);
      const [ax, ay] = pt(R, s.from + 0.3);
      const [bx, by] = pt(R, s.to - 0.3);
      return svg('path', {
        id: `ja-text-path-${i}`,
        d: `M ${n2(ax)} ${n2(ay)} A ${R} ${R} 0 0 1 ${n2(bx)} ${n2(by)}`,
      });
    })
  );

  /* ------------------------------------------------------------------- the band */
  const bands = panels.map((panel, i) => {
    const s = seg(i);
    return svg('path', {
      class: 'ja-seg',
      d: sector(s.from, s.to, rOuter, rInner),
      style: `--i:${i}`,
      onclick: () => open(i),
    });
  });

  const titles = panels.map((panel, i) => {
    const textPathEl = svg('textPath', {
      href: `#ja-text-path-${i}`,
      startOffset: '50%',
      'text-anchor': 'middle',
    }, (panel.title || `Chapter ${i + 1}`).toUpperCase());

    return svg('text', {
      class: 'ja-seg__label',
      'dominant-baseline': 'central',
      dy: '2px',
      style: `--i:${i}`,
      onclick: () => open(i),
    }, textPathEl);
  });

  /* A dotted leader per chapter, drawn under the band so a stray end is covered. Its ends are
     set in `place`, once the card it points at has been seated. */
  const leads = panels.map((panel, i) => svg('line', { class: 'ja-lead', style: `--i:${i}` }));

  const canvas = svg('svg', {
    class: 'ja-svg',
    viewBox: `0 0 ${VB.w} ${VB.h}`,
    preserveAspectRatio: 'xMidYMid meet',
  }, defs, ...leads, ...bands, ...titles);

  /* -------------------------------------------------------------- the cards
     Built now, shown on click. Each is anchored outside its own segment and turned to it. */
  const fitted = new WeakSet();
  const cards = panels.map((panel, i) => {
    const s = seg(i);
    const tilt = Math.max(-TILT_MAX, Math.min(s.mid - 270, TILT_MAX));
    const [cx, cy] = pt(rOuter + LEAD + reachOf(s.mid, tilt), s.mid);
    const list = points(panel);
    const items = list.map((line, n) => h('li', { style: { '--n': String(n) } }, line));

    const card = h('div', {
      class: 'ja-card',
      hidden: true,
      style: {
        left: `${n2((cx / VB.w) * 100)}%`,
        top: `${n2((cy / VB.h) * 100)}%`,
        '--tilt': `${n2(tilt)}deg`,
      },
      /* The anchor its segment asks for. `place` starts from this every time, so a card is
         seated against the box it has rather than drifting further on each pass. */
      'data-base': `${n2((cx / VB.w) * 100)},${n2((cy / VB.h) * 100)}`,
    },
      h('span', { class: 'ja-card__role' }, panel.role || panel.title || ''),
      items.length ? h('ul', { class: 'ja-card__list' }, ...items) : null,
    );

    card.__fit = () => {
      if (fitted.has(card) || !items.length) return;
      fitted.add(card);
      fitToCard(card, items, list.map((line) => line.split(/\s+/)));
    };
    return card;
  });

  /* Seat the shown cards and aim their leaders.
   *
   * The cards are one fixed size, so where each lands is settled geometry — but it is still
   * worked out against the stage rather than the viewBox, because the two agree in aspect and
   * not in scale. */
  const place = () => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!W || !H) return;
    const toVB = VB.w / W;
    /* The circle's centre in stage units, for the off-the-band rule below. */
    const hub = { x: C.x / toVB, y: C.y / toVB };

    const labels = titles.map((label) => {
      const b = label.getBBox();
      return {
        left: b.x / toVB,
        right: (b.x + b.width) / toVB,
        top: b.y / toVB,
        bottom: (b.y + b.height) / toVB,
      };
    });

    /* The box each shown card occupies, widened for its lean: a turned card covers more ground
       than its own width and height. */
    const live = [];
    cards.forEach((card, i) => {
      if (card.hidden) return;
      const [bx, by] = String(card.dataset.base).split(',').map(Number);
      const tilt = parseFloat(card.style.getPropertyValue('--tilt')) || 0;
      const t = rad(Math.abs(tilt));
      live.push({
        card,
        i,
        tilt,
        w: (CARD.w * Math.cos(t) + CARD.h * Math.sin(t)) / toVB,
        h: (CARD.w * Math.sin(t) + CARD.h * Math.cos(t)) / toVB,
        x: (bx / 100) * W,
        y: (by / 100) * H,
      });
    });

    const seat = (b) => {
      for (let pass = 0; pass < 6; pass += 1) {
        let moved = false;
        const dx = b.x - hub.x;
        const dy = b.y - hub.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const need = (rOuter + LEAD + reachOf((Math.atan2(dy, dx) * 180) / Math.PI, b.tilt)) / toVB;
        if (d < need) {
          b.x = hub.x + (dx / d) * need;
          b.y = hub.y + (dy / d) * need;
          moved = true;
        }

        /* On the slide. Where this and the rule above disagree — at the arc's ends, which run
           into the corners — staying on screen wins and the leader simply comes up short. */
        const x = Math.max(b.w / 2 + EDGE, Math.min(b.x, W - b.w / 2 - EDGE));
        const y = Math.max(b.h / 2 + EDGE, Math.min(b.y, H - b.h / 2 - EDGE));
        if (Math.abs(x - b.x) > 0.5 || Math.abs(y - b.y) > 0.5) moved = true;
        b.x = x;
        b.y = y;

        /* Off any title. The arc's ends run down into the corners, so the space radially outside
           them is off the slide and a card seated there drops onto the band — over the very
           title it belongs to. Above the end segments the stage is empty, so it goes there. */
        const hit = labels.find((l) => b.x - b.w / 2 < l.right + CLEAR
          && b.x + b.w / 2 > l.left - CLEAR
          && b.y - b.h / 2 < l.bottom + CLEAR
          && b.y + b.h / 2 > l.top - CLEAR);
        if (hit) {
          const lifted = Math.max(b.h / 2 + EDGE,
            Math.min(hit.top - CLEAR - b.h / 2, H - b.h / 2 - EDGE));
          if (Math.abs(lifted - b.y) > 1) {
            b.y = lifted;
            moved = true;
          }
        }

        if (!moved) break;
      }
    };

    live.forEach(seat);

    /* No card hides another's words. An overlapping pair is pushed apart along whichever axis
       they overlap least and both are reseated. Each push is halved so a card boxed in by two
       neighbours settles between them instead of being volleyed. */
    for (let pass = 0; pass < 40; pass += 1) {
      let moved = false;
      for (let i = 0; i < live.length; i += 1) {
        for (let j = i + 1; j < live.length; j += 1) {
          const a = live[i];
          const b = live[j];
          const ox = (a.w + b.w) / 2 + CLEAR - Math.abs(a.x - b.x);
          const oy = (a.h + b.h) / 2 + CLEAR - Math.abs(a.y - b.y);
          if (ox <= 0 || oy <= 0) continue;
          moved = true;
          if (ox <= oy) {
            const d = (a.x <= b.x ? -1 : 1) * (ox / 2);
            a.x += d;
            b.x -= d;
          } else {
            const d = (a.y <= b.y ? -1 : 1) * (oy / 2);
            a.y += d;
            b.y -= d;
          }
          seat(a);
          seat(b);
        }
      }
      if (!moved) break;
    }

    live.forEach((b) => {
      b.card.style.left = `${n2((b.x / W) * 100)}%`;
      b.card.style.top = `${n2((b.y / H) * 100)}%`;

      /* The leader runs from the band's outer edge to the card's border, both in viewBox units,
         which is why the seated centre is converted back up. */
      const s = seg(b.i);
      const [ax, ay] = pt(rOuter, s.mid);
      const [ex, ey] = edgeOf(b.x * toVB, b.y * toVB, b.tilt, CARD.w, CARD.h, ax, ay);
      const lead = leads[b.i];
      lead.setAttribute('x1', n2(ax));
      lead.setAttribute('y1', n2(ay));
      lead.setAttribute('x2', n2(ex));
      lead.setAttribute('y2', n2(ey));
    });
  };

  const opened = new Set();

  function open(i) {
    const card = cards[i];
    if (!card) return;
    /* Opened stays opened: clicking a second segment adds its card and leaves the first
       standing, which is how the slide builds up. */
    bands[i].classList.add('is-open');
    titles[i].classList.add('is-open');
    if (!opened.has(i)) {
      opened.add(i);
      card.hidden = false;
      card.__fit();
      place();
      leads[i].classList.add('is-in');
      // One frame, so the class change animates instead of applying instantly.
      requestAnimationFrame(() => card.classList.add('is-in'));
    }
    // The most recent card sits above any it overlaps.
    cards.forEach((c, n) => c.classList.toggle('is-last', n === i));
  }

  const stage = h('div', { class: 'ja-stage' }, canvas, ...cards);

  if (typeof ResizeObserver === 'function') new ResizeObserver(() => place()).observe(stage);

  const root = h('div', { class: 'ja-root ph-root' },
    h('h2', { class: 'ja-title' }, (block.titleLines || ['Leadership Journey'])[0]),
    stage,
  );

  if (!editing) {
    /* Prev/Next reveal the chapters in order before the deck turns the slide, which is the same
       build-up a presenter gets by clicking. */
    let reached = -1;
    registerStepper((delta) => {
      const next = reached + delta;
      if (next < 0 || next > count - 1) return false;
      reached = next;
      open(reached);
      return true;
    });
  }

  return root;
}
