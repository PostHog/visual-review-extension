import { afterEach, describe, expect, it, vi } from 'vitest'

import { lookupRepo, needsRefresh, type RepoIndex } from './repoIndex'

const HOUR = 3600_000
const now = new Date('2026-09-27T12:00:00Z').getTime()

function index(overrides: Partial<RepoIndex> = {}): RepoIndex {
    return {
        builtAt: now,
        repos: { 'posthog/posthog': { projectId: 2, repoId: 'r', fullName: 'PostHog/posthog' } },
        ...overrides,
    }
}

describe('needsRefresh', () => {
    afterEach(() => vi.useRealTimers())

    it.each([
        ['fresh', index(), false],
        ['older than the TTL', index({ builtAt: now - 2 * HOUR }), true],
        ['never built', index({ builtAt: 0 }), true],
        ['stale but a rebuild just failed', index({ builtAt: now - 2 * HOUR, failedAt: now - 60_000 }), false],
        ['stale and the failure was a while ago', index({ builtAt: now - 2 * HOUR, failedAt: now - HOUR }), true],
    ])('%s', (_, idx, expected) => {
        vi.useFakeTimers({ now })
        expect(needsRefresh(idx)).toBe(expected)
    })
})

describe('lookupRepo', () => {
    it('matches owner/repo case-insensitively', () => {
        expect(lookupRepo(index(), { owner: 'posthog', repo: 'PostHog', number: 1 })?.repoId).toBe('r')
        expect(lookupRepo(index(), { owner: 'PostHog', repo: 'other', number: 1 })).toBeUndefined()
    })
})
