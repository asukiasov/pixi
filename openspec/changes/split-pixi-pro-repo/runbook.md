# Access and distribution runbook

Operator-facing process for selling and maintaining Pro access. Distribution
is fully manual per `proposal.md` — no license server, no Stripe/Supabase
entitlements for this flow.

## 4.1 PayPal → GitHub collaborator flow

1. Buyer pays $5, one-time, via https://paypal.me/asukiasov (this is the
   link published in `pixi`'s README).
2. **Buyer's GitHub username isn't collected by PayPal itself.** Until
   there's a proper checkout flow, the buyer needs to send it separately —
   e.g. in the PayPal payment note, or by email/DM. Confirm which channel
   you're actually using and add it to the README's Pro-access paragraph
   next to the PayPal link, since right now a buyer paying has no stated
   way to tell you who they are on GitHub.
3. Operator checks for the payment (PayPal notification email, or the
   PayPal dashboard) and the buyer's GitHub username.
4. Add the buyer as a collaborator on the private `pixi-pro` repo:
   `github.com/asukiasov/pixi-pro` → Settings → Collaborators and teams →
   Add people → enter their GitHub username → **Read** access is enough
   (a buyer needs to clone/pull, not push).
5. GitHub emails the buyer an invite; they accept it and get repo access,
   including the live Cloudflare demo URL and instructions in
   `pixi-pro`'s own README.
6. Turnaround: manual, no formal SLA today. Decide on and state a real
   number (e.g. "within 24 hours") once this has run a few times for real
   — an unstated SLA on a paid product is worth fixing before it's
   pointed to publicly.

## 4.2 Release-zip alternative

For a buyer who doesn't want ongoing GitHub access (no GitHub account, or
just wants the code once):

1. Clone `pixi-pro` fresh into a scratch directory:
   ```bash
   git clone https://github.com/asukiasov/pixi-pro.git pixi-pro-release
   cd pixi-pro-release
   git submodule update --init --recursive
   ```
2. Flatten it into a plain source tree — a submodule-aware buyer without
   repo access can't `git submodule update` themselves, so the `pixi/`
   directory's contents need to be actual files, not a submodule pointer:
   ```bash
   rm -rf .git pixi/.git .gitmodules
   ```
3. Zip the directory and send it to the buyer (email attachment or a
   file-transfer link — whatever channel task 4.1 uses for the GitHub
   username also works here).
4. This is a point-in-time snapshot pinned to whatever `pixi` tag
   `pixi-pro`'s submodule was on at clone time — it does not auto-update.
   State that explicitly to the buyer so they don't expect future Pro
   fixes to appear in it.

## 4.3 Submodule-pin-bump process

When `pixi-pro` should pick up a newer `pixi` release (bug fix, new hook,
new Standard feature Pro modules need to build against):

1. In `pixi`: confirm the target commit is on `main` and pushed to
   `origin`.
2. Cut a new annotated tag on that commit and push it:
   ```bash
   git tag -a vX.Y.Z -m "..."
   git push origin vX.Y.Z
   ```
3. In `pixi-pro`, bump the submodule pin to the new tag:
   ```bash
   cd pixi
   git fetch origin --tags
   git checkout vX.Y.Z
   cd ..
   git add pixi
   git commit -m "Bump pixi submodule pin to vX.Y.Z"
   git push origin main
   ```
4. Cloudflare auto-deploys `pixi-pro`'s `main` on push (git-connected, no
   manual trigger needed).
5. **Smoke-test the live demo after every bump** — don't assume the pin
   bump alone is safe. If `pixi` removed or renamed an extension hook a
   Pro module depends on (e.g. `registerApplyPixelTransform`), the Pro
   module fails at import time with a `SyntaxError` in the browser
   console, not at build/deploy time, since there's no build step to
   catch it. This exact failure happened during initial deployment
   (`pixi-pro` pinned to `v0.2.0`, which predated the extraction hooks) —
   see this change's `tasks.md` section 3 history.
