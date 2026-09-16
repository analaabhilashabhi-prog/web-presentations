/**
 * Sample layouts, chosen by what the section is called.
 *
 * A section named "Profile" should not open as an empty rectangle — it should
 * open as an about-the-company paragraph, a row of KPI cards and room for the
 * logo. This file holds those starting points: a set of archetypes, each with
 * the words that identify it, the elements that suit it, and two or three
 * ready-made layouts the admin can keep, customise or throw away.
 *
 * All sample copy is placeholder prose and all sample numbers are round
 * placeholders — they are prompts to be replaced, never claims.
 */
import { at, emptyKpi, emptyButton, emptyCard, uid } from './blocks.js';

/* --------------------------------------------------------------- builders */
const heading = (pos, text, level = 2) => at('heading', pos, { text, level });
const para = (pos, text) => at('paragraph', pos, { text });

const textBox = (pos, { title = '', body = '', items = [], align = 'left' } = {}) =>
  at('text', pos, { heading: title, body, items, align });

const image = (pos, title = '', caption = '') => at('image', pos, { title, caption, alt: title });
const logo = (pos, title = '') => at('logo', pos, { title, alt: title });
const gallery = (pos, caption = '') => at('gallery', pos, { caption });
const video = (pos, caption = '') => at('video', pos, { caption });
const profile = (pos, name = '', role = '') => at('profile', pos, { name, role });

const icon = (pos, glyph, label = '', note = '') =>
  at('icon', pos, { glyph, label, note, shape: 'circle', tone: 'accent' });

const kpis = (pos, rows, extra = {}) =>
  at('kpi', pos, {
    items: rows.map(([label, value, suffix = '', glyph = '']) =>
      emptyKpi({ label, value, suffix, icon: glyph })),
    ...extra,
  });

const buttons = (pos, rows, align = 'left') =>
  at('buttons', pos, {
    items: rows.map(([label, variant = 'primary']) => emptyButton({ label, variant, href: '' })),
    align,
  });

const quote = (pos, text, author = '', role = '') => at('quote', pos, { text, author, role });

const cardSet = (pos, variant, titles) =>
  at('cards', pos, {
    variant,
    items: titles.map(([title, subtitle = '', body = '']) => ({ ...emptyCard(), title, subtitle, body })),
  });

const box = (pos, children, opts = {}) => at('box', pos, { children, ...opts });

const hero = (pos, props) => at('hero', pos, props);

/**
 * A three-across feature row built from layout boxes — used by several
 * archetypes. Heights are deliberately snug: a row is a minimum, so a box
 * grows to fit longer copy but never reserves dead space for short copy.
 */
const featureTrio = (y, entries, { h: height = 7 } = {}) =>
  entries.map(([glyph, title, note], i) =>
    box([i * 4, y, 4, height], [
      icon([0, 0, 12, 3], glyph, title),
      para([0, 3, 12, 3], note),
    ], { background: 'surface', padding: 'md', label: title }),
  );

const LOREM = {
  about:
    'Replace this with two or three sentences about what the organization does, who it '
    + 'serves and what makes it different. Keep it short — the numbers below carry the detail.',
  short: 'A one-line summary the audience should remember.',
  invite: 'Tell the reader what to do next and who to contact.',
};

/* ------------------------------------------------------------- archetypes */
export const ARCHETYPES = [
  {
    id: 'hero',
    label: 'Hero / banner',
    icon: '▬',
    keywords: ['hero', 'banner', 'cover', 'welcome', 'landing', 'intro', 'opening', 'title'],
    elements: ['hero', 'buttons', 'image', 'video'],
    layouts: [
      {
        id: 'hero-image',
        name: 'Image hero with call to action',
        description: 'Full-width background image, headline stack and two buttons.',
        build: () => [
          hero([0, 0, 12, 11], {
            media: 'image',
            kicker: 'WELCOME',
            heading: 'A headline that earns the next five minutes',
            subheading: LOREM.short,
            align: 'left',
            height: 'lg',
            overlay: 50,
            buttons: [emptyButton({ label: 'Talk to us' }), emptyButton({ label: 'Download profile', variant: 'outline' })],
          }),
        ],
      },
      {
        id: 'hero-video',
        name: 'Centred video hero',
        description: 'Looping background video with a centred headline.',
        build: () => [
          hero([0, 0, 12, 15], {
            media: 'video',
            heading: 'Show the work, then say the words',
            subheading: LOREM.short,
            align: 'center',
            height: 'full',
            overlay: 55,
            buttons: [emptyButton({ label: 'See what we do' })],
          }),
        ],
      },
      {
        id: 'hero-split',
        name: 'Split hero with image beside',
        description: 'Brand-colour hero on the left, a picture on the right.',
        build: () => [
          hero([0, 0, 7, 9], {
            media: 'color',
            kicker: 'WHO WE ARE',
            heading: 'A short, confident statement',
            subheading: LOREM.short,
            align: 'left',
            height: 'md',
            buttons: [emptyButton({ label: 'Get in touch' })],
          }),
          image([7, 0, 5, 9], '', 'Add a photograph that supports the headline'),
        ],
      },
    ],
  },

  {
    id: 'profile',
    label: 'Profile / about',
    icon: '◈',
    keywords: ['profile', 'about', 'company', 'organisation', 'organization', 'overview', 'who we are', 'introduction', 'firm'],
    elements: ['text', 'kpi', 'logo', 'image', 'gallery'],
    layouts: [
      {
        id: 'profile-story-kpi',
        name: 'About + KPI cards + images',
        description: 'A paragraph and the logo, a row of KPI cards, then two captioned images.',
        build: () => [
          textBox([0, 0, 8, 5], { title: 'About the company', body: LOREM.about }),
          logo([8, 0, 4, 5], ''),
          kpis([0, 5, 12, 4], [
            ['Number of employees', 250, '+', '👥'],
            ['Certifications', 12, '', '🏅'],
            ['Training hours', 8000, '+', '🎓'],
          ]),
          image([0, 9, 6, 8], 'Our campus', 'Add a caption for this picture'),
          image([6, 9, 6, 8], 'Our team at work', 'Add a caption for this picture'),
        ],
      },
      {
        id: 'profile-logo-lead',
        name: 'Logo lead with gallery',
        description: 'Logo and intro side by side, four KPI cards, then a photo gallery.',
        build: () => [
          logo([0, 0, 3, 5], ''),
          textBox([3, 0, 9, 5], { title: 'About the company', body: LOREM.about }),
          kpis([0, 5, 12, 4], [
            ['Number of employees', 250, '+', '👥'],
            ['Certifications', 12, '', '🏅'],
            ['Training hours', 8000, '+', '🎓'],
            ['Years in operation', 15, '', '🕒'],
          ], { columns: '4' }),
          gallery([0, 9, 12, 10], 'Life at the organization'),
        ],
      },
      {
        id: 'profile-split-card',
        name: 'Card split with picture',
        description: 'A bordered box of copy beside a tall image, with KPI cards below.',
        build: () => [
          box([0, 0, 7, 10], [
            heading([0, 0, 12, 2], 'About the company'),
            para([0, 2, 12, 5], LOREM.about),
            buttons([0, 7, 12, 3], [['Download our profile'], ['Contact us', 'outline']]),
          ], { background: 'surface', padding: 'lg', label: 'About' }),
          image([7, 0, 5, 10], '', 'A picture of the organization'),
          kpis([0, 10, 12, 4], [
            ['Number of employees', 250, '+', '👥'],
            ['Certifications', 12, '', '🏅'],
            ['Training hours', 8000, '+', '🎓'],
          ]),
        ],
      },
    ],
  },

  {
    id: 'leadership',
    label: 'Leadership message',
    icon: '◉',
    keywords: ['ceo', 'leadership', 'message', 'chairman', 'director', 'founder', 'md', 'president', 'principal'],
    elements: ['profile', 'quote', 'text', 'image'],
    layouts: [
      {
        id: 'leader-portrait-quote',
        name: 'Portrait, quote and message',
        description: 'A portrait beside a pull quote, with the full message underneath.',
        build: () => [
          profile([0, 0, 4, 12], 'Full name', 'Designation'),
          quote([4, 0, 8, 6], 'The one sentence you want the room to remember.', 'Full name', 'Designation'),
          textBox([4, 6, 8, 6], { body: LOREM.about }),
        ],
      },
      {
        id: 'leader-letter',
        name: 'Letter layout',
        description: 'A wide message with the portrait and signature block on the right.',
        build: () => [
          heading([0, 0, 12, 2], 'A message from our leadership'),
          textBox([0, 2, 8, 11], { body: LOREM.about }),
          box([8, 2, 4, 11], [
            profile([0, 0, 12, 10], 'Full name', 'Designation'),
          ], { background: 'soft', padding: 'md', label: 'Signature' }),
        ],
      },
    ],
  },

  {
    id: 'vision',
    label: 'Vision, mission & values',
    icon: '🧭',
    keywords: ['vision', 'mission', 'values', 'purpose', 'philosophy', 'principles', 'ethos', 'culture'],
    elements: ['icon', 'box', 'text', 'bullets'],
    layouts: [
      {
        id: 'vision-trio',
        name: 'Three pillars',
        description: 'Vision, mission and values as three icon cards.',
        build: () => [
          heading([0, 0, 12, 2], 'What we stand for'),
          ...featureTrio(2, [
            ['🎯', 'Vision', 'Where the organization is going, in one sentence.'],
            ['🧭', 'Mission', 'What it does every day to get there.'],
            ['★', 'Values', 'The behaviour it will not trade away.'],
          ]),
        ],
      },
      {
        id: 'vision-list',
        name: 'Statement and value list',
        description: 'A vision statement with the values as a bulleted list beside a picture.',
        build: () => [
          textBox([0, 0, 7, 4], { title: 'Our vision', body: LOREM.short }),
          image([7, 0, 5, 11], '', ''),
          textBox([0, 4, 7, 7], {
            title: 'Our values',
            items: ['Integrity in every engagement', 'Safety before schedule', 'Learning that never stops'],
          }),
        ],
      },
    ],
  },

  {
    id: 'certifications',
    label: 'Certifications',
    icon: '🏅',
    keywords: ['certification', 'certificate', 'accreditation', 'iso', 'standard', 'compliance', 'licence', 'license', 'approval', 'quality'],
    elements: ['kpi', 'logo', 'cards', 'gallery'],
    layouts: [
      {
        id: 'cert-cards',
        name: 'Certification cards',
        description: 'A count of accreditations above a grid of certification cards.',
        build: () => [
          heading([0, 0, 12, 2], 'Certifications & accreditations'),
          kpis([0, 2, 12, 4], [
            ['Active certifications', 12, '', '🏅'],
            ['Accredited programmes', 8, '', '🎓'],
            ['Audits passed', 24, '', '🛡️'],
          ]),
          cardSet([0, 6, 12, 9], 'certification', [
            ['Certification name', 'Issuing body', 'What it covers and when it was awarded.'],
            ['Certification name', 'Issuing body', 'What it covers and when it was awarded.'],
            ['Certification name', 'Issuing body', 'What it covers and when it was awarded.'],
          ]),
        ],
      },
      {
        id: 'cert-logo-wall',
        name: 'Logo wall',
        description: 'The awarding bodies as a row of logo tiles, with a short note.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'Certified to work at standard', body: LOREM.short }),
          ...[0, 3, 6, 9].map((x, i) => logo([x, 4, 3, 5], `Body ${i + 1}`)),
          gallery([0, 9, 12, 10], 'Certificates'),
        ],
      },
    ],
  },

  {
    id: 'gallery',
    label: 'Gallery / media',
    icon: '⊞',
    keywords: ['gallery', 'media', 'photo', 'photos', 'images', 'moments', 'memories', 'event', 'events', 'glimpse', 'album'],
    elements: ['gallery', 'image', 'video', 'text'],
    layouts: [
      {
        id: 'gallery-grid',
        name: 'Full gallery',
        description: 'A short intro and one large auto-arranging photo grid.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'Moments', body: 'A line of context for what these pictures show.' }),
          gallery([0, 4, 12, 12], 'Highlights'),
        ],
      },
      {
        id: 'gallery-feature',
        name: 'Feature image with grid',
        description: 'One hero picture beside a caption, with the rest as a grid below.',
        build: () => [
          image([0, 0, 8, 9], 'Feature photograph', 'Say what is happening in this picture'),
          textBox([8, 0, 4, 9], { title: 'The story', body: LOREM.short }),
          gallery([0, 9, 12, 11], 'More from the day'),
        ],
      },
      {
        id: 'gallery-video',
        name: 'Video and stills',
        description: 'A video at the top with a supporting photo grid.',
        build: () => [
          video([0, 0, 12, 10], 'Add a caption for this video'),
          gallery([0, 10, 12, 9], 'Stills'),
        ],
      },
    ],
  },

  {
    id: 'contact',
    label: 'Contact',
    icon: '📍',
    keywords: ['contact', 'reach', 'address', 'enquiry', 'inquiry', 'get in touch', 'location', 'find us', 'connect'],
    elements: ['icon', 'text', 'buttons', 'box', 'logo'],
    layouts: [
      {
        id: 'contact-cards',
        name: 'Three ways to reach us',
        description: 'Address, phone and email as icon cards, with a call to action.',
        build: () => [
          heading([0, 0, 12, 2], 'Get in touch'),
          ...featureTrio(2, [
            ['📍', 'Visit', 'Street address\nCity, postcode'],
            ['📞', 'Call', '+00 00000 00000\nMonday to Friday'],
            ['✉️', 'Email', 'hello@example.com'],
          ]),
          buttons([0, 9, 12, 2], [['Email us'], ['Call now', 'outline']], 'center'),
        ],
      },
      {
        id: 'contact-split',
        name: 'Details beside a picture',
        description: 'Contact details in a card next to a photograph of the office.',
        build: () => [
          box([0, 0, 6, 10], [
            heading([0, 0, 12, 2], 'Contact'),
            para([0, 2, 12, 5], 'Street address\nCity, postcode\n\n+00 00000 00000\nhello@example.com'),
            buttons([0, 7, 12, 3], [['Send an email'], ['Open in maps', 'outline']]),
          ], { background: 'surface', padding: 'lg', label: 'Details' }),
          image([6, 0, 6, 10], 'Our office', ''),
        ],
      },
    ],
  },

  {
    id: 'team',
    label: 'Team / people',
    icon: '👥',
    keywords: ['team', 'trainer', 'trainers', 'people', 'staff', 'faculty', 'members', 'experts', 'workforce', 'employees'],
    elements: ['profile', 'cards', 'kpi', 'text'],
    layouts: [
      {
        id: 'team-cards',
        name: 'Team card grid',
        description: 'An intro line above a grid of people cards.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'The people behind the work', body: LOREM.short }),
          cardSet([0, 4, 12, 12], 'team', [
            ['Full name', 'Designation', 'One line on what they do.'],
            ['Full name', 'Designation', 'One line on what they do.'],
            ['Full name', 'Designation', 'One line on what they do.'],
            ['Full name', 'Designation', 'One line on what they do.'],
          ]),
        ],
      },
      {
        id: 'team-portraits',
        name: 'Portrait row',
        description: 'Four portrait slots in a row, each cropped to the same frame.',
        build: () => [
          heading([0, 0, 12, 2], 'Our team'),
          ...[0, 3, 6, 9].map((x) => profile([x, 2, 3, 11], 'Full name', 'Designation')),
          kpis([0, 13, 12, 4], [
            ['Team members', 40, '', '👥'],
            ['Certified trainers', 18, '', '🎓'],
            ['Average experience', 12, ' yrs', '🕒'],
          ]),
        ],
      },
    ],
  },

  {
    id: 'programs',
    label: 'Programs / services',
    icon: '🎓',
    keywords: ['program', 'programme', 'course', 'courses', 'training', 'curriculum', 'service', 'services', 'offering', 'offerings', 'solutions', 'capabilities'],
    elements: ['cards', 'icon', 'kpi', 'buttons'],
    layouts: [
      {
        id: 'programs-cards',
        name: 'Programme catalogue',
        description: 'An intro with a grid of programme cards and a call to action.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'What we offer', body: LOREM.short }),
          cardSet([0, 4, 12, 9], 'program', [
            ['Programme name', 'Duration · Mode', 'Who it is for and what they leave with.'],
            ['Programme name', 'Duration · Mode', 'Who it is for and what they leave with.'],
            ['Programme name', 'Duration · Mode', 'Who it is for and what they leave with.'],
          ]),
          buttons([0, 13, 12, 2], [['Request the full catalogue']], 'center'),
        ],
      },
      {
        id: 'programs-trio',
        name: 'Three capabilities',
        description: 'Three icon cards for the headline capabilities, then the detail.',
        build: () => [
          heading([0, 0, 12, 2], 'How we help'),
          ...featureTrio(2, [
            ['⚙️', 'Capability one', 'One or two lines on what this covers.'],
            ['🔬', 'Capability two', 'One or two lines on what this covers.'],
            ['🚀', 'Capability three', 'One or two lines on what this covers.'],
          ]),
          cardSet([0, 9, 12, 9], 'program', [
            ['Programme name', 'Duration · Mode', 'Who it is for.'],
            ['Programme name', 'Duration · Mode', 'Who it is for.'],
          ]),
        ],
      },
    ],
  },

  {
    id: 'placements',
    label: 'Placements / careers',
    icon: '📈',
    keywords: ['placement', 'placements', 'recruiter', 'recruiters', 'hiring', 'career', 'careers', 'alumni', 'outcomes', 'jobs'],
    elements: ['kpi', 'cards', 'logo'],
    layouts: [
      {
        id: 'placement-numbers',
        name: 'Numbers then names',
        description: 'Headline placement numbers above the recruiter cards.',
        build: () => [
          kpis([0, 0, 12, 4], [
            ['Learners placed', 500, '+', '🎓'],
            ['Hiring partners', 60, '', '🤝'],
            ['Highest package', 18, ' LPA', '📈'],
          ]),
          cardSet([0, 4, 12, 9], 'placement', [
            ['Name', 'Role · Company', ''],
            ['Name', 'Role · Company', ''],
            ['Name', 'Role · Company', ''],
          ]),
        ],
      },
      {
        id: 'placement-logos',
        name: 'Recruiter logo wall',
        description: 'A row of recruiter logos with the numbers underneath.',
        build: () => [
          heading([0, 0, 12, 2], 'Where our people go'),
          ...[0, 3, 6, 9].map((x, i) => logo([x, 2, 3, 5], `Recruiter ${i + 1}`)),
          kpis([0, 7, 12, 4], [
            ['Learners placed', 500, '+', '🎓'],
            ['Hiring partners', 60, '', '🤝'],
          ], { columns: '2' }),
        ],
      },
    ],
  },

  {
    id: 'partners',
    label: 'Partners / MOUs',
    icon: '🤝',
    keywords: ['mou', 'mous', 'partner', 'partners', 'partnership', 'collaboration', 'alliance', 'tie-up', 'association', 'academic partnership', 'clients'],
    elements: ['logo', 'cards', 'kpi', 'text'],
    layouts: [
      {
        id: 'partners-logos',
        name: 'Partner logo wall',
        description: 'Six logo tiles with a short framing paragraph.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'Who we work with', body: LOREM.short }),
          ...[[0, 4], [3, 4], [6, 4], [9, 4], [0, 9], [3, 9], [6, 9], [9, 9]]
            .map(([x, y], i) => logo([x, y, 3, 5], `Partner ${i + 1}`)),
        ],
      },
      {
        id: 'partners-cards',
        name: 'Partnership cards',
        description: 'Detail cards for each MOU, with a count above.',
        build: () => [
          kpis([0, 0, 12, 4], [
            ['Active MOUs', 24, '', '🤝'],
            ['Partner institutions', 18, '', '🏭'],
            ['Joint programmes', 9, '', '🎓'],
          ]),
          cardSet([0, 4, 12, 10], 'partner', [
            ['Partner name', 'Signed 20XX', 'What the partnership covers.'],
            ['Partner name', 'Signed 20XX', 'What the partnership covers.'],
            ['Partner name', 'Signed 20XX', 'What the partnership covers.'],
          ]),
        ],
      },
    ],
  },

  {
    id: 'achievements',
    label: 'Achievements & awards',
    icon: '🏆',
    keywords: ['achievement', 'achievements', 'award', 'awards', 'recognition', 'milestone', 'milestones', 'accolade', 'honours', 'honors', 'success'],
    elements: ['kpi', 'cards', 'gallery', 'icon'],
    layouts: [
      {
        id: 'awards-timeline',
        name: 'Counts and citations',
        description: 'Award counts above a card per award, with a photo strip.',
        build: () => [
          kpis([0, 0, 12, 4], [
            ['Awards received', 15, '', '🏆'],
            ['National recognitions', 4, '', '🏅'],
            ['Years recognised', 6, '', '🕒'],
          ]),
          cardSet([0, 4, 12, 8], 'plain', [
            ['Award name', 'Awarding body · 20XX', 'Why it was given.'],
            ['Award name', 'Awarding body · 20XX', 'Why it was given.'],
          ]),
          gallery([0, 12, 12, 10], 'Award moments'),
        ],
      },
      {
        id: 'awards-highlight',
        name: 'One headline award',
        description: 'A single award called out beside its photograph.',
        build: () => [
          box([0, 0, 7, 8], [
            icon([0, 0, 12, 3], '🏆', 'Award name'),
            para([0, 3, 12, 4], 'Awarding body · 20XX — why it was given and what it recognises.'),
          ], { background: 'soft', padding: 'lg', label: 'Headline award' }),
          image([7, 0, 5, 8], '', 'The presentation'),
          cardSet([0, 8, 12, 8], 'plain', [
            ['Award name', 'Awarding body · 20XX', ''],
            ['Award name', 'Awarding body · 20XX', ''],
          ]),
        ],
      },
    ],
  },

  {
    id: 'facilities',
    label: 'Facilities / centres',
    icon: '🏭',
    keywords: ['centre', 'center', 'excellence', 'coe', 'lab', 'labs', 'laboratory', 'facility', 'facilities', 'infrastructure', 'campus', 'workshop', 'plant'],
    elements: ['image', 'gallery', 'kpi', 'text'],
    layouts: [
      {
        id: 'facility-showcase',
        name: 'Facility showcase',
        description: 'A wide picture, a description and the capacity numbers.',
        build: () => [
          image([0, 0, 7, 10], 'Inside the centre', ''),
          textBox([7, 0, 5, 10], { title: 'Centre of excellence', body: LOREM.about }),
          kpis([0, 10, 12, 4], [
            ['Square feet', 12000, '', '🏭'],
            ['Workstations', 120, '', '⚙️'],
            ['Equipment types', 30, '+', '🔧'],
          ]),
        ],
      },
      {
        id: 'facility-gallery',
        name: 'Walkthrough gallery',
        description: 'A gallery of the space with capability cards underneath.',
        build: () => [
          heading([0, 0, 12, 2], 'Our facilities'),
          gallery([0, 2, 12, 11], 'A walk through the centre'),
          cardSet([0, 13, 12, 8], 'plain', [
            ['Facility name', 'What it is used for', ''],
            ['Facility name', 'What it is used for', ''],
            ['Facility name', 'What it is used for', ''],
          ]),
        ],
      },
    ],
  },

  {
    id: 'testimonials',
    label: 'Testimonials',
    icon: '❝',
    keywords: ['testimonial', 'testimonials', 'review', 'reviews', 'feedback', 'voices', 'what they say', 'quotes', 'references'],
    elements: ['quote', 'cards', 'profile'],
    layouts: [
      {
        id: 'testimonial-pair',
        name: 'Two pull quotes',
        description: 'Two quotes stacked, each with an attribution.',
        build: () => [
          heading([0, 0, 12, 2], 'In their words'),
          quote([0, 2, 12, 5], 'A sentence in the customer’s own words.', 'Full name', 'Role, Organization'),
          quote([0, 7, 12, 5], 'A second sentence in someone else’s words.', 'Full name', 'Role, Organization'),
        ],
      },
      {
        id: 'testimonial-grid',
        name: 'Quote and card grid',
        description: 'One headline quote with shorter ones as cards.',
        build: () => [
          quote([0, 0, 12, 5], 'The single most persuasive thing anyone has said about the work.', 'Full name', 'Role, Organization'),
          cardSet([0, 5, 12, 8], 'plain', [
            ['“A short quote.”', 'Full name · Organization', ''],
            ['“A short quote.”', 'Full name · Organization', ''],
            ['“A short quote.”', 'Full name · Organization', ''],
          ]),
        ],
      },
    ],
  },

  {
    id: 'initiatives',
    label: 'Initiatives / projects',
    icon: '💡',
    keywords: ['initiative', 'initiatives', 'csr', 'project', 'projects', 'campaign', 'outreach', 'programme highlights', 'sustainability', 'impact'],
    elements: ['cards', 'image', 'kpi', 'icon'],
    layouts: [
      {
        id: 'initiative-cards',
        name: 'Initiative cards with picture',
        description: 'A lead picture and a card per initiative.',
        build: () => [
          textBox([0, 0, 7, 5], { title: 'What we are driving', body: LOREM.short }),
          image([7, 0, 5, 9], '', 'An initiative in progress'),
          kpis([0, 5, 7, 4], [
            ['People reached', 5000, '+', '👥'],
            ['Active initiatives', 8, '', '💡'],
          ], { columns: '2' }),
          cardSet([0, 9, 12, 8], 'plain', [
            ['Initiative name', 'Since 20XX', 'What it does and who it helps.'],
            ['Initiative name', 'Since 20XX', 'What it does and who it helps.'],
          ]),
        ],
      },
      {
        id: 'initiative-trio',
        name: 'Three focus areas',
        description: 'Three icon cards with a gallery beneath.',
        build: () => [
          heading([0, 0, 12, 2], 'Our focus areas'),
          ...featureTrio(2, [
            ['♻️', 'Focus area', 'One or two lines on this area of work.'],
            ['🎓', 'Focus area', 'One or two lines on this area of work.'],
            ['🤝', 'Focus area', 'One or two lines on this area of work.'],
          ]),
          gallery([0, 9, 12, 10], 'Initiatives in action'),
        ],
      },
    ],
  },

  {
    id: 'practices',
    label: 'Best practices / process',
    icon: '✓',
    keywords: ['best practice', 'practices', 'process', 'processes', 'methodology', 'approach', 'how we work', 'standards', 'safety', 'sop'],
    elements: ['bullets', 'icon', 'text', 'image'],
    layouts: [
      {
        id: 'practice-list',
        name: 'Checklist beside a picture',
        description: 'The practices as a bulleted list with a supporting photo.',
        build: () => [
          textBox([0, 0, 7, 8], {
            title: 'How we work',
            body: LOREM.short,
            items: [
              'The first practice, stated as an action',
              'The second practice',
              'The third practice',
              'The fourth practice',
            ],
          }),
          image([7, 0, 5, 8], '', ''),
        ],
      },
      {
        id: 'practice-steps',
        name: 'Four-step process',
        description: 'The process as four numbered icon cards.',
        build: () => [
          heading([0, 0, 12, 2], 'Our process'),
          ...[['1', 'Understand'], ['2', 'Plan'], ['3', 'Deliver'], ['4', 'Review']].map(([glyph, title], i) =>
            box([i * 3, 2, 3, 7], [
              icon([0, 0, 12, 3], glyph, title),
              para([0, 3, 12, 3], 'One line on what happens at this step.'),
            ], { background: 'surface', padding: 'md', label: title }),
          ),
        ],
      },
    ],
  },

  {
    id: 'numbers',
    label: 'Numbers / impact',
    icon: '▦',
    keywords: ['stats', 'statistics', 'numbers', 'impact', 'at a glance', 'metrics', 'kpi', 'kpis', 'performance', 'growth', 'figures'],
    elements: ['kpi', 'stats', 'text'],
    layouts: [
      {
        id: 'numbers-band',
        name: 'KPI band with context',
        description: 'Four KPI cards with a line of explanation above.',
        build: () => [
          textBox([0, 0, 12, 4], { title: 'At a glance', body: LOREM.short, align: 'center' }),
          kpis([0, 4, 12, 4], [
            ['Number of employees', 250, '+', '👥'],
            ['Certifications', 12, '', '🏅'],
            ['Training hours', 8000, '+', '🎓'],
            ['Clients served', 120, '', '🤝'],
          ], { columns: '4' }),
        ],
      },
      {
        id: 'numbers-split',
        name: 'Numbers beside a story',
        description: 'A tall stack of KPI cards next to a paragraph.',
        build: () => [
          kpis([0, 0, 5, 8], [
            ['Number of employees', 250, '+', '👥'],
            ['Certifications', 12, '', '🏅'],
            ['Training hours', 8000, '+', '🎓'],
          ], { columns: '2' }),
          textBox([5, 0, 7, 8], { title: 'What the numbers mean', body: LOREM.about }),
        ],
      },
    ],
  },
];

/** Layouts offered for any section, whatever it is called. */
export const UNIVERSAL_LAYOUTS = [
  {
    id: 'generic-text-image',
    name: 'Text and image',
    description: 'A heading and paragraph beside a picture — the everyday layout.',
    build: () => [
      textBox([0, 0, 7, 7], { title: 'Section heading', body: LOREM.about }),
      image([7, 0, 5, 7], '', 'Add a caption'),
    ],
  },
  {
    id: 'generic-trio',
    name: 'Three columns',
    description: 'Three layout boxes to fill with anything.',
    build: () => [
      heading([0, 0, 12, 2], 'Section heading'),
      ...featureTrio(2, [
        ['◆', 'Column one', 'What goes here.'],
        ['◆', 'Column two', 'What goes here.'],
        ['◆', 'Column three', 'What goes here.'],
      ]),
    ],
  },
  {
    id: 'generic-banner',
    name: 'Banner and intro',
    description: 'A hero strip across the top with body copy under it.',
    build: () => [
      hero([0, 0, 12, 6], {
        media: 'color',
        heading: 'Section heading',
        subheading: LOREM.short,
        align: 'left',
        height: 'sm',
        buttons: [],
      }),
      textBox([0, 6, 12, 5], { body: LOREM.about }),
    ],
  },
];

/* ---------------------------------------------------------------- matching */
const normalise = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Scores an archetype against a section name. A multi-word keyword found in
 * the name beats a single word, and a whole-word match beats a partial one, so
 * "Centres of Excellence" picks facilities rather than the generic fallback.
 */
function score(archetype, name) {
  const haystack = ` ${normalise(name)} `;
  let best = 0;
  for (const keyword of archetype.keywords) {
    const needle = normalise(keyword);
    if (!needle) continue;
    const words = needle.split(' ').length;
    if (haystack.includes(` ${needle} `)) best = Math.max(best, 10 * words);
    else if (haystack.includes(needle)) best = Math.max(best, 4 * words);
  }
  return best;
}

/** The archetype a section name points at, or null when nothing matches. */
export function matchArchetype(name) {
  let winner = null;
  let winningScore = 0;
  for (const archetype of ARCHETYPES) {
    const value = score(archetype, name);
    if (value > winningScore) {
      winner = archetype;
      winningScore = value;
    }
  }
  return winningScore ? winner : null;
}

/**
 * Sample layouts to offer for a section name: the matched archetype's first,
 * then the universal ones, so there is always more than one option.
 */
export function layoutsFor(name) {
  const archetype = matchArchetype(name);
  const suggested = (archetype?.layouts || []).map((layout) => ({
    ...layout,
    archetype: archetype.id,
    archetypeLabel: archetype.label,
    suggested: true,
  }));
  const universal = UNIVERSAL_LAYOUTS.map((layout) => ({
    ...layout,
    archetype: 'generic',
    archetypeLabel: 'Any section',
    suggested: false,
  }));
  return { archetype, layouts: [...suggested, ...universal] };
}

/** Element types worth highlighting in the library for this section. */
export function suggestedElementsFor(name) {
  return matchArchetype(name)?.elements || ['text', 'image', 'kpi', 'buttons'];
}

/** Builds a layout's blocks with fresh ids. */
export function buildLayout(layout) {
  const blocks = layout.build();
  const stamp = (block) => {
    block.id = uid('blk');
    (block.children || []).forEach(stamp);
    return block;
  };
  return blocks.map(stamp);
}
