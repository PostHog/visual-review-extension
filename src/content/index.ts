// Runs on every github.com page, so it stays tiny: parse the URL, check the repo index in
// storage, and only load the tile module (React + hoggies) for a PR in a tracked repo.

import { parsePullRequestUrl } from '../shared/github'
import { send } from '../shared/messages'
import { lookupRepo, needsRefresh, repoIndexItem } from '../shared/repoIndex'
import { onStorageChange } from '../shared/storage'
import type { TileHandle } from './mount'

// mergebox.css makes room for the tile by this id.
const HOST_ID = 'posthog-visual-review'

/**
 * Where the tile goes: last in the row of status tiles (Checks, Comments, Approvals) at the
 * bottom of the PR's merge box. Pages without the merge box (Files changed, Commits, merged
 * and closed PRs) show nothing.
 */
function findPlacement(): Element | null {
    return document.querySelector('[data-testid="mini-status"]')?.parentElement ?? null
}

let host: HTMLElement | null = null
let tile: TileHandle | null = null
let lastHref = ''
let syncId = 0

/**
 * Put the host in place while there's something to show, or back in place if GitHub re-rendered
 * the merge box and dropped it. Otherwise keep it out of GitHub's DOM entirely.
 */
function attach(): void {
    if (!host) {
        return
    }
    if (host.hidden) {
        host.remove()
    } else if (!host.isConnected) {
        findPlacement()?.append(host)
    }
}

function unmount(): void {
    tile?.unmount()
    host?.remove()
    tile = null
    host = null
}

async function sync(): Promise<void> {
    const id = ++syncId
    lastHref = location.href
    const pr = parsePullRequestUrl(location.href)
    // No index means signed out: signing in happens in the toolbar popup, never on GitHub.
    const index = pr ? await repoIndexItem.get() : null
    const entry = pr && index ? lookupRepo(index, pr) : undefined
    if (id !== syncId) {
        return
    }
    if (index && !entry && needsRefresh(index)) {
        // The repo may have been set up since the index was built. If the rebuild adds it,
        // the storage listener below syncs again.
        void send({ type: 'index:refresh' }).catch(() => undefined)
    }
    if (!pr || !entry) {
        unmount()
        return
    }

    const { mountTile } = (await import(chrome.runtime.getURL('tile.js'))) as typeof import('./mount')
    if (id !== syncId) {
        return
    }
    if (tile) {
        tile.update(pr, entry)
    } else {
        const el = document.createElement('section')
        el.id = HOST_ID
        el.setAttribute('aria-label', 'Visual review')
        // Hidden, and so out of the page, until there's something to show.
        el.hidden = true
        host = el
        tile = mountTile(el, pr, entry, (visible) => {
            el.hidden = !visible
            attach()
        })
    }
    attach()
}

let scheduled = false
function schedule(): void {
    if (!scheduled) {
        scheduled = true
        requestAnimationFrame(() => {
            scheduled = false
            void sync()
        })
    }
}

// GitHub navigates with Turbo and React Router and re-renders the merge box freely. The observer
// is the catch-all for both, so its per-mutation work is a string compare and a flag check.
new MutationObserver(() => {
    if (location.href !== lastHref) {
        schedule()
    } else if (host && !host.hidden && !host.isConnected) {
        attach()
    }
}).observe(document.body, { childList: true, subtree: true })
document.addEventListener('turbo:load', schedule)
window.addEventListener('popstate', schedule)
// Sign-in, sign-out, and index rebuilds all land in storage.
onStorageChange([repoIndexItem], schedule)
void sync()
