import type {WindowPreferences} from '@/shared/config/app-config.types'
import {normalizeWindow} from '@/shared/config/app-config.service'
import {toWindowStatePayload} from '@/features/layout/services/electron-window-state.service'


export function setupElectronWindowSync(options: {
    getWindow: () => WindowPreferences | undefined
    onWindowChange: (window: WindowPreferences) => void
    applyInitial: (window: WindowPreferences) => void
}) {
    const api = window.datawise?.window
    if (!api) return

    void (async () => {
        try {
            const saved = options.getWindow()
            if (saved?.width && saved?.height) {
                await api.setState(toWindowStatePayload(saved))
            } else {
                const current = await api.getState()
                if (current) options.applyInitial(normalizeWindow(current))
            }
        } catch (error) {
            console.warn('[desktop] window state sync skipped', error)
        }
    })()

    api.onStateChange((state) => {
        options.onWindowChange(state)
    })
}
