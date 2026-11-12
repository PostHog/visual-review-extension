import { Logo } from '@posthog/brand/logo'
import { useSyncExternalStore } from 'react'

import { isDarkScheme } from './colorScheme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function subscribe(onChange: () => void): () => void {
    const media = matchMedia(DARK_QUERY)
    media.addEventListener('change', onChange)
    // GitHub switches themes by changing attributes on <html>.
    const observer = new MutationObserver(onChange)
    observer.observe(document.documentElement, { attributes: true })
    return () => {
        media.removeEventListener('change', onChange)
        observer.disconnect()
    }
}

function isPageDark(): boolean {
    return isDarkScheme(getComputedStyle(document.documentElement).colorScheme, matchMedia(DARK_QUERY).matches)
}

/**
 * The PostHog logomark in the brand's treatment for the page's theme: the full gradient on
 * light, and the single-color (`mono`) mark on dark, drawn in the surrounding text color.
 */
export function BrandLogomark({ className }: { className?: string }) {
    const dark = useSyncExternalStore(subscribe, isPageDark)
    return <Logo.Logomark variant={dark ? 'mono' : 'gradient'} className={className} aria-hidden="true" />
}
