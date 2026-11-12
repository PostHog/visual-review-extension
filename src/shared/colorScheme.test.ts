import { describe, expect, it } from 'vitest'

import { isDarkScheme } from './colorScheme'

describe('isDarkScheme', () => {
    it.each([
        // GitHub resolves the theme, so the system preference doesn't matter.
        ['dark', false, true],
        ['light', true, false],
        ['normal', true, false],
        // The popup supports both and follows the system.
        ['light dark', true, true],
        ['light dark', false, false],
    ])('%s (prefers dark: %s) → %s', (scheme, prefersDark, expected) => {
        expect(isDarkScheme(scheme, prefersDark)).toBe(expected)
    })
})
