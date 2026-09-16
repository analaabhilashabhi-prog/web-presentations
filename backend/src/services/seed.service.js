import { promises as fsp } from 'node:fs';
import * as orgModel from '../models/org.model.js';
import * as sectionModel from '../models/section.model.js';
import * as assetService from './asset.service.js';
import { data, persist } from '../models/db.js';
import { SEED_UPLOADS_DIR } from '../config/paths.js';
import { themeFor } from '../config/themes.js';
import { SEED, SECTION_ORDER } from './seed.data.js';
import { avatarSvg, orgLogoSvg, partnerLogoSvg, tileSvg } from '../utils/placeholderArt.js';
import { newId } from '../utils/id.js';
import { logger } from '../utils/logger.js';

const block = (type, props) => ({ id: newId('blk'), type, ...props });

async function buildArt(orgId, seed) {
  const theme = themeFor(orgId);
  const tag = orgId.slice(0, 4);

  const tiles = (list, prefix) =>
    Promise.all(
      list.map((item, index) =>
        assetService.saveSvg({
          name: `${tag}-${prefix}-${index + 1}`,
          svg: tileSvg({ label: item.label, sub: item.sub, theme, index }),
          width: 960,
          height: 640,
        }),
      ),
    );

  const [logo, ceoPortrait] = await Promise.all([
    assetService.saveSvg({
      name: `${tag}-logo`,
      svg: orgLogoSvg({ name: seed.meta.name, theme }),
      width: 720,
      height: 200,
    }),
    assetService.saveSvg({
      name: `${tag}-ceo`,
      svg: avatarSvg({ name: seed.ceo.name, role: seed.ceo.role, theme, index: 0 }),
      width: 520,
      height: 520,
    }),
  ]);

  const teamAvatars = await Promise.all(
    seed.team.map((member, index) =>
      assetService.saveSvg({
        name: `${tag}-team-${index + 1}`,
        svg: avatarSvg({ name: member.name, role: member.role, theme, index }),
        width: 520,
        height: 520,
      }),
    ),
  );

  const partnerLogos = await Promise.all(
    seed.mous.partners.map((partner, index) =>
      assetService.saveSvg({
        name: `${tag}-partner-${index + 1}`,
        svg: partnerLogoSvg({ name: partner.name, theme, index }),
        width: 480,
        height: 200,
      }),
    ),
  );

  const placementLogos = await Promise.all(
    seed.placements.entries.map((entry, index) =>
      assetService.saveSvg({
        name: `${tag}-company-${index + 1}`,
        svg: partnerLogoSvg({ name: entry.company, theme, index: index + 1 }),
        width: 480,
        height: 200,
      }),
    ),
  );

  const programImages = await tiles(
    seed.programs.map((program) => ({ label: program.title, sub: program.category })),
    'program',
  );

  return {
    logo,
    ceoPortrait,
    teamAvatars,
    partnerLogos,
    placementLogos,
    programImages,
    initiativeGallery: await tiles(seed.initiativeGallery, 'initiative'),
    coeGallery: await tiles(seed.coe.gallery, 'coe'),
    momentsGallery: await tiles(seed.moments, 'moment'),
    mediaGallery: await tiles(seed.media, 'media'),
  };
}

/** Maps the seed copy onto the block model the viewer and editor both speak. */
function buildBlocks(key, seed, art) {
  switch (key) {
    case 'profile':
      return [
        block('paragraph', { text: seed.profile.lead }),
        block('stats', { items: seed.profile.stats }),
        block('heading', { text: 'What makes us different', level: 2 }),
        block('bullets', { items: seed.profile.bullets }),
        block('paragraph', { text: seed.profile.body }),
      ];

    case 'ceo-message':
      return [
        block('quote', {
          text: seed.ceo.quote,
          author: seed.ceo.name,
          role: seed.ceo.role,
          imageAssetId: art.ceoPortrait.id,
        }),
        ...seed.ceo.paragraphs.map((text) => block('paragraph', { text })),
      ];

    case 'vision-mission':
      return [
        block('heading', { text: 'Vision', level: 2 }),
        block('paragraph', { text: seed.vision.vision }),
        block('divider', {}),
        block('heading', { text: 'Mission', level: 2 }),
        block('paragraph', { text: seed.vision.mission }),
        block('divider', {}),
        block('heading', { text: 'Values we hold each other to', level: 2 }),
        block('bullets', { items: seed.vision.values }),
      ];

    case 'best-practices':
      return [
        block('paragraph', {
          text: 'These are the operating rules our delivery teams work to. They exist because each one was learned the hard way.',
        }),
        block('cards', {
          variant: 'plain',
          items: seed.bestPractices.map((item) => ({ title: item.title, body: item.body })),
        }),
      ];

    case 'programs':
      return [
        block('paragraph', {
          text: 'Programs are delivered on our learning platform: sequenced modules, graded assignments, and a capstone that must be defended. Cohorts are scheduled around the academic calendar.',
        }),
        block('cards', {
          variant: 'program',
          items: seed.programs.map((program, index) => ({
            title: program.title,
            subtitle: program.category,
            meta: `${program.duration} · ${program.level}`,
            body: program.summary,
            tags: program.modules,
            imageAssetId: art.programImages[index]?.id || null,
          })),
        }),
        block('heading', { text: 'Every program includes', level: 3 }),
        block('bullets', {
          items: [
            'Sequenced modules with graded assignments and reviewed submissions',
            'A baseline, midline and exit assessment for every learner',
            'A defended capstone project as the exit requirement',
            'Attendance and progress reporting shared with the department',
          ],
        }),
      ];

    case 'team':
      return [
        block('paragraph', {
          text: 'Our trainers are practitioners first. Each one is certified internally before taking a batch, and is reviewed every semester on learner outcomes.',
        }),
        block('cards', {
          variant: 'team',
          items: seed.team.map((member, index) => ({
            title: member.name,
            subtitle: member.role,
            body: member.focus,
            tags: member.tags,
            imageAssetId: art.teamAvatars[index]?.id || null,
          })),
        }),
      ];

    case 'initiatives':
      return [
        block('paragraph', {
          text: 'Programmes we fund ourselves, because access should not depend on what a student can pay.',
        }),
        block('cards', {
          variant: 'plain',
          items: seed.initiatives.map((item) => ({
            title: item.title,
            meta: item.meta,
            body: item.body,
          })),
        }),
        block('gallery', {
          caption: 'Initiatives in action',
          assetIds: art.initiativeGallery.map((asset) => asset.id),
        }),
      ];

    case 'certifications':
      return [
        block('paragraph', {
          text: 'Our certifications are assessed, not awarded for attendance. Every credential below has a published rubric and a fixed pass bar.',
        }),
        block('cards', {
          variant: 'certification',
          items: seed.certifications.map((item) => ({
            title: item.title,
            meta: item.meta,
            body: item.body,
          })),
        }),
      ];

    case 'placements':
      return [
        block('stats', { items: seed.placements.stats }),
        block('paragraph', {
          text: 'Drives are run on campus by our recruiter desk. The figures below are illustrative sample data covering the most recent placement cycle.',
        }),
        block('cards', {
          variant: 'placement',
          items: seed.placements.entries.map((entry, index) => ({
            title: entry.company,
            subtitle: entry.role,
            meta: `${entry.offers} offers · ${entry.pkg} highest`,
            imageAssetId: art.placementLogos[index]?.id || null,
          })),
        }),
      ];

    case 'coe':
      return [
        block('paragraph', { text: seed.coe.lead }),
        block('cards', {
          variant: 'plain',
          items: seed.coe.centres.map((centre) => ({
            title: centre.title,
            meta: centre.meta,
            body: centre.body,
          })),
        }),
        block('gallery', {
          caption: 'Inside our centres',
          assetIds: art.coeGallery.map((asset) => asset.id),
        }),
      ];

    case 'mous':
      return [
        block('paragraph', { text: seed.mous.lead }),
        block('stats', { items: seed.mous.stats }),
        block('heading', { text: 'Institutions we work with', level: 2 }),
        block('cards', {
          variant: 'partner',
          items: seed.mous.partners.map((partner, index) => ({
            title: partner.name,
            subtitle: partner.type,
            meta: `MOU signed ${partner.since}`,
            body: partner.scope,
            imageAssetId: art.partnerLogos[index]?.id || null,
          })),
        }),
        block('divider', {}),
        block('heading', { text: 'What we bring to the partnership', level: 3 }),
        block('bullets', { items: seed.mous.whatWeBring }),
        block('heading', { text: 'What we ask from the institution', level: 3 }),
        block('bullets', { items: seed.mous.whatWeAsk }),
      ];

    case 'moments':
      return [
        block('paragraph', {
          text: 'A few moments from the last academic year — summits, drives, inaugurations and the days students remember.',
        }),
        block('gallery', {
          caption: 'Highlights from the past year',
          assetIds: art.momentsGallery.map((asset) => asset.id),
        }),
      ];

    case 'achievements':
      return [
        block('paragraph', {
          text: 'Recognition from industry bodies and the milestones we measure ourselves against.',
        }),
        block('cards', {
          variant: 'plain',
          items: seed.achievements.map((item) => ({
            title: item.title,
            meta: item.meta,
            body: item.body,
          })),
        }),
      ];

    case 'media':
      return [
        block('gallery', {
          caption: 'Press, events and campus life',
          assetIds: art.mediaGallery.map((asset) => asset.id),
        }),
      ];

    case 'testimonials':
      return seed.testimonials.map((item) =>
        block('quote', { text: item.text, author: item.author, role: item.role }),
      );

    case 'contact':
      return [
        block('paragraph', { text: seed.contact.lead }),
        block('cards', {
          variant: 'plain',
          items: seed.contact.offices.map((office) => ({
            title: office.title,
            subtitle: office.subtitle,
            body: office.body,
          })),
        }),
        block('heading', { text: 'Reach us', level: 3 }),
        block('bullets', { items: seed.contact.lines }),
      ];

    default:
      return [block('paragraph', { text: 'Add content for this section.' })];
  }
}

const SUBTITLES = {
  profile: 'Who we are',
  'ceo-message': 'A note from our leadership',
  'vision-mission': 'Where we are going, and how we behave',
  'best-practices': 'How we deliver',
  programs: 'What we teach',
  team: 'The people who deliver it',
  initiatives: 'Programmes we fund ourselves',
  certifications: 'Assessed credentials',
  placements: 'Outcomes and hiring partners',
  coe: 'Labs and facilities',
  mous: 'Partner with us',
  moments: 'Moments worth keeping',
  achievements: 'Recognition and milestones',
  media: 'Photo gallery',
  testimonials: 'In their words',
  contact: 'Start a conversation',
};

async function seedOrganization(orgId, { blank = false } = {}) {
  const seed = SEED[orgId];
  // A blank start still needs a logo so the theme reads correctly.
  const art = blank
    ? {
        logo: await assetService.saveSvg({
          name: `${orgId.slice(0, 4)}-logo`,
          svg: orgLogoSvg({ name: seed.meta.name, theme: themeFor(orgId) }),
          width: 720,
          height: 200,
        }),
      }
    : await buildArt(orgId, seed);

  await orgModel.insert({
    id: orgId,
    name: seed.meta.name,
    shortName: seed.meta.shortName,
    tagline: seed.meta.tagline,
    logoAssetId: art.logo.id,
    founded: seed.meta.founded,
    hq: seed.meta.hq,
    order: orgId === 'torii' ? 0 : 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  for (const [index, tab] of SECTION_ORDER.entries()) {
    await sectionModel.insert({
      id: newId('sec'),
      orgId,
      key: tab.key,
      title: tab.title,
      subtitle: blank ? '' : SUBTITLES[tab.key] || '',
      icon: tab.icon,
      order: index,
      hidden: false,
      status: 'published',
      blocks: blank ? [] : buildBlocks(tab.key, seed, art),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}

/**
 * Runs once, on an empty database. Safe to call on every boot.
 * `blank: true` creates both organizations with all 16 sections present but
 * empty, ready for the admin's own content.
 */
export async function seedIfEmpty({ force = false, blank = false } = {}) {
  const store = data();
  if (store.meta.seededAt && !force) return false;

  if (force) {
    store.organizations = [];
    store.sections = [];
    store.assets = [];
    // Generated art is disposable; clear it so reseeding cannot pile up
    // orphaned files. Admin uploads live one level up and are untouched.
    await fsp.rm(SEED_UPLOADS_DIR, { recursive: true, force: true });
    await fsp.mkdir(SEED_UPLOADS_DIR, { recursive: true });
  }

  for (const orgId of Object.keys(SEED)) {
    await seedOrganization(orgId, { blank });
  }

  store.meta.seededAt = new Date().toISOString();
  store.meta.blank = blank;
  await persist();
  logger.info(
    blank
      ? `created ${store.organizations.length} organizations with ${store.sections.length} empty sections — ready for your content`
      : `seeded ${store.organizations.length} organizations, ${store.sections.length} sections, ${store.assets.length} placeholder images`,
  );
  return true;
}
