# Vendored upstream

`pi.file-manager` is a third-party plugin that also ships through the official
marketplace. This directory is a vendored copy of one released version, so that
every installation has a file view out of the box (ADR 0241).

## Origin

| Field | Value |
| --- | --- |
| Repository | https://github.com/Tioit-Wang/pi-desktop-plugin-file-manager |
| Tag | `v0.3.1` |
| Commit | `f5f264803f626334d56a812e3b50ce41edcb8537` |
| License | MIT (see `LICENSE`; upstream ships no license file) |
| Marketplace | `vastsa/pi-desktop-plugins` pull request #45 (`packages/pi.file-manager-0.3.1.piplug`) |

The files below are byte-identical to that tag (and to the marketplace pull
request's payload), except for the one manifest field listed under local
changes. Line endings are LF: the upstream commit stores LF, and this
repository's `.gitattributes` keeps it that way.

## Upstream checksums (sha256)

| File | Bytes | sha256 |
| --- | --- | --- |
| `main.js` | 48845 | `b8b52881384bdfc136353e8868aa74045e4055ad362763e602b18424e421d5e1` |
| `README.md` | 14671 | `49e365dba958ac21eb4c9c9b8f41aceec0a9a51bfd1687b517bb5c1ab1be3ddf` |
| `views/index.html` | 345 | `771fd3d8afdea7fca75ed1f1918c1ce93ad1c87babdb321cfb85e910465cd2c1` |
| `views/assets/index.js` | 1338606 | `55709e3c8646c58d2449bc59798f46ed46a07ea66dfa31a1a4ed8029effb8aa8` |
| `manifest.json` | 6756 | `d77847d36aa5756fa94d8f62369c95b198679c77fb9c3702ec0a65efdd5c9092` |

`views-src/` from the upstream repository is deliberately not vendored: this
directory carries the built view the plugin publishes, not its React source.

## Local changes

Only one, so a re-sync stays a copy:

- `manifest.json` gains `"license": "MIT"`, making the vendored copy 6776 bytes
  (`6cb9bba5c3ba9af414b0a5d6cdc59098f84fc4736da78ba1eb053e7dc4e2d9d5`). Every
  shipped plugin carries its license, and the upstream manifest predates that
  convention.

## Re-syncing a newer release

1. Check out the new upstream tag and confirm the marketplace entry points at
   the same bytes.
2. Replace the five files above with the tag's copies.
3. Re-apply `"license": "MIT"` to `manifest.json`.
4. Update `Origin` and the checksum table here, then run
   `node --test test/bundled-plugins.test.mjs` in `apps/desktop`.
5. Leave the version in `manifest.json` untouched: it is the upstream version,
   and the marketplace offers an update from it.
