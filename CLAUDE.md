# Organization Presentation Portal — working brief

A projector-ready digital brochure a presenter walks through live, built to attract
colleges and universities into MOUs and academic partnerships. Three organizations
sharing one pane, fifteen sections each, role-based login.

## The working agreement

**The user supplies content and images. Claude does all the design and all the code.**

- The user never opens a builder, never arranges a layout, never adds a section.
- There is **no section-creation UI** and no free-hand editor. Do not add either back.
- Every section starts blank. It gets content only when the user hands it over.
- The user drops files in `incoming/<Section>/<Subsection>/` with a `content.txt`.
  Read the folder, design the page, publish it via the API.
- Deliver a finished, designed page — layout, image treatment, typography, motion.
  Do not hand back a half-built page for the user to finish.

## Run it

```bash
cd backend && node src/server.js      # http://127.0.0.1:4173
```

Zero runtime dependencies — no `npm install`, no build step, no CDN, no internet at
presentation time. Node 20+.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `Torii@123.com` | `Admin@123` |
| Presenter | `Torii@present.com` | `Present@123` |

The addresses were `admin@org.local` and `presenter@org.local` until 2026-09-18.
Neither is a mailbox; they are login identifiers and nothing is ever sent to
them. `ensureSeedUsers` reconciles the account holding each **role**, not each
address, so changing `ADMIN_EMAIL` renames the existing account rather than
creating a second admin beside it — which is what it did before, leaving the
old address live with its old password. The 31 publish tools read
`ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment and fall back to these.

## Shape of the thing

- `backend/` — plain Node HTTP server, JSON store at `backend/data/db.json`,
  media in `backend/uploads/`. Serves the API *and* the frontend.
- `frontend/src/` — vanilla ES modules, no framework. Built with a tiny `h()`
  helper in `utils/dom.js` (and `svg()` for vector nodes — SVG needs the
  namespace, `document.createElement('svg')` renders nothing).
- `frontend/public/styles/app.css` — the whole design system, one file.
- `incoming/` — raw user drops. Not served; not live until Claude places it.

**Two** orgs, each with its own palette applied at runtime as CSS custom
properties. There were three until 2026-09-17, when NCET was removed on request
and NGI's tab took both names:

| Tab | id | Primary | Accent | What it is |
| --- | --- | --- | --- | --- |
| NGI and NCET | `technical-hub` | `#008638` | `#FFBB00` | Nagarjuna Group of Institutions, presenting for both. The id stayed `technical-hub` because every tool and the palette table key on it; the display name has now changed twice — Technical Hub → NGI (2026-09-14) → NGI and NCET (2026-09-17) — and nothing but `name`/`shortName` moved either time. Its wordmark and rail mark were swapped off Technical Hub's on 2026-09-14: the pane shows the NGI letterform cut out of `uploads/Placements/Journeys/banner-1.jpg`, the rail the Nagarjuna emblem cut out of `Downloads/Claude Technical Hub/.../assets/logo-ngi.png`. The full stacked NGI lockup is not used — the pane's logo slot is 38px tall and its third line would land at about 4px. |
| Torii | `torii` | `#000000` | `#E95A22` | Torii Minds. A mirror of NGI as of 2026-09-14, edited into its own deck ever since. |

**NCET's deck was deleted** (2026-09-17, `tools/drop-ncet.cjs`): the
organization and all nineteen of its sections — the fifteen rows that mirrored
NGI plus the four pages under Governance Council. The one structure that remains
is NGI's, which is what the tab now announces. Three things about that removal:

  - **There is no DELETE route for an organization.** `org.routes.js` has list,
    get, create and update and nothing else, so the tool edits `db.json`
    directly — and *refuses to run while the server is up*, because the store is
    held in memory and written back on every change, so the edit would be lost
    the next time anything was published. Stop the server, run it, start again.
  - **The backup is the way back.** `db-before-drop-ncet-*` holds all nineteen
    sections whole, and NCET's palette is deliberately left in
    `config/themes.js`, unused, so a restore needs nothing but the backup.
  - **Its photographs stay in `uploads/`.** Assets are shared across
    organizations and there is no delete route for them either; 73 of the 85
    NCET referenced are used by no other deck and are left where they are. A
    wrong guess deleting media is unrecoverable; an unused file is only bytes.

Checked before writing: no user, session or template mentioned `ncet`, and the
router sends a stale `/o/ncet/...` URL to `#/orgs` rather than to an error —
verified after, along with the tab measuring 130px for a label that fits whole.

The two are tabs in the pane head — `.sidenav__orgs`, one filled in its own ink
for the current deck, stacked short names on the rail. They are a control, so
they are the one filled element in a pane whose rows are colour rather than fill.
The strip is `grid-auto-columns: 1fr`, so the tabs share the width however many
there are; the tab draws `shortName || name`, which is why the rename sets both.
`POST /api/orgs` creates an organization; add its palette to `config/themes.js`
alongside, or it falls back to Torii's. `PATCH /api/orgs/:id` takes `order`, which is
the tab order — NGI is 0 because it is the deck the room is shown first. Torii and NCET are meant to diverge: a
change asked for on one is not mirrored to the others unless asked.

The deck is **flat**: every navigation row is a slide, none of them is a folder.
A row is named by the section's **stored title**; the curated list in
`NAVIGATION_GROUPS` (`frontend/src/components/SideNav.js`) is only the fallback for a
section with no title, plus the icon for each key. It used to be the other way round,
until three decks shared one set of keys and NGI asked for names Torii did not — so
renaming a tab is a `PATCH` of `title` on that one organization's section, nothing
in the code. Each section also carries its own `iconKey`, which outranks the curated
one — keep the two in step or the pane and the data disagree.

The subsection machinery is still there and still enforced one level deep
server-side; nothing currently uses it.

## Publishing a designed section

Sections hold `blocks[]` on a 12-column canvas. Write a Node script that PATCHes
`/api/sections/:id` with the block list. Block types and their fields are defined
in `backend/src/services/section.service.js` — that file is the schema.

```js
{ type: 'image', layout: { x: 0, y: 0, w: 7, h: 10 }, assetId, fit: 'cover', radius: 'lg' }
```

Upload media first via `POST /api/assets` (`{files:[{name, dataUrl}]}`), then
reference the returned asset ids.

## Hard-won layout rules — read before designing

- **A row span includes the gaps.** `ROW_HEIGHT` is 28 and `GAP` is 16, so `h: 7`
  reserves `7×28 + 6×16 = 292px`, not 196. Oversized spans leave dead white.
- **One slide is 16:9 at a nominal 1600×900.** After the head and gutters the
  canvas budget is **~654px**. Design to it: a section that exceeds it cannot fill
  the screen and gets letterboxed instead.
- **Blocks stretch, they do not shrink.** A block's content decides its real height;
  the span is a minimum.
- Card and gallery grids use `auto-fit`, never `auto-fill` — `auto-fill` leaves a
  phantom empty column and three cards end up filling 60% of the width.
- Presentation mode fills the display edge to edge when the content fits, and falls
  back to fitting (with margins) when it does not. Never clip content to fill.
- Do not widen the presenting side gutters. Row counts are measured at that exact
  canvas width; a wider gutter rewraps text onto rows that do not exist.

## Design rules

- **Accent as text must use `--accent-ink`.** Raw brand accent on white measures
  1.7:1 for Technical Hub's gold. The ink is the readable derivative. Raw accent is
  fine on a dark ground (e.g. a hero scrim over an image).
- **No gradients.** White is the major surface; the accent is reserved for what is
  active or primary.
- **Never place a raw poster.** Crop away burned-in headlines and logos so the
  page's own typography carries the message — unless the user asks to keep it.
- **Never invent a metric.** "Thousands of students" stays as words; it does not
  become a fabricated number.
- **Never hand-draw a third-party brand logo.** No clean vendor logos exist in the
  library. Use typographic chips and ask for official files.
- Icons come from `frontend/src/utils/icons.js` — one 24×24 line family, resolved
  by keyword. Add to it rather than importing an icon set.
- Motion: blocks arrive in reading order, counters count up, the accent rule draws
  itself. Everything is off under `prefers-reduced-motion`.

## Verifying work — do not skip

Screenshot and measure before reporting done. Headless Chrome over CDP:

```bash
chrome --headless=new --remote-debugging-port=9222 --user-data-dir=<tmp> about:blank
```

Drive it with a small WebSocket client: set the session cookie, `Page.navigate`,
then **`Page.reload {ignoreCache:true}`** — a hash-only navigation does not reload
ES modules and you will test stale code. Then `Runtime.evaluate` to measure and
`Page.captureScreenshot` to look.

**Never `taskkill /IM chrome.exe`.** It kills every Chrome on the machine, and the
user keeps their own open beside this work to refresh the deck by hand — it took
their windows down several times in one session before they said so. Start the
headless instance once on its own `--user-data-dir` and its own debug port, check
`/json/version` on that port before starting another, and leave it running when
the checks are done. If one really has to be stopped, stop the PID that was
launched, never the name.

Measure, don't eyeball: contrast ratios, letterbox bars, whether a block clips.
When comparing a transformed element, `getBoundingClientRect()` is scaled but
`scrollHeight` is not — mixing them invents bugs that are not there.

Layout settles late: entrance animations and counters measure up to 30px taller
than the final layout, which is enough to flip a fill/fit decision. Re-measure
after the motion finishes.

**Later than you think, on a section with an intro card.** `slide--intro` sets
`--intro-hold: 3s`, and every entrance on the slide adds that to its own delay —
so a screenshot taken three seconds after entering presentation catches the
content at the *start* of its arrival, not the end. On the Trainings shelf that
read as six covers washed out to nothing and sent a colour investigation off
after a bug that did not exist: the books were at opacity 0.50, 0.18, 0, 0, 0, 0
because their animations had barely begun. Add the hold, the stagger and the run
before sampling — there, 3s + 790ms + 780ms, so 6.4s.

## Subsections are real pages

A section may carry `parentId`, making it a page inside a group. The tree is one
level deep and that is enforced server-side. Selectors live in
`context/appStore.js`: `visibleSections()` returns groups only,
`childSections(parentId)` returns the pages inside one, and `deckSections()` walks
the tree so Prev/Next moves group → its pages → next group.

The navigation prefers real child sections; the curated label lists in
`NAVIGATION_GROUPS` are only placeholders for groups whose pages do not exist yet.
Build the pages and the labels are replaced automatically.

A detail page (a single success story, say) is just another child section. Link to
it from a `buttons` block with `href: '#/o/<org>/<sectionId>'` — the pane stays
put, and browser Back returns.

## Current state

Fifteen sections in Torii and NCET, thirteen in NGI, all with content. Nothing is a placeholder and nothing is half
built; the empty ones were deleted rather than left for a presenter to walk into.
Organization Overview and Leadership used to be groups whose rows opened a list
instead of a slide — Leadership held no blocks at all, so its row opened an empty
page. Their pages came up a level and both wrappers went, along with CEO Vision.

| # | Section | Icon | Block | Source |
| --- | --- | --- | --- | --- |
| 1 | Executive Summary | `team-cycle` | `hero` | authored |
| 2 | Organization Snapshot | `camera-photo` | `drift-wall` | authored — **Torii and NCET only**; removed from NGI on request 2026-09-14 (backup in `backups/db-before-remove-snapshot-ngi-*`) |
| 3 | History & Milestones | `roadmap` | `milestone-timeline` | authored — **Torii and NCET**. On NGI the row is **Legacy & Infrastructure** and holds a `tilted-tiles` wall built from `uploads/Infrastructure/` |
| 4 | CEO Profile | `ceo-podium` | `leader-hero` | Babji Neelam portfolio — **Torii and NCET only**; removed from NGI on request 2026-09-14 (backup in `backups/db-before-remove-ceo-profile-ngi-*`) |
| 5 | Leadership Journey | `climb-steps` | | Babji Neelam portfolio |
| 6 | Success Stories | `rosette` | `story-wall` | Babji Neelam portfolio |
| 7 | Programs | `www-globe` | `program-deck` | `uploads/Programs*`, `Videos.xlsx` |
| 8 | Centers of Excellence | `handshake-check` | `coe-wall` | `uploads/coepics/`, `Videos.xlsx` |
| 9 | Industry Alliances | `partners` | `alliance-accordion` | `uploads/mou/`, six MOUs |
| 10 | Certifications | `seal-check` | `certification-wall` | see below |
| 11 | Placements | `job-pin` | `placement-wall` | `uploads/Placements/` |
| 12 | Events | `event-sign` | `event-reel` | `uploads/Videos.xlsx` |
| 13 | Video Resumes | `clapper` | `video-resume` | `uploads/Video Resumes.xlsx` |
| 14 | AI Ready Engineer | `ai-figure` | `course-deck` | authored |
| 15 | Platforms | `tap-network` | `platforms` | `uploads/platform-logos/` |

The glyphs are the user's own SVGs in `backend/uploads/navicons/`, one file per row
plus `Signout`, `collapse` and `expand`. They are solid-fill artwork at mixed
viewBoxes with no fill attributes, so `SideNav.artworkGlyph` paints each one as a CSS
mask over `background: currentColor` — the glyph then takes whatever colour the row
already has, with no second copy of the file and nothing to keep in step. Mapping
lives in `NAV_ARTWORK`, keyed by section key. The pane reads `navicons-fit/`, not
`navicons/`: the originals come from several sets at several weights (0.44 to 1.40 px
of stroke at 21px, a 3.2x spread) and `tools/normalise-navicons.cjs` writes copies
evened to one weight — scaling declared widths on stroked files, adding a stroke to
filled outlines, iterating because the weight has to be measured off a raster. Run it
after changing any original.

`navicons-fit/` is generated and is **not** in git. If it goes missing every icon in
the pane silently disappears, because a CSS mask whose file 404s paints nothing at all
rather than falling back. It has been lost once already. One command restores it:

```bash
node tools/normalise-navicons.cjs --port <a headless Chrome debug port>
```

A key with no file a key with no file falls through to the
line library in `utils/icons.js`, which still holds a drawn glyph for every row as a
fallback.

Distinct on purpose: collapsed, the pane is an icon rail and the glyph is the only
thing identifying a row.

Torii has begun to diverge (2026-09-14): Governance Council is **Team** and now
holds the team itself rather than a `hub` of four doors, Programmes
is **Trainings**, and six new rows were added with no content yet — Project Week,
Project Street, NT Square, Beyond, IT Development, Torii Connect. (By 2026-09-15
Project Week, Project Street and NT Square have content; Beyond, IT Development
and Torii Connect are still blank.) They were created as
drafts so a presenter would not be walked into a blank slide, but the user works in
the presenter view and could not see them, so they are **published and blank**: each
opens on the "This section is blank" card until its content arrives. Hide them again
(`tools/presenter-visibility.cjs --hide ...`) before any real presentation if content
has not landed. Two of the names were dictated by voice and may be misheard —
"Project Street" and "NT Square" — check before designing them. **NT Square is
confirmed** (2026-09-15): the signage and the filenames both read NT SQUARE, and
that row now has content.

Torii and NCET each hold a copy of NGI's fifteen sections, made with
`tools/mirror-deck.cjs` on 2026-09-14. Torii's earlier, half-built deck (twenty-one
sections, six with content, among them a CEO Vision and a testimonial wall NGI never
had) was replaced on request; the whole store as it stood is in
`backend/data/backups/db-before-mirror-torii-*.json`. The mirror reads the *stored*
blocks off disk rather than the API, because the API hands back hydrated sections —
films merged in from Videos.xlsx — and pushing those back through `create` would
double the merge on the next hydrate. Assets are shared across organizations, so a
mirrored photograph is the same file, not a second upload.

**Certifications is user-supplied and is not to be redesigned.** The component,
its CSS and `tools/publish-certifications.cjs` arrived as a bundle and were
reverted to it once already after being rewritten. Three acts — The Register,
Skills Unlocked, The Gallery — 42 credentials at 32,146 held, 19 vendors, 82
cohort cards (that is still NCET's; NGI's row is switched off). Change it only
when asked, and change only what is asked.

Torii's copy was changed on request (2026-09-16), and only in the ways asked:
its **fifteen** credentials and **3,120** total come from two tables the user
supplied — B.E 1st year 1,277 · 2nd 1,070 · 3rd 595 · 4th (ServiceNow) 178 —
transcribed to the unit and checked to add up before anything is written. The
register shows the total alone in the middle with the year split as small
figures beneath; the "16,000+ Trainees Certified" card is gone from Torii; the
Gallery act is gone from Torii. Three things about how, because they had to
touch the shared component:

  - **Nothing in the component is Torii-specific.** "16,000+" was a literal in
    the register; it is a block field now (`trainees`), and the same publish run
    wrote "16,000+" onto NGI's and NCET's blocks so their register did not
    change. The Gallery act is drawn only when `vendors` holds cohort artwork;
    Torii's block holds none. `years` is a new optional list. The register's
    total was never typed anywhere — the component sums the credentials, which
    is why the table's own total has to be right first.
  - **Badges by preference, then by vendor, then cropped, then in type.**
    Nine credentials had a badge or a same-vendor badge in the library already.
    Four are cropped through the canvas from cards that carry the real badge
    — Red Hat's Python Programming badge and Oracle's Foundations Associate
    Database badge from the user's own cohort cards, the Postman Student
    Expert badge and the CodeChef lockup from the cards already in uploads —
    into `uploads/certifications/torii/`. Infosys Springboard and IBM
    SkillsBuild have no artwork anywhere in the library and stand in type;
    the type fallback now keeps all three letters of a name as short as IBM.
  - **`domain` carries where a count came from** ("354 (1st year) + 200 (2nd
    year)"), shown under the count in the detail view.

The skills lines are descriptions of each certification's syllabus as its
awarding body publishes it — four a credential, not claims about results.

**How many badges an arc carries is a question about the arc, not about the
catalogue** (2026-09-17, after "the logos were too much small… too much gap…
it needs to look filled"). The register used to share the credentials out
between its two arcs by length, so each arc held its share of however many there
were. That is right at 42 and wrong at 15: the same two arcs, 2,165px and
1,589px of path, held fifteen 36px badges at 197px centre to centre — 161px of
air between each — and the band stopped reading as a band. The badge is now
`clamp(w/26, 40, 64)` (62px on a 1600px stage, 72% larger) and the slots are set
by density instead: one every 1.5 badge-widths of path. Measured after: 42
badges at 62px, 92px apart, a 30px gap. Three things make that safe:

  - **The travel already wrapped.** `credentials[(g.from + j) % length]` was
    there from the start, so a catalogue shorter than the slots simply comes
    round again — no new mechanism, and the same discipline as the event wheel.
  - **A repeat is always a full catalogue away from itself.** The slots are
    numbered straight through both arcs, so with 15 credentials a badge recurs
    15 slots later and never stands beside itself. Asserted: 0 adjacent
    duplicates on Torii's 15 and on NGI's 42.
  - **A catalogue longer than the slots would lose its tail**, so the density is
    raised until there is a slot for every credential. NGI's 42 land in 42
    slots, one each, and its register is unchanged but for the larger badge.

The type fallback for a credential with no art (Infosys, IBM) was a fixed 12px,
which was legible beside a 36px badge and lost beside a 62px one; the pin now
publishes its own size as `--cs-pin-size` and the fallback is `0.28em` of it.

## Republishing a section

`tools/` holds what can rebuild a page from its sources. Anything not listed is
still publishable only by hand.

| Script | Section |
| --- | --- |
| `publish-certifications.cjs` | Certifications — counts from `Logos.xlsx`, artwork from the folders, prose in the script |
| `fetch-certification-logos.cjs` | downloads the badge art named in `Logos.xlsx` |
| `import-leadership-photos.cjs` | Leadership Journey |
| `publish-programs.cjs` | Programs — the section's name, and Ignite Coder's photographs |
| `presenter-visibility.cjs` | what the presenter side shows |
| `flatten-navigation.cjs` | the flat deck — order, titles and per-section icons |
| `publish-industry-alliances.cjs` | Industry Alliances — the six MOUs, their captions and their photographs |
| `publish-placements.cjs` | Placements — rebuilds the chapters and imports the company-wise cards from the user's `PLACEMENTS FOLDER` |
| `publish-events.cjs` | Campus Events — imports the event photographs and rebuilds the section as a filtered wall |
| `publish-achievements.cjs` | Student Achievements — one folder per achievement, its largest photograph on the card and the rest behind it |
| `publish-torii-team.cjs` | Torii's Team — the cut-out portraits, re-encoded to WebP, as the skewed ribbon |
| `publish-torii-summary.cjs` | Torii's Executive Summary — uploads the brand film and rebuilds the slide around it |
| `publish-infrastructure.cjs` | NGI's Legacy & Infrastructure — the campus folders, as the tilted wall and the gallery behind it |
| `publish-nt-square.cjs` | Torii's NT Square — the thirteen photographs as the card fan, and the GitHub Experience Center subfolder as the deck behind the third pill |
| `publish-trainings.cjs` | Torii's Trainings — the bookshelf, and the placeholder list currently standing on it |
| `publish-it-development.cjs` | Torii's IT Development — the five products as the project showcase, and the offline mock sites the monitor opens |
| `publish-torii-certifications.cjs` | Torii's Certifications — the fifteen credentials and the year split from the user's two tables, four badges cropped from cohort cards, no gallery |
| `publish-torii-snapshot.cjs` | Torii's Organization Snapshot — the whole Torii Minds photograph library as the drift wall, the Torii mark in the middle |
| `publish-torii-events.cjs` | Torii's Events — the section's own grouped events re-issued as the wheel of albums |
| `publish-torii-connect.cjs` | Torii Connect — the three photographs, de-framed, as the folder that opens into a bento |
| `publish-project-street.cjs` | Torii's Project Street — the film and the thirty-two photographs, copied as they are, as the film screen and the thread board |
| `publish-project-week.cjs` | Torii's Project Week — the nine collage photographs (re-encoded once, then reused) and the wall of sixteen more under them |
| `publish-section-intros.cjs` | the title card on every row of both decks - the row's own title; `--clear` takes them off |
| `apply-review-2026-09-17b.cjs` | the review's second pass — the showcase cut to five products plus three named ones, the photographic badges off the register, the CEO's two figures |
| `apply-review-2026-09-17.cjs` | Torii's content changes from the 2026-09-17 review — the Claude card, the CEO lines, About, the team and CoE orders, the film start, the Beyond and Certifications photograph |
| `fix-uploads-path-case.cjs` | corrects the case of every stored `/uploads` path — run it before deploying, because Windows hides a wrong case and Linux does not |
| `crop-image.cjs` | crops a photograph through headless Chrome's canvas — there is no image library and there is not going to be |
| `drop-ncet.cjs` | removes the NCET organization and its sections, and renames NGI's tab — stop the server first; always backs up `db.json` |
| `mirror-deck.cjs` | copies one organization's whole deck into another — `--replace` clears the target first; always backs up `db.json` to `backend/data/backups/` |
| `normalise-navicons.cjs` | evens the weight of the supplied nav artwork into `navicons-fit/` |

The `.xlsx` reader inside `publish-certifications.cjs` is self-contained — lift it
rather than writing a third one.

## The navigation pane

One row per section, no folders. The rules it now follows:

- **Selected is colour, not fill.** The title and its mark turn `--nav-accent-ink`
  and a 3px `--nav-accent` bar appears at the row's left edge. A filled pill made
  the pane read as a row of buttons with one pressed.
- **Closed, the rows share the height.** `.nav-tree:not(:has(.is-open))` stretches
  them to fill the pane, capped at 66px, with the residue dealt out as gaps. Open a
  group and it reverts to content sizing.
- **A row with no subsections gets no panel element.** An empty one still drew its
  sunken plate and read as a subsection with nothing on it.
- **A closed panel's vertical padding belongs to the open state.** A `0fr` track
  zeroes the rows inside it but not the element's own padding, so a closed panel
  measured 14px and the pitch down the pane wandered.
- **Collapsed, the rail is `deepen(primary)`** — dark green for Technical Hub,
  black for Torii — with white glyphs and the selected one in `--nav-rail-active`
  (gold). The brand mark sits on it with no plate: the artwork is transparent
  everywhere but its strokes, so the white square was the plate alone.
- **The pane keeps its scroll position across a click.** The router rebuilds the
  whole pane on every navigation, so its scroller is a new element starting at the
  top; on a deck long enough to scroll, that put every row below the fold out of
  reach — clicking one sent the pane back up and the next had to be hunted for
  again. `keepScroll` parks the offset on `navigationStateByOrg` beside the
  open-group state, per organization, and restores it in a rAF after mount. It has
  to force `scroll-behavior: auto` for the assignment: the pane is declared
  `smooth`, and a smooth restore just animates the same glitch half a second
  slower. The collapsed rail's list gets the same treatment.
- **Nothing draws a scrollbar.** `scrollbar-width: none` and a zero-width
  `::-webkit-scrollbar`; it still scrolls.
- Presenting is on the top bar and on **F**. The pane does not repeat it.

## Things already learned the hard way

Two galleries solve their own layout and do it differently on purpose.
`PlacementWall.justifyRows` fills each row's width, which suits photographs of
every shape. `CertificationWall.packRows` solves width and height together and
picks a column count, because a row of square cards is always far wider than it is
tall and filling the width alone strands the stage in white. Neither ever crops: a
tile's width is always its own aspect ratio times the solved height.

A programme's evidence is not always film. Ignite Coder has five photographs and
no reel, so a program carries `photos[]` beside `videos[]` and the gallery holds
both — a still opens in the same viewer a film does, contained rather than cropped
and capped at twice its own pixels. That is also why the cards carry no count: a
card reading "—" told the room a programme had nothing when it had five pictures.

Two things about that viewer, both found the hard way. Its way out was drawn at
zero opacity and revealed on `:hover` alone, so a presenter who had just clicked a
film saw a full-screen picture and nothing offering a way back — it is now lit on
open and again on any movement over the film, and a photograph keeps it for good.
And the *gallery's* back button was worse: the shared `.pg-bar` rule left it at zero
opacity with no hover rule that could ever match it, so it never appeared at all.

`width: auto` on an image you want to fill something is always wrong. `max-width`
only limits an intrinsically-sized image, it never stretches one, so the 800px
stills sat at 800px in the middle of a 1600px display however generous the cap was.
Fill the box and `object-fit: contain` inside it, and cap the *box*. Cap it on
`load` **and** immediately when `img.complete` is already true, or the second time
a picture is opened it comes from cache and the event never fires again.

Films live in `backend/uploads/Videos.xlsx`, six sheets, and the sheet's own
convention matters: a row with a title starts a series and every row beneath it
with the title left blank is another part of it. `EventReel` draws a series as a
numbered run with arrows, and the same films are filed into the matching programme
on Programs and the matching centre on Centers of Excellence — merged, never
replacing what those pages already carry.

No YouTube poster may be load-bearing. They come from `i.ytimg.com` and there is
no network at presentation time, so every poster removes itself on `error` and the
card falls back to type on a dark plate. The same rule covers vendor badges, which
is why they are downloaded rather than hot-linked.

A dimension check does not prove an image is whole. `others/DriveReady 10 Trainees
(PARTIAL DOWNLOAD).jpg` is 9.6kB of a much larger photograph with a header intact
enough to report a size. Check the last bytes too — `FFD9` for JPEG, `IEND` for
PNG, `0x3B` for GIF.

Industry Alliances is a heading over a row of six agreements. The heading was on
a card of its own for one cut, which turned out to be exactly wrong: it was only
on screen while nothing was being shown, so the moment a presenter pointed at an
agreement the slide lost its name. It is a `.aa-head` above the row instead —
eyebrow, title, a rule that draws itself, and nothing more, because every row the
head takes comes off the cards. The `intro` panel kind that card used is still in
the schema and still works; no content uses it.

The row **returns to its resting card whenever the pointer leaves it**. That reset
is the point of the section: the presenter shows an agreement, moves the mouse
away, and the row composes itself again. Which card it rests on is computed at
publish time as the first one that actually has a photograph — hard-coding 0 made
the section's first impression the one card with nothing on it, and computing it
means nothing has to be undone when the missing photographs arrive. Four things
drive the row, because a presenter's hand is not always on the mouse: hover, the
arrow pill in the top-right corner, the wheel, and the arrow keys. The pill lives
*inside* the row, because crossing onto it must not count as leaving the cards —
outside, the row went home between the press and the release.

The photograph on a card is optional — all six have one now, but a card with no
`assetId` wears a plate in the partner's own colour with its initials
on it, and the picture drops into the same box later without the layout moving.
Three things that plate taught. The monogram is only drawn on the open card,
because at 72px on a 140px slat it is two clipped letter-halves and seven of them
across a row read as one smeared word. Deriving the initials from the name is not
enough on its own — "Institute of Advanced Energy (IAE)" reduces to INA, which is
not what anyone calls it — so a panel can carry its own `mono`. And the caption
sits on its own black plate rather than on the gradient alone: these photographs
are bright right to the bottom edge, where a scrim however deep cannot carry a
name. The Snowflake photograph arrived as a finished 1080 social card, both logos
and a vignette burned into a header band, and was cropped back to the photograph
inside it with `tools/crop-image.cjs`; the original is kept beside it as
`snowflake-original.jpg`.

Placements diverged on NGI (2026-09-14). It now shows two chapters: **Placement
Journeys** (three NGI #2026 banners) and **Company Wise Placements**. Open Drives,
Inside the Companies and then Campus Placements were each removed on request — their
images all stay on disk under `uploads/Placements/`, and Torii and NCET still show the
original four. `KEEP` in the publish script is the list of chapters that survive a
re-run; a chapter dropped on request is taken out of it so the next run does not
resurrect it. **Company Wise Placements** was added — the
announcement cards from the user's `PLACEMENTS FOLDER`, one group per company, which
is all the filter needs: `drawChips` draws a chip per *named* group and wires itself.
22 companies, 40 cards; two folders were filed twice (o9, Idea Infinity) and are
merged under one name, and the folder-to-name map in the script is written out by
hand rather than derived, because title-casing turns DHL into "Dhl" and [24]7.ai into
"[24]7.Ai". Torii and NCET still hold the original four chapters.

Placement Journeys on NGI now holds the thirteen co-branded Torii x Nagarjuna
banners from `Downloads/NCET/NCET/PLACEMENT/PLACEMENT`, then the three original
`PJ*.jpg` infographics. The script rebuilds that chapter rather than appending to
it — the originals are picked back out by their filename — so running it twice does
not stack the banners up. Its `kind` moved from `journey` to `poster` with them:
`journey` sizes every row to fill the stage, which is right for one tall infographic
read on its own and wrong for sixteen cards — the chapter came to 3735px of stage
with roughly one row visible at a time, against 1062px as a poster wall. No caption
is written on any of them; six of the thirteen are named `1.jpg` or
`Group 1 copy.jpg`, and a company guessed off a filename is worse on a recruiter's
slide than no caption.

Student Achievements (NGI, 2026-09-14) keeps the hanging-card carousel it always
had and gains two things. A story carries `backdrop[]` — the photographs of that
achievement beyond the one on its card — and they fill the wall behind the deck
while that card is centred, crossfading as the collection is stepped through. They
show only while the deck is *dealt*: folded, the section is a poster and should
arrive as one. An achievement with a single photograph has no set, so the wall keeps
its own gradient, which is the designed state and not a fallback. The veil that
keeps the white cards readable belongs to `.sw-bg__set`, never to `.sw-bg` — on the
layer it would wash out the wall's own gradient on every achievement that has no
backdrop. `.sw-bg` is positioned absolutely because `.sw-root` is a three-row grid
and a fourth child in flow adds a fourth row; it also has to restate `position` and
`z-index` to beat `.sw-root > * { position: relative; z-index: 1 }`.

And the headline follows the cards: the section's own title while folded, the
centred achievement's name once dealt. The names are whole sentences, so they are
set well down from the 70px poster line and allowed to wrap — the poster line never
has to. The title's elements are rebuilt rather than having their text swapped,
because the entrance animation lives on the element and only a new node replays it;
`lastTitle` guards that, or every arrow press would replay the animation on a name
that had not changed. One folder is one achievement and its name is used verbatim,
which is what the user files them by.

`placement-wall` is no longer only about placements. It is the deck's justified
photo wall — rows solved so nothing is ever cropped, filter chips built from the
group names, a staggered reveal, a stage that scrolls — and two fields make it
reusable: `base` names the folder under `/uploads` the sources hang off (it was
hardcoded to `Placements`, which is what kept anything else from using it) and
`allLabel` names the chip that clears the filter (it was the literal string
"All companies", which announced forty-three photographs of workshops and
graduations as companies). The chapter rail hides itself when there is only one
chapter — a lone tab is a control that does nothing.

Campus Events on NGI uses it (2026-09-14). It held an `event-reel` of six tabs and
91 films, every one a YouTube id — none of which can play in the room, since there
is no network at presentation time. Those tabs were not wanted; the section is now
43 photographs from `Downloads/NGI/NGI/campus events`, one group per event, twelve
chips. The event names on the chips are shortened by hand in the script: at full
length ("A 3-Day Hands-on-Workshop on IOT & Embedded Systems by the Department of
ECE") thirteen chips wrapped to five rows and took the stage with them. The
photographs are small — 125 to 960px wide, most under 500 — so they are upscaled on
the wall. Torii and NCET keep their reel and their films.

Torii's Team is a skewed ribbon (2026-09-14), ported from the reactbits Pro
`SkewedCarousel` the way the accordion was ported from `AccordionGallery`: the
behaviour, not the package. `npx shadcn add` has nothing here to add to — no
components.json, no package.json, no Tailwind — and there is no network at
presentation time. Twenty-four cut-out portraits lean across a red wall, the one
at the centre square and full size, and the further out a card is the more it
turns away, sinks, falls back and dims. The centred person's name is set across
the wall behind the row, overlapping it. The row is driven four ways, as the
accordion is: the wheel, a drag, the arrow keys and the pill in the corner. It
replaced a `hub` block whose four doors — Profile of the Society, Governing Body,
Academic Council, Faculty Strength — were real child sections of that row; the
block was a second copy of a list the pane already showed, on the slide that
should be showing the team. Those four pages were then **deleted from Torii**
outright (2026-09-15): they came across with the mirror and they belong to NGI.
Torii's Team row is one slide and nothing hangs off it, which took the deck from
25 rows to 21. NGI and NCET keep both the hub and all four pages; the store as it
stood is in `backups/db-before-drop-team-pages-torii-*`.

Eight things that section is built out of, most of them found by measuring.

**The slab leans and the photograph does not.** The sketch skews the card and
everything in it. These are portraits: a leaning frame is a design and a leaning
face is a fault, so the skew is on `.sk-card__slab` and `.sk-card__shot` carries
the exact counter. What moves with the scroll is a shear of the whole ribbon,
where there is nothing to distort — `--sk-shear` and `--sk-heat` are written on
the root every frame off the speed, and both are zero at rest. The row is only
ever a diagonal while it is moving, which is what makes the movement read as
movement rather than as a crooked row.

**One element per member, not a marquee track.** The offset wraps into the half
lap either side, so the card leaving the left edge is the same element arriving
at the right. Nothing is cloned. The list is only repeated when a team is small
enough that one lap would not cover a slide.

**`max-width` on an image is not always a kindness.** The stylesheet caps every
image at the width of its box. The figure here is deliberately wider than its
card — the source is a square with a person standing in the middle of it — and
capped, it was drawn 300px wide in a 416px-tall box: a 28% horizontal squeeze on
two dozen faces, which looks like nothing in particular until it is measured
against the file's own dimensions. `.sk-card__shot img` sets `max-width: none`.
Measure `offsetWidth`/`offsetHeight`, not `getBoundingClientRect` — a card that
is rotated, sheared and turned in 3D has an axis-aligned box that means nothing.

**Padding on a root cannot clear the deck bar for a positioned child.** An
absolutely positioned element resolves against its containing block's *padding
box*, which includes the padding — so the `--deck-bar-clear` padding that works
for `.pw-root` and `.aa-root` moved nothing at all here. The stage takes the
clearance itself: `bottom: var(--deck-bar-clear, 0px)`, which is 0 when the
section is not presenting.

**A frame's worth of time has to be the time the frame took.** `kick()` reset the
clock, and it is called from the end of the frame it schedules, so every frame
was worth a nominal 16ms however long the browser had actually spent on it — the
arrival then ran at the speed of the machine. Measured in headless Chrome: an
entrance written to settle in about 1.5 seconds took 4.8. A gap wider than a few
frames is the loop restarting after a pause and is worth one nominal frame;
anything else is real elapsed time.

**The long time constant is for the travel, not for the last few pixels.** An
exponential settle from four cards out to under half a pixel takes the better
part of four seconds at the arrival's own tau, which the room reads as a section
that has not finished loading. The fast constant takes over inside 60px.

**Arrow keys must be stopped, not only prevented.** Presenting binds the arrows
to the whole deck (`PresentPage.js`), so a component that only calls
`preventDefault` walks its own row *and* leaves the slide. Every other section
that takes the arrows calls `stopPropagation` first; `AllianceAccordion` does not
and has the same latent bug.

**The reveal's trailing word margin.** `letterReveal` gives every word a
`margin-right` of 0.28em so words never touch. On a centred single line that is
width the glyphs do not have, and it pulls the name a third of a letter off the
centre it is supposed to be on. `.sk-ghost__word > span > span:last-child` zeroes
it — with `!important`, because the margin is written as an inline style.

The portraits are cut-outs on transparency, so the alpha has to survive: a JPEG
would put a white box behind every person on a red wall. `publish-torii-team.cjs`
re-encodes them through headless Chrome's canvas to WebP at 760px — 21.5MB of
1080px PNG becomes 1.1MB, a twelfth of the weight, with the transparency intact
and no ground painted under it. The names are written out by hand in the script
for the reason the events map is: no rule turns `sampath].png` into a person's
name. Two of the team are both called Prasanth — the files tell them apart and
the cards cannot, so both read Prasanth until their full names arrive, and
nobody has a role, because an invented title is worse than a missing one.

The red is measured, not chosen: `#D91823`, the mean of six samples taken at the
shoulder of the polo everybody in the photographs is wearing, away from the logo
and away from the folds. The wall, the glow behind the centre card and the lit
top of every plate are all derived from it. Each plate is lit at the top and deep
at the bottom for a reason that only shows up with these particular pictures:
against a flat red, twenty-four identical red polos disappear into the ground, so
the head sits in the light and the shirt sits in the dark.

Torii's Executive Summary is the brand film and nothing else (2026-09-15). It
held a `paper-tabs` of three — Brand Film, Profile of NCET, Vision & Mission —
every word of it about Nagarjuna College, because Torii's deck began as a mirror
of NGI's. Two of those tabs were not wanted and none of that copy was Torii's. It
is now one full-bleed `hero` with a film behind and the name over it. NGI and
NCET keep their three tabs.

**The film is `learning__technical__communication__leadership__r.mp4`, played
whole.** It replaced `012. torii video NEW.mp4` later the same day, on the
instruction "played from the starting itself, don't cut for any scenes" — so
`hero.start` is 0, the `src` carries no `#t=` fragment, and the browser's own
`loop` does the repeat (verified: mounts at 0.8s, and a seek to one second
before the end comes back round to 2s). 1m 19s, 1280x720, 9.1MB, fast-start. It
is stored as `torii-brand-film-2.mp4` — a *different* asset name from the first
film's, because the script finds its asset by exact name and would otherwise
have handed the block the old 298MB file. That first film is still in the
library as `ast_23d907a92fc2471b`; there is no delete route.

**`hero.start` still works when a film needs it.** The first film opened on a
logo sting and was started at 18 (13 on the first cut), and the mechanism stays:
a `#t=` media fragment on the `src`, which is what the browser actually opens
on, and a `loadedmetadata` seek behind it, because a fragment is advisory and a
file already in cache can ignore it. The seek only ever pulls *forward*, so a
presenter who has scrubbed past the offset is left alone. With an offset the
`loop` attribute comes off — it always returns to zero — and an `ended` handler
does the repeat instead. At 0 none of that engages.

**A dark scene is not a letterbox bar.** The bar detector walks near-black rows
in from each edge up to the middle of the frame. On this film's title cards
(t=15 and t=75) it reports 330 and 349 rows of "bar" — the whole frame is black
with a word in it. Read it beside the frame's luminance: 4/255 there against 47,
136 and 134 on the three frames with picture in them, all of which measure 0
rows of bar. The film is honest 16:9 and `zoom: 1` stands.

**`--hero-zoom`, because 1.325 was a default pretending to be a rule.** NGI's
brand film is a 2.34:1 picture exported inside a 16:9 frame, so it carries 130
rows of black top and bottom as real pixels, and the stylesheet scales the
element past the frame to push them out of sight. Torii's film is honestly
1920x1080 with no bars anywhere in it — measured across five frames, sampling
rows and columns for near-black — and that same scale was throwing a third of the
picture away, invisibly, because a cropped animation still looks like an
animation. `hero.zoom` sets `--hero-zoom` on the element; unset falls through to
the 1.325 NGI depends on.

**The hero's `kicker` is its display line, not its `heading`** — 38 to 64px
against the heading's 28 to 44. Written the other way round, "BRAND FILM" was set
half again as large as Torii's own name.

**A bright film needs the scrim NGI's uses.** The left two-fifths of this film
measures 112 to 237 in luminance across the frames sampled, so white type over it
at `overlay: 42` came out at about 1.7:1 — the words were there and could not be
read. At 88, with the copy on the right where the presenting scrim is nearly
opaque, it measures 12 to 14.7:1 mean and 4.95:1 at its worst pixel, against a
film that is still clean down its left half. The copy is on the right for a
second reason: this film's subject walks in from the left. The second film is
darker on the whole but has bright classroom scenes (right half 136/255 at 35s);
on the brightest of them the copy measures 13.4 to 18.8:1 mean and 3.9:1 at the
subheading's worst pixel, so the `overlay: 90` / right alignment carried over
without change.

**A film goes up as a stream, not as a data URL** (the first one was 298MB). `/api/assets/binary?name=`
takes the raw bytes with the name in the query; `/api/assets` would have meant
about 400MB of base64 JSON for the server to parse. The limit is `MAX_VIDEO_MB`,
400 by default. The file is already fast-start — its `moov` atom is at byte 24,
ahead of the media, which `publish-torii-summary.cjs` checks and reports — and
`static.middleware` answers byte ranges, so the browser seeks to the offset by fetching
from the middle of the file rather than buffering thirteen seconds of what it is
about to skip.

**The copy is the user's own, whole** (supplied 2026-09-15). Its opening
sentence is lifted to the `heading` because that slot is 52px and it is the
strongest line; the rest runs on underneath in the order it was written, down to
the sign-off. The only editorial change is the em dash after "placement", which
arrived as a doubled space, and a hard space before the last word — right
aligned, the sign-off broke after "Stand" and left "OUT." alone on a line.

**The accent is measured off the mark, not chosen.** The film closes on the
logo: the wordmark in white, the final "i" inside an orange torii gate, on
black, with "IN" and "OUT" picked out of the tagline in the same orange. Sampled
at three frames it reads **#F05D29** — 5,296 pixels of it on the logo card and
60,517 on the gate. That is not the `#E95A22` in the palette table, which
predates any brand file; it is close and it is not the same. `hero.accent` sets
`--hero-accent`, which the `[gold:…]` rules now read with NCET's orange as the
fallback, so the two decks written first are untouched. The copy uses it the way
the mark does: white on black, orange on the numbers and on IN and OUT.

**The structure is NGI's hero and nothing else.** Same block, same `overlay: 90`,
same `align: 'right'`, same scrim — the only fields that differ are the three
this film and this mark own: `start`, `zoom` and `accent`. A panel behind the
copy was tried here for one cut and was wrong: it reads as a black box dropped on
the picture, and the point of these two slides is that they are the same slide
with different content in them. If the copy is hard to read on a bright frame,
the dial is `overlay` and the shared presenting ramp — not a new element.

What that costs, measured on the brightest frame in Torii's film: white body text
11.25:1 mean and 4.3:1 at its worst pixel, and the accents between 4.71:1 and
4.97:1 — except a phrase that happens to begin a line, which reaches out to where
the ramp has faded and read 1.49:1. It is a few seconds of a four-minute film and
one phrase of six. Deepening the shared ramp would fix it and would change NGI
and NCET with it, which is not a trade to make without being asked.

**The presenter bar was over the last line of all three Executive Summaries.**
`.slide--hero .hero--right` sits the copy on the hero's own 44px padding, and the
bar is 83 real pixels — measured overlap 739 x 39px on NGI, NCET and Torii alike.
Presenting now gives that hero `padding-bottom: var(--deck-bar-clear)`. A
photograph behind the bar is the design; a sentence behind it is a sentence
nobody can read.

NGI's Legacy & Infrastructure is a tilted wall with a gallery behind one button
(2026-09-15), ported from the reactbits Pro `TiltedTiles` the way the accordion
and the ribbon were ported: the behaviour, not the package. Columns of campus
photographs lean across the frame, adjacent columns drifting in opposite
directions, with the section's name and one button held still in the middle.
The button swaps in the filtered gallery — twelve facilities, forty-six
photographs from `Downloads/NGI/NGI/Campus Infrastructure` — and Back returns to
the wall, which never stopped moving. The row was **History & Milestones** and
was renamed on request; this **replaced the hand-written milestone timeline**,
which is kept verbatim in `backups/db-before-infrastructure-technical-hub-*`.
Torii and NCET keep the timeline and the old name.

**The gallery is `PlacementWall`, not a second gallery.** `TiltedTiles` builds a
`placement-wall`-shaped block out of its own `groups` and hands it over, so
justified rows that never crop, the chips, the staggered reveal, the scrolling
stage and the lightbox are all the ones that already existed. That is the third
caller of that component and the reason it took `base` and `allLabel` as fields.

**The block carries its photographs twice, on purpose.** `tiles` is the wall and
`groups` is the gallery. The wall is a backdrop that has to fill eight columns
taller than the frame, so it repeats the set; the gallery shows each photograph
once, in its own facility. Letting them differ means the wall can be a spread of
the best of them later without touching what the filter shows.

**A column's run must clear the column, or the wrap shows a gap.** The loop is
one run drawn twice and wrapped on the run's own height; if the run is shorter
than the visible column, the second copy arrives late and a band of ground
crosses the wall once per lap. Forty-six photographs over eight columns is under
six each — about 1,100px against a rotated frame of nearly 1,550 — so each column
is filled from the list until its run passes 1,700px, each starting at a
different point in the list. A photograph appears more than once on the wall,
never twice in the same column. Measured: shortest run 1,747px against a 1,548px
column, no short runs.

**Nothing on either half is cropped.** A wall tile's height is written on the
element as its own aspect ratio times the column width, which is the same rule
`justifyRows` follows — so `object-fit: cover` has nothing left to crop. Measured
worst deviation from true aspect: 0.36% on the wall, 0.27% in the gallery.

**The way back needs a strip of its own.** Dropped at the gallery's top-left it
landed on the first filter chip — which is the one that clears the filter and the
one most likely to be pressed. `.tt-gallery .pw-root` reserves 56px at the top
for it.

The photographs are small — 284 to 1920px wide, most under 700 — so they are
upscaled on both the wall and the gallery, the same as Campus Events. Camera
originals would sharpen them. Twelve facility names are shortened by hand in the
script for the chips, for the reason the event names are; the only one that loses
anything is the solar plant, whose folder also names the street lights and water
heaters it runs.

NT Square is Torii's pavilion at Nagarjuna College of Management Studies — a
permanent open-air kiosk whose inner walls carry the programmes, the 30+ global
certifications, the Centre of Excellence partners, the learning path, Project
Week / Project Street / Dark Ninjas and the team — and which doubles as a venue:
the Skill Edge days ("Learn AI. Apply AI. Own AI.") run in front of it. Nine
photographs, filed under `uploads/NTSquare/`.

The slide is a **`card-fan`** (2026-09-15), built to a layout the user supplied
as a reference image rather than to anything in this deck: eyebrow, a two-line
headline, two pills, and under them a hand of rounded cards arching up out of the
bottom edge, each cut off by the floor. Taken off the reference by proportion,
not by eye — its middle card is 30% of the frame's width and shows 47% of its
height, and the hand is wider than the frame so the cards at both ends are cut by
the side edges. Measured here: the middle card shows 71% of itself and the ends
25%, and the hand is 2,134px across a 1,600px slide. A first cut at a quarter of
that size read as a strip of thumbnails floating under a lot of white.

**Three things move, so there are three layers per card.** They would otherwise
be three rules fighting over one `transform`, which is the same trap the ribbon's
cards have: `.cf-card` carries the fan (the step across, the drop, the lean —
written once by JS, never animated), `.cf-card__rise` carries the entrance, and
`.cf-card__face` carries the hover. The entrance staggers **outward from the
middle** rather than left to right: the card the eye lands on first is the one
that arrives first.

The headline uses the deck's own letter reveal, one per line. The viewer is
`openLightbox` — the one the galleries already use, with its own arrows and its
own way out — so "click a card to see it full size" needed no new code. The two
pills each open the viewer at a card, so a button on that slide always does
something and always the same kind of thing.

**The card is square, which the reference's is not.** Seven of these nine
photographs are square and the other two are 16:9, so a square card shows seven
of them with nothing cropped at all and takes the other two in at the sides,
where a wide group shot has the least in it. Measured: 100% shown on seven,
56% on two. A portrait card matching the reference took a quarter of the height
off every one of them, and on a slide whose whole job is the pictures that is the
wrong trade — "I can't see the full image" was the note that got it changed. The
cards also sit further out of the floor than the first cut did, 84% of the middle
one against 71%, because the same note asked for that too.

Four of the nine are 3,375 to 6,000px wide and up to 7.9MB. They are re-encoded
to 1,800px rather than to card size, because the same file is what the viewer
opens full screen: 20.2MB becomes 3.6MB.

**The ground is not white, quite.** Three soft orbs sit under the hand in the
orange measured off the mark, so the cards stand in light rather than on a sheet
of paper. Two things that took a second pass. A radial gradient is strongest at
exactly one point, so **that point has to be somewhere the eye can reach** — the
first cut hung the orbs off the frame's edges, which put every core off screen
or behind a card and left the visible ground 0.7% off white: present, and not
present enough to be worth having. Positioned by their centres instead, the band
above the cards measures 7.2% below white, behind the headline 3.5%, and the top
corners are still pure white. And an animation replaces the *whole* transform,
so `cf-drift` has to repeat the centring `translate(-50%, -50%)` in both
keyframes — leave it out and every orb snaps half its own width down and right
the moment the animation takes hold. `card-fan.glow` accepts a hex, or 'none' to
turn them off.

**The hand's edges are fixed; the cards stand closer the more of them there
are** (2026-09-15). The fan was first tuned to nine cards with a step of 200, a
drop of 34px × a^1.55 and a lean of 3.8° a card, and those constants did not
survive a folder of thirteen: card 13 would have stood 1,200px from the middle
and dropped 550, which is off the slide entirely, and the schema's cap of eleven
would have thrown two photographs away. The geometry is now written at its
edges — the outermost card stands 875px out, drops 291 and leans 15.2°, and the
cards between are placed on a 0..1 scale of how far out they are — so nine
cards reproduce exactly the numbers above and thirteen fit the same frame at a
step of 146. Measured: the end cards show 166×177 of themselves, the middle
500×420. The cap is fifteen. The thirteen came from
`Downloads/TORII/Torii/Torii/NT SQUARE` and replaced the nine (backup
`db-before-ntsquare-torii-2026-09-15T16-29-*`); they are copied as they are,
the pavilion group photograph named as the middle card in the script, the rest
in the order taken. No captions — the files are timestamps — which also
retired the "Skill Edge" pill that used to open on a captioned card.

**The GitHub Experience Center is a deck behind a third pill.** The folder's
one subfolder, ten photographs, did not belong in the hand: it is a different
event. `card-fan.deck` (label, eyebrow, title, photos ≤24) draws one more
outlined pill with the count set into it; pressed, a frosted panel comes up over
the hand and the ten are *dealt* — every card starts on one pile at the middle
and turns out to its own lean, staggered outward, the way a hand of cards is
fanned. All the cards are positioned at the same point and differ only in a
rotation about a pivot 900px below them, so the deal is one transition on one
property. Measured after the deal: ten cards leaning −36° to +36°, the hand
1,320px across, every card at least 36% uncovered (hit-testing its own area)
and the rest a hover away, the lowest corner 76px clear of the presenter bar.
The first cut leaned to ±44° about a pivot 980px down and showed 41% of each
card, but its outer corners ran under the bar; the trade was made for the bar. A card opens the viewer on itself
with the deck behind it; Escape closes the viewer and leaves the deck, Back or
Escape again leaves the deck.

**The headline on that slide is not the user's.** There is still no description
of NT Square anywhere. "Torii, on campus." is what the photographs show, and
"Step IN. Stand OUT." is the tagline in the lockup on all nine of them. Replace
both when the real copy arrives. (The earlier set's one judgement call — a file
named `CLAUDE DAY 1 HR.jpg` whose printed card said **Day 2** — went with that
set.)

Torii's Trainings is a bookshelf (2026-09-15), built to a reference image the
user supplied rather than to anything in this deck: one frame, two zones, a shelf
between them. Above the shelf the trainings stand as books, the selected one
large and square on with the rest ranged to its right; below it, where the
reference puts a row of bestsellers, this puts **the selected training's own
information** — the one change asked for against that layout. A book is a
training, its cover carries the name, and white-into-red is the brief. Four ways
to change the selection, because a presenter's hand is not always on the mouse:
press a book, the arrow pill, the wheel, or the arrow keys. The search filters
the shelf as it is typed and lands on the first match.

It is a **new block type**, `training-shelf`, not a change to `book-shelf` — all
three decks share that one, so editing it would have rebuilt NGI's Academic
Programmes and NCET's Programmes as well. Both still hold their own, unchanged.

**The row is one eased offset in a rAF loop**, the way the skewed ribbon is, not
a CSS transition per book: a transition cannot be interrupted mid-flight without
jumping, and a wheel is nothing but interruptions. Same clock discipline applies
— `kick` must not reset `last`, or every frame is worth a nominal 16ms whatever
the browser actually spent, and the shelf moves at the speed of the machine.

**Never size a section's own zones as a percentage of its root.** A slide learns
its real height one frame after it is drawn — the root starts at the 860 fallback
and becomes `--slide-h` the moment FitSlide decides to fill, 900 on a 16:9
screen. Sized at 62%, the shelf and every book standing on it dropped 25px on
that frame; the deck's own `slide-in` entrance, half a second of it on every
slide in the deck, then carried the whole thing back up, so the page appeared to
drop, stick, and slide into place. Pinned instead to a fixed 533px from the top,
the extra height falls into the zone below the shelf, whose content is
top-aligned, and nothing moves: measured on arrival, the shelf is at 561 before
the height lands and 561 after it. This is the same family of bug as a root with
only a `min-height`, and it is worth checking on any section whose composition
has a horizon in it.

**A row that moves must be laid out by a continuous function of its offset.**
The first cut placed each book at `d × STEP` and then pushed it sideways by a
fixed 39px depending on which *side* of the front it was on — so a book crossing
the front flipped 78px in one frame, and the one arriving at the front made the
biggest move of its whole transition a second after the press, when the ease
finally landed on exactly zero. Measured per frame through one Next: book 2's
largest single-frame jump was 39px at 1030ms; book 1 lurched 68px on the first
frame where every other book moved 29. The row is now laid out the way a real
shelf is — each book's width follows from how near the front it is (smoothstep,
not a tent, so the growth eases at both ends) and its position is the sum of the
widths before it, with the front anchored by interpolating between two centres.
Nothing in that has a step, so nothing on screen can jump: every book's biggest
move is now its first frame (26–27px) and the gaps between books stay at exactly
26px throughout the motion. If a carousel "looks glitchy" and the numbers say it
is smooth, look for a `d > 0 ?` in the layout maths.

**What is highlighted must be where the row is going, not what it is passing.**
Read off the live geometry, a flick lit up each book as it went by and then the
landing moved the row under whichever one it stopped on — the shelf appearing to
correct itself a second after the hand came off, which is exactly how the user
described it. Everything on the slide now reads from `landing()`, which is
`Math.round(target)`: during a flick that is the book it will stop on, and
because rounding is idempotent the landing changes it by nothing at all.
Measured across a single notch, a ten-tick flick and a twenty-five-tick drag:
after the gesture ends the highlight changes 0 times and the information 0
times. The idle before the row lands came down from 170ms to 90ms with it, so
the landing reads as the end of the same gesture rather than as a second one.

**The red has to arrive early in the cover's gradient.** Held back to the last
third, every cover came out a pale pink card, and on the books behind the front
one — which are drawn at 74% — it read as no colour at all. It now passes 42% of
the tint by the middle of the board and reaches full at the foot, which is also
why the line at the foot is white rather than ink. Measured across the six
visible covers: colourfulness 121 to 153, and every one distinct.

**Under the shelf is a band, not a table** (2026-09-15). It began as four
labelled facts — track, length, level, mode — with an outcome list and a row of
tool chips beside them, all set small enough that nobody could read them from a
room and none of it what anybody is there to find out. It is now a hairline
across the zone and two columns under it: the programme's number and name on the
left, what it covers and its syllabus on the right. 52px and 22px, up from 30px
and 13.5px. Side by side because the zone is wide and shallow — stacked, a
paragraph set large enough to read runs out of height before it runs out of
words. The syllabus is one dot-separated line rather than a bulleted list: seven
subjects as a list is something to scroll, and as a line is something to read.
Measured across all seven, the deepest ends 91px above the presenter bar. The
search went with the facts; the covers still carry the kind of programme and the
size of its syllabus, which is where they belong.

**The shelf has a second state** (2026-09-15): press the front book — or the
band's Open — and the shelf closes around it. That book grows and travels to the
left of the slide and the right side carries everything about the programme, set
large: number and kind, the name at 66px, what it covers, and the syllabus as a
numbered list, "What we teach". If the programme has photographs they sit below,
as a justified wall reusing `justifyRows`, and the page scrolls down to them; if
it has none, the page does not scroll at all — `overflow: hidden` unless
`.has-photos`, and the wheel is swallowed. Back, Escape or the arrows while open
(which turn the page and move the shelf underneath so Back lands on the right
book) return it. Photographs are dropped in `incoming/Trainings/<programme
name>/`, one folder per programme, named exactly; the folders exist and are
empty, so nothing scrolls yet.

  - **The book's journey is a FLIP.** The big book is laid out where it will end
    up, given the transform that maps it back onto the shelf book's rectangle,
    and released a frame later; the stylesheet's 720ms transition carries it.
    The shelf underneath *fades* — never `display: none` — so on the way back
    the book can measure its way onto exactly the rectangle it left. Screen
    rectangles are in FitSlide-scaled pixels and the transform is in unscaled
    ones, so the distances are divided by the slide's scale first. Measured:
    +60ms the big book was at [284,91,328,470] on its way from the shelf book at
    [406,75,300,430]; settled at [58,120,380,545] with `transform: none`.
  - **The wheel steps one book per notch** now, gated on a cooldown the way the
    accordion's is — a burst of twelve trackpad events moved it one book, not
    twelve. Free fractional scrolling with a snap was what made it "look like a
    glitch"; one book per gesture is what was asked for.
  - **`highlights[]`** on a training is a slot for further points — what it is
    for, who it is for, what it ends in — drawn only when supplied. Nothing
    invented is in it; it is empty on all seven until the user writes them.

**The seven programmes are the user's own** (supplied 2026-09-15): Ninja, Ninja
Plus, Ninja Pro, AI Ready Engineer, Industry Readiness Program, LaunchPad and
Skill Sprint — with their kinds and their syllabuses, 25 subjects across the
seven. The descriptions are written from those syllabuses and from nothing else:
no duration, no cohort size, no pass rate and no outcome appears anywhere,
because none was supplied. The only derived value on the slide is the line at the
foot of each cover, which counts the syllabus rather than restating it — "7
subjects" beside a list of six is the kind of disagreement nobody notices until a
room does. The section's intro card read "Programmes" until 2026-09-15 — NCET's
name, on the title card shown before the slide — and was then removed outright on
request, so the slide arrives directly.

Torii's Project Week is a photo collage (2026-09-15), built to a reference image
the user supplied — the NOIR layout: copy in the left third, a staggered collage
of nine cards rising toward the right edge, four short arrowed lines set into a
gap in the collage, one ink pill. Nine photographs from
`Downloads/TORII/project week`, re-encoded from PNG to JPEG at 1,600px (11.3MB
becomes 1.3MB) and filed under `uploads/ProjectWeek/`. The reference is black and
white; this keeps the photographs in colour and takes ink, button and accent from
Torii's own palette — the measured `#F05D29` is on the arrows and the eyebrow's
mark and nowhere else.

**Nine fixed slots, dealt in order.** The geometry is written into the component
in canvas pixels, taken from the reference's proportions, so the publisher's
order IS the layout. Each photograph was matched to a slot near its own shape
where possible — the wide hall shots to the wide cards, the two-person shots to
the square ones — and the two tall cards take pictures with a strong vertical
subject and a `focus` (an `object-position`) that keeps it in frame. A card is a
window on its photograph and the whole picture is one press away in the shared
viewer; same trade as NT Square's fan.

**Every card has its own entrance.** Five motions — rise, a slow drift with a
settle of scale, a slide from the side, an unfold, a sink from above — each slot
naming one with its own delay (80–840ms) and duration (900–1500ms), so the
collage assembles rather than fades in. Measured 700ms in: opacities from 0 to
0.95 across the nine. The hover lives on an inner face so it never fights the
entrance for the same transform.

**Soft blobs behind it**, in the organization's two measured colours — the
orange off its mark and the red off the polo in its team photographs. Two things
this cost, both worth knowing:

  - **`@keyframes` names are global.** `pc-drift` was already a card entrance in
    this same stylesheet, and giving the blobs an animation of the same name
    handed them the card's keyframes: they were faded from 0 to 1 across
    forty-four seconds and had their centring `translate(-50%, -50%)` replaced
    by `transform: none`, so they sat half a width off and all but invisible.
    Measured opacities before the rename: 0.013, 0.32 and 0.54 against the 0.07,
    0.055 and 0.06 set on them. Prefix a keyframe with its own component *and*
    its own purpose — `pc-blob-drift`, not `pc-drift`.
  - **Put a blob where the ground is visible, not where the content is.** The
    first placement centred them under the collage, which is exactly where nine
    photographs are: one sample point in seven moved at all. They sit now in the
    band above the collage, the column beside the copy and the right edge.

  Measured by differencing the rendered slide against itself with the layer
  hidden, over every pixel that was pure white: 83% of the ground is now tinted,
  by a mean of 5.0% below white, 12.1% at the strongest point. Guessing sample
  points found one; differencing the frame found all of it.

**The slide keeps going under the collage** (2026-09-15). Sixteen further
photographs arrived in `Downloads/TORII/Torii/Torii/Events/Project Week`, and
the brief was that the collage stays the landing and the rest come up under it
as the presenter scrolls, each opening full size. So `photo-collage` gained
`more[]` (≤60, same shape as `photos`, `w`/`h` required) and the root became
the scroller: a `.pc-stage` of exactly one screen — `height: 100%` of a root
whose height is definite, so the wall begins at the fold on the canvas *and* in
the room, and because everything on the stage is top-anchored in px, the stage
growing 860→900 on arrival moves nothing — then `.pc-more`, a justified wall
off `justifyRows` (1480 wide, rows aimed at 300, the collage's 16px gap). Tiles
fade up on an `IntersectionObserver` whose root is the scroller, not the
viewport — inside FitSlide the viewport is the wrong frame — and stay up, so
scrolling back does not replay the wall. The pill scrolls to the wall now
rather than opening a viewer over it (with no wall it still opens the viewer),
and an outline pill at the foot returns to the top. The viewer holds all 25,
collage first, so the arrows walk the whole set from any picture. Measured:
stage = root = 900 presenting, wall top 900, 0 tiles seen before scrolling,
16/16 after; five rows, every full row ends at 1540; worst tile aspect
deviation 0.11%; the tail of two centred; the last row clears the bar by the
wall's `--deck-bar-clear` padding. The sixteen are JPEG already, 800–1920 wide,
2.8MB together, and are copied as they are as `m01.jpg` on, in filename order —
timestamps, so the order taken. No caption is written on them.

**An eased scroll must move a whole pixel or land.** `scrollTop` is kept in
whole pixels, so `cur + (target − cur) × 0.22` asks for less than a pixel once
it is inside ~4.5px and gets none — the pill stopped 2px short of the wall,
Back to the top stopped at 2, and the rAF loop spun for ever on the residue.
Inside a pixel of the target the loop now sets the target and stops; a step
under a pixel is made a pixel. The Trainings page's photo scroll had the same
loop and the same latent stall and was fixed with it.

**The copy on that slide was written from the photographs**, at the user's
request, and from nothing else: numbered Project Week tent cards (05, 23, 24,
27, branded Torii with an AWS "Cloud Foundation" label), chart-paper blueprints
whose titles are legible (Google Cloud Fundamentals, Student Attendance Tracker,
Wheel N Deal), laptops, Torii mentors in red at the tables, a full hall. No count
is stated — "at least 27 teams" would be an inference off a tent card — and
nothing is claimed about outcomes. Replace it when the user's own words arrive.

Torii's Project Street is a film and a thread board (2026-09-15), a new block
type `thread-board`, built to a reference image the user supplied: a pale sheet
of graph paper, a headline top-left, numbered white cards leaning a few degrees
each way, a dashed thread running pin to pin between them, and a handwritten
sign-off where the thread ends. The reference reads down a page and its cards
carry copy; this reads across the slide — the cards alternate high and low
along a horizontal band and the thread weaves through the corridor between the
rows — and each card carries one photograph and its running number. Two screens
stacked: the folder's film first, full-bleed and muted, with the section's name
over it; the board one screen down. Thirty-two photographs and one 1m 11s film
from `Downloads/TORII/Torii/Torii/Events/Project Street`, all copied as they are
into `uploads/ProjectStreet/` — every one is JPEG at 1920 or under and the film
is fast-start MP4. `Main project .jpg` is card 01 because it is the one with the
event's own title set into it; the rest follow in filename order, which is the
order they were taken.

**Both axes are one eased loop.** `pageY` (film → board) and `bandX` (along the
thread) are two targets in one rAF, written as transforms — never scrollTop,
never `scroll-behavior: smooth`, never a transition per card. The wheel turns
the page down from the film; on the board it drives the band; turned back at the
very start of the band after 450ms of stillness it returns to the film — the
stillness is what stops a trackpad's tail from bouncing a presenter back up the
moment the band reaches its start. For 700ms after a page turn the wheel is
ignored, or the inertia that turned the page would scroll the board before
anyone has seen it. The film pauses when the board has settled and resumes on
the way back; there is no point decoding a screen away.

**The thread reveals itself in order, and a dashed line cannot be drawn with a
dash offset.** Each segment is its own `<path>` and is *uncovered* instead:
`clip-path: inset(-6px 100% -6px -6px)` → `inset(-6px)`, transitioned. The
reference box of a clip on an SVG element is that element's own bounding box,
which is exactly the segment. A card is revealed in two beats — its segment
draws (560ms), then it fades up onto its pins — and reveals queue: on the first
showing at 640ms a card, the pace of a thread being followed; afterwards, as
the band brings cards in, at 240ms, so a presenter scrolling is never waiting
for the line. Nothing on the board reveals until the board is 40% into view,
and the board's headline is *built* at that moment rather than at mount,
because the letter reveal lives on the element and would have played to nobody
one screen up. The film's title reveals at mount; it is the first thing seen.

**A card is as wide as its photograph is at 200px tall** — 228 for a square,
356 for 16:9, 294 for 4:3 — so nothing is cropped (measured 0.15% worst). At
250 tall only two cards fit the first screen and the board read as empty; at
200, three, the third half in, which is what invites the scroll. The band is
clipped at x=500 with a 130px mask fade, so a card passing behind the copy
dissolves rather than being cut.

**Escape in the viewer used to leave presentation mode, and an arrow in the
viewer turned the slide underneath.** `Lightbox` and `PresentPage` both bound
the same keys on `window` in the bubbling phase, so both fired — a bug every
gallery had. `useShortcuts` took an `exclusive` option: the handler binds in
the capture phase and stops propagation, so a window listener in the bubbling
phase never sees the key. The viewer uses it. Found on this slide, fixed for all.

**The copy on that slide was written from the photographs**, and from nothing
else: teams presenting mini-projects on chart paper set on easels along the
campus walkway — an enrolment dashboard, a course-demand forecast, a
complaint-tracking system, a food-ordering app — Torii mentors in red reviewing
them, a crowd at each board. "Step IN. Stand OUT." on the sign-off is the
tagline in the Torii lockup on every photograph. No caption is written on any
card. Replace the words when the user's arrive.

Torii's IT Development is the Project Showcase (2026-09-16), a new block type
`project-showcase` and a port of a page the user supplied — kept rule for rule,
class name for class name. A 1920x1080 canvas cover-fitted into the slide: paper
"files" on the left that open one at a time and drop the rest into a dock, a desk
rig on the right whose monitor is put in perspective by one `matrix3d`, and the
open project's name set 300px behind it, swapped character by character. It
replaced the `platforms` block that branch had put there; NGI and NCET keep
theirs.

**What a supplied page has to give up to live in this deck, and nothing more.**
Four changes, all forced:

  - **Scope.** The original styles `:root` and `.hero`. `:root` there sets
    `--ink`, `--line`, `--card`, `--font`, `--mono` and `--orange`, which are
    this deck's own variables, and `.hero` is this deck's full-bleed hero block —
    dropped in as written it would have restyled every other slide. Everything
    is scoped under `.ps-root`; every inner class name is the original's, so the
    markup is unchanged. The keyframes are prefixed `ps-` for the reason this
    stylesheet already learned once: `@keyframes` names are global.
  - **No web fonts.** The Google Fonts link is gone — there is no internet at
    presentation time. Inter and JetBrains Mono are still named first in the
    stacks and fall through to the system faces the original already listed.
  - **The arrows are stopped, not only prevented,** and bound to the root rather
    than to `document`; a `pointerdown` anywhere on the slide focuses the root so
    they are armed. Without it the original's `document` listener walked the
    projects *and* turned the slide.
  - **The dock is lifted off the presenter bar.** It rests at y=934 of 1080,
    which is exactly the band the bar floats over; presenting solves
    `--ps-dock-top` from the bar's real height. Measured: 909 instead of 934, and
    the dock's bottom edge 790 against a bar at 804 — it was 7px under before.

**A custom property holding a `calc()` cannot be read back with `parseFloat`.**
`--deck-bar-clear` is `calc(96px / var(--slide-scale,1))`, and
`getComputedStyle(el).getPropertyValue('--deck-bar-clear')` hands back that
unresolved token string, not a length — `parseFloat` of it is `NaN`, which
silently became a lift of zero. The value has to be given to a real property
before the browser will resolve it: a hidden zero-width probe with
`height: var(--deck-bar-clear, 0px)`, read as `offsetHeight`. Any section
needing that clearance as a *number* rather than as CSS has the same problem.

**"Open website" puts the site in the monitor, live.** A project may carry a
`site`; the button in the opened file's header swaps the screen's `<video>` for
an `<iframe>` inside the same `.screen`, so it inherits the monitor's
perspective transform and is driven from the slide — verified with a real
pointer press through the transform, not just a synthetic click. Pressing it
again returns to the film. Two things to know before a real URL goes in: there
is no internet in the room, and most sites refuse to be framed at all
(`X-Frame-Options`, `frame-ancestors`). A copy served from `uploads/` always
works; a public URL may not.

**The shelf is the Platforms block's own content, read rather than retyped**
(2026-09-16). The seven files are the "Built to Deliver" panel's five products,
with AI Engineer LMS and TAG each appearing twice because each has a portal and
an admin console in its `views` — the same seven rows, and the same login counts
(1, 1, 1, 2, 2, 3, 2), that panel lists. `publish-it-development.cjs` reads the
block off **NGI**, since Torii's own copy is the thing this slide replaced.
Each file plays the screen recording that already existed for that product in
`uploads/platforms/<shot>.mp4`, and "Open website" opens the product's real URL.
Checked 2026-09-16: all five hosts answer 200 and none sends `X-Frame-Options`
or a `frame-ancestors` policy, so they frame; `--mocks` writes offline stand-ins
instead, for a room with no internet.

**Credentials are carried and never drawn.** Each project takes the demo
`logins` from the same source; the detail sheet shows the role and two buttons
that put the username or the password on the clipboard. That is `Platforms.js`'s
rule — a password on a three-metre screen is a password given away — and the
check asserts it, scanning the rendered slide for all eight known values.

**A `.state` card at `opacity: 0` still eats every click.** The two cards that
say "Select a project" and "Demo is being prepared" are `position: absolute;
inset: 0` over the screen and are only faded out, and a transparent element is
still hit-testable — so with a live site in the monitor, `elementFromPoint` at
the centre of the screen returned `.orb` and not one click reached the product.
They carry nothing interactive, so they take `pointer-events: none` outright.
The original page never had anything clickable in that screen to notice it.

**The monitor is as large as the slide allows** (2026-09-17, after "it's not
that clear"). The rig went from `scale(1.7)` at `translate(690px,-76px)` to
`scale(2.1)` at `translate(600px,-300px)`: the screen is 1055x739 of the
1920x1080 canvas where it was 854x598 — 879x616 nominal, 23% wider — and it sits
150 canvas pixels higher with its right edge 155 further right. Three things
bound those numbers and were measured before choosing them, not after: the left
column of files and the detail sheet end at canvas x=756, so the screen's left
edge must stay past 780 (it is at 828, 60 nominal px clear); the canvas is 1920
wide, so the right edge must stay inside 1900 (1883); and the presenter bar
covers the last 138 canvas pixels, so the bottom must stay above 942 (827, 116
nominal px clear). What it cost: the desk slats now begin at canvas y=938 rather
than 926, so they read as a strip behind the bar rather than a band under the
monitor — the trade taken, since the monitor is what the slide is for.

**And the site inside it is laid out at 1280, not 1440.** The rig's scale makes
the screen bigger without giving a site more room — the `.screen` is 503x338 CSS
pixels whatever the rig does to it, because a transform is not a layout. So the
other half of "not that clear" is the viewport: at 1280 a site still lays out its
desktop breakpoint and gets 12% fewer CSS pixels to do it in, which is 12% larger
type inside the same box. With the rig's 23% that is about 39% larger than
before. Measured: laid out at 1280x860, scaled 0.393, filling the screen to the
pixel.

**The monitor shows a recording whole and a site at laptop size** (2026-09-16,
after "it was cropped… and the website was zoomed up"). The screen recordings
are browser-window captures at about 1.95:1 and the monitor's screen is 1.47:1,
so `object-fit: cover` — right for a photograph filling a card — cut a quarter
off both sides of every film. A recording is now `contain` on a screen that goes
near-black behind it (`.media--video`): 100% of the frame, 66px of letterbox
top and bottom, the way a monitor actually plays a wide film. And the iframe
used to be the screen's own 503x338 CSS pixels, magnified 1.4x by the rig and
the canvas — so a site laid itself out for a 503px viewport, its narrow
breakpoint, and that was then blown up. It is now laid out at a laptop's 1440
wide (the height follows the screen's ratio, 968) and `transform: scale(0.3493)`
brings it into the screen: the desktop layout at the size it has on a desk,
still live, with pointer events mapping through the transform. Measured: the
scaled frame fills the screen box to the pixel. The screen is measured, not
assumed — the monitor's bezel padding takes 13px of the 516.

**The badge is the product's logo now** (2026-09-17, on request). The design
draws a 40px orange disc with the product's initial, and that is still what a
project with no `logo` gets. The user supplied five logos in
`Downloads/TORII/It Development logos`; they are filed under
`uploads/Showcase/logos/` with plain names, mapped by product name in `LOGOS` in
`publish-it-development.cjs` (the two views of one product share one), and drawn
on a white plate: 40px tall like the disc, shrink-to-fit up to 118px wide, the
mark contained with 5px of air, a hairline so the plate reads as a plate on the
paper. 118 is the room the card has — 200 wide, the plate starts at 22, the
dog-ear fold takes the last 46.

  - **Size the mark by height, and nothing else.** The first rule was
    `width: auto; height: 100%; max-width: 100%`, and it measured 100x53 on a
    1.89:1 mark inside a 30px-tall content box: the percentage max-width resolved
    against the plate, the width won, the height followed the ratio out of the
    bottom of the plate, and `overflow: hidden` cut it — which on screen was
    "coder" and the bottom of "t@g" missing. `height: 30px; width: auto;
    max-width: none` gives every mark its own width (55 to 102px) and every
    plate wraps it (73 to 118px). Measured: no image overflows its plate.
  - **One of the five needed a crop.** `AI ready engineer logo.png` is a
    4500x4500 canvas with the mark in a 3,586x996 band across its middle and
    transparent everywhere else; contained in a 30px-tall box it would have been
    a 9px sliver. The ink was measured (x 455–4041, y 1794–2790), cut with 40px
    of air by `crop-image.cjs` at 0.125% ratio drift, and written to PNG at 900
    wide so the transparency survives.

The older `platform-logos/` wordmarks are not used here; three of those are
unreachable anyway under the names the Platforms data uses (`owlcoder.png`
against `Owl Coder.png` on disk).

**The descriptions, features and stacks are still placeholders**, written from
the one-line blurbs the Platforms block carries and from nothing else. `COPY` in
the publisher is the one place to change them.

**Torii's rows are in the order the user asked for** (2026-09-17), set by
`tools/order-torii-rows.cjs`, which posts the whole id list to
`/orgs/:id/sections/reorder` — an endpoint that refuses a list holding another
organization's section, so it cannot reach NGI by accident. Thirteen rows were
named: Executive Summary, CEO Profile, Team, Trainings, Centers of Excellence,
Certifications, Placements, Torii Connect, Project Week, Project Street, NT
Square, Beyond, IT Development last. Two were not, and the script's header says
where each went and why — **Organization Snapshot** after Team (the bridge from
who Torii is into what it does) and **AI Ready Engineer** after Trainings (a
programme, beside the programmes shelf).

**Amended the same day: Placements and Events go after Beyond.** Events had been
placed before Torii Connect, on the reasoning that Torii Connect, Project Week,
Project Street, NT Square and Beyond are Torii's own occasions and Events is the
general one; the user moved both record rows to the far side of that run
instead, so it now reads summary → people → programmes → credentials → Torii's
own occasions → the record → IT Development. Events keeps its place beside
Placements rather than being re-derived: the two were moved together, so they
stay a pair in the order they were in. IT Development is still last, which is
the one position the user has now named twice. The four switched-off rows are
parked after it, so switching one back on puts it at the end rather than in the
middle of a sequence somebody chose. A key is not a title here and the script says so twice: Team is keyed
`leadership-journey`, Centers of Excellence is keyed `team`, Events is keyed
`achievements`, Video Resumes is keyed `testimonials`.

**A walk of the deck has to press until the slide actually turns.** `advance`
gives the slide's own steps first refusal, so a block with beats of its own eats
the press — AI Ready Engineer's course deck takes six before the deck moves. A
harness that presses once per slide and gives up when the hash does not change
reports the deck ending four slides early, which is a bug in the harness and not
in the deck; press the dock's Next tab instead, or keep pressing. Measured
either way: 16 slides, in the order above, IT Development last, and the
seventeenth press comes back round to Executive Summary.

**And a check's own regex can invent the bug it reports.** The pane check read
each row's `title` through `.replace(/\s+/g, ' ')` written inside a *template
literal*, where `\s` is not an escape sequence and collapses to a bare `s` — so
the expression the page actually ran was `.replace(/s+/g, ' ')`, which deleted
every lowercase "s" from every label it read. It reported the order as a
mismatch and printed "Organization Snap hot · Training · Center  of Excellence"
as the evidence, which reads exactly like the letter-spacing artefact this brief
already warns about, and sent a second investigation after a bug that was in the
harness. A `title` holds no runs of whitespace and never needed normalising.
Inside a template literal every backslash meant for the page has to be doubled;
better still, do not put a regex there at all.

## The review of 2026-09-17

Sixteen numbered changes arrived from the reviewer with a standing instruction:
make exactly these and nothing else. Fourteen were made, verified in headless
Chrome and are recorded here; two could not be located and were left, and are
recorded here too so nobody hunts for them twice. The content side is
`tools/apply-review-2026-09-17.cjs`, one PATCH per row, backed up first; the
title cards went through `publish-section-intros.cjs --clear` and the order
through `order-torii-rows.cjs`. The server had to be restarted for the two
schema fields below before the data would take.

**Rows: About first, Organization Snapshot fifteenth, Placements after.** The
review named fifteen rows in order and did not name Placements; nothing may be
removed, so Placements follows the fifteen. Measured: the pane reads About · CEO
Profile · Team · Trainings · Centers of Excellence · Certifications · AI Ready
Engineer · Torii Connect · NT Square · Project Week · Project Street · Beyond ·
Events · IT Development · Organization Snapshot · Placements, and the arrow key
walks all sixteen and comes back round. "Executive Summary" is retitled "About"
on Torii; NGI's row keeps its name.

**The title cards are off, on both decks.** `intro` is empty on all 37
sections. The late-mount machinery in `SlideView` is still there and inert: with
no card there is nothing to hold for, and the content is built at once. Measured
at 0.5s after arrival: no card, content up.

**AI Ready Engineer** lost the frames "What the campus gains" and "Step In.
Stand Out." (five frames to three, plus the cover the component draws) and its
"What a student walks away with" frame gained a fifth card, **Claude
Certification**, carrying the Claude Certified Architect badge. That needed a
field: a course-deck card may now carry `logo`, a path under `/uploads`, and
`.cd-card__mark.has-art` shows it in the disc instead of the line icon. The
badge is the user's own `Downloads/claude badge.png`, filed as
`uploads/Claude/claude-certified-architect.png`; `claude certification.png` in
the same folder is a poster, not a mark.

**CEO Profile** gained one line under the existing paragraph, on its own line
via the `\n` the body's `inlineRich` already honours: "12+ years of experience
in IBM and Wipro. 10+ years of entrepreneurship experience." Nothing above it
changed.

**Team** opens on Sudhir, Bhargava, Harshavardhini, Naveen, Abraham; the other
nineteen follow in their old order. The review spelt two of them Sudheer and
Bhargav; the stored names are the filenames the portraits arrived under and were
not changed, since renaming was not asked. **The ten Claude Architect Certified
Trainers** the review says must be present are `Downloads/claude trainers
images/trainers/`: akhilesh, azar (Azarunnisa), bhargav (Bhargava), bobby,
harshavardhini, manikanta, naveen, peter, prashat (one of the two Prasanths),
sudhir — every one already among the 24 members, none duplicated. Nothing was
changed for that item and nothing needed to be; no trainer carries a label
saying so, because none was asked for.

**Centers of Excellence** opens Snowflake, Claude, AWS Academy, Oracle Academy,
Red Hat, GitHub, Cisco Networking Academy, o9, then the other twelve as they
were. The **Photos & videos option is gone** from this section only: the card's
foot no longer says "Photos & videos" (or a count), and an opened centre shows
the mark, the name and its line above the rule and nothing below — `mediaTile`
and the player parameters stay in the file for the day it is wanted back. That
leaves an opened centre mostly empty, which is what was asked for and is noted
here rather than filled.

**Project Street's film begins at 0:13**, and the join is invisible. A
thread-board may carry `videoStart`; the component opens the file at that point
(`#t=13` on the src, a `loadedmetadata` seek behind it because a fragment is
advisory), takes `loop` off since it always returns to zero and repeats from the
offset on `ended` instead, and holds the element at opacity 0 until it is at the
offset and playing, then eases it in over the film's own dark ground. Measured:
at t+300ms the film is at 13.08s and half-way through its fade, at t+700ms at
13.48s and fully up; no frame before 13 was ever painted.

**Beyond** now opens on the group photograph the review supplied. That file was
already in the section — it is `Beyond/beyond-boundaries/01.jpg`, 2048x1151, the
first shot of the "Beyond Boundaries" group — so "add it" meant making it the
card the fan opens on: the Beyond Boundaries group moved to the front and the
filters read All · Beyond Boundaries · Shine Mode · Code Fall. Measured at 1.6s:
the front card is 01.jpg; the fan then turns one card at a time as it always
did.

**Certifications** takes the same photograph as its register backdrop, in place
of `certifications/register-crowd.jpg`, through the existing `.cs-reg__back`
treatment untouched (38% opacity, half saturation, the Ken Burns drift, the
scrim). The 3,120 and the four year figures stay legible over it; the poster's
own "BEYOND BOUNDARIES" lettering reads faintly through the scrim behind the
count, which is the photograph as supplied.

**Organization Snapshot loads every tile with the slide again.** The staged
load that stood for a few hours — sixteen tiles a column eager, the rest
trickled in — was measured smooth and was wrong for the room: the plane is
centred, so what is on screen on arrival is the *middle* of each track, not its
head, and the tiles in view were the ones still waiting their turn. That is the
lag the review saw. Every tile carries a `src` from construction now; the other
gains (flat tiles, two copies, FitSlide's debounce) stand. Measured at 1s: 766
of 766 decoded, 32 of 32 on screen.

**Two items could not be located and were left as they were.** Item 4, remove
"(Done)" from every Centers of Excellence card: the string is in neither the
stored data, the hydrated API response, the component, the stylesheet nor the
rendered slide (orbit, cards, opened centre all read), so there is nothing to
remove; the only "Done" in the deck is "Certifications Done", a label on the
Certifications grid. Item 12, add NGI and NCET "in the comments": nothing in
either deck is a comments area, and the only NCET mentions in Torii's copy are
About's "Technical partner to NCET", Beyond's lead and IT Development's TAG
descriptions. Both need the reviewer to point at the screen.

**Only Torii shows, and Placements is off** (2026-09-17, after the review:
"I just want Torii ones"). Two switches in `context/appStore.js`, both code,
both reversible by deleting a line:

  - `HIDDEN_ORGS` lists `technical-hub`. `loadOrgs` drops a listed id as the
    organizations arrive, so the pane's tab strip, the organizations page and
    the router never see it: the strip draws Torii alone, and a direct URL to an
    NGI section bounces to `#/orgs`. The organization and all seventeen of its
    sections stay in the store, whole, and every NGI tool still works against
    the API. This is the same idea as `HIDDEN_ROWS`, one level up, and it is
    deliberately not a delete — NGI was the deck everything was built on.
  - `placements` joined Torii's `HIDDEN_ROWS`. Fifteen rows show; the deck bar
    reads "/ 15"; the arrow key walks all fifteen and comes back round.

**The Certifications photograph is framed on the students** (same day: "move it
up, I can't see the students"). The backdrop box shows 43% of the picture's
height, and at the shared `object-position: center 30%` that band fell on the
poster's lettering. `[data-org='torii'] .cs-reg__back img` sets 72%, which shows
source rows 517–950 of 1151 — every row of faces (about 560–800) inside it, the
title out of frame. Torii only; NGI's backdrop is a different photograph framed
for 30% and is untouched.

**The second pass of the review** (`tools/apply-review-2026-09-17b.cjs`, same
discipline: one PATCH per row, backed up first, and the server restarted for the
two schema fields it needs).

**Sign out is no longer beside Present.** It sat in the top bar's action row,
immediately right of Present, on the reasoning that a presenter's hand is
already there when they have finished — which is precisely why it was the
easiest control in the deck to hit by mistake while reaching for Present, and
being signed out in front of a room is not a recoverable slip. It is gone from
that row. The control in the navigation pane's head stays, and that head is
drawn whether the pane is open or collapsed to its rail, so nothing is stranded.
Measured: the top bar now holds Previous tab, Next tab, Present and nothing
else; the remaining control is 1,262px from Present. Both were already hidden
while presenting, so this is about the editing view, which is where the deck is
driven from between runs.

**The register drops a badge that is a photograph of a badge.** Four of Torii's
fifteen were cropped from cohort cards and carry what was behind them — a brick
wall, a dark plate, a green sheet, a brown bar — and on the register's clean
sheet they read as stickers. They are not a hand-picked list: every badge in the
block was measured for whether its four corners are opaque, and exactly those
four are (0% transparent), while all eleven others are transparent artwork. A
credential now carries `onRegister`, and `badgeArt` takes an `ignoreBadge`
argument that only the register's pin passes — so the arcs draw the vendor's
two-letter mark for those four, and **Skills Unlocked draws every badge**, which
is what was asked. Measured after: 42 pins, 26 artwork, 16 in type, no
photographic file left on the arcs; the Skills grid shows all fifteen
credentials with all four photographs among them and nothing broken.

**The CEO's two experience lines are figures now, not prose.** They were
appended to the body paragraph in the first pass and read as more of the same
sentence. `leader-hero` takes `highlights` — up to three `{ value, label }` —
drawn under the social row: a hairline above, an accent rule beside each, the
figure in the display face in `--accent-ink` at 25px and its line in the body's
grey. The words are the reviewer's own, split into a figure and its description.
Measured: two marks, 40px below the social row, and the numbers are out of the
body.

**The brand mark on that slide is the real logo now** (2026-09-17). The supplied
page drew the gate with CSS borders — `.ps-root .brand i`, a 22px box with a 3px
orange border and a dark bar — which is a fair likeness and is not the mark: the
real one carries an orange starburst above the bar. `project-showcase` takes a
`logo` path under `/uploads`, unset falling back to the drawn gate, and Torii's
block points at `snapshot/torii-logo.png`, the same 420px alpha crop the drift
wall and the Centres of Excellence hub already use. It is drawn in a **28px**
box, not 22: the file's ink runs 54–366 across and 45–374 down of its 420px
square, so it is 78.6% of the height, and at 22px the gate would have stood
about three-quarters of the size it replaced. Measured: 28x28 canvas px at
canvas 96,64, the position the drawn one held.

**IT Development is the five products asked for, plus three named ones.** Portal
only — MYNA, Torii Minds & JPath, OwlCoder, AI Engineer LMS, TAG — with the two
admin consoles dropped, and **Loop**, **AI Anchor** and **Hibi** added by name
with nothing else, because nothing else was supplied. Each shows the design's
initial disc (as every file did before the logos arrived) and the monitor's own
"Demo is being prepared" card. The reviewer said "add two more" and then named
three; all three are in, because a name that was said is a name that was wanted
and removing one is a line in the tool, while a missing one has to be asked for
again. Two notes for when the logos land: `LOGOS` in
`publish-it-development.cjs` is where a logo path goes, and a project's
description, features and stack are still empty — **the detail sheet now hides a
heading with nothing under it**, which it did not before, because "Key features"
and "Built with" over empty space is what a project added by name alone looked
like.

## Every tab announces itself

**A title card on every row, in each deck's own colours** (2026-09-17, on
request). The mechanism already existed and four of NGI's pages used it: a
section carrying a non-empty `intro` gets `slide--intro` in `SlideView`, which
lays the string full-screen over the slide, revealed letter by letter, and
publishes `--intro-hold: 3s` that every entrance animation on that slide adds to
its own delay, so the page behind arrives only once the card has gone.
`tools/publish-section-intros.cjs` now sets `intro` on all 37 sections in both
decks, and `--clear` takes them off again.

**The card says the row's own title**, not a second name written into the tool.
The pane, the dock's Next tab button and the card all say one thing, and
renaming a row renames its card with nothing else to remember.

**White, with the deck's colour as the type** (second cut the same day, on
request: "no background colour, white background and colour for the text").
The first cut set each card on the deck's own dark colour with light type; what
was wanted was the reverse. The colours come off `data-org`, which `applyTheme`
already stamps on the root, so neither the slide nor the section needs a field:

| deck | ground | type | measured |
| --- | --- | --- | --- |
| NGI and NCET | white | its green, `--nav-accent-ink` | 5.1:1 |
| Torii | white | its orange `#F05D29` | 3.3:1 |

Torii's 3.3:1 is under the 4.5:1 body-text floor and above the 3:1 large-text
one; this type is 160px, revealed letter by letter, on screen for three seconds.
Torii's orange is the value measured off the gate in the brand film, not the
older `#E95A22` in the palette table.

**The page is not built until the card is most of the way through.** The
request was "after the text, I want the entrance animation": with every tab
carrying a card, the arrivals were playing out *behind* it and were over when it
lifted. `--intro-hold` was the first answer to that and it only ever half
worked, because a CSS delay is honoured only by the entrances written to read
it — a JS arrival (an IntersectionObserver reveal, a rAF ease, a letter reveal
with `trigger: true`) fires the moment its element exists, and under an opaque
card that is to nobody. So `SlideView` now mounts the canvas late: at 66% of the
card's run, read off the card's own computed `animation-duration` so
reduced-motion's shorter card mounts proportionally earlier. The card holds
opaque to 76%, so the entrances begin a beat before the fade and are arriving as
it lifts. `--intro-hold` is 0 now and stays as a variable so the existing
`calc(var(--intro-hold, 0s) + …)` staggers keep working. Three things this
needed:

  - **The slide has to hold its own height while it is empty**, or the card,
    which is `inset: 0` of the slide, is a strip a few pixels tall. `is-holding`
    gives it `min-height: var(--slide-h, 860px)` until the content lands.
  - **`FitSlide` has to fit again when the content lands.** What it measured at
    mount was a card over nothing. `SlideView` dispatches `slide-content` on the
    slide and `FitSlide` runs its whole opening pass again on it — hooks the new
    images, fits, settles. Measured: `--slide-h` 900px before and after.
  - **The mount is guarded on the slide still being in the document.** The deck
    rebuilds on every navigation; a slide left before its card finished must not
    build its blocks — and register their steppers — into the slide that
    replaced it.

Measured on Project Week: at 1.0s no content built; at 2.1s nine collage cards
at opacity 0; at 2.5s, card at 0.17, cards at 0 to 0.87; at 2.9s all arriving;
settled by 4.6s. On Organization Snapshot, which now builds its 5,411 nodes
under the card, the card runs at 6.9ms a frame with one 431ms spike at the
build — on a static, opaque card, so nobody sees it — against 14.2ms before.
The full Torii deck still walks end to end on the arrow key.

## Sixty frames a second, measured

**The deck was asked to feel like film** (2026-09-17). Measured before anything
was changed, at 1600x900 in headless Chrome whose own frame is 6.9ms: scrolling
was already perfect on every slide that scrolls, and so was every slide's idle
frame time, except two. Organization Snapshot ran at **41.6ms a frame** (24fps)
with six long tasks, the worst 276ms, took 449ms to arrive and then ran its first
second at 152.8ms a frame. Certifications ran at 13.9ms with 25 frames over 20ms.
Everything else was already at the display's own limit.

**Ablate before optimising.** Each suspected cost on the drift wall was removed
on its own, on a fresh load, and the slide re-measured:

| what was removed | idle frame time |
| --- | --- |
| nothing, as it was | 48.7ms |
| `saturate(0.92)` from all 1,149 images | 48.5ms |
| the 0.42s transitions on tile, image and scrim | 48.6ms |
| the hover `box-shadow` | 48.7ms |
| `transform-style: preserve-3d` from the tiles | **20.9ms** |
| one of the three copies, 1,149 tiles to 767 | **27.7ms** |
| the last two together | **13.9ms** |

Three of the five obvious suspects cost nothing measurable and all three are
still there. The two that mattered are both fixed:

  - **`.dw-tile` is flat now.** Nothing inside a tile was ever at a different
    depth from the tile itself; the only Z was the hover lift. `DriftWall.js`
    converts the block's `lift`, a distance in px toward the viewer, into the
    scale that distance produces at the wall's own perspective and publishes it
    as `--dw-lift-scale`, so the field keeps its meaning and the tile keeps its
    look. `.dw-wall`, `.dw-plane`, `.dw-col` and `.dw-track` keep their 3D, so
    the columns still stand in space and still turn with the pointer.
  - **One spare copy, not two.** A column shows no seam as long as its track is
    one visible column taller than the run it wraps on, which is
    `ceil(visible / copyHeight) + 1` copies. The old `+ 2` with a floor of three
    was a whole copy more than the wrap can need: 383 images and about 2,700
    nodes on this slide.

**`loading: 'lazy'` does nothing inside a 3D wall, and only a measurement showed
it.** All 767 images decoded within a second of the slide mounting while 35 were
ever on screen: the wall sits in a `perspective` container that is rotated and
translated, and the browser resolves every tile in it as in-viewport. The near
sixteen tiles of each column now carry a `src` and the rest carry the URL on the
element, promoted four every 120ms. A trickle, not a burst, because the wall has
minutes before it needs any of them: a column drifts a few dozen pixels a second
over a track around 20,000px long. The `load` listener has to be attached at
promotion, not before, because **an `<img>` with no `src` reports
`complete === true`**, so the earlier pass skipped every one of them and nothing
would have re-measured the columns as they landed.

**`FitSlide` refit once per image, and that is what made changing tab stack.**
`schedule()` collapses everything asked for within one frame into a single fit,
which is right for a resize and wrong for images: they land across hundreds of
*different* frames, so a slide with a lot of them refits on nearly every frame
for as long as they stream, and a fit clears the height and reads `scrollHeight`
back, a forced synchronous layout of the whole slide. Image arrivals now go
through `scheduleQuiet`, a 120ms trailing debounce. This was never a drift-wall
problem: it fixed Certifications outright, 13.9ms to 6.9, without that slide
being touched.

**`letterReveal` never released its layers.** Every glyph carried
`will-change: opacity, transform, filter` from construction, and `filter`
promotes each one to a compositor layer for as long as the declaration stands.
That was a headline per slide when a few sections had a card; since every tab got
one it is a screenful on every navigation. The hint is now put back before each
reveal and dropped once the last letter has landed.

Where it ended up, at 1600x900. The harness's own frame is 6.9ms, so 6.9 means
the display is the limit; 16.7ms is 60fps.

| | before | after |
| --- | --- | --- |
| Organization Snapshot, idle | 41.6ms, 6 long tasks | **13.9ms**, none |
| Organization Snapshot, through its title card | 152.8ms over the first second | **14.2ms** |
| Certifications, idle | 13.9ms, 25 frames over 20ms | **6.9ms**, none |
| the other seven slides measured, idle | 6.9ms | 6.9ms |
| scrolling, all five scrolling slides | 6.9ms, 0 frames over 16.7ms | unchanged |
| a title card on any other slide | n/a | 6.9ms, 0% over 16.7ms |
| changing tab, every slide but one | 7 to 110ms to appear | 7 to 93ms |
| changing tab to Organization Snapshot | 449ms | about 490ms, then 20.8ms for one second |

What is left: that one slide builds 5,411 nodes, so it takes about half a second
to appear and runs its first second at roughly 48fps, all of it underneath its
own three-second title card. Everything else in both decks, idle, scrolling and
changing tab, is at or above 60fps. Fixing the last of it means building the wall
incrementally, which is a real change to a section that currently works.

Two things the survey flagged that the measurements did not support, recorded so
they are not chased again: the wheel handlers that read then write `scrollTop`
(`PlacementWall`, `VideoResumes`) cost nothing detectable, since every scrolling
slide measures 0 frames over 16.7ms; and `utils/dock.js`'s read/write loop now
runs on one slide only, because the presenter bar stopped using it when the rail
went.

## Every picture is warmed before its tab is opened

**A tab's photographs used to arrive after the tab did** (2026-09-18, on
request: "every photo need to be loaded before even we are entering to the
tab"). Nothing was slow — every slide but one already measured at the display's
own limit — but Events fetched its 94 photographs when Events was first opened,
and a picture landing after the slide it belongs to reads as a page still
loading. On a three-metre screen that is the whole impression.

`GET /api/orgs/:id/media-manifest` hands the client every image each section
will ask for, and `utils/preload.js` walks that list in the background while the
first slide is on screen. Measured: **806 images, 113.4MB, warmed in about four
seconds** from localhost, after which Events, Centres of Excellence, the drift
wall, Project Week and NT Square each open with **0 network fetches** and every
image on the slide already decoded.

**The manifest is computed on the server because the browser cannot.** A tab's
pictures are only known once that tab is built, and building one is the
expensive thing being got ahead of. The server has the blocks *and* the
filesystem, which is what makes a guess checkable — and it has to be checked,
because a stored path is not always a path from the uploads root: a wall stores
photographs relative to its block's `base`, a centre of excellence stores
`snowflake.png` and the component prefixes `coe/`, and `placement-wall` falls
back to `Placements` in the component when no base is stored. Each candidate is
tried against the disk and the first that exists wins; a reference that resolves
nowhere is dropped, because a preloader requesting files that do not exist turns
a silent non-problem into a screenful of 404s. Encoding each component's habits
instead would rot the moment one changed.

**Films are left out on purpose.** They are 57MB of the deck's 171 and they
stream — the browser fetches the opening seconds and seeks for the rest, so
downloading them whole in advance costs minutes of bandwidth to save nothing.
Images are what flash in.

**Four things keep the warming out of the way**, and together they cost nothing
measurable: the open tab is warmed first and then the deck in order, so the
work never competes with the slide the room is looking at; `fetchPriority:
'low'` puts every one behind whatever the current slide wants; six at a time
with the next batch on an idle callback, because the `load` handlers are on the
main thread even though the fetch and decode are not; and a failed image
resolves exactly like a loaded one, since a picture that will fail will fail
again, visibly, when its slide draws it. Measured while the warm-up was in
flight: 6.9ms a frame, 0 frames over 16.7ms. The JS heap after holding all 806
is 6MB — the browser keeps the encoded bytes and decodes on demand, which is
the whole point of holding the `Image` rather than decoding it.

**The drift wall was drawing 720 tiles nobody could see.** It is the one slide
that was not already at 60fps, and after the warming it measured 17.1ms a frame
with 53 of 85 frames over budget. Ablated one suspect at a time on a fresh load,
the way the earlier pass was:

| what was changed | idle frame time |
| --- | --- |
| nothing, as it was | 14.5ms |
| the images hidden | 13.9ms |
| the drift stopped | 14.4ms |
| `saturate` off | 14.4ms |
| radius and shadow off | 15.7ms |
| **half the tiles removed** | **9.9ms** |
| **`content-visibility: auto` on the tile** | **8.6ms** |

Only the tile count mattered, and skipping the off-screen ones beat deleting
half the wall. 766 tiles exist and about 47 are on screen at any moment.

**It cannot be declared in the stylesheet, and that is the whole difficulty.**
A tile is as tall as its own photograph (`height: auto`), and the loop's length
is `track.scrollHeight / copies` — so a tile whose layout was being skipped
would report its `contain-intrinsic-size` instead of its real height, every
column would measure short, and the wrap would show a band of ground once a lap.
`DriftWall.cull` therefore pins every tile's measured height and its intrinsic
size first, then adds `is-culled` to the wall; after that the two can never
disagree. It runs once, refuses to run until every tile has a real height, and
is attempted from 700ms rather than at the end — the pictures are warmed before
the deck is opened now, so the heights are usually there within a second, and
waiting five seconds left the slide at 16ms a frame for exactly as long as
anybody was likely to be looking at it.

Measured after, at 1600x900, where the harness's own frame is 6.9ms:

| slide | before | after |
| --- | --- | --- |
| Organization Snapshot | 17.1ms, 53/85 frames over 16.7ms | **9.7ms, 0 over** |
| Events, CoE, Project Street, NT Square, IT Development | 6.9ms | 6.9ms |
| Certifications, settled | 7.7ms | 7.5ms, 0 over |
| while the 806 images warm | n/a | 6.9ms, 0 over |

Checked for the failure this invites: 49 tiles on screen, **0 unpainted**, and
the wall photographs to a full frame with no gaps. Certifications spikes for a
moment on arrival and is at 7.5ms once its entrance has run — a settled
measurement is the only honest one on a slide with an entrance.

## Presenting: the forward gesture, and the dock

**Forward walks the tab, then opens the next one** (2026-09-17). `advance` in
`PresentPage.js` offers the press to whatever the open slide holds of its own —
a course deck's courses, a timeline's years, the panels of a leader's story —
and turns the tab only once that is spent. So on AI Ready Engineer the first
five presses walk the six courses and the sixth opens Centers of Excellence; on
a slide with nothing of its own, one press is one tab. Backwards is the mirror:
from the front of a slide, back opens the previous tab.

`turn` is the other movement and it changes tab outright, from wherever inside a
slide you are. The dock's two buttons call it, and so do Page Down and Page Up,
because a presenter's clicker sends those. It is the only way to skip the rest
of a run of sub-tabs.

| | what it does | what drives it |
| --- | --- | --- |
| `advance(delta)` | the slide's own steps, then the next tab | ← → and Space |
| `turn(delta)` | straight to the previous or next tab | the dock's two buttons, Page Down, Page Up, the admin top bar |

**A cut in between made the arrows stop at the end of a slide**, so that only the
dock could change tab. It was wrong in the room and was reverted the same day:
it turned the last sub-tab into a wall, and a presenter had to move a hand to the
dock to get past every slide with any depth. Keep the spill. The dock is for
skipping, not for the ordinary press.

A slide's sub-steps come from two places and only one was ever in this file's
hands. Six blocks register with `utils/slideSteps.js` — course deck, gallery
wall, leadership panels, leadership road, milestone timeline, paper tabs — and
those are what `advance` offers the press to before it turns. Everything else
that takes the arrows (the training shelf, the team ribbon, the card fan, the
event wheel, the alliance accordion, the project showcase) binds them on its own
root and calls `stopPropagation`, so the press never reaches `PresentPage` at
all and those slides are turned by the dock or by Page Down.

**The dock holds two buttons and nothing else** (2026-09-17, on request). It was
a pair of named neighbours with a rail of sixteen section icons between them,
each with a hover card of its subsections; the rail, the cards and
`SideNav.sectionMenu` that fed them are gone. What is left is **Previous tab**
and **Next tab**, each naming the tab it lands on, the position, and Exit. Three
notes:

  - **Exit stays, though only two buttons were asked for.** In fullscreen the
    top bar is hidden and Escape is the only other way out; a presenter whose
    hand is on a mouse would have none. It is the small ghost button at the end,
    not one of the pair.
  - **The names are 15.5px now, up from 12.5.** They were sized to leave room
    for the rail. With the rail gone the dock is about 480px, and the point of a
    dock a presenter glances at is that the glance works from the desk.
  - **The dock is centred now, which the wide bar could not be.** `.deck-bar`
    shifts left by half `--player-reserve` so that a 1180px bar and the film
    player's controls in the bottom-right corner did not sit on each other. At
    480px that shift is 123px of visible offset bought against a collision that
    cannot happen, and it read as a dock somebody had nudged. `.deck-bar--pair`
    takes `left: 50%` back and caps its width at `100vw - 2×reserve - 48px`, so
    half the bar plus the whole reserve clears the corner at any window size.
    Measured at 1600, 1280 and 1024: dead centre, nothing overlapping.

Measured on both decks with the right arrow alone and nothing else touched:
every tab is reached, in the stored order, and the deck comes back round to the
first — 16 tabs on each, one press apiece except where a slide has depth (Torii's
AI Ready Engineer takes 6, NGI's Executive Summary 3 for its paper tabs, NGI's
own AI Ready Engineer 6). The dock's Next tab pressed from sub-tab 3 of 6 goes
straight to Centers of Excellence, and Previous tab from there comes back.

## The team ribbon drifts on its own

**It moves when nobody is touching it and stops when the pointer is over it**
(2026-09-18, on request: "soft auto scroll, not hard one, it should be
premium"). One card every 3.4 seconds, which is slow enough to read a name by
and not so slow that it reads as a fault.

**The drift is added to the target, not to the offset.** The row already eases
`offset` toward `target` every frame, so pushing the target along at a velocity
means the movement inherits that easing instead of needing its own — no second
opinion about how this row moves, and the constant lag between the two is what
keeps it looking poured rather than stepped.

**The two time constants are deliberately different, and that is the whole of
"premium".** The drift is a velocity eased toward its aim rather than switched
on and off, but stopping has to answer the hand and starting has to not startle.
At a symmetrical 0.85s the row was still moving at 13px/s a second and a half
after the pointer arrived, which does not read as "it stopped when I hovered
it" — it reads as a row that ignores you. Stopping is 0.32s and starting is
1.1s.

| | px/s |
| --- | --- |
| drifting | 69 |
| 0.0–0.3s after the pointer arrives | 56, gliding down |
| 0.6–1.5s after it arrives | **5.4**, at rest |
| 0.0–0.5s after it leaves | 19.5, easing away |
| 1.6–2.5s after it leaves | 63.7, full speed |
| frame time while drifting | 7.0ms, 0 frames over 16.7ms |

Four things it has to respect, three of which are about not arguing with the
presenter:

  - **The hover is the whole row, not a card.** The gap between two cards is
    still the row, and a drift that restarted between faces would be worse than
    one that never stopped. `focusin`/`focusout` do the same for a presenter on
    the keyboard, who has no pointer to park.
  - **A gesture buys stillness.** A wheel, a drag, a click on a face or an arrow
    press sets `autoAfter` a second ahead, and the snap onto a card sets it
    again as it lands. Without that the drift starts pulling the moment a
    gesture ends, and a row that argues with the hand is worse than one that
    does not move.
  - **It does not fight the arrival.** `warm` is true while the ribbon is
    easing in from four cards out, and the drift is held at nothing until it is
    over.
  - **`prefers-reduced-motion` turns it off entirely**, like everything else
    here.

**And the loop needed a disconnect guard it had never needed before.** The row
used to come to rest and stop asking for frames; drifting, it asks for ever. The
deck rebuilds its DOM on every navigation, so without `if (!root.isConnected)
return` the loop would outlive the slide it drives — once per visit — and go on
costing frames on every other tab. Any component given a permanent animation
needs this; the drift wall has had it from the start for the same reason.

## Collapsed, the editing view is the presenting view

**The pane on its rail means full screen** (2026-09-18, on request: "when I
collapse I have some space on the left and right side, I don't want it like
that... and above we have so much space"). Collapsing the pane is what a
presenter does to get the deck out of the way, and a slide still sitting in a
window with bars down both sides was the one thing that still said *editor*.

**Smaller type was not the fix; the top bar taking a row was.** The arithmetic,
measured at 1920x1000: the stage is 1842 wide once the rail has its 78, and
FitSlide fills only when a section's 860 nominal rows fit
`1600 x height / width`. With the bar in the flow the stage is 960 tall, which
allows 834 rows — twenty-six short, so it declined to fill and left 61px down
each side rather than lose the bottom of the slide. That is the documented rule
working correctly: **never clip content to fill.** Floating the bar gives the
stage the whole 1000, which allows 869, and every slide fills with nothing
cropped. Shrinking the bar from 64px to 39 was worth 24 rows and would never
have been enough on its own.

Three parts, all scoped to `:root[data-nav-rail='1']` so the working view and
presenting itself cannot be changed by accident:

  - **`wantsFill` counts the rail as presenting.** `fill: 'presenting'` now
    means the deck presenting *or* the pane collapsed. The MutationObserver
    watches `data-nav-rail` on `<html>` as well as the body's class, because the
    fill decision is an attribute and would otherwise be read once at mount and
    never again — the resize observer sees the frame change width but not why.
  - **The bar floats and carries no ground at rest.** The scrim is this deck's
    near-white, which is invisible over a white slide and a grey band across a
    black one — and the first slide of the deck is a black film. The controls
    carry their own backgrounds and stay readable either way; the scrim and full
    opacity come up on hover, when the breadcrumb is being read.
  - **The slide's own padding becomes the presenting 44/48/52**, not the
    editor's 48/52/56. Not cosmetic: every block's row count is measured at one
    exact canvas width, so a gutter 4px wider rewraps a line onto a row that
    does not exist. Matching it is also the point — collapsed, what is on screen
    is what the room will see, to the pixel.

Measured across all fifteen Torii tabs at 1920x1000:

| state | stage | slide | side bars | fills |
| --- | --- | --- | --- | --- |
| collapsed | 1842x1000 | 1842x1000 | **0 / 0** | yes, all 15 |
| pane open | 1620x939 | 1580x849 | 20 / 20 | no — unchanged |
| presenting | 1920x1000 | 1860x1000 | 30 / 30 | unchanged |

Presenting letterboxes on a 1920x**1000** window for the same arithmetic — 833
rows against 860 — and fills on a real 16:9 display, where it is 900. The
collapsed view fills on that window precisely because the rail makes the stage
narrower, which is the one case where losing 78px of width buys something.

## Four keys run the whole deck

**Left and right explore a tab; up and down change tab** (2026-09-18, on
request). That is the entire control surface, and a presenter learns it in one
sentence.

| key | what it does |
| --- | --- |
| → | the next thing *in* this tab — the next portrait, book, file, card — and the next tab once they are spent |
| ← | the previous one, and the previous tab from the first |
| ↓ | the next tab, from wherever inside a slide you are |
| ↑ | the previous tab |

Page Down and Page Up do what up and down do, because a presenter's clicker
sends those and not arrows. Space still goes forward.

**The spill was already right; the problem was that seven slides never let the
press reach it.** `advance` offers a press to whatever the slide holds of its
own and turns the tab only once that is spent — but only six blocks registered a
stepper, and the training shelf, the team ribbon, the event wheel, the project
showcase, the thread board, the alliance accordion and the event orbit each
bound the arrows on their own root and called `stopPropagation`. So those slides
could not be left with the forward key at all, and five of them had **up and
down doubled onto the same job**, which would have taken the new tab gesture
away on exactly the slides that most needed it. All seven register a stepper
now and none of them binds an arrow. `utils/slideSteps.js` is the only route in.

**A stepper returns whether it consumed the press**, and the honest way to know
is to measure rather than to keep a second opinion of where the end is: walk,
then compare the index, the page or the band position across the call. The
shelf, the story deck and the thread board all do that; the showcase and the
accordion stop at their bounds instead of wrapping, because a run that comes
back to where it started has no end for the deck to spill out of, which is
precisely why the forward key used to be trapped on IT Development.

**A row with no ends needs "spent" defined rather than detected.** The team
ribbon and the event wheel deliberately have none — one step back from the first
event is the last — so they count instead: the slide is entered at position 0,
forward is spent after one lap, and back from 0 leaves the tab exactly as it
does on a row with real ends. A presenter should not have to learn that some
rows go backwards for a lap and others do not. Two traps in that count, both
found by walking the deck: the wheel's `N` is the length of the *strip*, which
repeats the events until the arc is full, so a lap measured on it took twenty
presses to leave a ten-event wheel — it is `groups.length`; and the orbit's
up/down tilt had to go with the rest, since it is a flourish and the four keys
are the whole control surface now.

**Project Street reads on one gesture now.** Its page turn was on up and down —
film, then board — and the band on left and right. Forward now carries the whole
slide: onto the board, along the thread card by card, and out into the next tab
after the last one. Back at the very start of the band it returns to the film
rather than leaving, because the film is part of that slide.

Measured on Torii by dispatching real key events, nothing else touched:

| | |
| --- | --- |
| ↓ from About | walks all fifteen tabs, one press each, and comes back round |
| ↑ | one tab back |
| → on Team | 24 presses, one a portrait, then Trainings |
| → on Trainings | 7 presses, one a book, then Centres of Excellence |
| → on Events | 10 presses, one an event, then IT Development |
| → on IT Development | 9 presses, one a file, then Organization Snapshot |
| → on Project Street | 34 presses — the film, 32 cards — then Beyond |
| 5 × → then 5 × ← on Team | still on Team; the sixth ← goes to CEO Profile |

**Nine tabs have nothing to step through and take one press.** About, CEO
Profile and Organization Snapshot have nothing discrete in them and are right as
they are. The other six do have something a presenter might want to walk and no
way to walk it yet — Centres of Excellence (20 centres), Certifications (its
acts), Torii Connect (3 photographs), NT Square (13 cards), Project Week (25)
and Beyond (its ring). Adding a stepper to each means deciding what a step *is*
on a wall, a fan and a ring, which is a design question rather than a
mechanical one; the mechanism is ready for them.

The overlays keep their own keys and should: `Lightbox`, and the viewers inside
Certifications and Placements, bind in the capture phase and stop the event, so
arrows walk the photographs while one is open and the deck stays where it is.

**Four Torii rows and one NGI row are switched off in the code** (2026-09-16),
on request: Torii's Industry Alliances, History & Milestones, Success Stories
and Video Resumes, and NGI's Certifications — the user-supplied section that is
not to be redesigned, still intact and published underneath.
`HIDDEN_ROWS` in `context/appStore.js` is the switch — one list of section keys
per organization, and both `isShown` (the pane and the collapsed rail) and
`deckSections` (Prev/Next while presenting) read it, so the two can never
disagree. Deleting a line brings a row back; nothing else changes.

It is deliberately *not* the `hidden`/`status` flags that
`tools/presenter-visibility.cjs` writes. Those are editorial state in the store
that an admin can still see through, which is right for a draft; this is a
switch that hides the row from everyone, admin included, while leaving the
section published and every block in it untouched. Measured: 16 slides in
Torii's presenting deck instead of 20, none of the four in either pane, and
NGI and NCET unchanged. A direct URL to one of those sections still renders it —
the switch governs what is *offered*, not what exists — which is the escape
hatch for checking one without turning it back on. One trap in the list: a key
is not a title. Torii's "Video Resumes" row is keyed `testimonials`, so the
keys are taken from `backend/data/db.json` rather than guessed.

Torii Connect is a folder that opens into a bento (2026-09-16), a new block
type `photo-folder`, built to a reference the user supplied: one big folder
standing in the middle of the frame, cards peeking out of its mouth, its own
name and count on the pocket across the front. The button empties it — each
photograph flies out and lands in a wall of deliberately unequal tiles, each
with a name and a line read off the picture — and Back sends them home along the
same path. Three photographs, so a big tile and two stacked beside it.

**The folder is the reference's silhouette, shape for shape** (second cut,
2026-09-16, after "it's not looking like a folder"): the back panel is an SVG
path whose top edge steps down on the right through one soft curve — the tab —
inside a pocket that is a little wider than it; the cards are *documents*,
white paper with a thin rule, the photograph set into the top and the name and
a line beneath, fanned out of the mouth with the middle one highest and in
front; the pocket carries the name in a plain semibold sans and "N Files", as
the reference does, not the deck's display face. The reference's pale blue is
done in Torii's warm tints. There is no eyebrow above it — the reference has
nothing there and the user asked for the label to go.

**One element per photograph, and only its transform ever moves.** A card's box
*is* its bento slot, written once in px; the closed state is a
`translate … scale … rotate` solved in JS that carries that box back into the
mouth. Opening and closing are one transition played in opposite directions —
measured, a card lands back on exactly the rectangle it left, to the pixel — and
no width or height is ever animated. Scaled to 250px in the mouth, the caption
reads as the two grey lines the reference draws on its documents, which is why
the card can be one element in both states.

**The cards stay behind the pocket, always.** That is the whole trick: going out,
a card emerges from behind the pocket while the pocket fades; coming back, it
slides behind the pocket as the pocket fades in. No z-index is touched
mid-flight because none has to be.

**`animation-fill-mode: both` outranks the state you switch to.** The folder's
entrance holds `opacity: 1` in its last keyframe, and a filling animation beats
every declaration in the cascade — so `.is-open { opacity: 0 }` did nothing and
the folder simply never went away. `backwards` is the fill that was wanted:
the from-state through the delay, and the declared style once it has run.
Anything with both an entrance animation and a state that changes the same
property has this bug waiting.

**A tile is the photograph's own shape, exactly.** The first cut sized tiles as
boxes and let `object-fit: cover` take the difference — 1.88 against pictures of
1.41 on the small tiles, and even the big one at 1.37 was noticed ("not the same
original ratio as before"). A composition now names only *columns of widths*;
each tile's photograph height follows from its own `w/h`, a fixed caption band
sits under it, columns are centred on one another and the whole is centred on
the frame, and if it comes out taller than the space above the presenter bar
the widths are scaled down together. Measured: −0.2%, −0.6%, −0.6% — rounding.
Unequal is a composition, not a licence to crop.

**The photographs had a frame burned into them.** All three arrived as 465px
exports inside a black mat and a 6px red rule — a picture inside a picture,
which in a bento reads as a mistake. The rule measured at rows 20–25 and columns
32–35 / 422–426, the same in all three; `crop-image.cjs` cut past it at 0.000%
ratio drift, leaving 384x272, and a check that counts red pixels on every edge
now returns zero. The framed originals are kept beside them as `NN-framed.png`,
the way the Snowflake card's was.

**Windows resolves a filename whatever its case; Linux does not.** Three slides
lost the Torii mark the moment the deck was deployed (2026-09-18) and every
local check had passed: the blocks pointed at `Snapshot/torii-logo.png` and the
folder is `snapshot/`. An `<img>` or a CSS mask whose file 404s draws nothing at
all rather than complaining, so the only symptom is a missing mark, and only on
the deployed copy. The three were the Centres of Excellence hub, the drift
wall's middle and the IT Development brand mark; 77 other references into that
same folder had the real lowercase name, so the folder was right and the
references were wrong.

`tools/fix-uploads-path-case.cjs` audits every stored `/uploads` path against
the case on disk and corrects only the case. Run it before a deploy. Two things
it has to know to be believed: a path is resolved either from the uploads root
or from the block's own `base`, and `placement-wall` falls back to `Placements`
in the component when no base is stored — judged against the root alone it
reports 345 files as missing that are on disk one directory down, which is the
same false positive a media check here produced once before. With both, it
reports 3 case mismatches and 3 genuinely absent files, all three of them
NGI Platforms references that were already broken.

**A replaced file keeps serving its old bytes for an hour.** `/uploads` goes out
as `public, max-age=3600` with no ETag and no Last-Modified, so overwriting
`01.png` in place changes nothing in any browser that has already seen it —
including, for a long while, the one checking the work: three rounds of crops
were verified as correct on disk and wrong on screen. The crops are published
under new names (`aisle.png`, `stalls.png`, `myna.png`) instead. **When media
changes, change its filename**; only that changes the URL.

Torii's Events is a wheel of albums (2026-09-16), a new block type
`event-wheel`, built to a reference the user supplied: on the left the
rightmost sweep of a great ring whose centre stands 270px off the frame, its rim
made of the photographs themselves — a continuous curved strip of tiles, one
per event, each turned by its own angle to follow the arc, edge to edge — the
open event's tile large and lit with its name and count on a card beside it; on
the right the open album running down a 520px column, each photograph at its
own ratio. Two things from the reference are left out on request: the ring of
icons inside the wheel, and the dark room — this is Torii's light sheet with
its two measured colours washing behind, like Torii Connect and NT Square. It
replaced the `event-orbit` that branch had put there, reading that block's ten
events and ninety-four photographs as they stood — nothing retyped, no order
changed. Twelve more folders under `uploads/Events/` belong to the other decks
and stay out.

**The name sits inside the ring** (on request): "Events" at 44px in the display
face, right-aligned against the inner rim in the sliver of the disc the frame
shows, ink running into Torii's orange over its last letters, "10 EVENTS" in
small caps beneath. The right-hand panel lost its "EVENTS" kicker with it —
saying it twice on one slide is one time too many.

**The wheel has no ends.** The tiles are the events repeated until there are at
least fifteen (enough to fill the visible arc), and every tile is placed each
frame from its distance to the wheel's position taken the *short way round* —
so one step back from the first event is the last, and the strip is never seen
to stop. Measured: AWS Summit → AI Cinema → AWS Summit. The first cut was a
finite row of squares spaced along a dark band, which drew "I don't want to see
ends" and "the shape behind should be photos too"; a tile is now 124 along the
radius by 96 along the tangent, rotated by its angle, with a 6px seam, so the
strip bends with the rim (tiles measured at −64°…+64°) and the band shows only
in the seams. The card also ended at x=790 over an album that began at 760; it
now ends at 750 and the album begins at 780.

**Two eased values in one rAF loop, and nothing else moves.** `pos` is the
wheel's position in events: every cover is placed each frame from
`(i − pos) × 12°` around the ring's centre, so the rim turns rather than the
covers sliding, with scale and dimming continuous in the distance from the
front. `colY` is the album's scroll: a step is one photograph, and its target is
that photograph's own top, never a fixed distance. Same clock discipline as the
ribbon — real `dt`, capped so a pause costs one frame. Measured through one
turn: per-frame moves 18.6, 16.1, 16.5, 11, 9.2 … monotone and eased; one
notch over the album lands `colY` on the next photograph's top to the pixel.

**No fixed cooldown fits both a mouse and a trackpad; the inertia tail is caught
by its shape.** A trackpad gesture is a push and then a tail — dozens of events,
each smaller than the last, that can run on for a second — and a cooldown long
enough for the tail (it stepped twice at 380 *and* at 480) makes a mouse spun
quickly lose every other notch (at 260, four notches 150ms apart stepped twice).
The gate is disarmed after a step and re-arms only on a *fresh* event: one after
120ms of quiet, or one at least as large as the event before it — a new notch or
a new push, never the decay of the last one. The cooldown is then only 120ms,
enough to outlast one notch's own burst from a smooth-scrolling mouse. Measured:
a 22-event decaying tail over 900ms steps once; four notches 150ms apart step
four times. The accordion and the shelf still use the plain cooldown.

**Measure one element through a turn, not "whichever is lit".** The first
per-frame check tracked the cover carrying `.is-open`, and at the moment that
class moved to the next cover the trace showed a 118px "jump" that no pixel
ever made. Track a fixed cover. And a press at y=850 to give the slide focus
landed on the presenter bar and re-mounted the page — the check's own doing, not
the slide's.

Torii's Organization Snapshot is the drift wall it always was, refilled
(2026-09-16): the 79 tiles it inherited from NGI's mirror — Technical Hub's
campus, its app, its team, under the two-colour name "Technical Hub / 10 Years
of Excellence" — went, and every photograph in `Downloads/TORII/Torii/Torii`
came in: 383 tiles across twelve categories (Events 148, Trainings 68,
Placements 57, Certifications 24, MOUs 23, NT Square 23 …), the category being
the folder each came from, so the wall's own interleave keeps any one subject
from stacking a column. Nothing about the wall's look changed — same columns,
tile size, tilt, drift. NGI has no snapshot row; NCET's still shows the name.

**The middle is the mark now, not the name.** `drift-wall` took three fields:
`logo` (a file under `/uploads`, the way the newer blocks carry theirs — not an
assetId, which this block otherwise insists on for tiles because a bare path
resolves against whoever serves the page), `brand` (what the viewer's tag says
when a tile has no category; it used to say "Technical Hub" for everyone), and
`plate`, the colour of the wall's ground and of the scrim the centre sits on —
one value, set on the root — which was NGI's deep green in the stylesheet and is
now a variable with that as its default. Torii's is
`#171514`, its ink warmed a shade so the mark's dark bar still reads on it.
`Downloads/TORI LOGO.png` is 1024px with the mark in its middle 482x504 on
transparency (93% of it clear — the grey a viewer shows behind it is the
viewer's); it is cropped to the mark plus its glow and written at 420px with
alpha kept, into `uploads/snapshot/`. On the slide it is 210px, about what the
64px title stood — six rows of tiles — and no more.

**383 originals are 99MB; the wall carries 17.** A tile is 230x150, so each is
re-encoded through the canvas to 560px wide at 0.82 — a little over twice the
tile at presenting scale — and goes up as an asset named `snapshot-<path>.jpg`;
a name already in the library is reused, so the script re-runs without
re-uploading. Folder names are NFKC-folded first (several arrive in Unicode
"mathematical bold" letters — 𝐒𝐂𝐈𝐍𝐎𝐕𝐀 — which fold back to plain text) and a
short list of spellings is corrected by hand (`Achivers day`, `Hackthon`,
`Sucess`); no caption is written that is not the folder's own name. The wall
draws each tile three times for its loop, so a count of `img` elements on the
slide is 1,149 for 383 tiles — measured all loaded, none broken.

Torii's Centers of Excellence carries the Torii mark at its hub (2026-09-16),
not Technical Hub's: `coe-wall.hubLogo` → `/uploads/snapshot/torii-logo.png`
(the same 420px alpha crop the snapshot wall uses) and `hubName` → "Torii
Minds", changed on Torii's block only by a one-off PATCH (backup
`db-before-coe-logo-torii-*`). NCET's hub still shows Technical Hub's mark and
NGI's its own wordmark. The hub plate is white, where the mark's orange frame
and dark bar both read; drawn at 116px inside the 190px disc.

`tools/crop-image.cjs` writes PNG when the output path ends in `.png` and JPEG
otherwise, and that choice is load-bearing for logos: a mark cut out of a
transparent PNG and re-encoded as JPEG comes back as a white rectangle, which on
the rail's dark green is a sticker rather than a mark. The JPEG path paints a white
ground first, because an untouched canvas encodes to black. `--max-width` scales
after any crop and carries the ratio through at 0.000% drift.

**`.pw-stage` must not have `scroll-behavior: smooth`.** PlacementWall scrolls that
element by hand on every wheel tick (`stage.scrollTop += e.deltaY`), and with smooth
scrolling on, reading `scrollTop` back gives the *current animated position* rather
than the target — so each tick of a trackpad flick added its delta to a value still
catching up, and every assignment restarted the animation. Measured: a flick asking
for 800px moved 138px of the 350 available, which from the outside looks exactly like
a wall that will not scroll. `overscroll-behavior: contain` does the edge containment
the smooth scrolling was never providing anyway.

Two things the gallery was getting wrong, found by measuring each tile's box against
its image's true aspect ratio rather than by looking. `.pw-tile` carried
`flex: 1 1 auto`, so a tile grew past the width the row solver had computed for it to
fill whatever the row had left — invisible on a full row, but on the leftover tail one
wide card was pulled from 1048px to the full 1560 while its height stayed put, and
`object-fit: cover` cropped the difference away. Measured 229% off true. These are
designed cards with a student's name and package set into them, so a crop takes a name
off: the solved width is now final (`flex: 0 0 auto`). And `solveRow` hardcoded
`full: true` on every row including the tail, so nothing could tell a row that reaches
the margin from one that does not; the tail now takes the height of the row above it
and is centred under it, instead of solving to fill 1560px and standing 589px tall
beside a row of 328px cards.

A new full-bleed block must be added to the `hasHero` list in `SlideView.js`, or
the slide draws its own section head above it and titles the page twice. That is
the visible half. The other half is that the head is 181 rows tall and sits *in
the flow*, so a root pinned to `--slide-h` then starts 181 rows down and runs the
same distance off the bottom of the screen — with the captions, which live at the
foot of the block, among what goes. `alliance-accordion` did exactly this until it
joined the list.

Two things a new section needs that nothing warns you about, both discovered on
Industry Alliances. A `layout.h` of 15 is the figure every full-bleed wall uses,
because a span includes its gaps — 15x28 + 14x16 = 644px, the canvas budget. At 22
the block reserved 952, the slide measured 1185 nominal rows against a 900-row
screen, and presenting quietly gave up filling and fell back to fitting with a
margin down each side. And an asset is stored under the filename it was uploaded
with, extension included, so a publish script that looks its own images up by the
bare name matches nothing and re-uploads the whole set on every run.

One trap before adding a section that scrolls internally: `.canvas-block > *` sets
`flex: 1`, and its `flex-basis: 0%` overrides `height` on the main axis. A
`min-height` root then grows to its content instead of letting a child scroll, and
FitSlide scales the slide down to fit. Use `flex: 0 0 auto` with `height` **and**
`max-height` — see `.ev-root`.

`.pw-root` had exactly this bug and it hid for a long time, because the presenting
rule below pins that root with `--slide-h` and `!important` — so the slide was right
in the room and wrong everywhere else. It only became obvious once Campus Events put
43 photographs behind it: the root measured 3068px, FitSlide drew the slide at
**0.294**, and the admin view was a postage stamp in the middle of the screen while
presenting looked perfect. If a section looks right presenting and tiny out of it,
this is the bug — measure `.fit-slide__inner`'s transform scale and the root's
`offsetHeight`, and check whether the root's computed `flex-basis` is `0%`.

That definite height must be `var(--slide-h, 860px)`, never a bare `860px`. **A
slide in presentation mode is not 16:9 — it is the screen's shape.** FitSlide gives
it `1600 × (screenHeight / screenWidth)` nominal rows, so a 16:10 display hands the
section 1000 rows where the admin canvas has 860, and a root pinned to 860 stops
140 rows short. The section still *looks* full-bleed and FitSlide still reports the
slide as filled — the dead band is inside it, which is why it survived so long.
Seven roots had it: `sw`, `pg`, `tw`, `ev`, `vr`, `cs`, `pw`.

A percentage cannot replace it. FitSlide measures with the slide's height cleared —
it must, or it reads back its own answer — and a percentage of nothing is `auto`, so
the root grows to its full content during the very pass that decides whether to
fill. Placements measured 1483 rows that way and stopped filling at all. So
FitSlide publishes two properties on `.fit-slide__inner` instead:

| Property | What it is | Use it for |
| --- | --- | --- |
| `--slide-h` | the slide's height in its own nominal px, **set only while filling** | a root that needs a definite height |
| `--slide-scale` | the transform scale currently applied | converting real px into nominal px |

Both are cleared before the measurement for the same reason the height is, so
neither can feed back into the decision that produced it. Unfilled, every root
falls back to the 860 it always had.

`--slide-scale` exists because **the deck bar is 83 *real* pixels whatever the
slide is scaled to** — 69 nominal at scale 1.2, 92 at 0.9. Any clearance written as
a flat nominal figure clears the bar on one display and leaves the controls under
it on the next. Presenting therefore defines
`--deck-bar-clear: calc(96px / var(--slide-scale, 1))`, and the sections whose own
content reaches the floor use it as `padding-bottom`. The older `bottom: 104px` on
`.coe-wall` and `.tw-wall` predates this and has the same latent bug at large
scales.

The bar floating over a full-bleed photograph is the design and it carries its own
scrim; over a card's caption or a student's tile it is just content covered up.
Only the second kind needs the clearance.

When measuring whether something is really under the bar, intersect its rect with
every ancestor that clips. Inside a scrolling wall a half-scrolled card still
reports its whole box, well past the clip, and every scroller reads as a collision
that is not there.

Related: a box sized by `aspect-ratio` off a percentage width contributes *nothing*
to intrinsic height, so `grid-auto-rows: auto` sizes to the rest of the card and
the picture overflows. Hand the row an explicit height.
