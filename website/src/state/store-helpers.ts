import type { GrpcResult } from '@/domain/execution/grpc'
import type { WorkspaceData } from '@/domain/types'
import { PulseRepository } from '@/lib/persistence/pulse-repository'
import type { GrpcExecutionSession } from '@/services/execution-client'
import type { RunConfiguration } from '@/state/store-types'

export const initialRunConfig: RunConfiguration = {
  requestId: 'req-create-order',
  mode: 'race',
  datasetId: 'dataset-orders',
  iterations: 10,
  workers: 64,
  durationSeconds: 15,
  targetRate: 120,
  rampUpSeconds: 3,
  holdSeconds: 9,
  rampDownSeconds: 3,
  seed: 20260830,
}

export const persistWorkspace = (
  repository: PulseRepository,
  data: WorkspaceData,
): WorkspaceData => {
  repository.save(data)
  return data
}

const looksSecret = (key: string): boolean =>
  /(?:access|refresh)?_?token|password|secret|api[_-]?key/i.test(key)

const variableId = (key: string): string =>
  `var-captured-${key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`

export const applyEnvironmentWrites = (
  data: WorkspaceData,
  environmentId: string,
  writes: Readonly<Record<string, string>>,
  updatedAt: string,
  options: { secretKeys?: readonly string[] } = {},
): WorkspaceData => {
  if (Object.keys(writes).length === 0) return data
  const explicitSecretKeys = new Set(options.secretKeys ?? [])

  return {
    ...data,
    environments: data.environments.map((environment) => {
      if (environment.id !== environmentId) return environment
      const existingKeys = new Set(environment.variables.map((variable) => variable.key))
      const variables = environment.variables.map((variable) =>
        Object.hasOwn(writes, variable.key)
          ? {
              ...variable,
              value: writes[variable.key] ?? '',
              secret: variable.secret || explicitSecretKeys.has(variable.key),
            }
          : variable,
      )

      for (const [key, value] of Object.entries(writes)) {
        if (existingKeys.has(key)) continue
        variables.push({
          id: variableId(key),
          key,
          value,
          enabled: true,
          secret: looksSecret(key) || explicitSecretKeys.has(key),
          description: 'Captured by post-response action',
        })
      }

      return { ...environment, variables, updatedAt }
    }),
  }
}

export const collectGrpcResult = async (
  session: GrpcExecutionSession,
): Promise<GrpcResult | null> => {
  for await (const event of session.events) {
    if (event.type !== 'completed') continue
    return event.outcome === 'cancelled' ? null : event.result
  }
  return null
}
