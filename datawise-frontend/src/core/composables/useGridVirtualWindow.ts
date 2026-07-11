import {computed, ref, watch, type ComputedRef, type Ref} from 'vue'

export const GRID_ROW_HEIGHT = 30
export const GRID_VIRTUAL_THRESHOLD = 80
const VIRTUAL_BUFFER_ROWS = 6

export type VisibleGridRow<T> = {
    item: T
    /** 在完整行列表中的索引（0-based） */
    index: number
}

/**
 * 固定行高表格虚拟窗口。scrollContainer 为 overflow:auto 的滚动根元素。
 * wrapCells / 可变行高场景应关闭 enabled。
 */
export function useGridVirtualWindow<T>(
    scrollContainer: Ref<HTMLElement | null>,
    rows: Ref<readonly T[]>,
    options?: {
        rowHeight?: number
        threshold?: number
        enabled?: Ref<boolean> | ComputedRef<boolean>
    },
) {
    const rowHeight = options?.rowHeight ?? GRID_ROW_HEIGHT
    const threshold = options?.threshold ?? GRID_VIRTUAL_THRESHOLD
    const enabled = options?.enabled ?? computed(() => true)

    const scrollTop = ref(0)
    const viewportHeight = ref(0)

    const useVirtual = computed(
        () => enabled.value && rows.value.length >= threshold,
    )

    const visibleRange = computed(() => {
        const total = rows.value.length
        if (!useVirtual.value || total === 0) {
            return {start: 0, end: total, paddingTop: 0, paddingBottom: 0}
        }
        const start = Math.max(0, Math.floor(scrollTop.value / rowHeight) - VIRTUAL_BUFFER_ROWS)
        const visibleCount = Math.ceil(viewportHeight.value / rowHeight) + VIRTUAL_BUFFER_ROWS * 2
        const end = Math.min(total, start + visibleCount)
        return {
            start,
            end,
            paddingTop: start * rowHeight,
            paddingBottom: Math.max(0, (total - end) * rowHeight),
        }
    })

    const visibleRows = computed((): VisibleGridRow<T>[] => {
        const {start, end} = visibleRange.value
        return rows.value.slice(start, end).map((item, offset) => ({
            item,
            index: start + offset,
        }))
    })

    const paddingTop = computed(() => visibleRange.value.paddingTop)
    const paddingBottom = computed(() => visibleRange.value.paddingBottom)

    function syncViewport() {
        const el = scrollContainer.value
        if (!el) return
        scrollTop.value = el.scrollTop
        viewportHeight.value = el.clientHeight
    }

    function scrollToRowIndex(index: number, behavior: ScrollBehavior = 'smooth') {
        const el = scrollContainer.value
        if (!el || index < 0) return
        const target = Math.max(0, index * rowHeight - el.clientHeight / 3)
        el.scrollTo({top: target, behavior})
        syncViewport()
    }

    watch(
        scrollContainer,
        (el, _, onCleanup) => {
            if (!el) return
            syncViewport()
            el.addEventListener('scroll', syncViewport, {passive: true})
            let resizeObserver: ResizeObserver | null = null
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(syncViewport)
                resizeObserver.observe(el)
            }
            onCleanup(() => {
                el.removeEventListener('scroll', syncViewport)
                resizeObserver?.disconnect()
            })
        },
        {immediate: true},
    )

    watch(rows, () => {
        syncViewport()
    })

    return {
        useVirtual,
        visibleRows,
        paddingTop,
        paddingBottom,
        scrollToRowIndex,
        syncViewport,
    }
}
