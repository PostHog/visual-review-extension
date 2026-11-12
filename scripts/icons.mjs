// Renders the extension's PNG icons from the paintbrush logo: the brush, centered on a white
// rounded square so it stands out on light and dark toolbars alike.
// Run whenever the logo changes: node scripts/icons.mjs (needs ImageMagick 7, `magick`)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const source = 'src/assets/logo/paintbrush.png'
const outDir = 'src/assets/icons'
const master = 1024
// The artwork sits on a transparent canvas with faint, nearly invisible pixels around it.
// Crop to the solid shape, then scale it into the tile with some breathing room.
const artwork = Math.round(master * 0.78)
const radius = Math.round(master * 0.22)
// Outside the icons folder, which is copied into the extension as is.
const scratch = mkdtempSync(join(tmpdir(), 'icons-'))
const masterPng = join(scratch, 'icon-master.png')

const magick = (...args) => execFileSync('magick', args, { stdio: 'inherit' })

magick(
    // White rounded square.
    '-size', `${master}x${master}`, 'xc:none',
    '-fill', 'white', '-draw', `roundrectangle 0,0 ${master - 1},${master - 1} ${radius},${radius}`,
    // The brush, cropped to its shape, centered on it.
    '(', source, '-channel', 'A', '-fx', 'a < 0.1 ? 0 : a', '+channel', '-trim', '+repage',
    '-resize', `${artwork}x${artwork}`, ')',
    '-gravity', 'center', '-composite',
    masterPng
)
for (const size of [16, 32, 48, 128]) {
    magick(masterPng, '-filter', 'Lanczos', '-resize', `${size}x${size}`, '-strip', `${outDir}/icon-${size}.png`)
}
rmSync(scratch, { recursive: true })
console.log('Icons written to', outDir)
