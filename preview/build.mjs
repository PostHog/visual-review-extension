import { cp, mkdir } from 'node:fs/promises'
import * as esbuild from 'esbuild'

await mkdir('preview/out', { recursive: true })
await esbuild.build({
    entryPoints: ['preview/preview.tsx'],
    outfile: 'preview/out/preview.js',
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    loader: { '.css': 'text' },
    define: { 'process.env.NODE_ENV': '"development"' },
    logLevel: 'warning',
})
await cp('preview/index.html', 'preview/out/index.html')
// popup.css references fonts relative to itself
await cp('dist/fonts', 'preview/out/fonts', { recursive: true })
