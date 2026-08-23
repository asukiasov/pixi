## Why

`3-database-prep-sync-reference` repositions Pixi as a project developers
fork and deploy themselves, not a hosted product. That positioning needs
the standard documents an open-source repo is expected to have -
currently the repo has none of them (no LICENSE, no CONTRIBUTING.md, no
CODE_OF_CONDUCT.md, no issue/PR templates) despite already being public
on GitHub with a live GitHub Pages deploy.

## What Changes

- **LICENSE**: MIT, copyright Aleksandr Sukiasov, 2026.
- **CONTRIBUTING.md** (new): expands README's existing brief
  "Contributing / process" section into a real contributor doc - how to
  propose a change via OpenSpec, local dev setup (links to README rather
  than duplicating it), test expectations, PR expectations.
- **CODE_OF_CONDUCT.md** (new): standard Contributor Covenant.
- **`.github/ISSUE_TEMPLATE/bug_report.md`** and
  **`.github/ISSUE_TEMPLATE/feature_request.md`** (new).
- **`.github/PULL_REQUEST_TEMPLATE.md`** (new).
- **README.md**: "Contributing / process" section shrinks to a short
  pointer at `CONTRIBUTING.md`; adds a license line/badge linking to
  `LICENSE`.

## Capabilities

This change is pure repository documentation/governance - it adds no
application behavior and changes nothing testable at runtime. Per this
project's spec-driven schema, a change with no capabilities must set
`skip_specs: true` rather than inventing a requirement to satisfy
validation; that flag is set on this change.

### New Capabilities
(none - `skip_specs: true`)

### Modified Capabilities
(none - `skip_specs: true`)

## Impact

- New files: `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `.github/ISSUE_TEMPLATE/bug_report.md`,
  `.github/ISSUE_TEMPLATE/feature_request.md`,
  `.github/PULL_REQUEST_TEMPLATE.md`.
- Modified: `README.md` (shrink contributing section, add license
  pointer).
- No changes to `js/`, `index.html`, `style.css`, tests, or any
  `openspec/specs/` capability.
