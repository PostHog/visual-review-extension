// Which GitHub repos have visual review set up, across every project the user can reach.
//
// The service worker builds it (background/repoIndex.ts) and keeps it in chrome.storage.local.
// Content scripts read it straight from storage, so a PR in a repo that isn't tracked
// costs no network request and doesn't even wake the worker. No index means signed out.

import { repoFullName } from './github'
import { storageItem } from './storage'
import type { PullRequestRef } from './types'

export interface RepoIndexEntry {
    projectId: number
    repoId: string
    fullName: string
}

export interface RepoIndex {
    /** When the index was last built successfully; 0 until the first build. */
    builtAt: number
    /** When a rebuild last failed, so retries back off. */
    failedAt?: number
    repos: Record<string, RepoIndexEntry>
}

export const repoIndexItem = storageItem<RepoIndex>('repoIndex')

/** How long before a visit to an unknown repo triggers a rebuild, so newly enabled repos show up. */
const TTL_MS = 60 * 60_000
/** After a failed rebuild, wait this long before trying again. */
const RETRY_AFTER_FAILURE_MS = 5 * 60_000

export function needsRefresh(index: RepoIndex): boolean {
    const now = Date.now()
    return now - index.builtAt > TTL_MS && now - (index.failedAt ?? 0) > RETRY_AFTER_FAILURE_MS
}

export function repoKey(fullName: string): string {
    return fullName.toLowerCase()
}

export function lookupRepo(index: RepoIndex, pr: PullRequestRef): RepoIndexEntry | undefined {
    return index.repos[repoKey(repoFullName(pr))]
}
