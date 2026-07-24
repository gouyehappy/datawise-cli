/**
 * 统一异步视图工厂：所有 Tab / 设置分区 / 模块页共享 loading / error 占位，避免打开时布局塌陷。
 *
 * loading / error 使用 defineComponent + h()（不依赖 .vue SFC），便于 Node 单测与 Vite 运行时共用。
 */
import {
    defineAsyncComponent,
    defineComponent,
    h,
    type AsyncComponentLoader,
    type Component,
} from 'vue'
import {useI18n} from 'vue-i18n'

export type LazyViewLoader = AsyncComponentLoader

const DEFAULT_TIMEOUT_MS = 60_000

const shellStyle = {
    position: 'absolute',
    inset: '0',
    zIndex: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '14px',
    width: '100%',
    height: '100%',
    minHeight: '100%',
    background: 'var(--dw-bg-editor)',
    color: 'var(--dw-text-secondary)',
    fontSize: 'var(--dw-text-md)',
    textAlign: 'center',
    boxSizing: 'border-box',
    padding: '24px',
} as const

const spinnerStyle = {
    width: '28px',
    height: '28px',
    border: '2px solid color-mix(in srgb, var(--dw-primary) 22%, transparent)',
    borderTopColor: 'var(--dw-primary)',
    borderRadius: '50%',
    animation: 'dw-panel-async-spin 0.75s linear infinite',
} as const

/** 确保 spinner 关键一次即可；重复注入无害 */
function ensureAsyncSpinKeyframes(): void {
    if (typeof document === 'undefined') return
    if (document.getElementById('dw-panel-async-spin-style')) return
    const style = document.createElement('style')
    style.id = 'dw-panel-async-spin-style'
    style.textContent = '@keyframes dw-panel-async-spin{to{transform:rotate(360deg)}}'
    document.head.appendChild(style)
}

export const PanelLoadingShell = defineComponent({
    name: 'PanelLoadingShell',
    setup() {
        ensureAsyncSpinKeyframes()
        let label = 'Loading…'
        try {
            label = String(useI18n().t('common.panelLoading'))
        } catch {
            /* 单测 / 无 i18n 注入 */
        }
        return () =>
            h(
                'div',
                {
                    class: 'panel-loading-shell',
                    role: 'status',
                    'aria-live': 'polite',
                    'aria-busy': 'true',
                    'aria-label': label,
                    style: shellStyle,
                },
                [
                    h('span', {class: 'panel-loading-shell__spinner', 'aria-hidden': 'true', style: spinnerStyle}),
                    h('div', {style: {fontWeight: '500', color: 'var(--dw-text-secondary)'}}, label),
                ],
            )
    },
})

export const PanelLoadError = defineComponent({
    name: 'PanelLoadError',
    setup() {
        let title = 'Failed to load page'
        let hint = 'The view could not be loaded in time. Reload the app and try again.'
        let reloadLabel = 'Reload'
        try {
            const {t} = useI18n()
            title = String(t('common.panelLoadFailedTitle'))
            hint = String(t('common.panelLoadFailedHint'))
            reloadLabel = String(t('common.reload'))
        } catch {
            /* 单测 / 无 i18n 注入时回退英文 */
        }
        return () =>
            h(
                'div',
                {
                    class: 'panel-load-error',
                    role: 'alert',
                    style: shellStyle,
                },
                [
                    h('div', {style: {fontWeight: '600', color: 'var(--dw-danger)'}}, title),
                    h(
                        'div',
                        {
                            style: {
                                maxWidth: '420px',
                                color: 'var(--dw-text-secondary)',
                                fontSize: 'var(--dw-text-sm)',
                            },
                        },
                        hint,
                    ),
                    h(
                        'button',
                        {
                            type: 'button',
                            class: 'panel-load-error__reload',
                            style: {
                                marginTop: '8px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--dw-border)',
                                background: 'var(--dw-bg-panel)',
                                color: 'var(--dw-text)',
                                cursor: 'pointer',
                            },
                            onClick: () => window.location.reload(),
                        },
                        reloadLabel,
                    ),
                ],
            )
    },
})

export function createLazyView(
    loader: LazyViewLoader,
    options?: {timeout?: number},
): Component {
    return defineAsyncComponent({
        loader,
        loadingComponent: PanelLoadingShell,
        errorComponent: PanelLoadError,
        /** Vue 默认 delay=200ms，慢网前会先空白一帧导致「变形」 */
        delay: 0,
        timeout: options?.timeout ?? DEFAULT_TIMEOUT_MS,
    })
}

/** 空闲时预取 chunk，降低首次打开 Tab 的等待与占位闪现 */
export async function prefetchLazyLoaders(
    loaders: Array<LazyViewLoader | null | undefined>,
): Promise<void> {
    const jobs = loaders.filter((loader): loader is LazyViewLoader => typeof loader === 'function')
    if (jobs.length === 0) return
    await Promise.allSettled(jobs.map((loader) => loader()))
}

export function scheduleIdleWarmup(task: () => void, timeoutMs = 2_500): void {
    if (typeof window === 'undefined') {
        task()
        return
    }
    const ric = window.requestIdleCallback
    if (typeof ric === 'function') {
        ric(() => task(), {timeout: timeoutMs})
        return
    }
    window.setTimeout(task, Math.min(800, timeoutMs))
}
