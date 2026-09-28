// The sidebar module: React, the hoggies, and the styles. The loader (index.ts) only imports
// this module once it knows the current PR is in a tracked repo.

import { prKey } from '../shared/github'
import type { RepoIndexEntry } from '../shared/repoIndex'
import type { PullRequestRef } from '../shared/types'
import { App } from './App'
import { createShadowRoot } from './shadow'

export interface SidebarHandle {
    update(pr: PullRequestRef, entry: RepoIndexEntry): void
    unmount(): void
}

export function mountSidebar(host: HTMLElement, pr: PullRequestRef, entry: RepoIndexEntry): SidebarHandle {
    const root = createShadowRoot(host)
    const setVisible = (visible: boolean) => {
        host.hidden = !visible
    }
    const render = (pr: PullRequestRef, entry: RepoIndexEntry) =>
        root.render(<App key={prKey(pr)} pr={pr} entry={entry} onVisibleChange={setVisible} />)
    render(pr, entry)
    return { update: render, unmount: () => root.unmount() }
}
