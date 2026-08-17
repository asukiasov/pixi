## 1. License

- [ ] 1.1 Add `LICENSE` at repo root: standard MIT text, copyright
      Aleksandr Sukiasov, 2026.

## 2. Contributor documents

- [ ] 2.1 Add `CONTRIBUTING.md`: how to propose a change (OpenSpec,
      `/opsx:propose`), the "bug fixes can skip OpenSpec" carve-out from
      `CLAUDE.md`, local dev setup (link to README's existing
      instructions rather than repeating them), test requirements
      (`npm test` must pass), PR expectations.
- [ ] 2.2 Add `CODE_OF_CONDUCT.md`: standard Contributor Covenant text.

## 3. GitHub templates

- [ ] 3.1 Add `.github/ISSUE_TEMPLATE/bug_report.md`.
- [ ] 3.2 Add `.github/ISSUE_TEMPLATE/feature_request.md`.
- [ ] 3.3 Add `.github/PULL_REQUEST_TEMPLATE.md`.

## 4. README updates

- [ ] 4.1 Shrink README's "Contributing / process" section to a short
      pointer at `CONTRIBUTING.md`, removing the now-duplicated detail.
- [ ] 4.2 Add a license line (and/or badge) to README, linking to
      `LICENSE`.

## 5. Verify

- [ ] 5.1 Read all new/changed files end to end for internal consistency
      (no contradictions between README/CONTRIBUTING/CLAUDE.md on the
      contribution process).
- [ ] 5.2 Confirm `npm test` still passes (no code touched, but confirm
      nothing was accidentally broken).
