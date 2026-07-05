import {ref} from 'vue'
import type {ContextMenuItem} from '@/core/types'
import {useContextMenuAnchor} from './useContextMenuAnchor'

/** 封装菜单项 + 锚点状态，供右键与工具栏弹出菜单复用 */
export function useContextMenu<T = unknown>() {
    const items = ref<ContextMenuItem[]>([])
    const anchor = useContextMenuAnchor<T>()

    function showAt(x: number, y: number, menuItems: ContextMenuItem[], value: T | null = null) {
        items.value = menuItems
        anchor.openAt(x, y, value)
    }

    function open(event: MouseEvent, menuItems: ContextMenuItem[], value: T | null = null) {
        items.value = menuItems
        anchor.open(event, value)
    }

    function openBelow(el: HTMLElement, menuItems: ContextMenuItem[], gap = 4, value: T | null = null) {
        const rect = el.getBoundingClientRect()
        showAt(rect.left, rect.bottom + gap, menuItems, value)
    }

    return {
        items,
        visible: anchor.visible,
        pos: anchor.pos,
        target: anchor.target,
        open,
        showAt,
        openBelow,
        close: anchor.close,
    }
}
