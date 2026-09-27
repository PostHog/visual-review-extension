import { cp, mkdir, rm } from 'node:fs/promises'
import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')
const outdir = 'dist'

await rm(outdir, { recursive: true, force: true })
await mkdir(outdir, { recursive: true })

const shared = {
    bundle: true,
    target: 'chrome120',
    minify: !watch,
    sourcemap: watch ? 'inline' : false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
    // Stylesheets are injected as <style> text (the banner lives in a shadow root).
    loader: { '.css': 'text' },
    logLevel: 'info',
}

const builds = [
    // The service worker is an ES module (declared with "type": "module" in the manifest).
    { ...shared, entryPoints: { background: 'src/background/index.ts' }, format: 'esm', outdir },
    // Content scripts can't be modules, so the loader that runs on every GitHub page is a small IIFE…
    { ...shared, entryPoints: { content: 'src/content/index.ts' }, format: 'iife', outdir },
    // …which dynamic-imports the banner module (React + hoggies) only for PRs in tracked repos.
    { ...shared, entryPoints: { banner: 'src/content/mount.tsx' }, format: 'esm', outdir },
    { ...shared, entryPoints: { popup: 'src/popup/index.tsx' }, format: 'iife', outdir },
]

async function copyStatic() {
    await cp('src/manifest.json', `${outdir}/manifest.json`)
    await cp('src/popup/popup.html', `${outdir}/popup.html`)
    await cp('src/assets/icons', `${outdir}/icons`, { recursive: true, filter: (f) => !f.endsWith('.svg') })
    // RoundHog for the popup. @posthog/brand resolves font URLs via import.meta.url, which
    // doesn't survive bundling, so the faces we use are copied and referenced from popup.css.
    await mkdir(`${outdir}/fonts`, { recursive: true })
    for (const face of ['RoundHog', 'RoundHog-Medium', 'RoundHog-SemiBold', 'RoundHog-Bold']) {
        await cp(`node_modules/@posthog/brand/dist/fonts/${face}.woff2`, `${outdir}/fonts/${face}.woff2`)
    }
}

if (watch) {
    const contexts = await Promise.all(builds.map((b) => esbuild.context(b)))
    await copyStatic()
    await Promise.all(contexts.map((c) => c.watch()))
    console.log('Watching for changes… reload the extension in chrome://extensions after edits.')
} else {
    await Promise.all(builds.map((b) => esbuild.build(b)))
    await copyStatic()
}
