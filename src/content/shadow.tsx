import { createRoot, type Root } from 'react-dom/client'

import styles from './tile.css'

/**
 * A React root inside `host`'s shadow root. Shadow DOM keeps GitHub's CSS out, while Primer's
 * CSS custom properties (colors, fonts) still inherit through it, so the tile follows the
 * user's GitHub theme.
 */
export function createShadowRoot(host: HTMLElement): Root {
    const shadow = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = styles
    const container = document.createElement('div')
    container.className = 'root'
    shadow.append(style, container)
    return createRoot(container)
}
