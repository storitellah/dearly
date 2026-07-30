# Fonts

Dearly ships with **no remote font dependency**. Every typeface offered in the
editor is a stack of fonts the operating system already provides, with a generic
fallback (see `src/components/stationery/typography.ts`). That is a deliberate
choice:

- the application renders identically online, offline and when installed;
- no third party ever learns that a letter was opened;
- there is nothing to fail when the network disappears mid-session.

## Bundling a self-hosted font

If you want a specific typeface — for example a licensed serif for the letter
body — bundle it rather than linking to a font CDN, which would break offline use
and leak requests.

1. Put the files in this directory, in `woff2` (and optionally `woff`):

   ```text
   public/fonts/literata-regular.woff2
   public/fonts/literata-italic.woff2
   ```

2. Add an `@font-face` rule in `src/styles/fonts.css` and import it from
   `src/main.ts`:

   ```css
   @font-face {
     font-family: "Literata";
     src: url("/fonts/literata-regular.woff2") format("woff2");
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```

3. Add an entry to `FONTS` in `src/components/stationery/typography.ts`, keeping
   a system fallback at the end of the stack.

The build precaches `public/fonts/*.woff2` into the service worker cache, and
`_headers` serves this directory with a one-year immutable cache, so a bundled
font is available offline from the first visit onwards.

## Licensing

Only bundle a font whose licence permits web embedding and redistribution in a
public repository. Record the licence next to the file, and mention it in the
Credits section of `README.md`.
