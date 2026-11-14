---
title: Docs Conventions
type: reference
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# Docs Conventions

> The single source of truth for how skkuverse-app's documentation is filed and written. Read it before writing or editing a document.

**A document holds only what the code cannot say.** It records a decision and its reason, a constraint from outside this repo, or a procedure that spans repos. It never holds a file inventory, a restated type, schema or contract that another repo owns, a list of callers, a copied value (rule 3) or history, which git keeps. Each fact lives in one place. A constraint that fits in three lines is a tagged comment at the code it constrains, under [ADR 0026](decisions/0026-comments-say-only-what-the-code-cannot.md). A longer one is a document, and that comment cites it with `SEE:`.

## 1. Folders (Diátaxis)

Documents are filed under the four [Diátaxis](https://diataxis.fr/) categories plus three internal ones. **The category follows the reader's need, not the subject matter**, and a document serves one need: when a procedure and its background start sharing a page, split them and link the halves. Knowledge local to one package belongs in that workspace's `README.md` or a document inside it, such as `packages/sds/SDS.md`. This folder is for knowledge that crosses package boundaries.

| Folder | Need | Contents |
| --- | --- | --- |
| `tutorials/` | Learning | A guided lesson for someone with no context |
| `how-to/` | Doing | A runbook for one goal |
| `reference/` | Looking up | Authoritative facts: contracts, specs, rules |
| `explanation/` | Understanding | Why something is shaped this way, and the native mechanism behind it |
| `decisions/` | — | ADRs, `NNNN-kebab-title.md` |
| `internal/` | — | Postmortems and debugging records, `YYYY-MM-topic.md` |
| `plans/` | — | Work plans, mutable and draft by nature, until their work is done |

## 2. Frontmatter and skeleton

Every document opens with this frontmatter, then exactly one `# H1`, then a `> one-line summary` saying what it is and who should read it, then `##` sections with no skipped levels. Start from [`_template.md`](_template.md).

```yaml
---
title: <Title Case>
type: how-to | reference | explanation | tutorial | adr | plan | postmortem
status: draft | accepted | superseded | deprecated
owner: team@skkuverse.com
last-updated: YYYY-MM-DD
audience: internal | public
---
```

- `scripts/conventions/lint_conventions.py` checks the `status` and `audience` values. The `type` list is this repo's convention, which the checker requires as a key only, so a typo there fails review rather than CI.
- A `superseded` or `deprecated` document opens its body with a link to the current SSOT. Update `last-updated` whenever you change what the document says.

## 3. Point at the source, do not copy the value

**Never hardcode a version, measurement or count into a document.** A copied value starts lying silently when the code changes. Write `runtimeVersion is defined in apps/mobile/app.config.ts`, never `runtimeVersion is 3.5.0`. When an example needs a value, use a placeholder such as `<runtime-version>`, or say it was accurate at the time of writing.

## 4. File names and formatting

- **kebab-case, lowercase, `.md`**, as in `ios-build-deploy.md`. ADRs are `NNNN-kebab-title.md`, zero-padded and preferably starting with a verb. Postmortems are `YYYY-MM-topic.md`. ALL-CAPS names are kept for the files GitHub treats specially: `README`, `CONTRIBUTING`, `LICENSE`.
- **Write in English**, the fleet policy `scripts/conventions/lint_conventions.py` enforces. Korean that is itself the product, such as a UX copy example, carries a `<!-- conventions:allow-korean: reason -->` comment on its line, or a whole product-data path is declared under `productCopy` in `.conventions.json`.
- Every code fence declares a language (`ts`, not `typescript`). Structured facts go in tables, and warnings in GitHub admonitions, `> [!NOTE]` and `> [!WARNING]`. `yarn lint:md` runs markdownlint-cli2 with the rules in `.markdownlint.jsonc`, and `.markdownlint-cli2.jsonc` names the paths to lint.

## 5. Lifecycle

- When a plan in `plans/` is done, move what settled to the home the rule above gives it (the code, a comment, an ADR or a document), then delete the plan. Git keeps its history.
- After a structural decision, write one ADR in `decisions/` covering Context, Decision and Consequences.
- When a document disagrees with the code, fix it where you stand, or at minimum leave a `> [!WARNING]` saying it is stale.
