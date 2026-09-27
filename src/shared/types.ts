// The fields of the PostHog API this extension reads.
// Source of truth: products/visual_review/frontend/generated/api.schemas.ts in PostHog/posthog.

export interface RepoApi {
    id: string
    repo_full_name: string
}

export interface RunSummaryApi {
    total: number
    changed: number
    new: number
    removed: number
    unchanged: number
    unresolved?: number
}

export interface RunApi {
    id: string
    repo_id: string
    /** pending → processing → completed, or failed */
    status: string
    run_type: string
    commit_sha: string
    pr_number: number | null
    approved: boolean
    approved_by?: { first_name?: string; email?: string } | null
    summary: RunSummaryApi
    error_message: string | null
    created_at: string
    completed_at: string | null
    superseded_by_id?: string | null
}

export interface Paginated<T> {
    results: T[]
}

export interface ProjectBasic {
    id: number
    name: string
}

export interface CurrentUser {
    email: string
    team: { id: number; name: string } | null
    organizations: { id: string }[]
}

/** A PR page on GitHub, parsed from the URL. */
export interface PullRequestRef {
    owner: string
    repo: string
    number: number
}

export interface RunView {
    run: RunApi
    url: string
}

export type PrResults =
    | { kind: 'signed_out' }
    | { kind: 'repo_not_tracked' }
    | { kind: 'no_runs'; repoUrl: string }
    | { kind: 'runs'; runs: RunView[] }
    | { kind: 'error'; message: string }
