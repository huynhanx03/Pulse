import { SeededRandom } from '@/mocks/deterministic-random'

export type VariableScopeName = 'environment' | 'iteration'

export interface VariableScope {
  scope: VariableScopeName
  values: Readonly<Record<string, string>>
}

export interface ResolutionTraceEntry {
  key: string
  scope: VariableScopeName | 'dynamic'
  value: string
  masked: boolean
}

export interface TemplateResolution {
  value: string
  trace: ResolutionTraceEntry[]
  unresolved: string[]
}

interface ResolveOptions {
  seed?: number
  secretKeys?: readonly string[]
  now?: Date
}

/** Lists authored template keys once, excluding built-in dynamic expressions. */
export const extractTemplateKeys = (source: string): string[] => [
  ...new Set(
    [...source.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)]
      .map((match) => match[1]?.trim() ?? '')
      .filter((key) => key.length > 0 && !key.startsWith('$')),
  ),
]

const dynamicValue = (key: string, random: SeededRandom, now: Date): string | undefined => {
  switch (key) {
    case '$random.uuid':
      return random.uuid()
    case '$random.email':
      return `qa+${random.integer(1000, 9999)}@pulse.local`
    case '$random.int':
      return String(random.integer(1, 10_000))
    case '$timestamp':
      return now.toISOString()
    default:
      return undefined
  }
}

export const resolveTemplate = (
  template: string,
  scopes: readonly VariableScope[],
  options: ResolveOptions = {},
): TemplateResolution => {
  const random = new SeededRandom(options.seed ?? 20260830)
  const now = options.now ?? new Date('2026-08-30T00:00:00.000Z')
  const secretKeys = new Set(options.secretKeys ?? [])
  const trace: ResolutionTraceEntry[] = []
  const unresolved = new Set<string>()

  const value = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim()
    const dynamic = dynamicValue(key, random.fork(`${key}:${trace.length}`), now)
    if (dynamic !== undefined) {
      trace.push({ key, scope: 'dynamic', value: dynamic, masked: false })
      return dynamic
    }

    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      const scope = scopes[index]
      if (scope && Object.hasOwn(scope.values, key)) {
        const resolved = scope.values[key] ?? ''
        trace.push({ key, scope: scope.scope, value: resolved, masked: secretKeys.has(key) })
        return resolved
      }
    }

    unresolved.add(key)
    return `{{${key}}}`
  })

  return { value, trace, unresolved: [...unresolved] }
}
