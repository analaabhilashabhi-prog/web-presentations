import { h, render, clear } from '../utils/dom.js';
import { initials } from '../utils/format.js';
import { state, isAdmin, visibleSections, childSections, sectionById, sectionOrdinal, setSections } from '../context/appStore.js';
import { navigate, refresh } from '../utils/router.js';
import { icon, iconForTitle, hasIcon } from '../utils/icons.js';
import { updateSection } from '../services/contentService.js';
import { toastError, toastSuccess } from './Toast.js';
import { SectionIconGlyph } from './IconChooser.js';

/**
 * The curated story for each major topic. A child is either a row, a caption
 * that titles the rows under it, or a row with its own nested rows — the shape
 * the content actually has (six coder programs under Coding; three platforms
 * under Assessment Platforms).
 */
/**
 * Keyed by the section's own `key`, not by its position.
 *
 * These labels deliberately differ from the stored titles — "Vision, Mission &
 * Values" is presented as "Strategic Foundation" — so they used to be matched
 * by index. That breaks the moment the list is filtered, and the server filters
 * it for a presenter: with three sections released, AI Ready Engineer was being
 * announced as Strategic Foundation. A presenter never receives the full list,
 * so position cannot identify a section for them. The key can.
 */
/* The deck, in the order a presenter walks it. Fourteen sections, flat: every
   row is a slide, none of them is a folder.

   Organization Overview and Leadership used to be groups whose rows opened a
   list. Two folders among twelve slides is a rule the deck does not otherwise
   follow, and Leadership held no content of its own at all — its row opened an
   empty page. Their pages came up a level (`tools/flatten-navigation.cjs`), so
   Executive Summary, Organization Snapshot, History & Milestones, CEO Profile,
   Leadership Journey and Success Stories now each stand on their own.

   A curated label wins over the stored title, so this list is the presenter-facing
   naming. The icons are the same ones the sections themselves carry: fourteen
   distinct glyphs, because a repeated glyph is a row the eye cannot tell from its
   neighbour in the collapsed rail, where the glyph is all there is. */
const NAVIGATION_GROUPS = [
  ['company-profile', 'Executive Summary', 'team-cycle', []],
  ['organization-snapshot', 'Organization Snapshot', 'camera-photo', []],
  ['history-milestones', 'History & Milestones', 'roadmap', []],
  ['ceo-profile', 'CEO Profile', 'ceo-podium', []],
  ['leadership-journey', 'Leadership Journey', 'climb-steps', []],
  ['success-stories', 'Success Stories', 'rosette', []],
  ['programs', 'Programs', 'www-globe', []],
  ['team', 'Centers of Excellence', 'handshake-check', []],
  ['certifications', 'Certifications', 'seal-check', []],
  ['placements', 'Placements', 'job-pin', []],
  ['achievements', 'Events', 'event-sign', []],
  ['testimonials', 'Video Resumes', 'clapper', []],
  ['ai-ready-engineer', 'AI Ready Engineer', 'ai-figure', []],
  ['platforms', 'Platforms', 'tap-network', []],
];

/**
 * The artwork the user supplied, one file per row, drawn as a CSS mask.
 *
 * They are solid-fill SVGs at mixed viewBoxes with no fill attributes of their own.
 * An <img> cannot be recoloured and inlining the path data would put 35kB into the
 * icon library, so each one is painted as a mask instead: the element's background
 * is `currentColor`, so the glyph takes whatever colour the row already has — ink
 * normally, brand green when selected, white on the rail, gold when selected there.
 * No second copy of the artwork, and nothing to keep in step.
 *
 * A key with no file here falls through to the line library in `utils/icons.js`.
 */
const NAV_ARTWORK = {
  'company-profile': 'Executive Summary.svg',
  'organization-snapshot': 'Organization Snapshot.svg',
  'history-milestones': 'History and Milestones.svg',
  'ceo-profile': 'CEO Profile.svg',
  'leadership-journey': 'Leadership Journery.svg',
  'success-stories': 'Sucess Stories.svg',
  programs: 'Programs and Learnings.svg',
  team: 'Center of Excellence.svg',
  certifications: 'Certifications.svg',
  placements: 'Placements.svg',
  achievements: 'Events.svg',
  testimonials: 'Video Resumes.svg',
  'ai-ready-engineer': 'AI Ready Engineer.svg',
  platforms: 'Platforms.svg',
};

/** The three that are not sections: the sign-out row and the pane control. */
const CHROME_ARTWORK = {
  signout: 'Signout.svg',
  collapse: 'collapse.svg',
  expand: 'expand.svg',
};

/* Straight from the folder the user drops them in, unmodified.

   There was a pass that wrote weight-evened copies into navicons-fit/ — the files are
   drawn at 0.44 to 1.40 px of stroke at 21px, a 3.2x spread, and evening that out
   meant dilating the thin ones. It ruined them: Events is a banner with EVENT lettered
   across it and +19 units of stroke on its 512 viewBox filled the letters in and
   merged the two poles into a blob. The chip pins on AI Ready Engineer went the same
   way. An uneven column beats a column of blobs, so the artwork is used as supplied.
   tools/normalise-navicons.cjs still exists if a future set needs it. */
const artworkUrl = (file) => `/uploads/navicons/${encodeURIComponent(file)}`;

/**
 * A masked glyph. `--glyph` carries the url so the shorthand stays in the
 * stylesheet; -webkit-mask is set too, because the unprefixed property is still
 * not universal and a pane of invisible icons is not a graceful degradation.
 */
function artworkGlyph(file, { class: className = 'nav-tree__icon' } = {}) {
  return h('span', {
    class: `${className} nav-glyph`,
    style: { '--glyph': `url("${artworkUrl(file)}")` },
    'aria-hidden': 'true',
  });
}

/**
 * Releases a section to the presenter, or takes it back.
 *
 * Whether a presenter can see a section was only ever settable from a command
 * line, which meant the person who decides what is finished had to ask someone
 * else to run it. The rule is unchanged — published and not hidden — this is
 * simply the switch for it, on the row it belongs to. Admin-only: the server
 * answers a presenter with 403 either way, this just declines to draw a control
 * that would fail.
 */
function releaseToggle(section) {
  if (!isAdmin() || !section) return null;
  const live = section.status === 'published' && !section.hidden;
  const button = h('button', {
    class: `snav-release${live ? ' is-live' : ''}`,
    type: 'button',
    title: live
      ? `${section.title} is live for presenters — click to withdraw it`
      : `${section.title} is hidden from presenters — click to push it live`,
    'aria-pressed': String(live),
    onclick: async (event) => {
      // The row underneath navigates; the toggle must not.
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      try {
        const saved = await updateSection(section.id, {
          status: live ? 'draft' : 'published',
          hidden: false,
        });
        /* Put the answer back in the store before re-rendering. `refresh()`
           redraws from `state.sections`, which the PATCH does not touch — so
           the row came back exactly as it went in and the switch looked stuck
           until the next sign-in refilled the store from the server. */
        setSections(state.sections.map((s) => (s.id === saved.id ? { ...s, ...saved } : s)));
        toastSuccess(live
          ? `${section.title} withdrawn from presenters`
          : `${section.title} pushed to presenters`);
        refresh();
      } catch (err) {
        button.disabled = false;
        toastError(err.message);
      }
    },
  }, icon(live ? 'eye' : 'eye-off', { class: 'ic ic--xs', strokeWidth: 1.9 }));
  return button;
}

/** The curated group for a section, or an empty tuple when it has none. */
const groupFor = (section) => {
  const row = NAVIGATION_GROUPS.find((g) => g[0] === section?.key);
  return row ? [row[1], row[2], row[3]] : [];
};

/**
 * The presenter-facing name and icon for a section, exactly as the side pane
 * shows it — so the deck's jump bar cannot drift from the navigation. A curated
 * group label wins; a real subsection page falls back to its own title, because
 * no curated row is keyed to it.
 */
/**
 * What sits under a section, for the deck bar's hover menu.
 *
 * Real child pages win; a group whose pages have not been built yet falls back to
 * its curated labels, which is the same precedence the side pane uses. A curated
 * row carries no id — hovering shows it so the room can see what the group
 * covers, and clicking it opens the group's own page, because there is nothing
 * else to open yet.
 */
export function sectionMenu(section) {
  const own = childSections(section?.id);
  if (own.length) return own.map((c) => ({ label: c.title, id: c.id }));

  /* A page inside a group offers the rest of its group. The presenting deck is
     flattened — group, then its pages, then the next group — so most entries in
     the bar are child pages with no children of their own, and listing nothing
     for them would leave the menu on a single section out of thirteen. Its
     siblings are what a presenter actually wants to reach from there. */
  if (section?.parentId) {
    const family = childSections(section.parentId)
      .filter((c) => c.id !== section.id)
      .map((c) => ({ label: c.title, id: c.id }));
    if (family.length) return family;
  }

  const [, , curated] = groupFor(section);
  return (curated || []).map((label) => ({ label, id: null }));
}

export function sectionLabel(section) {
  const [title, iconKey] = groupFor(section);
  return {
    label: title || section?.title || 'Section',
    icon: iconKey || section?.icon || iconForTitle(section?.title),
  };
}

/**
 * One flat list of rows to draw, so the pane and the rail flyout agree.
 *
 * A row carrying a `sectionId` is a real subsection page and navigates to itself;
 * a row without one is a curated label for a group whose subsections have not
 * been built yet, and opens the group's own page.
 */
function childRows(children = []) {
  const rows = [];
  for (const child of children) {
    if (typeof child === 'string') {
      rows.push({ kind: 'item', label: child });
    } else if (child?.id && child?.title) {
      rows.push({ kind: 'item', label: child.title, sectionId: child.id });
    } else if (child?.caption) {
      rows.push({ kind: 'caption', label: child.caption });
    } else if (child?.label) {
      rows.push({ kind: 'item', label: child.label });
      for (const nested of child.children || []) {
        if (nested?.id && nested?.title) {
          rows.push({ kind: 'nested', label: nested.title, sectionId: nested.id });
        } else {
          rows.push({ kind: 'nested', label: nested });
        }
      }
    }
  }
  return rows;
}

/**
 * Folds the pages that exist into the curated story for a group.
 *
 * The old rule was all-or-nothing — one real child replaced the whole curated
 * list — so building the first page of a group deleted every other label in it
 * from the navigation. Building "History & Milestones" under Organization
 * Overview took "Executive Summary" and "Organization Snapshot" down with it,
 * and Executive Summary is finished content that lives on the group's own page.
 *
 * A label is now replaced only by its own page. The curated order is the story
 * and is kept; a real child with no curated label is appended rather than
 * dropped, so nothing an admin creates can go missing from the nav.
 */
function mergeChildren(curated = [], built = []) {
  const byTitle = new Map();
  for (const section of built) {
    const key = String(section.title || '').trim().toLowerCase();
    if (key && !byTitle.has(key)) byTitle.set(key, section);
  }

  const claimed = new Set();
  const claim = (label) => {
    const match = byTitle.get(String(label || '').trim().toLowerCase());
    if (!match) return null;
    claimed.add(match.id);
    return match;
  };

  const rows = curated.map((entry) => {
    if (typeof entry === 'string') return claim(entry) || entry;
    if (entry?.label) {
      return { ...entry, children: (entry.children || []).map((n) => claim(n) || n) };
    }
    return entry;
  });

  for (const section of built) {
    if (!claimed.has(section.id)) rows.push(section);
  }
  return rows;
}

// The router recreates the sidebar after every navigation. Storing this state
// outside the DOM lets an open group remain open and a collapsed group remain
// collapsed after that rerender.
const navigationStateByOrg = new Map();

const RAIL_KEY = 'portal.nav.rail';

/** Rail width is a shell-grid decision, so the choice lives on the document. */
function applyRail(collapsed) {
  document.documentElement.dataset.navRail = collapsed ? '1' : '0';
}

function railCollapsed() {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

applyRail(railCollapsed());

function setRail(collapsed) {
  try {
    localStorage.setItem(RAIL_KEY, collapsed ? '1' : '0');
  } catch {
    /* Private browsing can refuse storage; the session still switches. */
  }
  applyRail(collapsed);
}

function navigationState(orgId, activeIndex) {
  if (!navigationStateByOrg.has(orgId)) {
    navigationStateByOrg.set(orgId, {
      expanded: new Set(activeIndex >= 0 ? [activeIndex] : []),
      selectedChildren: new Map(),
    });
  }
  return navigationStateByOrg.get(orgId);
}

/** A section's own mark wins over the curated one — admins can restyle any row. */
function sectionGlyph(section, fallbackKey, { class: className = 'nav-tree__icon' } = {}) {
  if (section?.iconAsset?.url) return SectionIconGlyph(section, { class: className });
  const art = NAV_ARTWORK[section?.key];
  if (art) return artworkGlyph(art, { class: className });
  const key = hasIcon(section?.iconKey)
    ? section.iconKey
    : fallbackKey || iconForTitle(section?.title);
  return icon(key, { class: className });
}

export function SideNav(org, activeSectionId, { onLogout } = {}) {
  const sections = visibleSections();
  // A subsection page is the active route, but the group it belongs to is what
  // the pane highlights and holds open.
  const activeSection = sectionById(activeSectionId);
  const activeGroupId = activeSection?.parentId || activeSectionId;
  const activeIndex = sections.findIndex((section) => section.id === activeGroupId);
  const navState = navigationState(org.id, activeIndex);
  const admin = isAdmin();

  /* ------------------------------------------------------------ nav tree */
  // Filtering only ever hides rows, so an open group and its selected child
  // survive a search and come back untouched when the box is cleared.
  const records = [];

  /* Deciding which group is open and painting it are separate, so one group can
     close another. Keyed by the same index the state Set uses. */
  const groupControls = new Map();

  /**
   * Opens one group and closes the rest — an accordion, not ten switches.
   *
   * Every group that had been visited stayed open, so by the third click the
   * tree ran well past the bottom of the pane and the reader had to scroll to
   * find where they were. Pass -1 to close everything, which is what a group
   * with no subsections does: it is a page in its own right, so it takes the
   * selection without leaving somebody else's list hanging open behind it.
   */
  const openOnly = (index) => {
    navState.expanded.clear();
    if (index >= 0) navState.expanded.add(index);
    for (const [i, paint] of groupControls) paint(navState.expanded.has(i));
  };

  const openChild = (index, section, rowIndex, row) => {
    openOnly(index);
    // A real subsection has its own page; a curated label can only open the group.
    const target = row?.sectionId || section.id;
    if (row?.sectionId) navState.selectedChildren.delete(index);
    else if (navState.selectedChildren.get(index) === rowIndex) navState.selectedChildren.delete(index);
    else navState.selectedChildren.set(index, rowIndex);

    if (target !== activeSectionId) navigate(`/o/${org.id}/${target}`);
    else refresh();
  };

  const childButton = (row, rowIndex, index, section, selected) =>
    h(
      'button',
      {
        class: `nav-tree__child${row.kind === 'nested' ? ' nav-tree__child--nested' : ''}${selected ? ' is-active' : ''}`,
        type: 'button',
        title: row.label,
        'aria-current': selected ? 'page' : null,
        onclick: () => openChild(index, section, rowIndex, row),
      },
      icon('chevron-right', { class: 'nav-tree__child-icon' }),
      h('span', { class: 'nav-tree__child-title' }, row.label),
      /* Only a row backed by a real page can be released — a curated label with
         no section behind it has nothing to publish. */
      row.sectionId ? releaseToggle(sectionById(row.sectionId)) : null,
    );

  const groupNode = (section, index, title, iconKey, children) => {
    const active = section.id === activeGroupId;
    const rows = childRows(children);
    /* Programs, Placements, Events, Certifications and the rest are single
       pages. There is no list to open, so they get no panel at all: an empty one
       still drew its sunken plate and its padding, and that band of colour read
       as a subsection with nothing written on it. */
    const hasRows = rows.length > 0;
    const open = hasRows && navState.expanded.has(index);
    const group = h('div', { class: `nav-tree__group${open ? ' is-open' : ''}` });
    const paint = (isOpen) => {
      const on = hasRows && isOpen;
      group.classList.toggle('is-open', on);
      parent.setAttribute('aria-expanded', String(on));
    };
    groupControls.set(index, paint);
    const parent = h(
      'button',
      {
        class: `nav-tree__parent${active ? ' is-active' : ''}`,
        type: 'button',
        title,
        'aria-expanded': String(open),
        onclick: () => {
          if (active) {
            // Toggling means nothing when there is no list behind the row.
            if (hasRows) openOnly(navState.expanded.has(index) ? -1 : index);
            return;
          }
          openOnly(hasRows ? index : -1);
          /* A group with no content of its own is a heading, not a page.
             Leadership holds nothing and CEO Profile is the first thing under
             it, so opening Leadership showed an empty slide and the presenter
             had to click twice to reach the same place. Go straight to the
             first subsection that has something on it. */
          const own = (section.blocks || []).length;
          const firstPage = own ? null : childSections(section.id).find((c) => (c.blocks || []).length);
          navigate(`/o/${org.id}/${firstPage ? firstPage.id : section.id}`);
        },
      },
      h('span', { class: 'nav-tree__badge' }, sectionGlyph(section, iconKey)),
      h('span', { class: 'nav-tree__title' }, title),
      /* No "DRAFT" chip. The switch beside it already says the same thing —
         a closed eye is exactly "presenters cannot see this" — and the word was
         wide enough to push the row past the pane and raise a horizontal
         scrollbar under the whole sidebar. One mark, not two. */
      releaseToggle(section),
      rows.length ? h('span', { class: 'nav-tree__chevron' }, icon('chevron-right', { class: 'ic ic--xs' })) : null,
    );

    const childNodes = rows.map((row, rowIndex) => {
      // `--i` staggers the reveal, so the rows arrive in reading order.
      const node = row.kind === 'caption'
        ? h('div', { class: 'nav-tree__caption' }, row.label)
        : childButton(row, rowIndex, index, section,
            row.sectionId
              ? row.sectionId === activeSectionId
              : active && navState.selectedChildren.get(index) === rowIndex);
      node.style.setProperty('--i', String(rowIndex));
      return node;
    });

    group.append(parent);
    if (hasRows) {
      // The inner wrapper is what makes the open/close animate: a grid row of
      // 0fr → 1fr interpolates, where `display: none` cannot.
      group.append(
        h('div', { class: 'nav-tree__children' }, h('div', { class: 'nav-tree__children-inner' }, ...childNodes)),
      );
    }
    /* The index, not a snapshot of the open flag: clearing the search box puts
       back whatever is open now, and with an accordion that is rarely the group
       that was open when the row was built. */
    records.push({
      group,
      index,
      hasRows,
      haystack: `${title} ${rows.map((row) => row.label).join(' ')}`.toLowerCase(),
      children: childNodes.map((node, i) => ({ node, haystack: rows[i].label.toLowerCase() })),
    });
    return group;
  };

  const tree = sections.map((section, position) => {
    // Curated labels are keyed to the section's place in the organization's
    // full running order, not to where it happens to land in this viewer's
    // filtered list. `position` is still needed for the open/closed state,
    // which is per-rendered-row.
    const index = position;
    const [title, iconKey, curated] = groupFor(section);
    // A curated label is replaced by its own page once that page exists; the
    // rest of the group's story stays put until its pages are built too.
    const built = childSections(section.id);
    const children = title ? mergeChildren(curated, built) : built;
    return groupNode(section, index, title || section.title, iconKey, children);
  });

  /* ----------------------------------------------------------- rail flyout
     The rail keeps every section within one click; its subsections open beside
     it rather than disappearing with the labels. */
  const flyout = h('div', { class: 'snav-flyout', hidden: true });
  let flyoutIndex = -1;

  const closeFlyout = () => {
    flyoutIndex = -1;
    flyout.hidden = true;
    clear(flyout);
  };

  const openFlyout = (section, index, title, children, anchor) => {
    const rows = childRows(children);
    if (!rows.length) {
      navigate(`/o/${org.id}/${section.id}`);
      return;
    }
    if (flyoutIndex === index) {
      closeFlyout();
      return;
    }
    flyoutIndex = index;
    render(
      flyout,
      h(
        'div',
        { class: 'snav-flyout__head' },
        h(
          'button',
          {
            class: 'snav-flyout__title',
            type: 'button',
            title: `Open ${title}`,
            onclick: () => {
              closeFlyout();
              navigate(`/o/${org.id}/${section.id}`);
            },
          },
          title,
        ),
        h(
          'button',
          { class: 'snav-flyout__close', type: 'button', 'aria-label': 'Close', onclick: closeFlyout },
          icon('close', { class: 'ic ic--xs' }),
        ),
      ),
      h(
        'div',
        { class: 'snav-flyout__list' },
        ...rows.map((row, rowIndex) =>
          row.kind === 'caption'
            ? h('div', { class: 'nav-tree__caption' }, row.label)
            : h(
                'button',
                {
                  class: `nav-tree__child${row.kind === 'nested' ? ' nav-tree__child--nested' : ''}`,
                  type: 'button',
                  onclick: () => {
                    closeFlyout();
                    openChild(index, section, rowIndex);
                  },
                },
                icon('chevron-right', { class: 'nav-tree__child-icon' }),
                h('span', { class: 'nav-tree__child-title' }, row.label),
              ),
        ),
      ),
    );
    flyout.hidden = false;
    // Sit level with the icon that opened it, kept inside the window.
    const top = anchor.getBoundingClientRect().top - aside.getBoundingClientRect().top;
    flyout.style.top = `${Math.max(8, Math.min(top - 6, window.innerHeight - flyout.offsetHeight - 16))}px`;
  };

  /* ------------------------------------------------------------ rail tips
     One styled label, moved to whichever icon is under the pointer. The native
     `title` tooltip is a grey OS box that ignores the brand entirely, and a
     per-button pseudo-element would be clipped by the rail's own scroll. */
  const railTip = h('div', { class: 'snav-tip', hidden: true });

  const showTip = (anchor, label) => {
    railTip.textContent = label;
    railTip.hidden = false;
    const top = anchor.getBoundingClientRect().top - aside.getBoundingClientRect().top;
    railTip.style.top = `${top + anchor.offsetHeight / 2}px`;
    railTip.classList.add('is-on');
  };

  const hideTip = () => {
    railTip.classList.remove('is-on');
    railTip.hidden = true;
  };

  const railTree = h(
    'div',
    { class: 'snav-rail__list' },
    ...sections.map((section, index) => {
      const [title, iconKey, curated] = groupFor(section);
      const label = title || section.title;
      // The rail flyout was reading the curated list raw, so it never offered a
      // page that had actually been built. Same merge as the pane — the two are
      // meant to agree.
      const children = title ? mergeChildren(curated, childSections(section.id)) : childSections(section.id);
      const button = h(
        'button',
        {
          class: `snav-rail__btn${section.id === activeSectionId ? ' is-active' : ''}`,
          type: 'button',
          'aria-label': label,
          onclick: () => openFlyout(section, index, label, children, button),
          onmouseenter: () => showTip(button, label),
          onmouseleave: hideTip,
          onfocus: () => showTip(button, label),
          onblur: hideTip,
        },
        sectionGlyph(section, iconKey, { class: 'snav-rail__icon' }),
      );
      return button;
    }),
  );

  /* ----------------------------------------------------------- scroll body */
  const guide = h(
    'nav',
    { class: 'sidenav__scroll', 'aria-label': 'Organization guide' },
    h('div', { class: 'nav-tree' }, ...tree),
  );

  /* -------------------------------------------------------------- shell */
  const collapse = h(
    'button',
    {
      class: 'sidenav__collapse',
      type: 'button',
      title: 'Collapse the navigation',
      'aria-label': 'Collapse the navigation',
    },
    artworkGlyph(railCollapsed() ? CHROME_ARTWORK.expand : CHROME_ARTWORK.collapse,
      { class: 'ic ic--sm' }),
  );

  collapse.addEventListener('click', () => {
    const next = !railCollapsed();
    setRail(next);
    aside.classList.toggle('sidenav--rail', next);
    render(collapse, artworkGlyph(next ? CHROME_ARTWORK.expand : CHROME_ARTWORK.collapse,
      { class: 'ic ic--sm' }));
    collapse.title = next ? 'Expand the navigation' : 'Collapse the navigation';
    collapse.setAttribute('aria-label', collapse.title);
    closeFlyout();
  });

  /* Signing out is the one thing in the pane that is not navigation, so it sits in
     the head rather than in a card at the foot competing with the last section for
     the eye. This slot used to hold Manage sections, which was the only door to the
     settings page - that page is now reachable by its route only. */
  const signOut = h(
    'button',
    {
      class: 'sidenav__head-act sidenav__head-act--exit',
      type: 'button',
      title: 'Sign out',
      'aria-label': 'Sign out',
      onclick: onLogout,
    },
    artworkGlyph(CHROME_ARTWORK.signout, { class: 'ic ic--sm' }),
  );

  const brandMark = org.mark?.url
    ? h('img', { class: 'sidenav__mark', src: org.mark.url, alt: `${org.name} mark` })
    : h('div', { class: 'sidenav__mark sidenav__mark--text' }, initials(org.name, 1));

  const aside = h(
    'aside',
    { class: `sidenav${railCollapsed() ? ' sidenav--rail' : ''}` },
    h(
      'div',
      { class: 'sidenav__head' },
      org.logo?.url
        ? h('img', { class: 'sidenav__logo', src: org.logo.url, alt: `${org.name} logo` })
        : h('div', { class: 'sidenav__name' }, org.name),
      brandMark,
      signOut,
      collapse,
    ),
    guide,
    railTree,
    flyout,
    railTip,
  );

  return aside;
}
