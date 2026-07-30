# Security policy

Thank you for helping keep Dearly safe. People trust this application with
letters they would not put anywhere else, so security reports are taken
seriously and answered.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Email [hello@storitellah.com](mailto:hello@storitellah.com) with:

- what you found, and where (file, route, or steps to reproduce);
- what an attacker could do with it;
- anything needed to reproduce it — a proof of concept, a crafted `.dearly`
  file, a URL, a browser and version.

If the repository has GitHub private vulnerability reporting enabled, you may
use **Security → Report a vulnerability** instead.

**Never include a real letter, a real password, or anyone's personal data in a
report.** Reproduce with test content.

### What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement | within 3 working days |
| Initial assessment | within 7 working days |
| Fix or mitigation for a confirmed high-severity issue | within 30 days |
| Public disclosure | after a fix is released, coordinated with you |

You will be credited in `CHANGELOG.md` unless you would rather not be.

## Scope

**In scope**

- The application in `src/`, including storage, encryption, import validation,
  printing and export
- The optional Pages Functions in `functions/`
- The build and asset-generation scripts in `scripts/`
- The deployed security headers in `public/_headers`

**Out of scope**

- Attacks needing physical access to an unlocked device (Dearly is local-first:
  someone at your unlocked computer can read your letters, exactly as they could
  read a letter left on your desk)
- Browser or operating-system vulnerabilities
- Missing headers on third-party domains
- Automated scanner output without a demonstrated impact
- Denial of service against your own browser storage
- Social engineering

## The threat model, stated plainly

Dearly protects your letters from **the network and from other websites**. It
does not, and cannot, protect them from someone using your unlocked device.

| Threat | Protected? | How |
| --- | --- | --- |
| Letter content sent to a server | Yes | Nothing is ever transmitted; there is no server for content |
| Another site reading your letters | Yes | Same-origin storage, strict CSP, `frame-ancestors 'none'` |
| Script injection through a letter | Yes | Letter text is rendered with `textContent`; no `innerHTML` anywhere |
| Script injection through an imported backup | Yes | Archives are data-only, validated, and markup is stripped |
| Malicious image upload | Yes | Images are identified by content, SVG is refused, everything is re-encoded |
| Path traversal from an archive | Yes | Attachment names are reduced to a safe form |
| Prototype pollution | Yes | Dangerous keys stripped before any merge |
| Someone at your unlocked device | Partly | Lock individual letters with a password |
| A forgotten password | No | By design — there is no recovery path |
| Browser storage being cleared | No | Export backups; Dearly asks for persistent storage |

## Defences in the code

- **No `innerHTML`, anywhere.** Enforced by an ESLint rule that fails the build.
- **No `eval`, no `new Function`, no inline scripts.** Enforced by the CSP and by lint.
- **Content-Security-Policy** (`public/_headers`): `script-src 'self'`,
  `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`,
  `frame-ancestors 'none'`, `connect-src 'self'`, no `unsafe-eval`.
  `style-src-attr 'unsafe-inline'` is the single exception, and it exists because
  the print engine positions pages in real millimetres through style attributes —
  values, never code. No inline `<style>` element is used anywhere.
- **Import validation** (`src/components/security/validate-import.ts`): format and
  version checks, SHA-256 checksum, size ceilings, count ceilings, magic-byte image
  identification, SVG refusal, file-name sanitisation, markup stripping, prototype-key
  stripping. A rejected archive imports *nothing*.
- **Image validation** (`src/components/security/image-validate.ts`): content-based
  type detection, byte and pixel ceilings, local re-encoding that discards metadata
  and anything appended to the file.
- **Encryption** (`src/components/security/crypto.ts`): PBKDF2-SHA256 (250,000
  iterations) + AES-GCM-256, fresh salt and IV per operation, authenticated, with
  explicit handling for wrong passwords, corrupt data and unsupported versions.
- **External links** always carry `rel="noopener noreferrer"`, and only
  `http`, `https` and `mailto` URLs are ever produced from stored data.
- **Server-side routes** accept POST only, require JSON, cap body size, validate
  every field, rate-limit per address, return generic errors, and never log
  letter content.
- **No secrets in the repository.** Anything prefixed `VITE_` is public by
  definition; provider keys live only in Cloudflare secrets. `.gitignore` excludes
  `.env`, `.dev.vars`, key files, exports and `.dearly` archives.

## Dependencies

Dearly has **no runtime dependencies**. Development dependencies are updated
weekly by Dependabot (`.github/dependabot.yml`), and CI runs `npm audit` on every
pull request.

## Repository hardening

Recommended settings for a fork or deployment of this project:

- Protect `main`: require a pull request, require the `test` and `build` checks
  to pass, disallow force pushes and direct commits.
- Enable Dependabot security and version updates.
- Enable secret scanning and push protection.
- Enable code scanning (the CodeQL workflow is included).
- Never store Cloudflare account tokens in the repository. If you add a deploy
  workflow later, use GitHub repository secrets with the minimum permissions
  required.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.x | Yes |

Security fixes are released as patch versions on the latest minor release.
