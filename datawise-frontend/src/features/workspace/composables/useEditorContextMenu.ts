import type {DbType} from '@/core/types'
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {SqlEditorExpose} from '@datawise/sql-editor/types'
import {useContextMenuAnchor} from '@/core/context-menu'
import {getSqlEditorMenu} from '@/features/workspace/constants/console-editor-menu'

import type {ConnectionCapabilitiesSnapshot} from '@/shared/capabilities/db-type-capabilities'

export interface EditorContextMenuHandlers {
    editorRef: () => SqlEditorExpose | null
    runSql: (sql: string) => void
    requestExplainPlan: (sql: string) => void
    requestIndexSuggest: (sql: string) => void
    formatSelection: () => void
    openAiInput: (prefill?: string) => void
    getDbType: () => DbType | undefined
    getCapabilities?: () => ConnectionCapabilitiesSnapshot
    getCapabilityHint?: (key: 'sqlExplain') => string
    getExplainPlanEnabled?: () => boolean
    getIndexSuggestEnabled?: () => boolean
}

/** Monaco 编辑器右键菜单：仅对当前选区生效 */
export function useEditorContextMenu(handlers: EditorContextMenuHandlers) {
    const {t} = useI18n()
    const {visible, pos, openAt, close} = useContextMenuAnchor()
    const selection = ref('')

    const menuItems = computed(() => {
        const hasSelection = !!selection.value
        const caps = handlers.getCapabilities?.()
        const explainPluginEnabled = handlers.getExplainPlanEnabled?.() ?? true
        const indexSuggestEnabled = handlers.getIndexSuggestEnabled?.() ?? true
        const explainSupported = explainPluginEnabled && (caps?.sqlExplain ?? true)
        const explainHint = handlers.getCapabilityHint?.('sqlExplain')

        return getSqlEditorMenu(t)
            .filter((item) => item.id !== 'suggest-index' || indexSuggestEnabled)
            .map((item) => {
            if (item.divider) return item
            if (item.id === 'explain-plan') {
                const disabled = !hasSelection || !explainSupported
                return {
                    ...item,
                    disabled,
                    disabledHint: !explainSupported ? explainHint : undefined,
                }
            }
            return {...item, disabled: !hasSelection}
        })
    })

    function show(payload: { x: number; y: number; selectedText: string }) {
        selection.value = payload.selectedText.trim()
        openAt(payload.x, payload.y)
    }

    function selectMenuItem(id: string) {
        const targetSql = selection.value
        if (!targetSql) {
            close()
            return
        }
        if (id === 'run-selection') {
            handlers.runSql(targetSql)
            close()
            return
        }
        if (id === 'format') {
            handlers.formatSelection()
            close()
            return
        }
        if (id === 'explain-plan') {
            if (!handlers.getExplainPlanEnabled?.() || !handlers.getCapabilities?.().sqlExplain) {
                close()
                return
            }
            handlers.requestExplainPlan(targetSql)
            close()
            return
        }
        if (id === 'explain') {
            void handlers.openAiInput(t('console.explainPrompt', {sql: targetSql}))
            close()
            return
        }
        if (id === 'optimize') {
            void handlers.openAiInput(t('console.optimizePrompt', {sql: targetSql}))
            close()
            return
        }
        if (id === 'rewrite') {
            void handlers.openAiInput(t('console.rewritePrompt', {sql: targetSql}))
            close()
            return
        }
        if (id === 'generate-insert') {
            void handlers.openAiInput(t('console.generateInsertPrompt', {sql: targetSql}))
            close()
            return
        }
        if (id === 'suggest-index') {
            if (!handlers.getIndexSuggestEnabled?.()) {
                close()
                return
            }
            handlers.requestIndexSuggest(targetSql)
            close()
        }
    }

    return {
        visible,
        position: pos,
        menuItems,
        show,
        close,
        selectMenuItem,
    }
}
