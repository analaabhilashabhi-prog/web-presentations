# Architecture notes

## Why zero dependencies

The app has to run on a presenter's laptop, in a college auditorium, possibly with no usable network. Every dependency is a thing that can fail to install or phone home at the wrong moment. So:

- The backend is Node's built-in `http` module with a ~60-line router (`src/utils/router.js`).
- The frontend is native ES modules loaded straight from `frontend/src`, served by the same process. No bundler, no transpiler, no `.jsx`.
- Placeholder images for the demo are generated as SVG at seed time (`src/utils/placeholderArt.js`) rather than fetched from a photo service.

Cost of this choice: no JSX, no framework diffing (pages re-render their own subtree), and hand-rolled auth. Benefit: `node src/server.js` is the entire setup, and it works offline forever.

## Data model

One JSON document, `backend/data/db.json`, written atomically (temp file + rename) with writes serialized through a promise chain:

```
users[]          id, email, name, role, passwordHash (scrypt)
sessions[]       token, userId, expiresAt
organizations[]  id, name, shortName, tagline, logoAssetId, order
sections[]       id, orgId, key, title, subtitle, icon, order, hidden, status, blocks[]
assets[]         id, name, mime, size, url, seeded
```

A **section** is one tab and one slide: a `blocks[]` array where every block carries a `layout` of `{x, y, w, h}` in grid units.

| Block | Shape | Renders as |
| --- | --- | --- |
| `text` | `heading`, `level`, `body`, `items[]`, `align` | One movable box: heading + paragraphs + bullets |
| `image` | `assetId`, `caption`, `fit` | Image filling the block, click to zoom |
| `video` | `source`, `assetId` \| `videoUrl`, `caption`, `muted`, `loop`, `autoplay` | Inline player + fullscreen round trip |
| `profile` | `assetId`, `name`, `role`, `blurb`, `frame`, `focus` | Fixed 4:5 or 1:1 portrait frame, auto-cropped |
| `heading` | `text`, `level` | Section heading |
| `paragraph` | `text` | Prose, `**bold**` / `*italic*` supported |
| `bullets` | `items[]` | Accent-marker list |
| `quote` | `text`, `author`, `role`, `imageAssetId` | Brand-filled quote card with portrait |
| `stats` | `items[{value, prefix, suffix, label}]` | Animated counters |
| `cards` | `variant`, `items[]` | Card grid (team / partner / program / placement / certification / plain) |
| `gallery` | `caption`, `assetIds[]` | Smart 5-per-row centred grid + lightbox |
| `divider` | — | Rule with accent tick |

Adding a block type means touching exactly three places: `BLOCK_TYPES` + `DEFAULT_SIZE` in `section.service.js` (validation and default footprint), `renderBlock()` in `BlockRenderer.js` (viewer), and the `switch` in `BlockFields.js` (edit dialog).

## The block canvas

`frontend/src/utils/layout.js` holds the geometry, and both the viewer (`BlockCanvas`) and the editor (`CanvasEditor`) use it, so what the admin arranges is literally what presenters see.

- **Grid.** 12 columns; rows are `minmax(28px, auto)`. Because `h` is a *minimum*, a text block whose copy runs long grows its rows and pushes the rest down instead of clipping — CSS grid cannot overlap items it has placed, so the layout cannot break.
- **Auto-fit.** `autoPlace()` scans rows top-down then columns left-to-right for the first free `w×h` area. That single rule produces the "balanced" result: a 6-wide block dropped next to another 6-wide block fills the row instead of starting a new one.
- **Drag / resize.** Pointer deltas are divided by the column and row pitch and rounded, so movement snaps to whole grid cells. On drop, `resolveCollisions()` pushes any block the moved one now covers downward — with the moved block holding priority, so it keeps the position it was dropped in.
- **No auto-compaction on move.** An earlier version compacted upward after every drag, which yanked blocks back to the top and read as broken. Compaction now runs only on delete, to close the hole a removed block leaves. Deliberate vertical whitespace is preserved.
- **Responsive.** Below 900px the CSS collapses the grid to one column and forces every block full width. DOM order is reading order (`inReadingOrder()` sorts by y then x), so the stacked result matches how the slide reads on a projector.
- **Migration.** Content created before the canvas existed has no coordinates. `migrateLayouts()` runs at boot and flows those blocks full-width in document order; `ensureLayouts()` does the same defensively in the browser.

## Media pipeline

`asset.service.js` is the single ingest path for both the JSON (base64 data URL) and raw-binary upload routes. Large files and all video take the binary route, because base64 would inflate a 300MB video past any reasonable body limit.

- **PSD → PNG.** `psd.js` skips the layer records and decodes the flattened composite Photoshop writes for compatibility, handling raw / RLE (PackBits) / ZIP compression, 8- and 16-bit depth, and RGB / grayscale / CMYK. `png.js` then encodes it with zlib. The original PSD is preserved under `uploads/originals/`; the asset's `url` points at the PNG and `originalUrl` at the source. No native dependency, no ImageMagick.
- **Video.** MP4/WEBM are stored as-is. MOV/AVI/MKV are transcoded to MP4 (H.264/AAC, `+faststart`) with a poster frame *when ffmpeg is present*; when it is not, the file is stored unconverted and the asset carries a `note` that the admin UI surfaces on the block. Static responses honour `Range`, so seeking works.
- **Fullscreen return.** `VideoBox` promotes the existing `<video>`'s wrapper — nothing re-renders, so playback and the open slide survive. The scroll offset is captured on the way in and restored on the way out, covering browsers that reset it. `PresentPage` distinguishes deck fullscreen from video fullscreen; without that separation, exiting a video would re-render the deck and lose the presenter's place.

## Video sources

A video block carries `source: 'upload' | 'url'`. Uploads keep using `assetId`; links are stored raw in `videoUrl` and resolved on read by `utils/videoUrl.js`, so the viewer only ever sees a decided answer:

| Link | Result |
| --- | --- |
| `…/clip.mp4`, `.webm`, `.ogv`, `.mov`, or a `/uploads/…` path | `kind: 'file'` → plays in `<video>`, same as an upload |
| `youtube.com/watch?v=`, `youtu.be/`, `/shorts/`, `/embed/` (honours `t=`) | `kind: 'youtube'` → `youtube-nocookie.com/embed/ID` iframe |
| `vimeo.com/ID`, `player.vimeo.com/video/ID` | `kind: 'vimeo'` → `player.vimeo.com` iframe |
| `drive.google.com/file/d/ID/view` | `kind: 'drive'` → `/preview` iframe |
| anything else, or a non-http(s) scheme | rejected; the block shows why |

Resolution happens in `hydrate()` rather than at write time, so improving the parser fixes existing content without a migration. Both branches render inside the same `.video-box__frame`, which is what `requestFullscreen()` is called on — that is why the fullscreen button and the Back button behave the same for an uploaded file, a direct link and a provider embed, even though only the first two are real `<video>` elements. Embeds need internet access at presentation time; uploads and direct local links do not.

Sections are hydrated on read: `assetIds` become resolved `{id, url, name}` objects, so the viewer never performs a second lookup.

## Role model

Two roles, enforced server-side at the route declaration (`'none' | 'any' | 'admin'`), not in the UI:

- **admin** sees every section including drafts and hidden tabs, and can mutate anything.
- **presenter** sees only `status === 'published' && !hidden`, and every mutating route returns `403`.

The frontend hides admin affordances and redirects admin routes, but that is convenience — the server is the boundary.

## Smart gallery alignment

The requirement was: up to 5 per row, and a trailing incomplete row centred rather than left-aligned.

Implementation is pure CSS. Items are fixed at `calc((100% - 4 * gap) / 5)` inside a `flex-wrap` container with `justify-content: center`. A full row of five fills the width exactly, so centring is a no-op for it; only the trailing row visibly centres. Sets of 1–4 widen (via `.gallery--count-N`) so a small gallery does not look like a row of stamps, and the breakpoints drop to 4, then 3, then 2 per row while keeping the same behaviour.

Measured in a headless browser at 1600px: 7 images → rows of 5 (side gaps 0/0) and 2 (348/348); 9 → 5 (0/0) and 4 (116/116); 10 → 5 and 5.

## Colour discipline

The two palettes live in `backend/src/config/themes.js` and reach the browser through the org payload. `frontend/src/utils/theme.js` writes them to CSS custom properties and derives:

- `--on-accent` / `--on-primary` by relative luminance, picking between `#FFFFFF` and `#111827` only. This is why the Technical Hub gold pill gets dark text while the Torii orange pill gets white.
- `--accent-soft` / `--accent-line` as alpha variants of the accent, so chips and focus rings introduce no new hue.

No gradient blends two different brand colours, because interpolation would produce colours outside the approved list.
