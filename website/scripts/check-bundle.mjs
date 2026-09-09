import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const assetsDirectory = resolve(process.cwd(), 'dist/assets')
if (!existsSync(assetsDirectory)) {
  console.error('Bundle check requires dist/. Run npm run build first.')
  process.exit(1)
}

const scripts = readdirSync(assetsDirectory)
  .filter((file) => extname(file) === '.js')
  .map((file) => {
    const path = resolve(assetsDirectory, file)
    const raw = statSync(path).size
    const gzip = gzipSync(readFileSync(path)).byteLength
    return { file, raw, gzip }
  })

const totalGzip = scripts.reduce((sum, script) => sum + script.gzip, 0)
const largest = scripts.toSorted((a, b) => b.gzip - a.gzip)[0]
const totalBudget = 550 * 1024
const chunkBudget = 220 * 1024
const failures = []
if (totalGzip > totalBudget) failures.push(`total JS gzip ${totalGzip} > ${totalBudget}`)
if (largest && largest.gzip > chunkBudget)
  failures.push(`${largest.file} gzip ${largest.gzip} > ${chunkBudget}`)
if (failures.length > 0) {
  console.error(`Bundle budget failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`)
  process.exit(1)
}
console.log(
  `Bundle budget passed: ${scripts.length} chunks, ${Math.round(totalGzip / 1024)} KiB gzip total, largest ${Math.round((largest?.gzip ?? 0) / 1024)} KiB.`,
)
