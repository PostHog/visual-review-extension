import { type RepoIndex, repoIndexItem, repoKey } from '../shared/repoIndex'
import type { Paginated, ProjectBasic, RepoApi } from '../shared/types'
import { ApiError, api } from './session'

const CONCURRENCY = 6

async function listRepos(projectId: number): Promise<RepoApi[]> {
    try {
        return (await api<Paginated<RepoApi>>(`/api/projects/${projectId}/visual_review/repos/?limit=200`)).results
    } catch (error) {
        // A project the token can't read, or one without visual review, simply has no repos.
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return []
        }
        throw error
    }
}

async function build(projects: ProjectBasic[], preferredProjectId: number | undefined): Promise<RepoIndex> {
    // The preferred project goes first and wins when a repo is set up in more than one project.
    const ordered = [...projects].sort((a, b) => Number(b.id === preferredProjectId) - Number(a.id === preferredProjectId))
    const results: RepoApi[][] = new Array(ordered.length)
    let next = 0
    await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, ordered.length) }, async () => {
            while (next < ordered.length) {
                const i = next++
                results[i] = await listRepos(ordered[i]!.id)
            }
        })
    )

    const repos: RepoIndex['repos'] = {}
    ordered.forEach((project, i) => {
        for (const repo of results[i]!) {
            repos[repoKey(repo.repo_full_name)] ??= {
                projectId: project.id,
                repoId: repo.id,
                fullName: repo.repo_full_name,
            }
        }
    })
    return { builtAt: Date.now(), repos }
}

let inFlight: Promise<void> | null = null

/** Rebuild the index, sharing one rebuild between concurrent callers. Failures are recorded and rethrown. */
export function refreshRepoIndex(projects: ProjectBasic[], preferredProjectId: number | undefined): Promise<void> {
    inFlight ??= build(projects, preferredProjectId)
        .then((index) => repoIndexItem.set(index))
        .catch(async (error) => {
            // Keep the repos we had; failedAt makes needsRefresh() back off.
            const previous = await repoIndexItem.get()
            if (previous) {
                await repoIndexItem.set({ ...previous, failedAt: Date.now() })
            }
            throw error
        })
        .finally(() => {
            inFlight = null
        })
    return inFlight
}
