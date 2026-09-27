import { describe, expect, it } from 'vitest'

import { parsePullRequestUrl } from './github'

describe('parsePullRequestUrl', () => {
    it.each([
        ['https://github.com/PostHog/posthog/pull/123', { owner: 'PostHog', repo: 'posthog', number: 123 }],
        ['https://github.com/PostHog/posthog/pull/123/files', { owner: 'PostHog', repo: 'posthog', number: 123 }],
        ['https://github.com/PostHog/posthog/pull/123/changes#diff-abc', { owner: 'PostHog', repo: 'posthog', number: 123 }],
        ['https://github.com/PostHog/posthog/pull/123?w=1', { owner: 'PostHog', repo: 'posthog', number: 123 }],
    ])('parses %s', (url, expected) => {
        expect(parsePullRequestUrl(url)).toEqual(expected)
    })

    it.each([
        'https://github.com/PostHog/posthog/pulls',
        'https://github.com/PostHog/posthog/issues/123',
        'https://github.com/PostHog/posthog/pull/abc',
        'https://gitlab.com/PostHog/posthog/pull/123',
        'not a url',
    ])('ignores %s', (url) => {
        expect(parsePullRequestUrl(url)).toBeNull()
    })
})
