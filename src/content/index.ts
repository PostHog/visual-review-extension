// Runs on every github.com page, so it stays tiny: parse the URL, check the repo index in
// storage, and only load the banner module (React + hoggies) for a PR in a tracked repo.

import { parsePullRequestUrl } from '../shared/github'
import { send } from '../shared/messages'
import { lookupRepo, needsRefresh, repoIndexItem } from '../shared/repoIndex'
import { onStorageChange } from '../shared/storage'
import type { BannerHandle } from './mount'

const HOST_ID = 'posthog-visual-review'

/**
 * Where the banner goes, most specific first. GitHub ships hashed CSS-module class names,
 * so we match on stable prefixes and ARIA labels rather than full class names.
 */
function findPlacement(): { el: Element; position: InsertPosition } | null {
    const nav = document.querySelector('nav[aria-label="Pull request navigation"]')
    if (nav) {
        // React PR experience: the header block that holds the title and the tabs.
        const headerContent = nav.closest('[class*="PageLayout-HeaderContent"]')
        if (headerContent) {
            return { el: headerContent, position: 'beforeend' }
        }
        const pageHeader = nav.closest('[class*="PageHeader-PageHeader"]')
        if (pageHeader) {
            return { el: pageHeader, position: 'afterend' }
        }
    }
    // Classic (Rails-rendered) PR page.
    const classicHeader = document.querySelector('#partial-discussion-header')
    if (classicHeader) {
        return { el: classicHeader, position: 'afterend' }
    }
    const tabnav = document.querySelector('.tabnav.pull-request-tab-nav, .js-pull-request-tab-nav')
    return tabnav ? { el: tabnav, position: 'afterend' } : null
}

let host: HTMLElement | null = null
let banner: BannerHandle | null = null
let lastHref = ''
let syncId = 0

/** Put the host in place, or back in place if GitHub re-rendered the header and dropped it. */
function attach(): void {
    if (host && !host.isConnected) {
        const placement = findPlacement()
        placement?.el.insertAdjacentElement(placement.position, host)
    }
}

function unmount(): void {
    banner?.unmount()
    host?.remove()
    banner = null
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

    const { mountBanner } = (await import(chrome.runtime.getURL('banner.js'))) as typeof import('./mount')
    if (id !== syncId) {
        return
    }
    if (banner) {
        banner.update(pr, entry)
    } else {
        host = document.createElement('div')
        host.id = HOST_ID
        banner = mountBanner(host, pr, entry)
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

// GitHub navigates with Turbo and React Router and re-renders the header freely. The observer
// is the catch-all for both, so its per-mutation work is a string compare and a flag check.
new MutationObserver(() => {
    if (location.href !== lastHref) {
        schedule()
    } else if (host && !host.isConnected) {
        attach()
    }
}).observe(document.body, { childList: true, subtree: true })
document.addEventListener('turbo:load', schedule)
window.addEventListener('popstate', schedule)
// Sign-in, sign-out, and index rebuilds all land in storage.
onStorageChange([repoIndexItem], schedule)
void sync()
