## 1. License

- [x] 1.1 Add `LICENSE` at repo root: standard MIT text, copyright
      Aleksandr Sukiasov, 2026. (Was already sitting as an untracked file
      in the working tree, correct content, since before this change's
      own history starts. Landed in `main`'s git history as a side effect
      of merging `embeddable-integration-api` — that branch had it
      committed already, from its own task 4.3's LICENSE-confirmation
      work — not via a dedicated commit in this change. Verified on
      `main`: `git ls-files LICENSE` finds it tracked, content unchanged.)

## 2. Contributor documents

- [x] 2.1 Add `CONTRIBUTING.md`: how to propose a change (OpenSpec,
      `/opsx:propose`), the "bug fixes can skip OpenSpec" carve-out from
      `CLAUDE.md`, local dev setup (link to README's existing
      instructions rather than repeating them), test requirements
      (`npm test` must pass), PR expectations. (Written at repo root.
      Points to `CLAUDE.md` for the full OpenSpec process rather than
      restating it — matches the README's own existing "see CLAUDE.md for
      the process" pattern in its Project structure section. Links
      `README.md#quick-start`/`#testing` rather than duplicating setup
      instructions. Also references the Web Interface Guidelines
      (`vercel-labs/web-interface-guidelines` on GitHub — verified the
      actual URL via `.claude/skills/web-design-guidelines/SKILL.md`
      rather than guessing one) as a non-mandatory check for UI-touching
      PRs, matching `CLAUDE.md`'s own guidance on when that skill applies.)
- [x] 2.2 Add `CODE_OF_CONDUCT.md`: standard Contributor Covenant text.
      (Contributor Covenant v2.1, unmodified boilerplate per the task's
      own instruction — the one project-specific line is the enforcement
      contact, `asukiasov@gmail.com`, matching the address already public
      in the README's Pro-access section.)

## 3. GitHub templates

- [x] 3.1 Add `.github/ISSUE_TEMPLATE/bug_report.md`. (Standard
      GitHub-recognized frontmatter (`name`/`about`/`labels`) plus repro
      steps, expected behavior, environment (including Standard-vs-Pro,
      since that affects which codebase a bug lives in), and a link to
      the live demo for reproduction.)
- [x] 3.2 Add `.github/ISSUE_TEMPLATE/feature_request.md`. (Asks
      explicitly why a request belongs in Standard rather than Pro-tier,
      linking the README's Standard vs. Pro table — this repo has a real,
      documented product split a generic template wouldn't know to ask
      about. Also points at `openspec/roadmap.md` before a duplicate
      request gets filed.)
- [x] 3.3 Add `.github/PULL_REQUEST_TEMPLATE.md`. (Links the OpenSpec
      change a PR implements, or asks the submitter to state it's a
      spec-exempt bug fix per `CONTRIBUTING.md`'s carve-out; a `npm test`
      checkbox; a Web Interface Guidelines checkbox for UI-touching PRs,
      matching CONTRIBUTING.md's own guidance.)

## 4. README updates

- [x] 4.1 Shrink README's "Contributing / process" section to a short
      pointer at `CONTRIBUTING.md`, removing the now-duplicated detail.
      (This change's own `proposal.md` describes README as already having
      a brief "Contributing / process" section to shrink — by the time
      this task actually ran, README had been rewritten since that
      proposal was written (multiple intervening commits; see `git log
      --oneline -- README.md`) and no such section existed anymore in any
      form. So "shrink" didn't apply — added a new, short `## Contributing`
      section instead, in the same place a "Contributing / process"
      section would logically sit (right after "Support the Project",
      before "License"), pointing at `CONTRIBUTING.md` and
      `CODE_OF_CONDUCT.md` rather than restating either. Also trimmed the
      one sentence in "Support the Project" that briefly mentioned PRs/
      issues, since the new section is now the single place that's
      stated.)
- [x] 4.2 Add a license line (and/or badge) to README, linking to
      `LICENSE`. (Already shipped independently, before this change's own
      work started — commit `c9b04fe`, "README: add License section and
      Canvas 2D rendering note" — a `## License` section linking
      `[MIT](LICENSE)`. Verified still present and correct on `main`;
      nothing left to do here.)

## 5. Verify

- [x] 5.1 Read all new/changed files end to end for internal consistency
      (no contradictions between README/CONTRIBUTING/CLAUDE.md on the
      contribution process). (Checked every cross-reference actually
      resolves rather than assuming: `README.md#quick-start`/`#testing`
      (linked from `CONTRIBUTING.md`), `CONTRIBUTING.md#proposing-a-change`
      (linked from the PR template), `README.md#standard-vs-pro` (linked
      from the feature-request template and `CONTRIBUTING.md`),
      `openspec/roadmap.md`, `CODE_OF_CONDUCT.md` — all confirmed present
      at the exact heading/path referenced, via direct `grep`/`ls`, not by
      eye. No contradictions found between README/CONTRIBUTING/CLAUDE.md
      on the OpenSpec-vs-direct-PR process — CONTRIBUTING.md defers to
      CLAUDE.md for the full process rather than stating its own
      independent version that could drift out of sync with it.)
- [x] 5.2 Confirm `npm test` still passes (no code touched, but confirm
      nothing was accidentally broken). (263/263, identical count to
      before this change's docs-only work — confirms no code was touched,
      as expected.)
