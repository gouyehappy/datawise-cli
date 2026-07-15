import type {UiSkin} from './types'

export type {UiSkin}

export interface UiSkinDefinition {
    id: UiSkin
    /** i18n：settings.basic.uiSkins.* */
    labelKey: string
    /** i18n：settings.basic.uiSkinHints.* */
    hintKey: string
    /**
     * 主题服务写入 --dw-panel-shadow 时：
     * - inherit：沿用明暗主题默认卡片阴影（classic）
     * - none：扁平无阴影（ide），其余布局由 skins/*.css 覆盖
     */
    panelShadow: 'inherit' | 'none'
}

/** UI 壳层插件注册表 — 新增款式只需加一条 + styles/skins/<id>.css */
export const UI_SKIN_DEFINITIONS: readonly UiSkinDefinition[] = [
    {
        id: 'classic',
        labelKey: 'settings.basic.uiSkins.classic',
        hintKey: 'settings.basic.uiSkinHints.classic',
        panelShadow: 'inherit',
    },
    {
        id: 'ide',
        labelKey: 'settings.basic.uiSkins.ide',
        hintKey: 'settings.basic.uiSkinHints.ide',
        panelShadow: 'none',
    },
] as const

export const UI_SKIN_IDS: UiSkin[] = UI_SKIN_DEFINITIONS.map((item) => item.id)

export function resolveUiSkinDefinition(id: UiSkin | string | undefined): UiSkinDefinition {
    return UI_SKIN_DEFINITIONS.find((item) => item.id === id) ?? UI_SKIN_DEFINITIONS[0]
}

export function isRegisteredUiSkin(value: unknown): value is UiSkin {
    return typeof value === 'string' && UI_SKIN_IDS.includes(value as UiSkin)
}
