INDUSTRY ALLIANCES — THE SIX MOUs
=================================

The slide is a heading — "Six agreements, signed and running" — over a row of the
six. Move onto any of them and it runs out to full width; over its photograph
sits a black plate carrying the institute's name and what the agreement is. Take
the pointer off the row and it goes back to the card it rests on, which is the
first one that has a photograph.

Four ways to move through it: hover, the arrow pill in the top-right corner, the
mouse wheel, and the arrow keys.


WHERE THE SIX STAND
-------------------

  #  Agreement                                    Photograph      Line under the name
  1  Institute of Advanced Energy (IAE), Kyoto    in  (484x362)   MISSING
  2  Automation Anywhere                          in              Intelligent automation & RPA
  3  Snowflake                                    in              Data cloud & analytics
  4  Mile2 Cybersecurity Institute                in              Cybersecurity certifications
  5  o9 Solutions, Inc.                           in              MISSING
  6  AlgoBharath                                  in  (428x297)   MISSING

All six are photographed. Two of them are small — a card is about 930x660 on a
1600-wide display, so Kyoto is upscaled about 1.9x and AlgoBharath about 2.2x and
both are visibly soft next to the other four. They read fine; they are just not
as sharp. If the originals exist at a larger size, send those and they go
straight in.

The photographs came from `Downloads/NCET/NCET/MoU FOLDER` and now live in
`backend/uploads/mou/`. A card with no photograph would wear a plate in the
partner's own colour with its initials on it; none does now, but that is still
what happens if a file goes missing.

The three lines marked MISSING are marked so on purpose. Automation Anywhere,
Snowflake and Mile2 carry a line taken from the centres data; the other three
have no such record anywhere in the project, and the deck does not invent one.
Send a line for each and it goes in.

Nothing on the slide says when an MOU was signed, how long it runs, or how many
students it reaches. None of that has been given.


REPLACING A PHOTOGRAPH
----------------------

Drop the new file here, say which agreement it belongs to, and aim for at least
1400px on the long edge — a card is close to the full height of the screen.

A photograph that arrives as a finished social card — a branded header band, a
wordmark, a vignette — gets cropped back to the photograph inside it, because the
page's own typography carries the message. That is what happened to Snowflake:
the original is kept as `uploads/mou/snowflake-original.jpg` and the crop is

  node tools/crop-image.cjs --port <chrome debug port> \
       --in backend/uploads/mou/snowflake-original.jpg \
       --out backend/uploads/mou/snowflake.jpg --top 360


REPUBLISHING
------------

  node tools/publish-industry-alliances.cjs

The names, captions, colours and photograph paths all live in the PANELS list at
the top of that script.
