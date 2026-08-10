---
title: Adopt Diátaxis Docs Structure
type: adr
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# 0001. Adopt a Diátaxis-based docs structure

## Status

Accepted — 2026-07-21

## Context

Documents had piled up flat in `docs/`, and the problems compounded:

1. **Staleness.** Documents copied values out of the code and froze them: a `runtimeVersion`
   in the OTA runbook, a rules-test count, nine such cases found in one audit. When the code
   moves, the document goes quietly out of date.
2. **Nothing separated the categories.** Runbooks, native notes, API contracts, postmortems
   and in-progress plans shared one folder, so a settled spec and a draft looked alike.
3. **Documents had no metadata at all.** Frontmatter was missing, and with it any record of
   a document's status or age. The single postmortem in `docs/internal/` was the only
   structured document in the tree.

## Decision

- Adopt the four [Diátaxis](https://diataxis.fr/) folders (`tutorials/`, `how-to/`,
  `reference/`, `explanation/`) plus three internal ones (`decisions/`, `internal/`,
  `plans/`). The axis is the reader's need, not the subject matter.
- Require frontmatter (`title/type/status/owner/last-updated/audience`), one H1, and a
  one-line summary in every document.
- **Never copy a value.** Versions and measurements point at their source-of-truth file
  rather than being written out.
- Add a `README.md` per workspace, so package-local knowledge sits beside the code and
  `docs/` holds only what crosses package boundaries.
- Add markdownlint-cli2 at the root as `yarn lint:md`, configured by
  `.markdownlint-cli2.jsonc`. Prettier is not adopted: this monorepo never had it, and
  introducing a formatter is beyond this decision's scope, so lint `--fix` covers the gap.
- File names are kebab-case, and ADRs are `NNNN-kebab-title.md` following a light MADR
  shape of Context, Decision and Consequences.

The SSOT for all of it is [docs/README.md](../README.md).

## Consequences

- (+) A document's purpose is legible from its path alone. A draft in `plans/` and an
  authority in `reference/` are physically separated.
- (+) The frozen values behind most staleness are blocked by convention and lint, and
  `last-updated` makes age visible.
- (+) An agent can read `type`, `status` and `audience` mechanically and judge how far to
  trust a document.
- (−) Every reference to the old flat `docs/*.md` paths in `CLAUDE.md`, `README.md` and
  source comments had to be updated, which happened on this ADR's own branch.
- (−) Writing a new document now costs a categorisation decision. When it is unclear, use
  the reader-need table in [docs/README.md](../README.md).
- Revisit VitePress if the volume grows or a public site is needed, which is not the case
  today.
