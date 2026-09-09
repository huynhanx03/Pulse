export class JsonPathSyntaxError extends Error {
  constructor(path: string) {
    super(`Unsupported JSON path: ${path}`)
    this.name = 'JsonPathSyntaxError'
  }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$-]*/

export const parseJsonPath = (path: string): Array<string | number> => {
  if (path === '$') return []
  if (!path.startsWith('$')) throw new JsonPathSyntaxError(path)
  const segments: Array<string | number> = []
  let cursor = 1

  while (cursor < path.length) {
    if (path[cursor] === '.') {
      cursor += 1
      const match = path.slice(cursor).match(IDENTIFIER)
      if (!match) throw new JsonPathSyntaxError(path)
      segments.push(match[0])
      cursor += match[0].length
      continue
    }

    if (path[cursor] === '[') {
      const rest = path.slice(cursor)
      const index = rest.match(/^\[(\d+)\]/)
      if (index) {
        segments.push(Number(index[1]))
        cursor += index[0].length
        continue
      }
      const quoted = rest.match(/^\[(["'])((?:\\.|(?!\1).)*)\1\]/)
      if (quoted) {
        const quote = quoted[1]!
        const raw = quoted[2]!
        segments.push(raw.replaceAll(`\\${quote}`, quote).replaceAll('\\\\', '\\'))
        cursor += quoted[0].length
        continue
      }
    }

    throw new JsonPathSyntaxError(path)
  }

  return segments
}

export const readJsonPath = (source: unknown, path: string): unknown => {
  let current = source
  for (const segment of parseJsonPath(path)) {
    if (Array.isArray(current) && typeof segment === 'number') {
      current = current[segment]
      continue
    }
    if (
      typeof segment !== 'string' ||
      typeof current !== 'object' ||
      current === null ||
      !Object.hasOwn(current, segment)
    )
      return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}
