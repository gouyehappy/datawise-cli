/**
 * 统一右键菜单模块
 *
 * - ContextMenuHost：Teleport 到 body，全局单例菜单层
 * - useContextMenuAnchor：记录坐标与选中目标，供 composable 分发动作
 * - submenu-panels：注册自定义子面板（如 Explorer 数据库类型选择）
 *
 * @see features/explorer/setup-context-menus.ts 业务菜单项注册示例
 */
export {default as ContextMenu} from './ContextMenu.vue'
export {default as ContextMenuHost} from './ContextMenuHost.vue'
export {default as ContextMenuIcon} from './ContextMenuIcon.vue'
export {useContextMenu} from './useContextMenu'
export {useContextMenuAnchor} from './useContextMenuAnchor'
export {
    registerContextMenuSubmenuPanel,
    resolveContextMenuSubmenuPanel,
} from './submenu-panels'
