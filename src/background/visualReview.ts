import type { RepoIndexEntry } from '../shared/repoIndex'
import { latestRunPerType } from '../shared/runState'
import type { Paginated, PrResults, PullRequestRef, RunApi } from '../shared/types'
import { api, validSession } from './session'

/** Runs for a PR in a repo the index says is tracked. */
export async function getPrResults(pr: PullRequestRef, { projectId, repoId }: RepoIndexEntry): Promise<PrResults> {
    const session = await validSession()
    const project = `${session.apiHost}/project/${projectId}/visual_review`
    // pr_number is not unique across repos in a project, so filter to this repo afterwards.
    const page = await api<Paginated<RunApi>>(
        `/api/projects/${projectId}/visual_review/runs/?pr_number=${pr.number}&limit=100`,
        session
    )
    const runs = latestRunPerType(page.results.filter((r) => r.repo_id === repoId))
    if (runs.length === 0) {
        return { kind: 'no_runs', repoUrl: `${project}/repos/${repoId}/runs` }
    }
    return { kind: 'runs', runs: runs.map((run) => ({ run, url: `${project}/runs/${run.id}` })) }
}
