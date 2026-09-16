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
| Admin | `admin@org.local` | `Admin@123` |
| Presenter | `presenter@org.local` | `Present@123` |

## Shape of the thing

- `backend/` — plain Node HTTP server, JSON store at `backend/data/db.json`,
  media in `backend/uploads/`. Serves the API *and* the frontend.
- `frontend/src/` — vanilla ES modules, no framework. Built with a tiny `h()`
  helper in `utils/dom.js` (and `svg()` for vector nodes — SVG needs the
  namespace, `document.createElement('svg')` renders nothing).
- `frontend/public/styles/app.css` — the whole design system, one file.
- `incoming/` — raw user drops. Not served; not live until Claude places it.

Two orgs, each with its own palette applied at runtime as CSS custom properties:

| Tab | id | Primary | Accent | What it is |
| --- | --- | --- | --- | --- |
| NGI | `technical-hub` | `#008638` | `#FFBB00` | Nagarjuna Group of Institutions — the deck everything was built on. The id stayed `technical-hub` because every tool and the palette table key on it; only the display name changed. Its wordmark and rail mark were swapped off Technical Hub's on 2026-09-14: the pane shows the NGI letterform cut out of `uploads/Placements/Journeys/banner-1.jpg`, the rail the Nagarjuna emblem cut out of `Downloads/Claude Technical Hub/.../assets/logo-ngi.png`. The full stacked NGI lockup is not used — the pane's logo slot is 38px tall and its third line would land at about 4px. |
| Torii | `torii` | `#000000` | `#E95A22` | Torii Minds. A mirror of NGI as of 2026-09-14, to be edited into its own deck. |
| NCET | `ncet` | `#047738` | `#D6AB30` | Nagarjuna College of Engineering & Technology. Created 2026-09-14 as a mirror of NGI. Palette measured off the college's own logo on the Snowflake MOU card — no brand file has been supplied. No logo or mark yet: the pane sets the name in type. A `logo-ncet.png` exists in that same assets folder if one is wanted. |

The three are tabs in the pane head — `.sidenav__orgs`, one filled in its own ink
for the current deck, stacked short names on the rail. They are a control, so
they are the one filled element in a pane whose rows are colour rather than fill.
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
cohort cards. Change it only when asked, and change only what is asked.

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
| `publish-project-street.cjs` | Torii's Project Street — the film and the thirty-two photographs, copied as they are, as the film screen and the thread board |
| `publish-project-week.cjs` | Torii's Project Week — the nine collage photographs (re-encoded once, then reused) and the wall of sixteen more under them |
| `crop-image.cjs` | crops a photograph through headless Chrome's canvas — there is no image library and there is not going to be |
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
