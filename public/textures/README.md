# Textures

Interface textures used by the application shell (as distinct from
`public/stationery/`, which holds paper textures printed on the page).

Every file here must be:

- self-contained (no external references, no scripts, no fonts);
- small — a tile that repeats, not a full-page image;
- lazily requested, never part of the first paint.

`paper-grain.svg` is the only texture currently shipped. It is a repeating tile
used behind the memory box on large screens.
