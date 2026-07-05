import {sqlEditorSettingsVersion} from '@sql-editor/config/snippets/cache'
import {readPersonalSqlEditorLayer} from '@sql-editor/settings/personal-storage'

/** 行内执行按钮：personal 层显式 false 才关，缺省为开 */
export function isSqlRunGutterEnabled(): boolean {
    void sqlEditorSettingsVersion.value
    const personal = readPersonalSqlEditorLayer()
    return personal.showRunGutterButton !== false
}
