# Vendored libraries — version manifest

Vendored files are NEVER edited in place. To upgrade: download the release
files from the upstream repo/CDN by hand, replace the file, update this
manifest, and bump `CACHE` in `sw.js` — all three or none. Nothing in
package.json tracks these; this manifest is the only provenance record.

| File | Package | Version | Source |
|---|---|---|---|
| preact/preact.module.js | preact | 10.29.4 | dist/preact.module.js |
| preact/hooks.module.js | preact | 10.29.4 | hooks/dist/hooks.module.js |
| htm/htm.module.js | htm | 3.1.1 | dist/htm.module.js |
| htm/preact.module.js | htm | 3.1.1 | preact/index.module.js |

Note: hooks.module.js contains a bare `import ... from "preact"` — the app's
index.html must serve an import map resolving "preact", "preact/hooks" and
"htm" to these files. That import map is hash-pinned in the CSP; changing it
means recomputing the hash (see README, Develop).

## Fonts (vendor/fonts/)

Variable woff2, latin subset, fetched from Google Fonts (css2 API).

| File | Family | Fetched | License |
|---|---|---|---|
| fonts/bricolage-var.woff2 | Bricolage Grotesque | 2026-07-27 | OFL 1.1 (OFL-bricolage.txt) |
| fonts/jetbrains-mono-var.woff2 | JetBrains Mono | 2026-07-06 | OFL 1.1 (LICENSE-jetbrains-mono.txt) |
