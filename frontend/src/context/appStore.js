/**
 * Single shared application state. Pages read from `state`, mutate through the
 * helpers below, and re-render via the router — no per-component state.
 */
import * as contentService from '../services/contentService.js';

export const state = {
  user: null,
  loginHint: null,
  /* The presenter's sign-in details, served by /auth/me when PRESENTER_PREFILL
     is on, so the form arrives filled in. Never the admin's. */
  prefill: null,
  orgs: [],
  orgId: null,
  sections: [],
  loading: false,
  presenting: false,
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  for (const fn of listeners) fn(state);
}

export function isAdmin() {
  return state.user?.role === 'admin';
}

export function activeOrg() {
  return state.orgs.find((org) => org.id === state.orgId) || null;
}

export function orgById(orgId) {
  return state.orgs.find((org) => org.id === orgId) || null;
}

/**
 * Rows switched off in the code, per organization, by section key.
 * ---------------------------------------------------------------
 * These are sections that still exist, still hold all their content and are
 * still `published` in the store — they are simply not offered anywhere in the
 * interface: not in the pane, not in the collapsed rail, and not in Prev/Next
 * while presenting. Nothing is deleted and no data is touched, so switching one
 * back on is a one-line edit here and a refresh.
 *
 * TO BRING A ROW BACK: delete its line below (or comment it out). That is all.
 * TO HIDE ANOTHER ROW: add its `key` to that organization's list. The key is
 * the section's own, which is not always its title — Torii's "Video Resumes"
 * row is keyed `testimonials`, and its "Team" row is keyed `leadership-journey`
 * — so take the key from `backend/data/db.json` rather than guessing it.
 *
 * This is deliberately separate from `hidden`/`status` in the store, which is
 * what `tools/presenter-visibility.cjs` sets: that is per-deck editorial state
 * an admin can still see through, and this is a switch in the code that hides
 * the row from everyone, including an admin.
 */
export const HIDDEN_ROWS = {
  /* NGI, on request 2026-09-16. The section — the register, the skills and the
     gallery, 42 credentials — is intact and still published; only the row is
     switched off. */
  'technical-hub': [
    'certifications',       // Certifications
  ],
  /* Torii, on request 2026-09-16; Placements added 2026-09-17. */
  torii: [
    'industry-alliances',   // Industry Alliances
    'history-milestones',   // History & Milestones
    'success-stories',      // Success Stories
    'testimonials',         // Video Resumes  (the key is not the title)
    'placements',           // Placements
  ],
};

/**
 * Organizations switched off in the code — the same idea as `HIDDEN_ROWS`, one
 * level up. An id listed here is dropped as the organizations are loaded, so
 * the pane's tab strip, the organizations page and the router never see it:
 * its tab is not drawn, and a direct URL to one of its sections bounces to
 * `#/orgs`. The organization and every section in it stay in the store, whole.
 * Delete the line to bring it back.
 *
 * NGI and NCET, on request 2026-09-17: "I just want Torii ones."
 */
export const HIDDEN_ORGS = [
  'technical-hub',        // NGI and NCET
];

/** Whether this section is switched off in the code — see `HIDDEN_ROWS`. */
const isHiddenInCode = (section) => {
  const org = section.orgId || state.orgId;
  return (HIDDEN_ROWS[org] || []).includes(section.key);
};

const isShown = (section) => !isHiddenInCode(section)
  && (isAdmin() || (section.status === 'published' && !section.hidden));

/**
 * The navigation groups — top-level sections only. Subsections are their own
 * pages, reached through their parent, and are returned by `childSections`.
 */
/**
 * Where a top-level section sits in the organization's own running order,
 * regardless of who is looking.
 *
 * The curated navigation labels are matched to sections by position, and they
 * deliberately differ from the stored titles — "Vision, Mission & Values" is
 * presented as "Strategic Foundation". That only works against the complete
 * list. A presenter is shown a filtered subset, so indexing the labels by
 * position in *their* list slid every name up: with three sections released,
 * AI Ready Engineer was being announced as Strategic Foundation.
 */
export function sectionOrdinal(id) {
  return state.sections.filter((s) => !s.parentId).findIndex((s) => s.id === id);
}

export function visibleSections() {
  return state.sections.filter((s) => !s.parentId && isShown(s));
}

/** The pages inside one group, in their saved order. */
export function childSections(parentId) {
  return state.sections
    .filter((s) => s.parentId === parentId && isShown(s))
    .sort((a, b) => a.order - b.order);
}

/**
 * Presentation order walks the tree: a group, then the pages inside it, then the
 * next group — which is the order a presenter clicks through in the pane.
 */
export function deckSections() {
  const shown = (section) => !isHiddenInCode(section) && section.status === 'published' && !section.hidden;
  const children = (parentId) => state.sections
    .filter((s) => s.parentId === parentId && shown(s))
    .sort((a, b) => a.order - b.order);

  return state.sections
    .filter((s) => !s.parentId && shown(s))
    .flatMap((parent) => {
      const pages = children(parent.id);
      /* A group with no content of its own is a heading, not a slide. Leadership
         holds nothing and CEO Profile is the first page under it, so the deck
         was dealing a blank card before every group and the presenter had to
         press past it. Clicking the group in the nav already skips to the first
         page; Prev/Next now does the same. */
      const ownContent = (parent.blocks || []).length > 0;
      return ownContent || !pages.length ? [parent, ...pages] : pages;
    });
}

export function sectionById(id) {
  return state.sections.find((section) => section.id === id) || null;
}

export function sectionByKeyOrId(value) {
  return state.sections.find((section) => section.id === value || section.key === value) || null;
}

export async function loadOrgs({ force = false } = {}) {
  if (state.orgs.length && !force) return state.orgs;
  state.orgs = (await contentService.listOrgs()).filter((org) => !HIDDEN_ORGS.includes(org.id));
  return state.orgs;
}

export async function loadSections(orgId, { force = false } = {}) {
  if (state.orgId === orgId && state.sections.length && !force) return state.sections;
  state.orgId = orgId;
  state.sections = await contentService.listSections(orgId);
  return state.sections;
}

export function upsertSection(section) {
  const index = state.sections.findIndex((item) => item.id === section.id);
  if (index === -1) state.sections.push(section);
  else state.sections[index] = section;
  state.sections.sort((a, b) => a.order - b.order);
}

export function removeSection(sectionId) {
  state.sections = state.sections.filter((section) => section.id !== sectionId);
}

export function setSections(sections) {
  state.sections = sections;
}

export function upsertOrg(org) {
  const index = state.orgs.findIndex((item) => item.id === org.id);
  if (index === -1) state.orgs.push(org);
  else state.orgs[index] = org;
}

export function resetSession() {
  state.user = null;
  state.orgs = [];
  state.orgId = null;
  state.sections = [];
  state.presenting = false;
}
