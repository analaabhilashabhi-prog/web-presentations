import { h } from '../utils/dom.js';
import { HeroBox } from './HeroBox.js';
import { PaperSheet } from './PaperSheet.js';
import { registerStepper } from '../utils/slideSteps.js';

/**
 * Executive Summary as three tabs behind one nav row.
 *
 * The first tab is the brand film exactly as it was: the same hero block,
 * rendered by the same `HeroBox`, with its own kicker, heading, standfirst,
 * overlay and alignment untouched. It is passed through rather than rebuilt,
 * so the placement work already done to it — controls to the top right, copy
 * to the bottom, the scrim from the right — survives being put in a tab.
 *
 * The second and third are translucent sheets: the ported ThreeUI paper, one
 * printed with the college's recognitions and one with the vision, mission
 * and quality policy.
 *
 * Only one panel is ever live. A sheet builds its WebGL context the first
 * time it is shown and parks its frame loop the moment it is not, and the
 * film pauses when you leave it — three of these running behind each other
 * would spend the whole presentation rendering things nobody is looking at.
 */

/** The film keeps playing only while its own tab is in front. */
function setFilm(panel, playing) {
  const video = panel.querySelector('video');
  if (!video) return;
  if (playing) {
    const p = video.play();
    if (p) p.catch(() => {});
  } else {
    video.pause();
  }
}

export function PaperTabs(block, options = {}) {
  const tabs = Array.isArray(block.tabs) ? block.tabs.slice(0, 4) : [];
  if (!tabs.length) return h('div', { class: 'paper-tabs' });

  const uid = `pt-${Math.random().toString(36).slice(2, 8)}`;
  const buttons = [];
  const panels = [];
  let active = 0;

  tabs.forEach((tab, i) => {
    const body = tab.kind === 'hero' && tab.hero
      ? h('div', { class: 'paper-tabs__hero' }, HeroBox({ ...tab.hero, type: 'hero' }, options))
      : PaperSheet(tab.sheet || {}, { wordmark: block.wordmark || 'NCET' });

    const panel = h(
      'div',
      {
        class: `paper-tabs__panel paper-tabs__panel--${tab.kind === 'hero' ? 'hero' : 'sheet'}`,
        id: `${uid}-p${i}`,
        role: 'tabpanel',
        'aria-labelledby': `${uid}-t${i}`,
        style: { '--i': String(i) },
      },
      body,
    );
    panel.hidden = i !== 0;
    panels.push(panel);

    const button = h(
      'button',
      {
        class: 'paper-tabs__tab',
        type: 'button',
        id: `${uid}-t${i}`,
        role: 'tab',
        'aria-controls': `${uid}-p${i}`,
        'aria-selected': i === 0 ? 'true' : 'false',
        tabindex: i === 0 ? '0' : '-1',
        style: { '--i': String(i) },
        onClick: () => show(i),
        onKeydown: (event) => {
          const last = tabs.length - 1;
          let next = null;
          if (event.key === 'ArrowRight') next = active === last ? 0 : active + 1;
          if (event.key === 'ArrowLeft') next = active === 0 ? last : active - 1;
          if (event.key === 'Home') next = 0;
          if (event.key === 'End') next = last;
          if (next === null) return;
          event.preventDefault();
          show(next);
          buttons[next].focus();
        },
      },
      h('span', { class: 'paper-tabs__no' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'paper-tabs__label' }, tab.label || `Tab ${i + 1}`),
    );
    buttons.push(button);
  });

  function show(index) {
    if (index === active) return;
    const from = panels[active];
    const to = panels[index];

    if (from.__stopPanel) from.__stopPanel();
    from.hidden = true;
    buttons[active].setAttribute('aria-selected', 'false');
    buttons[active].tabIndex = -1;

    to.hidden = false;
    buttons[index].setAttribute('aria-selected', 'true');
    buttons[index].tabIndex = 0;
    active = index;
    if (visible && to.__startPanel) to.__startPanel();
  }

  // Each panel knows how to wake and park itself, whichever kind it is.
  panels.forEach((panel) => {
    const stage = panel.querySelector('.paper-stage');
    panel.__startPanel = () => {
      if (stage && stage.__start) stage.__start();
      else setFilm(panel, true);
    };
    panel.__stopPanel = () => {
      if (stage && stage.__stop) stage.__stop();
      else setFilm(panel, false);
    };
  });

  const root = h(
    'div',
    { class: 'paper-tabs' },
    h(
      'div',
      { class: 'paper-tabs__bar', role: 'tablist', 'aria-label': 'Executive summary' },
      ...buttons,
    ),
    h('div', { class: 'paper-tabs__panels' }, ...panels),
  );

  /* Prev/Next walk the tabs before they turn the slide.
   *
   * The three panels are three beats of one section, not three sections, so
   * the presenter should reach them with the control they are already using:
   * film, then the profile, then the vision, and only then does the deck move
   * on to Governance Council. Declining at either end hands the press back so
   * the deck turns as it always did — the section before this one is still one
   * press back from the film, and the section after is one press on from the
   * last sheet.
   *
   * The registry is cleared and rebuilt by PresentPage on every navigation, so
   * this registration lives exactly as long as the DOM it steps. */
  registerStepper((delta) => {
    const next = active + delta;
    if (next < 0 || next >= panels.length) return false;
    show(next);
    return true;
  });

  /* Nothing starts until the slide is actually on screen. A sheet that built
     its context behind the section's title card would spend its entrance
     animation unseen, and the film would be talking to an empty room. */
  let visible = false;
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((records) => {
      for (const record of records) {
        const now = record.isIntersecting;
        if (now === visible) continue;
        visible = now;
        if (now) panels[active].__startPanel();
        else panels.forEach((p) => p.__stopPanel());
      }
    }, { threshold: 0.15 });
    io.observe(root);
  } else {
    visible = true;
    panels[active].__startPanel();
  }

  return root;
}
