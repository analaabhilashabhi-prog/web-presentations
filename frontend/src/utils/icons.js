/**
 * Shared line-icon library.
 *
 * One geometric family: 24×24 box, 1.7 stroke, round joins, no fills. Every
 * navigation term — group and child alike — resolves to an icon that means
 * something, and admin-created sections resolve by keyword so a new section is
 * never left with a placeholder glyph.
 *
 * Shape encoding keeps the table readable: a bare `d` string is a <path>, and
 * `c cx cy r` / `r x y w h rx` / `l x1 y1 x2 y2` are the primitives.
 */
import { svg } from './dom.js';

const ICONS = {
  /* ------------------------------------------------ organization & content */
  /* The pane control. Four arrows to the corners to open it, four back to the
     middle to close it — a chevron alone was the same glyph every row uses to
     mean "open me", which said the wrong thing about a control that acts on the
     navigation itself. Each arrow is a shaft plus a two-stroke head, so it holds
     together at 16px in the head and at the heavier rail stroke alike. */
  'panel-expand': [
    'M10.2 10.2 4.4 4.4', 'M4.4 9V4.4H9',
    'm13.8 10.2 5.8-5.8', 'M15 4.4h4.6V9',
    'M10.2 13.8 4.4 19.6', 'M4.4 15v4.6H9',
    'm13.8 13.8 5.8 5.8', 'M15 19.6h4.6V15',
  ],
  'panel-collapse': [
    'M4.4 4.4l5.8 5.8', 'M10.2 5.6v4.6H5.6',
    'm19.6 4.4-5.8 5.8', 'M13.8 5.6v4.6h4.6',
    'M4.4 19.6l5.8-5.8', 'M5.6 13.8h4.6v4.6',
    'm19.6 19.6-5.8-5.8', 'M18.4 13.8h-4.6v4.6',
  ],

  /* ----------------------------------------------- the presentation deck
     One glyph per section, in deck order, drawn from the references the user
     supplied. They arrived from several different icon sets at several different
     weights, so none of them keeps its own: same 24x24 box, one stroke, no fills,
     round caps and joins. A column of fourteen has to look drawn, not collected.

     Where a reference carried a word — CEO, JOB, EVENT, WWW, AI — the container is
     kept and the lettering is not, except on the globe. Four letters inside a shape
     inside a 19px row is about two screen pixels per letter; it reads as dirt, and
     dirt in one row makes the whole column look unfinished. */
  /* 1. Executive Summary — a team inside a cycle. Four figures, as
     supplied; the three at the back merge below about 20px and the front one
     carries the reading from there down. */
  'team-cycle': [
    'M4 6.6A9.6 9.6 0 1 1 19.6 17.9',
    'M19.8 15.4L19.6 17.9L22 17.1',
    'M17.4 20A9.6 9.6 0 0 1 2.6 10',
    'M3.5 12.3L2.6 10L0.8 11.7',
    'c 12 6.5 1.3',
    'M9.7 11.9v-1.5a2.1 2.1 0 0 1 4.6 0v1.5Z',
    'c 7.1 11 1.3',
    'M4.8 16.2v-1.3a2.1 2.1 0 0 1 4.6 0v1.3Z',
    'c 16.9 11 1.3',
    'M14.6 16.2v-1.3a2.1 2.1 0 0 1 4.6 0v1.3Z',
    'c 12 12.4 1.75',
    'M8.5 19.7v-1.8a3.2 3.2 0 0 1 7 0v1.8Z',
  ],

  /* 2. Organization Snapshot — a camera with a print tucked behind it. */
  'camera-photo': [
    'M6.3 9.4 7.9 3.7a1.3 1.3 0 0 1 1.6-.9l7.3 2a1.3 1.3 0 0 1 .9 1.6l-.6 2.2',
    'M7.4 8.1l2.1-2.1 2.4 2.4 1.3-1.3 1.7 1.7',
    'c 11.2 4.7 .9',
    'M2.6 9.4h6.1l.7-1.5h5l.7 1.5h6.3v9.9a1.8 1.8 0 0 1-1.8 1.8H4.4a1.8 1.8 0 0 1-1.8-1.8z',
    'c 14.1 15.1 3.6',
    'c 14.1 15.1 1.5',
    'c 5.9 12.3 .85',
  ],

  /* 3. History & Milestones — the road, its stops, and the flag at the end.
     The supplied glyph also carried a target; four objects will not fit a nav row,
     so the pin marks the start and the flag the finish. */
  roadmap: [
    'M4.3 15.4a3.5 3.5 0 1 1 7 0c0 2.4-3.5 6-3.5 6s-3.5-3.6-3.5-6Z',
    'c 7.8 15.2 1.35',
    'M18.1 3.2v6.7',
    'M18.1 3.6h4.1l-1.2 1.5 1.2 1.5h-4.1z',
    'M18.1 9.9h-2.6',
    'c 13.9 9.9 1.6',
    'M12.3 9.9H9.1a3.1 3.1 0 0 0 0 6.2h3.3',
    'c 14 16.1 1.6',
    'M15.6 16.1h1.5a2.6 2.6 0 0 1 0 5.2h-5.3',
  ],

  /* 4. CEO Profile — the figure at the lectern. The nameplate keeps its
     shape and loses its three letters, which would be two screen pixels tall here. */
  'ceo-podium': [
    'M8.4 8.6a3.7 3.7 0 0 1 7.3 0',
    'c 12 8.9 3.5',
    'M6.6 17.5c.3-2.6 1.9-4.4 4.2-5',
    'M17.4 17.5c-.3-2.6-1.9-4.4-4.2-5',
    'M12 12.5l-1.5 1.6 1.5 3.4 1.5-3.4z',
    'M3.4 17.5h17.2v1.4l-1.1 3.1H4.5l-1.1-3.1z',
    'r 9.8 19.5 4.4 2.2 .6',
  ],

  /* 5. Leadership Journey — the climb, the steps, the flag planted at the top. */
  'climb-steps': [
    'M2.5 21.5h19',
    'M3 21.5v-2.1a.8.8 0 0 1 .8-.8h2.9',
    'M6.7 21.5v-4.1a.8.8 0 0 1 .8-.8h2.9',
    'M10.4 21.5v-6.6a.9.9 0 0 1 .9-.9h3',
    'M14.3 21.5V11.2a.9.9 0 0 1 .9-.9h2.4v11.2',
    'M18.6 21.5V3.4',
    'M18.6 3.8h3.9l-1.2 1.5 1.2 1.5h-3.9z',
    'c 9.8 6.9 1.15',
    'M9 8.1l-1.3 2.6',
    'M8.3 10.2l1.4 4.1 1.9 3.5',
    'M10.3 14.6l-.6 3.9',
    'M9.4 9.5l3-1.4 5.4-3.1',
  ],

  /* 6. Success Stories — the rosette. */
  rosette: [
    'c 12 9 6.1',
    'M12 5.4l1.7 3.5 3.8.5-2.8 2.7.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.7 3.8-.5z',
    'M8.4 14.2l-2 6.4 3-1.3 1.6 2.5 1.6-4.6',
    'M15.6 14.2l2 6.4-3-1.3-1.6 2.5-1.6-4.6',
  ],

  /* Platforms — the hand on the network. */
  'tap-network': [
    'c 5.2 5.6 2.2',
    'c 17.4 5.4 2.4',
    'c 20 12.2 2.1',
    'c 3.6 12.6 1.9',
    'M7.3 6.7l2.6 1.6',
    'M15.2 6.8l-2.3 1.5',
    'M13.5 9.9l4.5.9',
    'M5.5 12.4h.7',
    'M8.9 9.1a2.6 2.6 0 0 1 4.3 1.2',
    'M9.3 16.3v-5.5a1.5 1.5 0 0 1 3 0v3.3',
    'M12.3 14.4v-1a1.4 1.4 0 0 1 2.8 0v1',
    'M15.1 14.5v-.6a1.4 1.4 0 0 1 2.8 0v3.6a4.4 4.4 0 0 1-4.4 4.4h-3a3.6 3.6 0 0 1-3-1.6l-2.6-4a1.5 1.5 0 0 1 2.4-1.8l1.1 1.4',
  ],

  /* 8. Centers of Excellence — the handshake, agreed. Two forearms
     arriving from the edges into a clasp: drawn as free-floating cuffs the pair read
     as two diamonds with fingers between them. */
  'handshake-check': [
    'c 12 4.8 2.7',
    'M10.8 4.8l1 1 1.5-1.9',
    'M2.2 12.4l2.5-2.5 3.4 3.4-2.5 2.5z',
    'M21.8 12.4l-2.5-2.5-3.4 3.4 2.5 2.5z',
    'M8.1 13.3l1.7-1.7h2.6l3.5 2.9',
    'M15.8 13.5l-1.6 1.6',
    'M9.5 14.1l2 1.7',
    'M8.3 15.6l1.9 1.6',
    'M11.6 16.4a1.5 1.5 0 0 1 2.1 2.1',
    'M13.7 18.5a1.5 1.5 0 0 0 2.1 0l3.3-3.3',
  ],

  /* 9. Certifications — the scalloped seal, eight lobes on one continuous edge. */
  'seal-check': [
    'M12 2.6a2.6 2.6 0 0 1 1.9.8 2.6 2.6 0 0 0 1.9.8 2.6 2.6 0 0 1 2.7 2.7 2.6 2.6 0 0 0 .8 1.9a2.6 2.6 0 0 1 0 3.7 2.6 2.6 0 0 0-.8 1.9 2.6 2.6 0 0 1-2.7 2.7 2.6 2.6 0 0 0-1.9.8a2.6 2.6 0 0 1-3.7 0 2.6 2.6 0 0 0-1.9-.8 2.6 2.6 0 0 1-2.7-2.7 2.6 2.6 0 0 0-.8-1.9a2.6 2.6 0 0 1 0-3.7 2.6 2.6 0 0 0 .8-1.9 2.6 2.6 0 0 1 2.7-2.7 2.6 2.6 0 0 0 1.9-.8A2.6 2.6 0 0 1 12 2.6Z',
    'M8.4 11.4l2.6 2.6 5-5.4',
  ],

  /* 10. Placements — the job on the map. A briefcase inside the pin rather
     than the supplied J-O-B, which at this size read as three tally marks. */
  'job-pin': [
    'M12 2.4a7.1 7.1 0 0 1 5.4 11.7L12 20.4l-5.4-6.3A7.1 7.1 0 0 1 12 2.4Z',
    'c 12 9.5 4.6',
    'M4.1 18.4c-1 .4-1.6 1-1.6 1.6 0 1.2 4.2 2.2 9.5 2.2s9.5-1 9.5-2.2c0-.6-.6-1.2-1.6-1.6',
    'r 8.2 7.9 7.6 5.2 1',
    'M10.4 7.9V7a.9.9 0 0 1 .9-.9h1.4a.9.9 0 0 1 .9.9v.9',
  ],

  /* 11. Events — the sign, hung. Two rules stand in for the word on it. */
  'event-sign': [
    'c 12 3.6 1.1',
    'M11.3 4.5L4.6 7.9',
    'M12.7 4.5l6.7 3.4',
    'r 3.4 7.9 17.2 12.2 1.7',
    'M6 10.8h12',
    'M6 17h12',
  ],

  /* 12. Video Resumes — the clapperboard. */
  clapper: [
    'M3.2 9.5h17.6v9.6a1.9 1.9 0 0 1-1.9 1.9H5.1a1.9 1.9 0 0 1-1.9-1.9z',
    'M3.9 6.2l14.6-3.1a1.5 1.5 0 0 1 1.8 1.2l.5 2.4-16.6 3.5-.5-2.3a1.5 1.5 0 0 1 1.2-1.7Z',
    'M8 4.4l1.1 4.5',
    'M12.2 3.5l1.1 4.5',
    'M16.4 2.6l1.1 4.5',
    'M3.2 13.4h17.6',
    'M10.6 15.4l3.9 2.2-3.9 2.2z',
  ],

  /* 13. AI Ready Engineer — the figure whose thinking is the lamp. A spark
     in the head rather than the letters A and I, for the same reason as the nameplate. */
  'ai-figure': [
    'c 12 8.7 3.7',
    'M12 2.1v1.8',
    'M6.2 4.6l1.3 1.3',
    'M17.8 4.6l-1.3 1.3',
    'M2.9 10.2h1.8',
    'M21.1 10.2h-1.8',
    'M12 6.9l1.1 2.3 2.3 1.1-2.3 1.1L12 13.7l-1.1-2.3-2.3-1.1 2.3-1.1z',
    'c 12 14 1.5',
    'M12 15.5l-1.1 1.3.6 4.9h1l.6-4.9z',
    'M10.7 14.5L6.9 17v4.7',
    'M13.3 14.5l3.8 2.5v4.7',
  ],

  /* Programs & Learning — the web.

     The band interrupts the globe rather than sitting on top of it. Drawn the first
     way — a whole circle, two full latitudes, two pole-to-pole meridians, then the
     band laid across the middle — six lines crossed the band and the lettering sat
     among them, which at 21px is a dark bar and not a globe. The reference fills its
     band white to hide what is behind it; that is not available here, because the
     pane is white, the rail is dark green and the selected row is green, so a white
     plate would be a white block on two grounds out of three. Clipping the geometry
     to the band edges costs nothing and works on all three.

     Every stop is solved, not eyeballed: the circle meets the band at x=2.82 and
     21.18, the meridians at 7.6 and 16.4. */
  'www-globe': [
    'M2.82 9.2A9.6 9.6 0 0 1 21.18 9.2',
    'M21.18 14.8A9.6 9.6 0 0 1 2.82 14.8',
    'M4.2 6.4H19.8',
    'M4.2 17.6H19.8',
    'M12 2.4A4.6 9.6 0 0 0 7.6 9.2',
    'M12 2.4A4.6 9.6 0 0 1 16.4 9.2',
    'M7.6 14.8A4.6 9.6 0 0 0 12 21.6',
    'M16.4 14.8A4.6 9.6 0 0 1 12 21.6',
    'r 2.5 9.2 19 5.6 1.5',
    'M5.3 10.7l.85 2.6.85-2.6.85 2.6.85-2.6',
    'M9.9 10.7l.85 2.6.85-2.6.85 2.6.85-2.6',
    'M14.5 10.7l.85 2.6.85-2.6.85 2.6.85-2.6',
  ],

  /* Oracle. A wordmark, set as type rather than traced: the house rule is not to
     hand-draw a vendor's logo, and Oracle's mark *is* its wordmark, so type is also
     the closest honest rendering of it. Drop an official SVG into the assets and this
     can be swapped for it. */
  'oracle-word': [],

  layers: ['M12 3 3.6 7.4 12 11.8l8.4-4.4z', 'M4 12.4 12 16.6l8-4.2', 'M4 16.7 12 20.9l8-4.2'],
  document: [
    'M7.2 3h6.3L18 7.4V20a1 1 0 0 1-1 1H7.2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
    'M13.4 3v4.6H18',
    'M9.3 13.2h5.5',
    'M9.3 16.5h3.3',
  ],
  building: [
    'M4.2 20.6V7.4l7-3.3v16.5',
    'M11.2 20.6h8.6v-9.1l-8.6-4',
    'l 2.6 20.6 21.4 20.6',
    'M7.2 10.3v1.5',
    'M7.2 14.1v1.5',
    'M15 13.9v1.5',
    'M15 17.3v1.5',
  ],
  flag: ['M6 21V4', 'M6 4.6h11.5l-1.9 4 1.9 4H6'],
  copy: ['r 9 9 11 11 2', 'M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1'],
  clock: ['c 12 12 8.2', 'M12 7.4V12l3.3 2'],
  compass: ['c 12 12 8.4', 'm15 9-1.9 4.3-4.3 1.9 1.9-4.3z'],
  eye: ['M2.8 12S6.6 5.9 12 5.9 21.2 12 21.2 12 17.4 18.1 12 18.1 2.8 12 2.8 12z', 'c 12 12 2.9'],
  target: ['c 12 12 8.3', 'c 12 12 4.2', 'c 12 12 1'],
  heart: ['M12 20.4C7.6 17.6 4 14.6 4 10.9A4 4 0 0 1 12 8.6a4 4 0 0 1 8 2.3c0 3.7-3.6 6.7-8 9.5z'],
  /* Sound. Filled cone plus stroked arcs, so the state reads at a glance on a
     dark scrim: arcs present means audible, the slash means silent. */
  volume: ['f M4.6 9.4h3.2L12 5.8v12.4l-4.2-3.6H4.6z',
           'M15.4 9.6a3.4 3.4 0 0 1 0 4.8', 'M17.8 7.2a6.8 6.8 0 0 1 0 9.6'],
  'volume-off': ['f M4.6 9.4h3.2L12 5.8v12.4l-4.2-3.6H4.6z',
                 'm15.6 10.2 4.4 4.4', 'm20 10.2-4.4 4.4'],
  /* Transport controls. Filled rather than stroked: at 18px a stroked triangle
     reads as an outline of nothing, and these sit on a dark scrim where a solid
     shape carries much further. */
  play: ['f M8.4 5.6 18 12l-9.6 6.4z'],
  pause: ['f M8 5.4h2.9v13.2H8z', 'f M13.1 5.4H16v13.2h-2.9z'],
  rewind: ['f M11.4 6.6v10.8L4.6 12z', 'f M19.4 6.6v10.8L12.6 12z'],
  forward: ['f M12.6 6.6 19.4 12l-6.8 5.4z', 'f M4.6 6.6 11.4 12l-6.8 5.4z'],
  /* A fingerprint, for "human". Concentric arcs rather than a traced photograph
     of one — it is a pictogram, and it has to read at 26px. */
  fingerprint: [
    'M12 3.6c-2 0-3.8.7-5.2 1.9',
    'M18.4 6.6A8.4 8.4 0 0 0 12 3.6',
    'M4.4 8.2A8.4 8.4 0 0 0 3.6 12c0 1.5.4 2.9 1.1 4.1',
    'M20.4 12c0-1.4-.3-2.6-.9-3.8',
    'M12 7.2a4.8 4.8 0 0 0-4.8 4.8c0 1.6 0 3.2-.6 4.6',
    'M16.8 12A4.8 4.8 0 0 0 12 7.2',
    'M17 15.4c-.2 1.6-.6 3.2-1.4 4.6',
    'M12 10.6a1.4 1.4 0 0 0-1.4 1.4c0 2.6-.2 5.2-1 7.6',
    'M13.4 12c0-.8-.6-1.4-1.4-1.4',
    'M13.4 12c0 2.8-.2 5.6-.9 8.2',
  ],
  /* A four-point spark, for "AI". Ours, not a vendor's mark: no clean official
     file for any AI brand is in this repository, and drawing one from memory is
     how a deck ends up asserting a partnership nobody signed. */
  spark: [
    'f M12 2.4l1.9 5.9 5.9 1.9-5.9 1.9L12 21.6l-1.9-9.5L4.2 10.2l5.9-1.9z',
    'f M19.2 15.6l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8z',
  ],
  sparkles: ['m11.4 3.4 1.7 4.7 4.7 1.7-4.7 1.7-1.7 4.7-1.7-4.7L5 9.8l4.7-1.7z', 'm18.4 15.4.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z'],

  /* ------------------------------------------------------------- people */
  user: ['c 12 8.2 3.4', 'M5.4 20.4c1-3.6 3.3-5.4 6.6-5.4s5.6 1.8 6.6 5.4'],
  'user-badge': ['r 4 3.6 16 16.8 3', 'c 12 10.2 2.6', 'M8 17.6c.7-2 2-3 4-3s3.3 1 4 3'],
  users: [
    'c 9.4 8.6 3.1',
    'M3.4 19.9c.8-3.1 2.9-4.7 6-4.7 1.3 0 2.5.3 3.5.8',
    'c 16.9 10.1 2.4',
    'M14.6 15.4c3.2.2 5.4 1.7 6 4.5',
  ],
  'user-check': ['c 10 8.4 3.3', 'M3.6 20.4c1-3.6 3.2-5.4 6.4-5.4 1 0 2 .2 2.8.5', 'm15.6 17.8 1.8 1.8 3.4-3.6'],
  // Two interlocking rings: an alliance reads instantly at 18px, where a
  // literal handshake collapses into a squiggle.
  partners: ['c 9.2 12 5.2', 'c 14.8 12 5.2'],
  quote: [
    'M9.6 7.4c-2.6.8-4.2 2.9-4.2 5.4 0 1.9 1.2 3.2 2.9 3.2a2.6 2.6 0 0 0 2.7-2.6c0-1.5-1-2.5-2.4-2.6.2-1.2 1.1-2.2 2.4-2.7z',
    'M18.4 7.4c-2.6.8-4.2 2.9-4.2 5.4 0 1.9 1.2 3.2 2.9 3.2a2.6 2.6 0 0 0 2.7-2.6c0-1.5-1-2.5-2.4-2.6.2-1.2 1.1-2.2 2.4-2.7z',
  ],
  message: ['M4.2 6.4h15.6v9.4H12l-4.6 3.6v-3.6H4.2z', 'M8.2 11h7.6'],
  interview: ['c 8.6 9.4 2.8', 'M4 19.6c.8-2.9 2.4-4.4 4.6-4.4s3.8 1.5 4.6 4.4', 'M15.4 6.6h4.6v5.4h-2.4l-2.2 1.8v-1.8h-.1a1 1 0 0 1 .1-5.4z'],
  graduation: ['m3.4 9 8.6-3.9L20.6 9 12 12.9z', 'M6.6 10.7v4.5c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-4.5', 'M20.6 9v5.4'],

  /* --------------------------------------------------------- learning */
  book: ['M4.4 5.4A2.2 2.2 0 0 1 6.6 3.2H12v17.4H6.6a2.2 2.2 0 0 0-2.2 2.2z', 'M19.6 5.4a2.2 2.2 0 0 0-2.2-2.2H12v17.4h5.4a2.2 2.2 0 0 1 2.2 2.2z'],
  route: ['c 6.6 6.4 2.6', 'c 17.4 17.6 2.6', 'M9.2 6.4h5.4a2.9 2.9 0 0 1 0 5.8H9.4a2.9 2.9 0 0 0 0 5.8h5.4'],
  checklist: ['r 4.4 4 15.2 16.6 2.4', 'm7.8 9.4 1.4 1.4 2.6-2.8', 'M13.6 9.4h3.4', 'm7.8 15.4 1.4 1.4 2.6-2.8', 'M13.6 15.4h3.4'],
  'clipboard-check': [
    'M9 4.4H7.4a1.4 1.4 0 0 0-1.4 1.4v13.4a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4V5.8a1.4 1.4 0 0 0-1.4-1.4H15',
    'r 9 2.8 6 3.2 1.2',
    'm9.2 13.6 1.8 1.8 3.8-3.8',
  ],
  'trend-up': ['M3.8 17.4 9.8 11l3.6 3.6L20.2 7', 'M15.2 7h5v5'],
  gauge: ['M4 17.6a8.6 8.6 0 1 1 16 0', 'm12 12.8 3.6-3', 'c 12 17.4 1.2'],
  funnel: ['M3.8 5.4h16.4l-6.2 7.2v6.2l-4-2.2v-4z'],
  puzzle: [
    'M13.8 4.2v1.2a1.8 1.8 0 1 1-3.6 0V4.2H5.4a1.2 1.2 0 0 0-1.2 1.2v4.6h1.2a1.8 1.8 0 1 1 0 3.6H4.2v4.8a1.2 1.2 0 0 0 1.2 1.2h13.2a1.2 1.2 0 0 0 1.2-1.2V5.4a1.2 1.2 0 0 0-1.2-1.2z',
  ],
  pencil: ['m4.6 19.4 1-3.6L15.4 6a1.9 1.9 0 0 1 2.7 2.7L8.3 18.4z', 'l 4.6 19.4 8.3 18.4'],
  'pencil-test': ['M6.4 3.6h11.2v16.8H6.4z', 'M9 7.6h6.2', 'M9 11.2h6.2', 'm9 15.4 1.4 1.4 2.8-3'],

  /* ------------------------------------------------------- technology */
  code: ['m9 8.4-4.2 3.6 4.2 3.6', 'm15 8.4 4.2 3.6-4.2 3.6', 'm13.4 5.6-2.8 12.8'],
  terminal: ['r 3.4 4.6 17.2 14.8 2.2', 'm7.4 10 2.4 2.2-2.4 2.2', 'M12.4 14.4h4.2'],
  chip: ['r 7.4 7.4 9.2 9.2 2', 'r 10.6 10.6 2.8 2.8 .8', 'M10.4 4v3.4', 'M13.6 4v3.4', 'M10.4 16.6V20', 'M13.6 16.6V20', 'M4 10.4h3.4', 'M4 13.6h3.4', 'M16.6 10.4H20', 'M16.6 13.6H20'],
  brain: [
    'M11.2 4.6a3.1 3.1 0 0 0-5.3 2 2.9 2.9 0 0 0-.9 5.2 3 3 0 0 0 2.2 5.2h4z',
    'M12.8 4.6a3.1 3.1 0 0 1 5.3 2 2.9 2.9 0 0 1 .9 5.2 3 3 0 0 1-2.2 5.2h-4z',
    'M12 4.6V17',
    'M8.2 9.4h1.8',
    'M14 9.4h1.8',
  ],
  server: ['r 3.8 4.4 16.4 6 1.8', 'r 3.8 13.6 16.4 6 1.8', 'M7.2 7.4v0', 'M7.2 16.6v0', 'M10.6 7.4h6', 'M10.6 16.6h6'],
  workflow: ['r 3.6 4.2 6.4 5.2 1.6', 'r 14 14.6 6.4 5.2 1.6', 'M6.8 9.4v4.4a2 2 0 0 0 2 2h3.2', 'M14 11.6h-2'],
  'grid-4': ['r 4.2 4.2 6.4 6.4 1.4', 'r 13.4 4.2 6.4 6.4 1.4', 'r 4.2 13.4 6.4 6.4 1.4', 'r 13.4 13.4 6.4 6.4 1.4'],
  cube: ['M12 3.4l8 4.2v8.8L12 20.6 4 16.4V7.6z', 'M4 7.6 12 12l8-4.4', 'M12 12v8.6'],
  link: [
    'm9.8 14.6-1.3 1.3a3.6 3.6 0 0 1-5.1-5.1l3.1-3.1a3.6 3.6 0 0 1 5.1 0',
    'm14.2 9.4 1.3-1.3a3.6 3.6 0 0 1 5.1 5.1l-3.1 3.1a3.6 3.6 0 0 1-5.1 0',
    'M9.4 12h5.2',
  ],
  rocket: [
    'M12 3.4c3 2.3 4.6 5.4 4.6 9.1L12 17.2l-4.6-4.7c0-3.7 1.6-6.8 4.6-9.1z',
    'c 12 10.6 1.8',
    'm9.4 16.8-1.8 3.8 3.2-1.4',
    'm14.6 16.8 1.8 3.8-3.2-1.4',
  ],
  steering: ['c 12 12 8.4', 'c 12 12 2.4', 'M12 14.4V20.4', 'm9.8 11-6-1.6', 'm14.2 11 6-1.6'],
  car: ['M4 15.4h16v-3l-1.8-4.2H5.8L4 12.4z', 'c 7.4 17.6 1.8', 'c 16.6 17.6 1.8', 'M9.2 17.6h5.6'],
  flame: ['M12 21c3.4 0 5.6-2.2 5.6-5.2 0-4-4-5.6-3.4-9.6-3 1-6.2 4.4-6.2 8 0 1.2.4 2.2 1.2 3-.2-2 .8-3.4 2.2-4.2-1 3.4 1.2 4-1 8z'],
  moon: ['M20 14.4A8.6 8.6 0 0 1 9.6 4a8.6 8.6 0 1 0 10.4 10.4z'],
  leaf: [
    'M19.8 4.2C10.4 3.9 4.6 8.2 4.6 14.1A5.1 5.1 0 0 0 9.7 19c6.2 0 10.1-5.4 10.1-14.8z',
    'M8.2 19.4C9.4 12.6 13 7.8 19.8 4.2',
  ],
  owl: [
    'M12 3.8a5.4 5.4 0 0 0-5.4 5.4v4.6a5.4 5.4 0 0 0 10.8 0V9.2A5.4 5.4 0 0 0 12 3.8z',
    'c 9.7 9.4 1.7',
    'c 14.3 9.4 1.7',
    'm10.8 12.6 1.2 1.4 1.2-1.4',
    'm7.4 4.8 1.8 2.2',
    'm16.6 4.8-1.8 2.2',
    'M9.6 19.6 8.8 21',
    'm14.4 19.6.8 1.4',
  ],
  beaker: ['M9 3.6h6', 'M9.8 3.6v6L5.4 18a2 2 0 0 0 1.8 3h9.6a2 2 0 0 0 1.8-3l-4.4-8.4v-6', 'M7.6 14.4h8.8'],
  tools: ['m6 4.4 3.4 3.4-1.6 1.6L4.4 6', 'M4.4 6a4.6 4.6 0 0 0 6.4 6.4l7.2 7.2 2-2-7.2-7.2A4.6 4.6 0 0 0 6.4 4L4.4 6z', 'm16.6 4.4 3 3-2.2 2.2'],
  factory: ['M4 20.4V10l5 3.2V10l5 3.2V6.6h6v13.8z', 'M3 20.4h18', 'M17 10.4v1.6'],
  shield: ['M12 3.4 19 6.2v5c0 4.4-2.9 7.9-7 9.9-4.1-2-7-5.5-7-9.9v-5z', 'm9.2 11.8 1.9 1.9 3.8-4'],
  certificate: ['r 3.8 4.6 16.4 10.8 2', 'M7.2 8.4h5.4', 'M7.2 11.6h3.4', 'c 16.2 16.4 2.6', 'm14.6 18.4-.6 3.2 2.2-1.2 2.2 1.2-.6-3.2'],
  globe: ['c 12 12 8.4', 'M3.8 12h16.4', 'M12 3.6c2.2 2.4 3.3 5.2 3.3 8.4S14.2 18 12 20.4c-2.2-2.4-3.3-5.2-3.3-8.4S9.8 6 12 3.6z'],
  briefcase: ['r 3.6 7.6 16.8 12 2.2', 'M9 7.6V6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6v1.6', 'M3.6 12.8h16.8'],

  /* -------------------------------------------------------- recognition */
  trophy: ['M8.4 4.4h7.2v4.8a3.6 3.6 0 0 1-7.2 0z', 'M8.4 6.4H5.6v1a3.4 3.4 0 0 0 3.2 3.4', 'M15.6 6.4h2.8v1a3.4 3.4 0 0 1-3.2 3.4', 'M12 12.8v3.8', 'M8.6 20.6h6.8', 'M9.4 16.6h5.2'],
  medal: ['c 12 15.2 5', 'm8.8 11-3-6.6h4l2.4 4.4', 'm15.2 11 3-6.6h-4l-2.4 4.4', 'm10.3 15.2 1.4 1.4 2.4-2.6'],
  ribbon: ['c 12 9.4 5.4', 'm9 13.8-1.6 7.2 4.6-2.4 4.6 2.4-1.6-7.2', 'm10.6 8.4 1.4 1.4 2.6-2.8'],
  star: ['m12 4 2.6 5.4 5.8.8-4.2 4.1 1 5.7-5.2-2.8-5.2 2.8 1-5.7-4.2-4.1 5.8-.8z'],
  'bar-chart': ['M4 20.4h16.4', 'M7.4 20.4v-6.2', 'M12 20.4V8.4', 'M16.6 20.4v-9'],

  /* ------------------------------------------------------------- media */
  images: ['r 3.6 5.4 13 11 2', 'c 8 10 1.5', 'm3.6 15 3.8-3.8 3 3 2.4-2.2 3.8 3.6', 'M18.4 8.4h2v10a2 2 0 0 1-2 2H8.6'],
  'play-circle': ['c 12 12 8.4', 'm10.2 8.6 5.6 3.4-5.6 3.4z'],
  calendar: ['r 4.4 5.4 15.2 15 2.2', 'M8.6 3.4v4', 'M15.4 3.4v4', 'M4.4 10.6h15.2', 'M8.6 14.4h2.2', 'M13.2 14.4h2.2', 'M8.6 17.6h2.2'],
  camera: ['M4 8.6h3.4l1.6-2.2h6l1.6 2.2H20v10.8H4z', 'c 12 13.8 3.2'],

  /* ----------------------------------------------------------- contact */
  phone: ['M6.4 3.8h3l1.6 4-2 1.4a10.4 10.4 0 0 0 5.8 5.8l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.4 16.4 0 0 1 4.4 6a2 2 0 0 1 2-2.2z'],
  'map-pin': ['M12 21c4-4.3 6-7.6 6-10a6 6 0 1 0-12 0c0 2.4 2 5.7 6 10z', 'c 12 10.8 2.4'],
  mail: ['r 3.6 5.6 16.8 12.8 2', 'm3.8 7 8.2 6.2L20.2 7'],
  'mail-edit': ['M20.4 11.4V7.6a2 2 0 0 0-2-2H5.6a2 2 0 0 0-2 2v8.8a2 2 0 0 0 2 2h6', 'm3.8 8 8.2 6 8.2-6', 'm15.6 20.4.4-2 4.4-4.4a1.4 1.4 0 0 1 2 2L18 20.4z'],
  bell: ['M8 10.4a4 4 0 0 1 8 0c0 3.4 1.2 4.6 2 5.4H6c.8-.8 2-2 2-5.4z', 'M10.4 18.6a1.8 1.8 0 0 0 3.2 0'],

  /* --------------------------------------------------------- interface */
  'arrow-right': ['M4.4 12h13.2', 'm12.4 6.4 5.6 5.6-5.6 5.6'],
  'arrow-up': ['M12 19.4V5.6', 'm6.4 11.2 5.6-5.6 5.6 5.6'],
  'arrow-up-right': ['M7 17 17 7', 'M8.6 7H17v8.4'],
  lightbulb: [
    'M9.2 17.4a6 6 0 1 1 5.6 0',
    'M9.6 17.4h4.8',
    'M10.2 20.6h3.6',
  ],
  linkedin: ['f M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.2 8h4.6v14H.2V8zm7.6 0h4.4v1.9h.1c.6-1.1 2.1-2.3 4.3-2.3 4.6 0 5.4 3 5.4 6.9V22h-4.6v-6.6c0-1.6 0-3.6-2.2-3.6s-2.6 1.7-2.6 3.5V22H7.8V8z'],
  instagram: ['r 3 3 18 18 5', 'c 12 12 4', 'f M18.2 5.6a1 1 0 1 1-2 0 1 1 0 0 1 2 0z'],
  youtube: ['f M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.8-1.8C19.3 5 12 5 12 5s-7.3 0-8.8.5A2.5 2.5 0 0 0 1.4 7.3C1 8.8 1 12 1 12s0 3.2.4 4.7a2.5 2.5 0 0 0 1.8 1.8C4.7 19 12 19 12 19s7.3 0 8.8-.5a2.5 2.5 0 0 0 1.8-1.8C23 15.2 23 12 23 12zM9.8 15.3V8.7l5.7 3.3-5.7 3.3z'],
  facebook: ['f M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.1C16.6 2.1 15.5 2 14.3 2 11.7 2 10 3.6 10 6.4v2.1H7.5V12H10v10h4V12h2.8l.5-3.5H14z'],
  'chevron-down': ['m7.4 10 4.6 4.6L16.6 10'],
  'chevron-left': ['m14 7.4-4.6 4.6 4.6 4.6'],
  'chevron-right': ['m10 7.4 4.6 4.6-4.6 4.6'],
  expand: ['M4.6 10V4.6H10', 'M14 19.4h5.4V14', 'm4.6 4.6 6.2 6.2', 'm19.4 19.4-6.2-6.2'],
  plus: ['M12 5.6v12.8', 'M5.6 12h12.8'],
  check: ['m5.6 12.8 4 4 8.8-9.6'],
  close: ['m6.4 6.4 11.2 11.2', 'm17.6 6.4-11.2 11.2'],
  search: ['c 10.8 10.8 6.2', 'm15.4 15.4 4.4 4.4'],
  sliders: ['M4 8h10', 'M17.4 8H20', 'M4 16h4.4', 'M12 16h8', 'c 15.6 8 2.2', 'c 10.2 16 2.2'],
  gear: ['c 12 12 3', 'M12 3.4l1 2.3 2.5-.6 1.3 2.2-1.8 1.8.9 2.3h2.5v2.6h-2.5l-.9 2.3 1.8 1.8-1.3 2.2-2.5-.6-1 2.3h-2.6l-1-2.3-2.5.6L4.9 18l1.8-1.8-.9-2.3H3.3v-2.6h2.5l.9-2.3L4.9 7.3l1.3-2.2 2.5.6 1-2.3z'],
  upload: ['M12 16.4V5.4', 'm7.6 9.8 4.4-4.4 4.4 4.4', 'M4.6 15v3.4a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2V15'],
  logout: ['M14.4 5.6H7.6a2 2 0 0 0-2 2v8.8a2 2 0 0 0 2 2h6.8', 'm16 8.6 3.4 3.4-3.4 3.4', 'M10.4 12h9'],
  present: ['r 3.6 4.6 16.8 11.4 2', 'm10.4 8 4.2 2.4-4.2 2.4z', 'M8.4 20.4h7.2', 'M12 16v4.4'],
  swap: ['m8.4 5.6-3.8 3.8 3.8 3.8', 'M4.6 9.4h14.8', 'm15.6 18.4 3.8-3.8-3.8-3.8', 'M19.4 14.6H5.6'],
  folder: ['M3.8 7.6a2 2 0 0 1 2-2h3.4l2 2.4h7a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2H5.8a2 2 0 0 1-2-2z'],
  image: ['r 3.8 5.4 16.4 13.2 2', 'c 9 10.4 1.6', 'm4.4 17 4.4-4.4 3.2 3.2 3-2.6 5.2 4.4'],
  grip: ['c 9.4 6.4 1.1', 'c 14.6 6.4 1.1', 'c 9.4 12 1.1', 'c 14.6 12 1.1', 'c 9.4 17.6 1.1', 'c 14.6 17.6 1.1'],
  dot: ['c 12 12 3.4'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z', 'c 12 12 3'],
  'eye-off': ['M4 4l16 16', 'M9.9 5.2A9.6 9.6 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-3.2 4.2', 'M6.4 6.9A17 17 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 3.6-.7'],
};

ICONS.cpu = ICONS.chip;
ICONS['graduation-cap'] = ICONS.graduation;
ICONS.award = ICONS.trophy;
ICONS['arrow-left'] = ICONS['chevron-left'];
ICONS.x = ICONS.close;

/** Keyword → icon. First match wins, so specific terms sit above generic ones. */
const TERM_MAP = [
  [/executive summary|summary|snapshot at a glance/, 'document'],
  [/organization snapshot|snapshot|profile \/ about|about us/, 'building'],
  [/history|milestone|heritage|journey|timeline/, 'flag'],
  [/ceo message|message from|chairman message|leadership message/, 'quote'],
  [/ceo|chairman|founder|director|principal/, 'user-badge'],
  [/leadership|team|trainers|faculty team|management/, 'users'],
  [/vision/, 'eye'],
  [/mission/, 'target'],
  [/core values|values|culture|ethos/, 'heart'],
  [/ai innovation|innovation|ai &|artificial intelligence|data science|machine learning/, 'brain'],
  [/t-connect|connect\b.*link|integration hub/, 'link'],
  [/get ready/, 'rocket'],
  [/drive ready connect|drive ready|driving/, 'steering'],
  [/\bdrive\b|vehicle|automobile|mobility/, 'car'],
  [/ignite|spark|kindle/, 'flame'],
  [/moon|lunar|night/, 'moon'],
  [/skill ?up|upskill|level up|growth track/, 'trend-up'],
  [/become coder|become|onboarding track/, 'shield'],
  [/bamboo|green|sustainab/, 'leaf'],
  [/owl|hoot/, 'owl'],
  [/coding program|coding|programming|developer|coder|software/, 'code'],
  [/technology program|technology|tech stack|engineering/, 'terminal'],
  [/pega|workflow|automation|process/, 'workflow'],
  [/microsoft|azure|windows|office 365/, 'grid-4'],
  [/enterprise|infrastructure|cloud|devops|server/, 'server'],
  [/industry integration|integration|interoperab/, 'puzzle'],
  [/industry partner|industry|corporate|company partner/, 'factory'],
  [/centers? of excellence|excellence|coe\b|research lab|laborator/, 'beaker'],
  [/learning pathway|pathway|curriculum|roadmap|syllabus/, 'route'],
  [/assessment platform|assessment|examination|proctor/, 'clipboard-check'],
  [/myna|analytics|dashboard|metrics|score/, 'gauge'],
  [/\bats\b|applicant tracking|shortlist|screening pipeline/, 'funnel'],
  [/entrance test|aptitude|entrance|test\b|quiz/, 'pencil-test'],
  [/interview|screening|hr round|mock/, 'interview'],
  [/global certification|global collaboration|global|international|worldwide/, 'globe'],
  [/certification|certificate|credential|accredit/, 'certificate'],
  [/academic partner|academic|university|college|institution partner/, 'graduation'],
  [/partnership|partners|mou|alliance|collaboration/, 'partners'],
  [/placement readiness|readiness|preparation|career prep/, 'checklist'],
  [/placement statistic|statistic|numbers|data\b|report/, 'bar-chart'],
  [/recruiter|hiring partner|employer/, 'briefcase'],
  [/institutional award|award|honour|honor/, 'trophy'],
  [/student achievement|achievement|accomplishment/, 'medal'],
  [/faculty recognition|recognition|appreciation|tribute/, 'ribbon'],
  [/success stor|testimonial|alumni|feedback|review/, 'quote'],
  [/ceo profile|leader profile|profile/, 'user-badge'],
  [/photo gallery|photo|picture|image/, 'images'],
  [/video gallery|video|film|reel|watch/, 'play-circle'],
  [/media|press|news|coverage/, 'camera'],
  [/workshop|training session|bootcamp|seminar/, 'tools'],
  [/project arena|project|hackathon|showcase|arena/, 'cube'],
  [/event|celebration|fest|moments|memorable/, 'calendar'],
  [/contact information|contact info|phone|call|helpline/, 'phone'],
  [/office location|location|campus|address|branch/, 'map-pin'],
  [/contact form|enquir|inquir|reach out|write to us/, 'mail-edit'],
  [/contact|connect with us|mail|email/, 'mail'],
  [/program|course|learning|academy|education|school/, 'book'],
  [/strategic foundation|foundation|principle|belief/, 'compass'],
  [/initiative|strategic|programme launch/, 'sparkles'],
  [/best practice|standard|policy|compliance|quality/, 'shield'],
  [/student|learner|candidate|talent|people|staff/, 'user'],
  [/overview|introduction|organization|company|corporate profile/, 'layers'],
  [/gallery|album|collection/, 'folder'],
  [/star|highlight|featured/, 'star'],
];

/** Icons offered in the picker, grouped so a long list stays scannable. */
export const ICON_GROUPS = [
  {
    label: 'Organization',
    names: ['layers', 'building', 'document', 'compass', 'flag', 'clock', 'sparkles', 'shield', 'folder', 'globe'],
  },
  {
    label: 'People & leadership',
    names: ['user', 'user-badge', 'users', 'user-check', 'partners', 'graduation', 'interview', 'quote', 'message', 'briefcase'],
  },
  {
    label: 'Learning & assessment',
    names: ['book', 'route', 'checklist', 'clipboard-check', 'pencil-test', 'trend-up', 'gauge', 'funnel', 'puzzle', 'beaker'],
  },
  {
    label: 'Technology',
    names: ['code', 'terminal', 'chip', 'brain', 'server', 'workflow', 'grid-4', 'cube', 'link', 'rocket'],
  },
  {
    label: 'Programs & industry',
    names: ['steering', 'car', 'flame', 'moon', 'leaf', 'owl', 'factory', 'tools', 'target', 'eye'],
  },
  {
    label: 'Recognition',
    names: ['trophy', 'medal', 'ribbon', 'star', 'certificate', 'bar-chart', 'heart', 'check', 'dot', 'bell'],
  },
  {
    label: 'Media & contact',
    names: ['images', 'play-circle', 'camera', 'calendar', 'image', 'phone', 'map-pin', 'mail', 'mail-edit', 'present'],
  },
];

export const ICON_NAMES = Object.keys(ICONS);

export function hasIcon(name) {
  return Boolean(ICONS[name]);
}

function shape(spec) {
  const [kind, ...rest] = spec.split(' ');
  const n = rest.map(Number);
  if (kind === 'c') return svg('circle', { cx: n[0], cy: n[1], r: n[2] });
  if (kind === 'r') return svg('rect', { x: n[0], y: n[1], width: n[2], height: n[3], rx: n[4] ?? 2 });
  if (kind === 'l') return svg('line', { x1: n[0], y1: n[1], x2: n[2], y2: n[3] });
  // A brand glyph is a filled shape, not a stroked one.
  if (kind === 'f') return svg('path', { d: rest.join(' '), fill: 'currentColor', stroke: 'none' });
  return svg('path', { d: spec });
}

/**
 * Builds an icon node. Unknown names fall back to a neutral dot rather than
 * throwing, so a stored icon key from an older build still renders.
 */
export function icon(name, { class: className = 'ic', size = null, strokeWidth = 1.7 } = {}) {
  const node = svg(
    'svg',
    {
      class: className,
      viewBox: '0 0 24 24',
      width: size || null,
      height: size || null,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': strokeWidth,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    ...(ICONS[name] || ICONS.dot).map(shape),
  );
  return node;
}

/** Best icon for a free-text label — used for admin-created sections. */
export function iconForTitle(title, fallback = 'document') {
  const text = String(title || '').toLowerCase();
  if (!text.trim()) return fallback;
  for (const [pattern, name] of TERM_MAP) {
    if (pattern.test(text)) return name;
  }
  return fallback;
}

/** Readable label for a picker tile — `map-pin` → `Map pin`. */
export function iconLabel(name) {
  const words = String(name).replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
