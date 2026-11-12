// The tile module: React, the hoggies, and the styles. The loader (index.ts) only imports
// this module once it knows the current PR is in a tracked repo.

import { prKey } from '../shared/github'
import type { RepoIndexEntry } from '../shared/repoIndex'
import type { PullRequestRef } from '../shared/types'
import { App } from './App'
import mergeboxStyles from './mergebox.css'
import { createShadowRoot } from './shadow'

const PAGE_STYLE_ID = 'posthog-visual-review-styles'

export interface TileHandle {
    update(pr: PullRequestRef, entry: RepoIndexEntry): void
    unmount(): void
}

/** The page-level rule that makes room for the tile in the merge box (see mergebox.css). */
function addPageStyles(): void {
    if (!document.getElementById(PAGE_STYLE_ID)) {
        const style = document.createElement('style')
        style.id = PAGE_STYLE_ID
        style.textContent = mergeboxStyles
        document.head.append(style)
    }
}

export function mountTile(
    host: HTMLElement,
    pr: PullRequestRef,
    entry: RepoIndexEntry,
    onVisibleChange: (visible: boolean) => void
): TileHandle {
    addPageStyles()
    const root = createShadowRoot(host)
    const render = (pr: PullRequestRef, entry: RepoIndexEntry) =>
        root.render(<App key={prKey(pr)} pr={pr} entry={entry} onVisibleChange={onVisibleChange} />)
    render(pr, entry)
    return { update: render, unmount: () => root.unmount() }
}
