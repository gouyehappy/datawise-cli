import type {InjectionKey} from 'vue'
import type {SqlEditorGlobalConfig, SqlEditorRuntime} from '@sql-editor/types'

/** Vue provide/inject：Monaco 主题与字体等外观 */
export const SQL_EDITOR_CONFIG_KEY: InjectionKey<SqlEditorGlobalConfig> = Symbol('SqlEditorConfig')

/** Vue provide/inject：补全运行时（Schema / 方言 / 片段层） */
export const SQL_EDITOR_RUNTIME_KEY: InjectionKey<SqlEditorRuntime> = Symbol('SqlEditorRuntime')
