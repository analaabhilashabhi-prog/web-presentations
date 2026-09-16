# Organization Presentation Portal — Torii & Technical Hub

A projector-ready digital brochure a presenter walks through live, built to attract colleges and universities into MOUs and academic partnerships. Two organizations, sixteen editable sections each, role-based login, a drag-and-drop page builder that suggests a layout from the section's own name, and a smart image gallery that always looks composed.

Runs with **zero dependencies** — no `npm install`, no CDN, no internet at presentation time.

## Quick start

```bash
cd backend
node src/server.js
```

Then open **http://127.0.0.1:4173**.

| Role | Email | Password | What they get |
| --- | --- | --- | --- |
| Admin | `admin@org.local` | `Admin@123` | Add, edit, delete, reorder, hide, publish content; org settings |
| Presenter | `presenter@org.local` | `Present@123` | Clean read-only deck — no editing controls anywhere |

Both credentials are shown on the login screen for convenience. Set `SHOW_LOGIN_HINT=false` in `backend/.env` before a real presentation, and change the passwords via `ADMIN_PASSWORD` / `PRESENTER_PASSWORD` (see [backend/.env.example](backend/.env.example)).

Useful commands:

```bash
node src/server.js              # start (seeds demo content on first run)
node --watch src/server.js      # restart on file changes
node src/scripts/reseed.js      # wipe content and rebuild the demo data
```

## What is in the box

- **Two logins.** Admin manages content only; presenter gets the read-only view. Sessions are cookie-based (`HttpOnly`, `SameSite=Lax`) with scrypt-hashed passwords. Role checks are enforced on the server — a presenter calling an admin endpoint gets `403`, and deep-linking to an admin route redirects.
- **Two organizations,** chosen after sign-in, with identical structure, fully separate content and their own theme: **Torii** (black + orange, *STEP IN. STAND OUT.*) and **Technical Hub** (green + gold). Names, short names, taglines and logos are editable in settings.
- **Left side-nav** in the active brand colour + main area rendering the selected tab as a polished slide. First section is Profile / About, followed by CEO / Leadership Message.
- **16 pre-created tabs** per organization, all renameable, reorderable, hideable and deletable, plus an "Add tab" action: Profile / About · CEO / Leadership Message · Vision, Mission & Values · Best Practices · Programs / Courses · Team / Trainers · Initiatives · Certifications · Placements · Centers of Excellence · MOUs / Academic Partnerships · Memorable Moments · Achievements & Awards · Media / Gallery · Testimonials · Contact.
- **Sample layouts, chosen by the section's name.** Name a section "Profile" and it opens with an about-the-company paragraph, a row of KPI cards (employees, certifications, training hours) and space for the logo and captioned images. Name it "Certifications", "Hero", "Contact", "Placements" or "Centres of Excellence" and you get layouts built for those instead. Each match offers **two or three alternatives** plus three that suit any section, so there is always a choice — and every option previews as a real, scaled-down slide rendered by the same code that draws the finished page. **Keep it, customise anything in it, or clear it and start blank.** 18 archetypes, 40 layouts.
- **Drag-and-drop page builder.** Every section is a 12-column canvas. The element library sits under it, grouped into Text · Media · Data · Actions · Structure, with the elements that suit *this* section highlighted. **Drag a chip onto the grid to place it exactly**, or click it and the first balanced free slot is found for you (a half-width element lands *beside* an existing one, not below it).
- **The element library.** Text box (heading + paragraphs + bullets), Heading, Paragraph, Bullet list, Quote · Image, **Logo**, Video, Gallery, Profile image · **KPI cards**, Stat counters, Card grid · **Buttons / links**, **Icon** · **Hero**, **Layout box**, Divider.
- **Ready-made rows.** **Logo + title**, **Image + text** and **Two empty columns** sit at the top of the library. One click drops the finished arrangement — a logo already sitting *beside* a heading, not under it — and every piece inside stays editable, movable and resizable.
- **Layout boxes nest.** A box is an empty container with its own 12-column grid — drop elements inside it, drag them around in there, and nest a box inside a box up to three deep. Padding, inner spacing, corners, border and background (white, brand tint, brand fill, dark) are all switchable, so a two-up split or a bordered feature card is a few clicks rather than a CSS change.
- **Elements can be small.** The minimum is one column by one row, so a logo can sit at the size you want it. Below the point where a toolbar would fill the element, the toolbar floats above it on hover instead of sitting inside it.
- **The grid only shows when you need it.** Column guides appear while you drag and disappear the moment you drop, so the canvas reads as the page rather than as graph paper.
- **Hero sections.** Full-bleed background image, looping muted background video (upload or a YouTube/Vimeo/Drive link) or a brand-colour fill, with a kicker, headline, subheading and call-to-action buttons over it. Height (compact → full screen), alignment and overlay strength are yours; the gradient and type scale are decided for you so a headline can never end up unreadable over a busy photo.
- **KPI cards.** Number, label, optional prefix/suffix, optional icon and an optional note, animated up from zero when they scroll into view. They arrange themselves in a responsive grid — adding a fourth card rebalances the row instead of breaking it.
- **Every image has a title, a caption and alt text.** The title sits above, the caption below, and alt text falls back to the title so an image is never announced as unlabelled. Gallery images each carry their own title too, edited inline on the thumbnail.
- **Drag a block by the block.** Grabbing the thing you want to move is the instinct; hunting for a handle is a learned behaviour. The whole element is a drag handle — the `⠿` grip still works, but so does anywhere else on it. A press only becomes a drag once the pointer has actually travelled a few pixels, so the buttons and the click-to-zoom frames inside a block keep working, and the click that would follow a drag is swallowed so a picture does not open its lightbox just because it was used to move the block.
- **Auto-fit, then arrange by hand.** Drag to move, pull the edges to resize, duplicate `⧉` or delete `✕` from the hover toolbar. Everything snaps to the grid, neighbours are pushed aside rather than overlapped, and elements stay exactly where you drop them. Arrow keys nudge the selection; Shift+arrows resize it. Row heights are minimums, so text grows rather than clipping.
- **Undo / redo.** `Ctrl+Z` and `Ctrl+Shift+Z` (or the buttons above the canvas) step back through every move, resize, insert, delete and content edit — 60 steps deep. Applying a sample layout is a single undoable step, so trying one out costs nothing.
- **Edit / Preview toggle.** Preview is the presenter's renderer, not an approximation — the same component draws both.
- **Save any layout as a template.** "Save as template" puts the current section in the layout picker for every section in both organizations. Saved templates are managed (and deleted) from Settings. Whole sections can be duplicated too.
- **Brand controls.** Primary, accent, secondary, highlight and navigation colours plus the typeface are editable in Settings and apply across every section at once. Text on a brand fill is always chosen for contrast, so a pale accent or a light nav colour stays readable. One click resets to the approved palette.
- **Dedicated profile-image slot** with a fixed, well-composed frame (4:5 portrait or 1:1 square). Any upload is auto-cropped to fill it, with a top/centre/bottom focus choice, so a portrait always sits right regardless of its original dimensions.
- **Per-tab editor** also covers section title, kicker, nav icon, hide toggle, and **Save as draft** / **Save & publish**. Renaming a section re-targets which sample layouts and elements it suggests.
- **Smart gallery alignment.** Up to 5 images per row; the last incomplete row is centred under the full rows, never left-aligned with a gap. Verified: 7 → 5 + 2 centred, 9 → 5 + 4 centred, 10 → 5 + 5. Uniform sizing, rounded corners, subtle shadow, click-to-zoom lightbox with keyboard navigation. Galleries of **posters or certificates** switch to *show the whole image*, because cropping them to a uniform grid would cut off the very thing they are there to show — and a title typed against an image is shown under it permanently, since a projector audience has no pointer to hover with.
- **Auto-formatting.** The admin types content; the renderer decides typography, spacing, dividers, card grids, slide transitions and animated stat counters. There are no colour or spacing controls to get wrong.
- **One section, one screen — the deck is paged, never scrolled.** Each slide is laid out at a fixed nominal width (1600px) and then scaled uniformly to the space available, exactly the way a slide fits its frame in any presentation tool. Nothing is cut off, nothing reflows between screens, and a section looks the same on a laptop as it does on a projector. Verified at 1920×1080: every one of the 32 sections fits with the page scrollbar untouched.
- **Sections are arranged to fill the screen.** Each one is built to about 16 grid rows — a 16:9 slide — so the frame is filled rather than half-used. A section that runs over is scaled down to fit instead of being clipped. All 32 sections land between 11 and 17 rows.
- **No picture is ever cropped.** Showing the whole image is the default for image blocks and galleries alike; cropping is an opt-in choice, not something that happens to an admin by accident. In both decks every image box is sized from the aspect ratio of the photograph inside it, so the picture fills its box exactly — nothing cut off, nothing letterboxed. Gallery tiles are 16:9, which is the shape of almost every photograph here.
- **Fullscreen presentation mode** with next/previous buttons, a progress bar, and `←` `→` `Space` `F` `Esc` shortcuts. Admins also get `E` to edit the current section. The quick-add bar sits below the slide rather than inside it, so it stays at full size while the slide is scaled.
- **Real content in both decks.** All 32 sections are built and published from the organizations' own photographs — 145 images, downscaled to 2000px so the deck opens instantly. Torii's come from the `MAM` folder; Technical Hub's were extracted from *Technical Hub 2025 presentaion.pdf*. Every figure on a KPI card is one the source material states (Torii: 189 and 25 Cisco certifications, 47 communication certifications, 12 Deloitte selections; Technical Hub: 15,000+ certified trainees, 30+ technologies, 22.6 LPA highest package, 29 ServiceNow selections, 24 Areteans apprenticeships). Nothing is invented — where the pictures state no figure, the section carries prompt copy for the admin to replace instead of a claim.
- **Seeded demo content** is still available for a clean slate: `node src/scripts/reseed.js` rebuilds the fictitious demo deck, `node src/scripts/blank.js` empties every section.
- **Media handling.** Images: PNG, JPG/JPEG, WEBP, GIF, SVG, BMP, TIFF, AVIF. **PSD is accepted and converted to PNG on upload** by a built-in decoder (raw / RLE / ZIP compression, 8- and 16-bit, RGB / grayscale / CMYK) — the original `.psd` is kept in `backend/uploads/originals/` and the PNG is what gets displayed. Video uploads: MP4, WEBM, MOV, AVI, MKV, OGV, served with HTTP range requests so scrubbing works.
- **Video: upload a file *or* paste a link.** The video block's form asks which: **Upload a video file**, or **Use a link** — a direct `.mp4` / `.webm` / `.ogv` / `.mov` URL, or a **YouTube / Vimeo / Google Drive** share link. Direct files and uploads play in a `<video>`; hosted providers play in an embed. A link that isn't a playable video is rejected with an explanation on the block instead of failing silently, and `javascript:` / `ftp:` links are refused.
- **Video playback.** Videos play inline in their block. The **⛶ Fullscreen** button takes the block's frame fullscreen and a **‹ Back to presentation** button returns you to the exact scroll position you left — no reload, no re-render, playback position intact. This works identically for uploads, direct links and YouTube/Vimeo/Drive embeds, because it is the wrapper that goes fullscreen, not the player. Verified: offset 2452 → fullscreen → back → 2452, same slide still open.
- **Add sections on the fly** from **+ New section** in the side nav (or Settings). It appears in the nav immediately and opens straight into the layout chooser for the name you gave it. Sections stay reorderable, renameable, hideable, duplicable and deletable.
- **Typography.** Agency FB throughout, via `@font-face` using the locally installed copy first and the bundled `frontend/public/fonts/` files otherwise, falling back to Saira Condensed → Oswald → Arial Narrow.
- **Persistence.** Content lives in `backend/data/db.json` (atomic writes), uploads in `backend/uploads/`. Changes survive logout and restart.

> The seed content is fictitious. Company names, partner colleges, people and numbers are invented so a demo can never be mistaken for a real claim. Replace it with real content before presenting.

## Colour palette

These are the defaults, and the values an admin gets back by pressing **Reset to brand defaults**. The frame stays light and neutral; the side-nav, headers, accents and buttons switch with the organization. Brand colours are now editable in Settings — everything below still holds for an untouched deck, and every element in the page builder draws from these tokens rather than declaring its own colour, so a customised palette carries through heroes, KPI cards, icons and buttons without any of them being restyled by hand.

| Torii | Hex | Technical Hub | Hex | Shared neutrals | Hex |
| --- | --- | --- | --- | --- | --- |
| Primary (black) | `#000000` | Primary (dark green) | `#008638` | Page background | `#F8FAFC` |
| Accent / CTA (orange) | `#E95A22` | Secondary (lime) | `#71BD1F` | Card / surface | `#FFFFFF` |
| Orange highlight | `#F45C23` | Accent / CTA (gold) | `#FFBB00` | Primary text | `#111827` |
| On-dark text | `#FFFFFF` | On-colour text | `#FFFFFF` | Secondary text | `#4B5563` |
| | | | | Borders / dividers | `#E5E7EB` |
| | | | | Success / Error | `#16A34A` / `#DC2626` |

Palettes are declared once in [backend/src/config/themes.js](backend/src/config/themes.js) and applied as CSS variables by [frontend/src/utils/theme.js](frontend/src/utils/theme.js). Shadows and overlays use alpha of these same values, so no new hue is ever introduced. Text on a brand fill is chosen between `#FFFFFF` and `#111827` by contrast — which is why the gold nav pill uses dark text and the orange one uses white.

## Directory structure

```
.
├── frontend/                     # No-build ES-module client (served by the backend)
│   ├── public/                   # Static files served as-is
│   │   ├── index.html            # App shell
│   │   ├── favicon.svg
│   │   ├── fonts/                # Agency FB (bundled fallback for machines without it)
│   │   └── styles/app.css        # The whole design system
│   └── src/
│       ├── assets/               # Images/fonts imported by components
│       ├── components/           # CanvasEditor, ElementLibrary, TemplatePicker, BlockRenderer,
│       │                         #   HeroBox, KpiGrid, Elements, MediaBoxes, VideoBox, SideNav, …
│       ├── pages/                # Route screens: Login, OrgSelect, Present, Edit, Settings
│       ├── services/             # ALL network calls (api, authService, contentService, templateService)
│       ├── hooks/                # Reusable behaviour: useCountUp, useShortcuts
│       ├── context/              # appStore — shared application state
│       └── utils/                # dom, layout (canvas grid maths), blocks (element factory),
│                                 #   sectionTemplates (sample layouts), format, theme, router
├── backend/                      # Node HTTP server, no dependencies
│   ├── data/                     # db.json — created at runtime, git-ignored
│   ├── uploads/                  # Uploaded + generated images, git-ignored
│   └── src/
│       ├── config/               # env loading, paths, brand palettes
│       ├── models/               # db + per-collection data access (owns persistence)
│       ├── controllers/          # Request/response handling
│       ├── routes/               # Path declarations only
│       ├── middleware/           # auth gate, static file serving, error mapping
│       ├── services/             # Business logic + seed content
│       ├── utils/                # http, router, id, logger, placeholder art, psd, png, media
│       ├── scripts/reseed.js     # Rebuild demo content
│       └── server.js             # Entry point
├── docs/                         # Architecture notes, decisions
├── .gitignore
└── README.md
```

## API

All routes are JSON. `any` = signed in, `admin` = admin role only.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | public | Sign in, sets the session cookie |
| `POST` | `/api/auth/logout` | public | Clear the session |
| `GET` | `/api/auth/me` | public | Current user (and the login hint, if enabled) |
| `GET` | `/api/orgs` | any | Both organizations with theme and logo |
| `PATCH` | `/api/orgs/:orgId` | admin | Rename, retagline, change logo |
| `GET` | `/api/orgs/:orgId/sections` | any | Tabs — admins also get drafts and hidden tabs |
| `POST` | `/api/orgs/:orgId/sections` | admin | Add a tab |
| `POST` | `/api/orgs/:orgId/sections/reorder` | admin | Save tab order |
| `GET` `PATCH` `DELETE` | `/api/sections/:sectionId` | any / admin / admin | Read, update, delete a tab |
| `POST` | `/api/sections/:sectionId/duplicate` | admin | Copy a section, content and all, as a new draft |
| `GET` `POST` | `/api/templates` | any / admin | List / save section templates |
| `PATCH` `DELETE` | `/api/templates/:templateId` | admin | Rename or delete a saved template |
| `GET` `POST` | `/api/assets` | admin | List / upload images (base64 data URLs) |
| `POST` | `/api/assets/binary` | admin | Raw-bytes upload for video and large images |
| `GET` | `/api/assets/capabilities` | any | Size limits, supported formats, whether ffmpeg is present |

`PATCH /api/orgs/:orgId` also accepts `theme` (a partial `{primary, secondary, accent, highlight, navBg}` of `#RRGGBB` values, or `null` to reset) and `fontId`. Values that are not well-formed hex are dropped rather than stored.

## Conventions

### Backend layer boundaries

- `routes/` — declare paths only: method + path → controller, plus the auth level. No logic.
- `controllers/` — handle request/response. Read the request, call a service, send the reply. **Controllers must not query the database directly.**
- `services/` — business logic: validation, block normalisation, role-based filtering, seeding.
- `models/` — own persistence. All reads and writes to `db.json` live here; nothing else touches it.

Dependency direction is one-way: `routes → controllers → services → models`.

### Frontend

- All network calls live in `src/services/`. Components and pages import from there; `fetch` appears only in [frontend/src/services/api.js](frontend/src/services/api.js).
- `components/` are reusable and take data as arguments; `pages/` compose them per route; shared state lives in `context/appStore.js`.
- Any admin-entered text passed to `innerHTML` goes through `inlineRich()`, which escapes first and then applies only `**bold**`, `*italic*` and line breaks.

### The page builder

- **Block shapes are declared once,** in [frontend/src/utils/blocks.js](frontend/src/utils/blocks.js). The canvas editor, the sample layouts and the template picker all build elements through `newBlock()`, so a new field is added in one place.
- **Grid maths is shared** by the viewer and the editor ([frontend/src/utils/layout.js](frontend/src/utils/layout.js)). `DEFAULT_SIZE` there must stay in step with the copy in [backend/src/services/section.service.js](backend/src/services/section.service.js) — the server is the backstop that re-flows anything overlapping.
- **Heights are minimums in the editor, fixed in the viewer.** Reserve less than an element needs and the editing row grows; reserve more and you get a pocket of dead space. Inside the fit frame the rows are a *fixed* track instead, because with `auto` tracks a photograph sizes itself to its natural aspect ratio — `height: 100%` has nothing definite to resolve against — so the row grows silently, the slide ends up hundreds of pixels taller than the layout says, and the scale calculated for it no longer fits. Fixed tracks make a section's height exactly what its rows declare, which is what lets the whole slide be scaled onto one screen with confidence.
- **Because of that, presentation padding must match the normal slide's.** A wider gutter rewraps a paragraph onto a line with no row left to hold it.
- **And type inside the fit frame is fixed, never viewport-relative.** A `vw` font size changes with the browser window inside a canvas whose rows were measured once, so text grows after the fact and spills over the element below it. Every such size is pinned to what its `clamp()` resolves to at the 1600px design width; only the scale factor changes between the editor, a laptop and a projector.
- **Sizing a picture box:** rows = (span in pixels ÷ the image's aspect ratio) ÷ the row pitch. A square photograph at six columns needs seventeen rows — more than a whole slide — which is why the Torii deck, whose source images are mostly square social posts, puts them at three columns.
- **Sample layouts are data,** in [frontend/src/utils/sectionTemplates.js](frontend/src/utils/sectionTemplates.js): an archetype is a list of keywords, the elements worth highlighting, and two or three layouts. Adding a section type means adding one entry there — nothing else changes. All sample copy is placeholder prose and all sample numbers are round placeholders, so a demo can never be mistaken for a claim.
- **Nesting is bounded** at three levels, enforced on both sides (`MAX_BOX_DEPTH`). The server drops an over-deep box rather than keeping an empty shell, so a crafted payload cannot make the renderer recurse for ever.
- **Links are validated, not sanitised.** `safeHref()` keeps `http(s):`, `mailto:`, `tel:`, root-relative and anchor links and drops everything else outright — the server is the authority and the client mirrors it so an unsaved draft previews what would actually be published.

### Naming

- Components are `PascalCase.js`, everything else is `camelCase.js`. There is no build step, so no `.jsx` — the components are plain ES modules that return DOM nodes.
- Backend files are suffixed by role: `section.controller.js`, `section.routes.js`, `section.service.js`, `section.model.js`.

### Secrets

- Never commit `.env`. Both apps keep a documented `.env.example`; update it in the same commit that introduces a new variable.
- `backend/data/` and `backend/uploads/` are git-ignored — they hold runtime content, not source.

## Video transcoding (read this if you upload MOV/AVI/MKV)

MP4 and WEBM play natively in every current browser and are stored as uploaded. MOV, AVI and MKV are not universally playable, so the server transcodes them to MP4 (H.264/AAC, `faststart`) and extracts a poster frame — **but only if ffmpeg is available**.

- **ffmpeg is not installed on this machine.** Without it, those files are stored and served unconverted; most MOV files are H.264 and still play in Chrome/Edge, but there is no guarantee. The upload succeeds and the admin UI shows exactly that on the block.
- To enable conversion, install ffmpeg and either put it on `PATH` or set `FFMPEG_PATH` in `backend/.env`, then re-upload. The server logs which mode it is in at startup.

PSD conversion needs no external tools — it is implemented in `backend/src/utils/psd.js` + `png.js` using Node's zlib.

## Notes and limits

- Sessions are stored in `db.json`, so restarting the server keeps people signed in. Cookies are not `Secure`; put the app behind HTTPS before exposing it beyond a laptop or LAN.
- Uploads are capped at 32MB per image (`MAX_UPLOAD_MB`) and 400MB per video (`MAX_VIDEO_MB`). Deleting a block or gallery entry removes the reference, not the file on disk.
- Agency FB is a licensed Microsoft/Monotype font. The files under `frontend/public/fonts/` were copied from this machine's Windows font folder at your request; `local()` is tried first so an installed copy is used without serving the file. Check your licence before deploying it to a public server.
- PSD support reads the flattened composite that Photoshop stores for compatibility. If a PSD was saved with "Maximize Compatibility" off, there is no composite to read and the upload is rejected with a message saying so.
- `SHOW_LOGIN_HINT=true` (the default) publishes the demo passwords on the unauthenticated login screen. Turn it off before real use.
- Undo history lives in the open editor only — it is not saved, so it does not survive leaving the section.
- Saved section templates are shared by both organizations, by design: a layout worth keeping is usually worth reusing on the other deck. They store the layout and its text, and reference the same uploaded images as the section they came from.
- A hero's background video always plays muted and looped. YouTube/Vimeo/Drive backgrounds play in an embed sized to cover the hero, so they cannot be scrubbed — use an uploaded file or a direct link if the audience needs controls.
- The projector deck is designed for 1280px and wider; the layout stays usable on a tablet, where galleries drop to 3 and then 2 per row while keeping the last row centred.
