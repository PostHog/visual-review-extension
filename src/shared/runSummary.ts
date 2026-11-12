// The words shown for a PR's runs: on the merge box tile, in its panel, and per run.

import { approverName, changeCount, overallState, type RunState, runState, summaryText } from './runState'
import type { RunApi, RunView } from './types'

/** Snapshots still waiting for a reviewer, across the runs that need review. */
export function snapshotsToReview(runs: RunView[]): number {
    return runs
        .filter((r) => runState(r.run) === 'needs_review')
        .reduce((sum, r) => sum + (r.run.summary.unresolved ?? changeCount(r.run)), 0)
}

/** A few words for the merge box tile, after "Visual review": "5 to review", "Approved", … */
export function tileSummary(runs: RunView[], state: RunState = overallState(runs)): string {
    switch (state) {
        case 'needs_review':
            return `${snapshotsToReview(runs)} to review`
        case 'failed': {
            const failed = runs.filter((r) => runState(r.run) === 'failed').length
            return `${failed} ${failed === 1 ? 'run' : 'runs'} failed`
        }
        case 'processing':
            return 'Comparing…'
        case 'observe':
            return 'Changes recorded'
        case 'approved':
            return 'Approved'
        case 'clean':
            return 'No changes'
    }
}

/** The panel's headline: "5 snapshots to review", "Snapshots approved by Paul", … */
export function headline(runs: RunView[], state: RunState = overallState(runs)): string {
    switch (state) {
        case 'needs_review': {
            const total = snapshotsToReview(runs)
            return `${total} snapshot${total === 1 ? '' : 's'} to review`
        }
        case 'failed':
            return 'A run failed'
        case 'processing':
            return 'Comparing snapshots…'
        case 'approved': {
            const who = runs.map((r) => approverName(r.run)).find(Boolean)
            return who ? `Snapshots approved by ${who}` : 'Snapshots approved'
        }
        case 'observe':
            return 'Visual changes recorded'
        case 'clean':
            return 'All snapshots match'
    }
}

/** One run's status: "3 changed · 1 new", "Diffing snapshots", the error, … */
export function runDetail(run: RunApi): string {
    const state = runState(run)
    if (state === 'failed') {
        return run.error_message || 'Processing failed'
    }
    if (state === 'processing') {
        return run.status === 'pending' ? 'Waiting for screenshots' : 'Diffing snapshots'
    }
    const summary = summaryText(run)
    if (state === 'approved') {
        return `${summary || 'Changes'} approved`
    }
    return summary || `${run.summary.total} unchanged`
}
