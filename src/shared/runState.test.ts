import { describe, expect, it } from 'vitest'

import { latestRunPerType, overallState, runState, summaryText } from './runState'
import type { RunApi } from './types'

function run(overrides: Partial<RunApi> = {}): RunApi {
    return {
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
        superseded_by_id: null,
        ...overrides,
    }
}

const changed = { total: 10, changed: 2, new: 1, removed: 0, unchanged: 7, unresolved: 3 }

describe('runState', () => {
    it.each([
        ['failed', run({ status: 'failed' })],
        ['processing', run({ status: 'pending' })],
        ['processing', run({ status: 'processing' })],
        ['clean', run()],
        ['needs_review', run({ summary: changed })],
        ['approved', run({ summary: changed, approved: true })],
        ['observe', run({ summary: changed, pr_number: null })],
        // Every change tolerated or approved snapshot-by-snapshot: nothing gates the PR any more.
        ['clean', run({ summary: { ...changed, unresolved: 0 } })],
    ])('%s', (expected, r) => {
        expect(runState(r)).toBe(expected)
    })

    it('treats a missing unresolved count as unresolved changes', () => {
        const { unresolved: _, ...summary } = changed
        expect(runState(run({ summary }))).toBe('needs_review')
    })
})

describe('overallState', () => {
    it('picks the most urgent state', () => {
        const views = [run(), run({ summary: changed }), run({ status: 'processing' })].map((r) => ({
            run: r,
            url: '',
        }))
        expect(overallState(views)).toBe('needs_review')
    })
})

describe('latestRunPerType', () => {
    it('keeps the newest non-superseded run per type', () => {
        const runs = [
            run({ id: 'old', created_at: '2026-09-26T09:00:00Z', superseded_by_id: 'new' }),
            run({ id: 'new', created_at: '2026-09-26T11:00:00Z' }),
            run({ id: 'pw', run_type: 'playwright' }),
        ]
        expect(latestRunPerType(runs).map((r) => r.id)).toEqual(['pw', 'new'])
    })
})

describe('summaryText', () => {
    it('omits zero counts', () => {
        expect(summaryText(run({ summary: changed }))).toBe('2 changed · 1 new')
    })
})
