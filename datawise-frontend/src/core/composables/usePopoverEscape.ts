import {onUnmounted, watch, type MaybeRefOrGetter, toValue} from 'vue'

export type UsePopoverEscapeOptions = {
    /**
     * 点击这些节点之外时关闭浮层。
     * 传入后启用 outside dismiss（含 Teleport 菜单时需同时传入触发器与菜单根节点）。
     */
    containRefs?: MaybeRefOrGetter<Array<HTMLElement | null | undefined>>
    /** 默认 true；仅在提供 containRefs 时生效 */
    closeOnOutside?: boolean
}

/**
 * 浮层关闭：Esc；若提供 containRefs 则同时支持点击外部关闭。
 */
export function usePopoverEscape(
    open: MaybeRefOrGetter<boolean>,
    onClose: () => void,
    options?: UsePopoverEscapeOptions,
) {
    const closeOnOutside = options?.closeOnOutside !== false

    function onKeydown(event: KeyboardEvent) {
        if (event.key !== 'Escape' || !toValue(open)) return
        event.preventDefault()
        event.stopPropagation()
        onClose()
    }

    function resolveContainers(): Array<HTMLElement | null | undefined> {
        return toValue(options?.containRefs) ?? []
    }

    function isInsidePopover(target: Node): boolean {
        return resolveContainers().some((el) => el?.contains(target))
    }

    function onPointerDown(event: PointerEvent) {
        if (!closeOnOutside || !options?.containRefs || !toValue(open)) return
        if (event.button !== 0) return
        const target = event.target
        if (!(target instanceof Node)) return
        // 容器尚未挂载（如桌面端 Teleport 菜单）时不要当作「外部点击」关闭
        if (!resolveContainers().some((el) => el != null)) return
        if (isInsidePopover(target)) return
        onClose()
    }

    function bind() {
        window.addEventListener('keydown', onKeydown, true)
        if (closeOnOutside && options?.containRefs) {
            window.addEventListener('pointerdown', onPointerDown, true)
        }
    }

    function unbind() {
        window.removeEventListener('keydown', onKeydown, true)
        window.removeEventListener('pointerdown', onPointerDown, true)
    }

    watch(
        () => toValue(open),
        (isOpen) => {
            if (isOpen) bind()
            else unbind()
        },
        {immediate: true},
    )

    onUnmounted(unbind)
}
