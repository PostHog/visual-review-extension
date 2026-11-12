import { describe, expect, it } from 'vitest'

import { headline, tileSummary } from './runSummary'
import type { RunApi, RunView } from './types'

function view(overrides: Partial<RunApi> = {}): RunView {
    return {
        url: '#',
        run: {
            id: 'r1',
            repo_id: 'repo',
            status: 'completed',
            run_type: 'storybook',
            commit_sha: 'abcdef1234567',
            pr_number: 42,
            approved: false,
            summary: { total: 10, changed: 0, new: 0, removed: 0, unchanged: 10, unresolved: 0 },
            error_message: null,
            created_at: '2026-09-26T10:00:00Z',
            completed_at: '2026-09-26T10:05:00Z',
            ...overrides,
        },
    }
}

const changed = { total: 10, changed: 2, new: 1, removed: 0, unchanged: 7 }

describe('tileSummary', () => {
    it('counts unresolved snapshots across runs that need review', () => {
        const runs = [
            view({ summary: { ...changed, unresolved: 3 } }),
            view({ run_type: 'playwright', summary: { ...changed, unresolved: 1 } }),
            view({ run_type: 'clean' }),
        ]
        expect(tileSummary(runs)).toBe('4 to review')
        expect(headline(runs)).toBe('4 snapshots to review')
    })

    it('falls back to the change count when the API has no unresolved count', () => {
        expect(tileSummary([view({ summary: changed })])).toBe('3 to review')
    })

    it('counts failed runs, which win over everything else', () => {
        const runs = [view({ status: 'failed' }), view({ status: 'failed' }), view({ summary: { ...changed, unresolved: 3 } })]
        expect(tileSummary(runs)).toBe('2 runs failed')
        expect(tileSummary(runs.slice(0, 1))).toBe('1 run failed')
    })

    it.each([
        ['Comparing…', view({ status: 'processing' })],
        ['Approved', view({ summary: changed, approved: true })],
        ['No changes', view()],
        ['Changes recorded', view({ summary: changed, pr_number: null })],
    ])('%s', (expected, run) => {
        expect(tileSummary([run])).toBe(expected)
    })
})
