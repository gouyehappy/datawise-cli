import {readDatawiseHost} from '@/features/layout/services/desktop-bridge'

export function isDesktopApp(): boolean {
    return typeof window !== 'undefined' && Boolean(readDatawiseHost())
}

export function desktopPlatform(): string | null {
    return readDatawiseHost()?.platform ?? null
}
