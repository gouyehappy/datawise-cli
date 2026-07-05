import type {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import type {useLayoutStore} from '@/features/layout/stores/layout'
import type {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'

export type OnboardingTourPlacement = 'center' | 'right' | 'left' | 'top' | 'bottom'

export interface OnboardingTourStep {
    id: string
    target?: string
    placement: OnboardingTourPlacement
    prepare?: (ctx: OnboardingTourContext) => void | Promise<void>
}

export interface OnboardingTourContext {
    layout: ReturnType<typeof useLayoutStore>
    appConfig: ReturnType<typeof useAppConfigStore>
    workspace: ReturnType<typeof useWorkspaceStore>
}

export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
    {
        id: 'welcome',
        placement: 'center',
    },
    {
        id: 'home',
        target: isDesktopApp() ? 'titlebar-app-menu' : 'nav-home',
        placement: 'right',
    },
    {
        id: 'database',
        target: 'nav-database',
        placement: 'right',
        prepare({layout, appConfig}) {
            appConfig.setShowExplorerPanel(true)
            layout.setModule('database')
        },
    },
    {
        id: 'explorer',
        target: 'explorer-panel',
        placement: 'right',
        prepare({layout, appConfig}) {
            appConfig.setShowExplorerPanel(true)
            layout.setModule('database')
        },
    },
    {
        id: 'workspace',
        target: 'workspace-main',
        placement: 'top',
        prepare({layout, appConfig}) {
            appConfig.setShowExplorerPanel(true)
            layout.setModule('database')
        },
    },
    {
        id: 'ai',
        target: 'nav-ai',
        placement: 'right',
    },
    {
        id: 'terminal',
        target: 'nav-terminal',
        placement: 'right',
    },
    {
        id: 'tips',
        placement: 'center',
    },
]

export const ONBOARDING_STEP_IDS = ONBOARDING_TOUR_STEPS.map((step) => step.id)
