# tools/

Scripts that build a section from what is on disk, so a page can be rebuilt from its
sources rather than from whoever published it last. Each one is idempotent: run it
again after the files change and it re-derives everything.

The backend must be up on `127.0.0.1:4173` before any of these run.

| Script | Section | Reads from |
| --- | --- | --- |
| `fetch-certification-logos.cjs` | — | `tools/data/logos.json` -> `backend/uploads/certifications/logos/` |
| `publish-certifications.cjs` | Certifications (resolved by key) | `backend/uploads/certifications/` — `badges/`, `Certification Images  Sorted/`, `Certification Logos/Logos.xlsx`, `register-crowd.jpg` |
| `import-leadership-photos.cjs` | Leadership Journey (two sections) | `incoming/Leadership/Leadership Journey/` |
| `presenter-visibility.cjs` | — | toggles what the presenter side shows |

## publish-certifications.cjs

```bash
node tools/publish-certifications.cjs --dry-run   # report + write certification-block.json, publish nothing
node tools/publish-certifications.cjs             # publish
```

Three sources, deliberately split:

- **counts** — `Logos.xlsx`, joined on the certification name
- **logos** — `Logos.xlsx` links, downloaded once by
  `fetch-certification-logos.cjs` into `certifications/logos/`. Preferred over
  `badges/`, because the workbook is the file the user maintains and its links
  resolve for all forty-five rows.
- **artwork** — the badge folder and the nineteen cohort folders, with real pixel
  dimensions read from each file's header
- **prose** — vendor names, fields, and what each exam tests. Authored, so it lives
  in the script. A publisher that read its own copy from the database it writes to
  could not rebuild anything.

No dependencies. The `.xlsx` reader (ZIP central directory + inflate + the sheet XML)
and the image-dimension reader (PNG / JPEG / WEBP / GIF headers) are both in the file.
The xlsx reader is self-contained and worth lifting for the other spreadsheet-backed
sections rather than reimplementing.

### Counts are never guessed

The workbook is a living document and its names drift — the revision on disk calls
one exam "Arduino Certification" where the deck says "Arduino Fundamentals". So the
join is exact, or through the `ALIASES` table, and nothing else. A count that cannot
be matched keeps the figure last verified and is reported with a suggested alias to
paste in.

Fuzzy matching was tried and removed: on this workbook it paired *Azure Fundamentals*
with *Azure Administrator Associate* (1,728 against 660) and the Pega System Architect
with the Senior one. A deck quietly showing a wrong number is worse than one showing
last week's.

The same name listed twice with two different counts is dropped rather than resolved
by last-write-wins, and named in the report. `Microsoft Certified: Azure Administrator
Associate` is currently in the workbook at both 660 and 37; fix it there and the exact
join takes over.

### Reading the report

Every run prints what it could not do:

- **counts the workbook moved** — applied; check they are intended
- **no exact row** — verified figure kept; add an `ALIASES` entry
- **listed twice** — fix the workbook
- **rows the deck does not list** — a new certification; add it to `CREDENTIALS`
- **no badge on disk** — that card falls back to the vendor set in type
- **cohort folders with no `VENDORS` entry** — the folder stays dark until added

## Still living in a session scratchpad

These were never committed and do not survive the session that wrote them. Until
they are, Placements, Platforms, Events and Video Resumes can only be re-published
by hand:

| Needed | Section | Source |
| --- | --- | --- |
| `publish-placements.cjs` | Placements | `backend/uploads/Placements/` |
| `publish-platforms.cjs` | Platforms | `backend/uploads/platform-logos/` |
| `publish-reel.cjs` + `reel-data.cjs` | Events | `backend/uploads/Videos.xlsx` |
| `publish-v2.cjs` | Video Resumes | `backend/uploads/Video Resumes.xlsx` |

The two spreadsheet-backed ones need a workbook reader; use the one inside
`publish-certifications.cjs` rather than writing a third.
