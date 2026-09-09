import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import ts from 'typescript'

const root = resolve(process.cwd(), 'src')
const violations = []

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = resolve(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(path) ? [path] : []
  })

const networkPatterns = [
  [/from\s+['"]axios['"]/, 'Axios import'],
  [/from\s+['"]msw(?:\/[^'"]*)?['"]/, 'MSW import'],
]

const isAliasImport = (specifier) => specifier.startsWith('@/')
const featureName = (display) => display.match(/^src\/features\/([^/]+)\//)?.[1]

const validateImport = (display, specifier, isTest) => {
  if (!isAliasImport(specifier) || isTest) return

  if (display.startsWith('src/domain/') && !specifier.startsWith('@/domain/'))
    violations.push(`${display}: domain may only import domain modules: ${specifier}`)

  if (display.startsWith('src/services/') && !specifier.startsWith('@/domain/'))
    violations.push(`${display}: services may only import domain contracts: ${specifier}`)

  if (display.startsWith('src/state/')) {
    if (
      specifier.startsWith('@/mocks/') ||
      /\/(?:http|grpc|runner)\/(?:http|grpc|runner)-engine$/.test(specifier)
    )
      violations.push(`${display}: state must execute through ExecutionClient: ${specifier}`)
  }

  if (display.startsWith('src/state/') && specifier.startsWith('@/mocks/'))
    violations.push(`${display}: state cannot choose a concrete mock: ${specifier}`)

  if (display.startsWith('src/features/')) {
    if (
      specifier.startsWith('@/mocks/') ||
      specifier.includes('/persistence/') ||
      specifier.includes('/mock-engine/') ||
      /\/(?:http|grpc|runner|datasets|auth)\/(?:http|grpc|runner|dataset|auth)-engine$/.test(
        specifier,
      )
    )
      violations.push(`${display}: feature UI crosses execution boundary: ${specifier}`)

    const owner = featureName(display)
    const importedFeature = specifier.match(/^@\/features\/([^/]+)(?:\/|$)/)?.[1]
    const publicWorkbenchImport = specifier === '@/features/workbench'
    if (importedFeature && importedFeature !== owner && !publicWorkbenchImport)
      violations.push(`${display}: feature imports another feature's internals: ${specifier}`)
  }

  const concreteInfrastructure = [
    '@/mocks/mock-execution-client',
    '@/mocks/fixtures/demo-workspace',
    '@/lib/persistence/local-storage',
  ]
  if (
    concreteInfrastructure.includes(specifier) &&
    display !== 'src/app/dependencies.ts' &&
    !display.startsWith('src/test/')
  )
    violations.push(
      `${display}: concrete infrastructure belongs in app/dependencies.ts: ${specifier}`,
    )
}

for (const file of walk(root)) {
  const source = readFileSync(file, 'utf8')
  const display = relative(process.cwd(), file)
  const isTest = /\/__tests__\/|\.(?:test|spec)\.tsx?$/.test(display)
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  // Inspect executable syntax, not educational snippets stored as strings.
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      validateImport(display, node.moduleSpecifier.text, isTest)
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const target = node.expression
      const name = ts.isIdentifier(target)
        ? target.text
        : ts.isPropertyAccessExpression(target)
          ? target.name.text
          : ''
      if (
        ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'eval', 'Function'].includes(name)
      )
        violations.push(`${display}: forbidden runtime ${name}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(syntax)
  for (const [pattern, label] of networkPatterns) {
    if (pattern.test(source)) violations.push(`${display}: forbidden ${label}`)
  }
  if (
    !display.endsWith('src/lib/persistence/local-storage.ts') &&
    /\blocalStorage\b/.test(source)
  ) {
    violations.push(`${display}: localStorage is restricted to the local storage adapter`)
  }
}

if (violations.length > 0) {
  console.error(`Architecture check failed (${violations.length}):`)
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(
  `Architecture check passed: ${walk(root).length} source files, FE-only local boundaries intact.`,
)
