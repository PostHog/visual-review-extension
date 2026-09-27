import type { RunApi, RunView } from './types'

export type RunState = 'failed' | 'processing' | 'needs_review' | 'approved' | 'clean' | 'observe'

export function changeCount(run: RunApi): number {
    return run.summary.changed + run.summary.new + run.summary.removed
}

/**
 * Mirrors REVIEW_STATE_FILTERS in products/visual_review/backend/logic/run_queries.py,
 * collapsed to the one state a reviewer cares about on the PR page.
 */
export function runState(run: RunApi): RunState {
    if (run.status === 'failed') {
        return 'failed'
    }
    if (run.status !== 'completed') {
        return 'processing'
    }
    if (run.approved) {
        return 'approved'
    }
    if (changeCount(run) === 0) {
        return 'clean'
    }
    // A run without a PR is a default-branch push: tracking only, never approvable.
    if (run.pr_number == null) {
        return 'observe'
    }
    // `unresolved` counts snapshots still gating the check. Everything tolerated or
    // approved snapshot-by-snapshot means the run is effectively green.
    if (run.summary.unresolved === 0) {
        return 'clean'
    }
    return 'needs_review'
}

const PRIORITY: RunState[] = ['failed', 'needs_review', 'processing', 'observe', 'approved', 'clean']

/** The state that best describes a set of runs: the most urgent one wins. */
export function overallState(runs: RunView[]): RunState {
    const states = new Set(runs.map((r) => runState(r.run)))
    return PRIORITY.find((s) => states.has(s)) ?? 'clean'
}

/** Keep only the newest, non-superseded run for each run type. */
export function latestRunPerType(runs: RunApi[]): RunApi[] {
    const byType = new Map<string, RunApi>()
    const sorted = [...runs].sort((a, b) => b.created_at.localeCompare(a.created_at))
    for (const run of sorted) {
        if (run.superseded_by_id) {
            continue
        }
        if (!byType.has(run.run_type)) {
            byType.set(run.run_type, run)
        }
    }
    return [...byType.values()].sort((a, b) => a.run_type.localeCompare(b.run_type))
}

export function isInFlight(runs: RunView[]): boolean {
    return runs.some((r) => runState(r.run) === 'processing')
}

export function summaryText(run: RunApi): string {
    const parts: string[] = []
    const { changed, removed } = run.summary
    if (changed) {
        parts.push(`${changed} changed`)
    }
    if (run.summary.new) {
        parts.push(`${run.summary.new} new`)
    }
    if (removed) {
        parts.push(`${removed} removed`)
    }
    return parts.join(' · ')
}

/** When the run last changed: completion, or creation while still running. */
export function runTimestamp(run: RunApi): string {
    return run.completed_at ?? run.created_at
}

export function approverName(run: RunApi): string | null {
    const user = run.approved_by
    if (!user) {
        return null
    }
    return user.first_name || user.email || null
}
