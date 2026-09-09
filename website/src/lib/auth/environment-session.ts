import type { Environment, EnvironmentAuthSession, WorkspaceData } from '@/domain/types'

const emptySession = (profileId: string): EnvironmentAuthSession => ({
  profileId,
  lastCapturedAt: null,
  expiresAt: null,
  refreshCount: 0,
  tokenVersion: 0,
})

export const getEnvironmentAuthSession = (environment: Environment, profileId: string) =>
  environment.authSessions.find((session) => session.profileId === profileId) ??
  emptySession(profileId)

export const updateEnvironmentAuthSession = (
  data: WorkspaceData,
  environmentId: string,
  profileId: string,
  patch: Partial<EnvironmentAuthSession>,
): WorkspaceData => ({
  ...data,
  environments: data.environments.map((environment) => {
    if (environment.id !== environmentId) return environment
    const current = getEnvironmentAuthSession(environment, profileId)
    const sessions = environment.authSessions.some((session) => session.profileId === profileId)
      ? environment.authSessions.map((session) =>
          session.profileId === profileId ? { ...session, ...patch } : session,
        )
      : [...environment.authSessions, { ...current, ...patch }]
    return { ...environment, authSessions: sessions }
  }),
})
