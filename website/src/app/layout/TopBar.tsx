import { Command, Menu, Moon, Search, Sun, SunMoon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { EnvironmentSwitcher } from '@/app/layout/EnvironmentSwitcher'
import { WorkspaceSwitcher } from '@/app/layout/WorkspaceSwitcher'
import { PulseLogo } from '@/components/brand/PulseLogo'
import { IconButton } from '@/components/ui/IconButton'
import { usePulseStore } from '@/state/pulse-store'

const themeIcon = {
  system: <SunMoon className="size-4" aria-hidden="true" />,
  light: <Sun className="size-4" aria-hidden="true" />,
  dark: <Moon className="size-4" aria-hidden="true" />,
}

export const TopBar = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const preferences = usePulseStore((state) => state.preferences)
  const setTheme = usePulseStore((state) => state.setTheme)
  const setLocale = usePulseStore((state) => state.setLocale)
  const setCommandOpen = usePulseStore((state) => state.setCommandOpen)
  const setExplorerOpen = usePulseStore((state) => state.setExplorerOpen)

  const cycleTheme = () =>
    setTheme(
      preferences.theme === 'system' ? 'light' : preferences.theme === 'light' ? 'dark' : 'system',
    )
  const isWorkspaceRoute = location.pathname.startsWith('/w/')

  return (
    <header className="z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-2.5 md:px-3">
      <IconButton
        className="mobile-explorer-trigger md:hidden"
        label={t('nav.showExplorer')}
        icon={<Menu className="size-5" />}
        onClick={() => setExplorerOpen(true)}
      />
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center gap-2.5 px-1">
          <PulseLogo />
          <span className="hidden border-l border-border pl-2.5 text-xs font-medium text-ink-muted lg:inline">
            {t('common.appTagline')}
          </span>
        </div>
        {isWorkspaceRoute ? <WorkspaceSwitcher /> : null}
      </div>
      <div className="hidden min-w-0 flex-1 lg:block">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface-sunken px-2.5 text-left text-xs text-ink-subtle transition-colors hover:border-border-strong hover:text-ink-muted"
        >
          <Search className="size-3.5" aria-hidden="true" />
          <span>{t('command.placeholder')}</span>
          <span className="ml-auto flex items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-ink-subtle">
            <Command className="size-2.5" />K
          </span>
        </button>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <EnvironmentSwitcher />
        <IconButton
          className="lg:hidden"
          label={t('nav.openCommand')}
          icon={<Search className="size-4" />}
          onClick={() => setCommandOpen(true)}
        />
        <IconButton
          label={t(`settings.${preferences.theme}`)}
          icon={themeIcon[preferences.theme]}
          onClick={cycleTheme}
        />
        <button
          type="button"
          onClick={() => setLocale(preferences.locale === 'vi' ? 'en' : 'vi')}
          className="flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-[11px] font-bold uppercase text-ink-muted hover:bg-surface-hover hover:text-ink max-md:h-11"
          aria-label={t('settings.language')}
        >
          {preferences.locale}
        </button>
      </div>
    </header>
  )
}
