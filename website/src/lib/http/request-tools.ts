import type { ApiRequest, BodyMode, HttpMethod } from '@/domain/types'

interface ImportedCurlRequest {
  method: HttpMethod
  url: string
  body: string
  bodyMode: BodyMode
  headers: Array<{ key: string; value: string }>
}

// Tokenize a small shell-like syntax as data. Nothing here evaluates expansions or commands.
const tokenize = (source: string): string[] | null => {
  if (source.includes('\0')) return null
  const tokens: string[] = []
  let word = ''
  let quote = ''
  let active = false
  const text = source.trim()
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!
    if (character === '\\' && quote !== "'") {
      const next = text[index + 1]
      if (next === undefined) return null
      if (next === '\n') {
        index += 1
        continue
      }
      if (next === '\r' && text[index + 2] === '\n') {
        index += 2
        continue
      }
      if (quote === '"' && !['"', '\\', '$', '`'].includes(next)) word += '\\'
      else {
        word += next
        index += 1
      }
      active = true
      continue
    }
    if (quote) {
      if (character === quote) quote = ''
      else word += character
      active = true
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      active = true
      continue
    }
    if (/[;&|<>()\r\n]/.test(character)) return null
    if (/\s/.test(character)) {
      if (active) tokens.push(word)
      word = ''
      active = false
    } else {
      word += character
      active = true
    }
  }
  if (quote) return null
  if (active) tokens.push(word)
  return tokens
}

const validUrl = (url: string): boolean => {
  if (
    /[\s<>"\\]/.test(url) ||
    Array.from(url).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return false
  const candidate = url.replace(/^\{\{base_url\}\}(?=$|[/?#])/, 'https://template.invalid')
  if (!/^https?:\/\//i.test(candidate)) return false
  try {
    return Boolean(new URL(candidate).hostname)
  } catch {
    return false
  }
}

export const parseCurl = (source: string): ImportedCurlRequest | null => {
  const tokens = tokenize(source)
  if (!tokens || tokens[0] !== 'curl') return null
  let method: HttpMethod | undefined
  let url = ''
  const headers: ImportedCurlRequest['headers'] = []
  const bodies: string[] = []
  const ignored = [
    '-s',
    '-S',
    '-L',
    '-k',
    '-g',
    '--silent',
    '--show-error',
    '--location',
    '--insecure',
    '--compressed',
    '--globoff',
  ]
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]!
    if (ignored.includes(token)) continue
    if (token === '-I' || token === '--head') {
      method = 'HEAD'
      continue
    }
    let flag = token
    let value: string | undefined
    if (token.startsWith('--') && token.includes('=')) {
      const split = token.indexOf('=')
      flag = token.slice(0, split)
      value = token.slice(split + 1)
    } else if (/^-[XHd].+/.test(token)) {
      flag = token.slice(0, 2)
      value = token.slice(2)
    }
    if (
      [
        '--url',
        '-X',
        '--request',
        '-H',
        '--header',
        '-d',
        '--data',
        '--data-raw',
        '--data-binary',
      ].includes(flag)
    ) {
      value ??= tokens[++index]
      if (value === undefined) return null
      if (flag === '--url') {
        if (url || !validUrl(value)) return null
        url = value
      } else if (flag === '-X' || flag === '--request') {
        const candidate = value.toUpperCase()
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(candidate))
          return null
        method = candidate as HttpMethod
      } else if (flag === '-H' || flag === '--header') {
        const split = value.indexOf(':')
        const key = value.slice(0, split).trim()
        if (split < 1 || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(key) || /[\r\n\0]/.test(value))
          return null
        headers.push({ key, value: value.slice(split + 1).trim() })
      } else {
        if (flag !== '--data-raw' && value.startsWith('@')) return null
        bodies.push(value)
      }
    } else {
      if (token.startsWith('-') || url || !validUrl(token)) return null
      url = token
    }
  }
  if (!url) return null
  const body = bodies.join('&')
  const contentType =
    headers.find((header) => header.key.toLowerCase() === 'content-type')?.value ?? ''
  const bodyMode: BodyMode =
    bodies.length === 0
      ? 'none'
      : /json/i.test(contentType) ||
          body.trimStart().startsWith('{') ||
          body.trimStart().startsWith('[')
        ? 'json'
        : /x-www-form-urlencoded/i.test(contentType)
          ? 'form'
          : /graphql/i.test(contentType)
            ? 'graphql'
            : 'text'
  return { method: method ?? (bodies.length ? 'POST' : 'GET'), url, body, bodyMode, headers }
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\"'\"'")}'`
const literal = (value: string): string => JSON.stringify(value)
const encodeTemplate = (value: string): string =>
  value
    .split(/(\{\{[^{}]+\}\})/g)
    .map((part) => (part.startsWith('{{') ? part : encodeURIComponent(part)))
    .join('')

export const generateRequestSnippets = (
  request: ApiRequest,
): Record<'curl' | 'fetch' | 'go' | 'python', string> => {
  const auth = request.auth
  let headers = request.headers
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => ({ key: row.key.trim(), value: row.value }))
  let query = request.query
    .filter((row) => row.enabled && row.key.trim())
    .map((row) => ({ key: row.key.trim(), value: row.value }))
  const setHeader = (key: string, value: string) => {
    headers = headers.filter((row) => row.key.toLowerCase() !== key.toLowerCase())
    headers.push({ key, value })
  }
  if (['bearer', 'oauth2', 'inherit'].includes(auth.type))
    setHeader('Authorization', `Bearer ${auth.token}`)
  const basic = auth.type === 'basic'
  if (basic) headers = headers.filter((row) => row.key.toLowerCase() !== 'authorization')
  if (auth.type === 'api-key' && auth.key.trim()) {
    if (auth.location === 'header') setHeader(auth.key.trim(), auth.value)
    else {
      query = query.filter((row) => row.key !== auth.key.trim())
      query.push({ key: auth.key.trim(), value: auth.value })
    }
  }
  const fragmentIndex = request.url.indexOf('#')
  const base = fragmentIndex < 0 ? request.url : request.url.slice(0, fragmentIndex)
  const fragment = fragmentIndex < 0 ? '' : request.url.slice(fragmentIndex)
  const queryText = query
    .map((row) => `${encodeTemplate(row.key)}=${encodeTemplate(row.value)}`)
    .join('&')
  const separator = base.includes('?') ? (/[?&]$/.test(base) ? '' : '&') : '?'
  const url = `${base}${queryText ? separator + queryText : ''}${fragment}`
  const hasBody = request.bodyMode !== 'none'
  const curl = [
    `curl --request ${request.method} ${shellQuote(url)}`,
    ...headers.map((header) => `--header ${shellQuote(`${header.key}: ${header.value}`)}`),
  ]
  if (basic) curl.push(`--user ${shellQuote(`${auth.username}:${auth.password}`)}`)
  if (hasBody) curl.push(`--data-raw ${shellQuote(request.body)}`)

  const fetchHeaders = headers.map((header) => `[${literal(header.key)}, ${literal(header.value)}]`)
  if (basic)
    fetchHeaders.push(
      `["Authorization", "Basic " + btoa(String.fromCharCode(...new TextEncoder().encode(${literal(`${auth.username}:${auth.password}`)})))]`,
    )
  const fetchSnippet = `const response = await fetch(${literal(url)}, {\n  method: ${literal(request.method)},\n  headers: [${fetchHeaders.join(', ')}],${hasBody ? `\n  body: ${literal(request.body)},` : ''}\n});\nconsole.log(await response.text());`

  const goHeaders = headers.map(
    (header) => `\treq.Header.Add(${literal(header.key)}, ${literal(header.value)})`,
  )
  if (basic)
    goHeaders.push(`\treq.SetBasicAuth(${literal(auth.username)}, ${literal(auth.password)})`)
  const go = `package main\n\nimport (\n\t"fmt"\n\t"net/http"${hasBody ? '\n\t"strings"' : ''}\n)\n\nfunc main() {\n\treq, err := http.NewRequest(${literal(request.method)}, ${literal(url)}, ${hasBody ? `strings.NewReader(${literal(request.body)})` : 'nil'})\n\tif err != nil { panic(err) }\n${goHeaders.join('\n')}${goHeaders.length ? '\n' : ''}\tresponse, err := http.DefaultClient.Do(req)\n\tif err != nil { panic(err) }\n\tdefer response.Body.Close()\n\tfmt.Println(response.Status)\n}`
  const pythonHeaders = headers
    .map((header) => `${literal(header.key)}: ${literal(header.value)}`)
    .join(', ')
  const python = `import requests\n\nresponse = requests.request(\n    ${literal(request.method)},\n    ${literal(url)},\n    headers={${pythonHeaders}},${basic ? `\n    auth=(${literal(auth.username)}, ${literal(auth.password)}),` : ''}${hasBody ? `\n    data=${literal(request.body)},` : ''}\n)\nprint(response.text)`
  return { curl: curl.join(' \\\n  '), fetch: fetchSnippet, go, python }
}
