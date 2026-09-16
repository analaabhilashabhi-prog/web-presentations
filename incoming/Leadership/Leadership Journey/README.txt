LEADERSHIP JOURNEY — drop the five photographs here
====================================================

Name them 01..05. The number decides which phase each one lands on, so the
order in the filename is the only thing that matters — the rest of the name is
free text.

  01-*.jpg   ->  Technology Foundation        IBM | Software Engineering
  02-*.jpg   ->  Global Delivery Leadership   Wipro | Project & Technology Leadership
  03-*.jpg   ->  Entrepreneurial Vision       2015-2016 | The Birth of TECHNICAL HUB
  04-*.jpg   ->  Ecosystem Builder            2016-2025 | From Vision to Impact
  05-*.jpg   ->  AI & Innovation Leadership   2025-Present | AI, Innovation, New Ventures

.jpg / .jpeg / .png / .webp all work.


THEN RUN THIS
-------------

With the server running (cd backend && node src/server.js), from the project
root:

    node tools/import-leadership-photos.cjs

It uploads each file, points the matching phase at it in BOTH organizations,
and then fetches every new URL to confirm it returns 200 image/* — which is
what guarantees the photographs still appear once the site is deployed rather
than only on this machine.

Run it as many times as you like; it always re-reads the folder and re-applies.


WHY THE FILES HAVE TO BE HERE
-----------------------------

Images pasted into the chat are visible to Claude but are never written to
disk, so there is no file to upload. Only a real file in this folder can be
imported.
