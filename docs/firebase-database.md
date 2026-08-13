# Firebase / Database Reference

Status: **reference only** — nothing in this document is implemented yet.
`firebase auth/sync` (and Stripe entitlements, community feed) are explicitly
out of scope for Phase 1 (see
`openspec/changes/1-scaffold-drawing-engine/proposal.md` and
`openspec/roadmap.md`). Per `CLAUDE.md`, any
change that actually wires this in — auth, Firestore reads/writes, Storage,
Stripe webhook — needs an OpenSpec proposal (`/opsx:propose`) before code is
written. This doc exists so that proposal has the config and schema to work
from.

## 1. Firebase Project Config

Project: `pixi-8dbc2`

```js
const firebaseConfig = {
  apiKey: "AIzaSy...", // full key lives in the Firebase console; not fully
                        // pasted here — grab it fresh from Project Settings >
                        // General when wiring this in
  authDomain: "pixi-8dbc2.firebaseapp.com",
  projectId: "pixi-8dbc2",
  storageBucket: "pixi-8dbc2.firebasestorage.app",
  messagingSenderId: "789313967539",
  appId: "1:789313967539:web:456c89abbbcca2766527c6",
  measurementId: "G-NK5G2EM0EY"
};
```

This is the standard client-side web config object (not a secret — Firebase
web API keys are restricted by security rules, not by keeping the key
private). Still, prefer pulling the live value from the console rather than
copy-pasting an old one, in case it's rotated.

## 2. Environment Setup

**Chosen approach: CDN ES modules (Option A).** This matches the current
repo shape — a no-build-step scaffold (`index.html`, `style.css`, ES modules
under `js/`, see `openspec/changes/1-scaffold-drawing-engine/`). No bundler
exists in this project, so `npm install firebase` (Option B) is not the fit
unless/until the project adopts a bundler for other reasons.

Import Firebase directly from the CDN in an ES module, e.g.:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
// add firebase-auth.js / firebase-storage.js the same way when those are needed
```

Pin the version (`12.17.1` here) rather than using a floating tag, and bump it
deliberately.

## 3. Data Schema

Collections below reflect Pixi's actual domain (canvases/artwork/community),
not a generic placeholder. Field lists are the intended shape for planning
purposes — the OpenSpec proposal that implements each capability is the
place to finalize types/validation/security rules.

### `users/{uid}`
| Field | Type | Notes |
|---|---|---|
| `displayName` | string | |
| `email` | string | |
| `photoURL` | string | optional |
| `createdAt` | timestamp | |

### `users/{uid}/projects/{projectId}`
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `width` | number | |
| `height` | number | |
| `layers` | array<{ name, storagePath, opacity, blendMode }> | |
| `palette` | array\<string> | hex color strings |
| `thumbnailURL` | string | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `entitlements/{uid}`
Written only by the Stripe webhook via the Admin SDK — never from client code.

| Field | Type | Notes |
|---|---|---|
| `licensed` | boolean | |
| `stripeCustomerId` | string | |
| `purchasedAt` | timestamp | |

### `community_posts/{postId}`
Public read, author-only write.

| Field | Type | Notes |
|---|---|---|
| `uid` | string | author |
| `imageURL` | string | |
| `caption` | string | |
| `createdAt` | timestamp | |
| `likeCount` | number | |
| `reportCount` | number | |

### `community_posts/{postId}/likes/{uid}`
Doc ID is the liker's `uid` (one like per user, enforceable by doc-ID
uniqueness).

| Field | Type | Notes |
|---|---|---|
| `createdAt` | timestamp | |

### `community_posts/{postId}/comments/{commentId}`
| Field | Type | Notes |
|---|---|---|
| `uid` | string | |
| `text` | string | |
| `createdAt` | timestamp | |

### `reports/{reportId}`
Top-level moderation queue.

| Field | Type | Notes |
|---|---|---|
| `postId` | string | |
| `reportedBy` | string | uid |
| `reason` | string | |
| `status` | string | `pending` \| `reviewed` \| `dismissed` |
| `createdAt` | timestamp | |

## Storage paths

- `/users/{uid}/projects/{projectId}/layers/{layerId}.png`
- `/users/{uid}/projects/{projectId}/thumbnail.png`
- `/community/{postId}.png`

Confirms the open question below: layer pixel data lives in Storage as PNGs;
Firestore's `layers` array only holds the `storagePath` reference plus
metadata (name, opacity, blendMode).

## Security rules intent

- `users/{uid}/projects/**` — readable/writable only by that uid
- `entitlements/{uid}` — client can read their own doc, cannot write it at all
  (writes only via the Stripe webhook's Admin SDK, which bypasses rules)
- `community_posts` — public read, write only by the post's own `uid`;
  likes/comments writable only by their own author
- Do not ship with default test-mode (open) rules

## Secrets & deployment

Deployment target is **GitHub Pages** (static hosting only, no server compute,
no GitHub Actions/CI planned). This shapes what "secrets" even means here:

- `firebaseConfig` above is not a secret — see the note under Firebase Project
  Config. It ships as-is in client JS. No GitHub repo secrets needed for it.
- Firestore/Storage security rules are the actual access control layer for
  everything in this doc — not secret-keeping.
- Anything that genuinely is a secret (Stripe secret key, Stripe webhook
  signing secret, Firebase Admin SDK service account) cannot run on GitHub
  Pages at all — Pages serves static files only. That code has to live in
  Firebase Cloud Functions (or equivalent server compute), using Firebase's
  own secret storage (`firebase functions:secrets:set` / Secret Manager), not
  GitHub Actions secrets. This only becomes relevant at Phase 4
  (see `openspec/roadmap.md`).

## Open items for whoever proposes the sync/auth change

- Write the actual `rules_version = '2'` Firestore/Storage rules files
  implementing the intent above — this doc states intent, not enforced rules.
- Auth provider(s) to enable — Google sign-in is the confirmed one (see
  `openspec/roadmap.md` Phase 3); others not specified yet.
