# PostHog Visual Review for GitHub

> **Internal tool for the PostHog team.** It isn't a supported PostHog product. The code is public, but it's built around how we use visual review ourselves.

A Chrome extension that shows [visual review](https://github.com/PostHog/posthog/tree/master/products/visual_review) results at the top of GitHub pull requests, so nobody has to scroll to the checks at the bottom of the page.

- **On GitHub:** a banner under the PR header. It uses GitHub's own Primer variables, so it follows light, dark, and dimmed themes. It shows:
  - the overall state (needs review, approved, no changes, in progress, failed)
  - one row per run type (storybook, playwright, …), each linking to its run in PostHog
  
  It only shows up when there's something to report.
- **Popup (toolbar icon):** the only place to sign in. It also shows the current tab's status, the repos being watched, and a default project picker, styled like the PostHog app (RoundHog, LemonButton, hoggies from `@posthog/brand`).

## Install

1. Download [`posthog-visual-review.zip`](https://github.com/PostHog/visual-review-extension/releases/latest/download/posthog-visual-review.zip) from the latest release.
2. Unzip it somewhere it can stay, for example `~/Applications/posthog-visual-review`. Chrome loads the extension from that folder.
3. Open `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder.
5. Pin the extension, click its icon, and choose **Sign in with PostHog**.

**To update:** download the new zip, unzip it over the same folder, and click the reload icon on the extension's card in `chrome://extensions`. Reloading keeps your sign-in. Removing the extension clears it.

## How it works

```
GitHub page ──(content.js, 2 KB)── repo index in chrome.storage ──▶ not a tracked PR: nothing, no request
                    │
                    └── tracked PR ──▶ banner.js ──▶ service worker ──(OAuth bearer)──▶ PostHog API
```

- **Auth.** OAuth 2.0 authorization code + PKCE, run with `chrome.identity.launchWebAuthFlow`.
  - PostHog Cloud goes through `oauth.posthog.com`, which works out whether the user is on US or EU and returns `posthog_base_url` with the token.
  - Self-hosted and local instances are called directly.
  - The `client_id` is the URL of a [client ID metadata document](https://posthog.com/.well-known/oauth/visual-review/client-metadata.json) (CIMD) that lives in [PostHog/posthog.com](https://github.com/PostHog/posthog.com) at `static/.well-known/oauth/visual-review/client-metadata.json`. Each PostHog instance fetches it, so **nothing needs to be set up in PostHog first**, and it's the same client on US, EU, and self-hosted. A self-hosted instance needs outbound HTTPS to posthog.com.
  - The document registers one redirect, `https://coegljbgaffjilmoampifafjigkdmjaf.chromiumapp.org/`. The `key` in `src/manifest.json` pins that extension ID wherever the folder lives, so don't change the key without updating the document.
  - Scopes: `visual_review:read user:read project:read organization:read`. The document caps the client at the same list, so a new scope goes in both.
- **Repo index.** The worker lists visual review repos in every project the token can reach and saves `owner/repo` → project + repo id to `chrome.storage.local`.
  - It is rebuilt on sign-in, when the default project changes, and from the popup's Refresh button.
  - A visit to an unknown repo rebuilds it at most hourly, so newly enabled repos show up. After a failure it backs off for 5 minutes.
  - The default project wins when a repo is set up in more than one project.
- **Loader + banner.** `content.js` runs on every GitHub page but only parses the URL and reads the index. For a PR in a tracked repo it imports `banner.js` (React and the hoggies). Everything else costs no network request and never wakes the worker.
- **Runs.** The newest non-superseded run is kept for each run type. While a run is processing, the banner refreshes every 15s; a tracked PR with no runs yet is checked every minute. It also refreshes when you come back to the tab.
- **Account state.** `background/session.ts` is the only place that clears the session, profile, and index. Every surface re-reads state when `chrome.storage` changes, so signing in or out updates open tabs straight away.

## Develop

```bash
pnpm install
pnpm build        # → dist/
pnpm dev          # rebuild on change, then reload the extension in chrome://extensions
pnpm test         # vitest
pnpm typecheck
```

Load `dist/` with **Load unpacked**, as in [Install](#install).

To use a local PostHog, open the popup, choose **Self-hosted / local**, and enter something like `http://localhost:8010`. Chrome asks for permission to reach that host.

**Design preview.** Every banner state and the popup render with mock data, no extension or sign-in needed:

```bash
pnpm preview && open "preview/out/index.html?theme=dark"   # or ?theme=light, ?popup=signedIn, ?popup=signedOut
pnpm screenshots                                          # PNGs of all of them → preview/out/screenshots/ (needs Chrome)
```

See [AGENTS.md](AGENTS.md) for how to work in this repo.

**Icons** come from the brand logomark: run `node scripts/icons.mjs` (needs `rsvg-convert`).

## Release

1. Bump `version` in `src/manifest.json` and `package.json`.
2. Merge to `main`.
3. Tag and push:

   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```

The [release workflow](.github/workflows/release.yml) checks that the tag matches the manifest version, runs the checks, and attaches `posthog-visual-review.zip` to a GitHub release. The download link in [Install](#install) always points at the newest one.

## Layout

| Path                              | What                                                                     |
| --------------------------------- | ------------------------------------------------------------------------ |
| `src/background/auth.ts`          | PKCE, token exchange, refresh, revoke                                    |
| `src/background/session.ts`       | Account state (the only place it's cleared) and the authenticated `api()` |
| `src/background/repoIndex.ts`     | Builds the tracked-repo index across projects                            |
| `src/background/visualReview.ts`  | Runs for a PR in a tracked repo                                          |
| `src/content/index.ts`            | Loader: URL + index check, placement in GitHub's PR header               |
| `src/content/mount.tsx`, `App.tsx`, `Banner.tsx` | The banner, rendered in a shadow root                     |
| `src/popup/`                      | Popup UI                                                                 |
| `src/shared/runState.ts`          | Run → state rules, mirroring `REVIEW_STATE_FILTERS` in the backend       |
| `src/shared/runCopy.ts`           | Label, tone, and hoggie for each state                                   |

## Known limitations

- **GitHub DOM.** The banner mounts inside GitHub's React PR header, found via `nav[aria-label="Pull request navigation"]`, with fallbacks for the classic layout. If GitHub changes that markup, `findPlacement()` in `src/content/index.ts` is the only place to fix.
- **Consent screen.** PostHog shows a consent screen, with an "unverified application" warning, until staff mark the client verified or first-party in Django admin. That has to be done once per region.
- **Reading only.** The banner doesn't approve or tolerate snapshots.
- **Chrome only.**
