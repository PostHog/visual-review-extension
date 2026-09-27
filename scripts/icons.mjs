// Renders the PostHog logomark from @posthog/brand into the extension's PNG icons.
// Run once (or whenever the brand package changes): node scripts/icons.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { Logo } from '@posthog/brand/logo'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const outDir = 'src/assets/icons'
mkdirSync(outDir, { recursive: true })

// The logomark is 52x28; center it in a square viewBox so Chrome doesn't stretch it.
const mark = renderToStaticMarkup(createElement(Logo.Logomark, { width: 52, height: 28 }))
const inner = mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -14 56 56">${inner}</svg>`
writeFileSync(`${outDir}/icon.svg`, square)

for (const size of [16, 32, 48, 128]) {
    execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', `${outDir}/icon-${size}.png`, `${outDir}/icon.svg`])
}
console.log('Icons written to', outDir)
