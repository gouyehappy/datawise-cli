import type {WindowPreferences} from '@/shared/config/app-config.types'
import {normalizeWindow} from '@/shared/config/app-config.service'

export function setupElectronWindowSync(options: {
    getWindow: () => WindowPreferences | undefined
    onWindowChange: (window: WindowPreferences) => void
    applyInitial: (window: WindowPreferences) => void
}) {
    const api = window.datawise?.window
    if (!api) return

    void (async () => {
        const saved = options.getWindow()
        if (saved?.width && saved?.height) {
            await api.setState(normalizeWindow(saved))
        } else {
            const current = await api.getState()
            if (current) options.applyInitial(current)
        }
    })()

    api.onStateChange((state) => {
        options.onWindowChange(state)
    })
}
