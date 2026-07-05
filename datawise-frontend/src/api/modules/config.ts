import {createHttpConfigApi} from '@/shared/api/http/config'
import type {AppConfigFile} from '@/shared/config/app-config.types'
import type {SqlEditorShortcutsLayer} from '@datawise/sql-editor/types'
import type {UpdatePreferences} from '@/features/settings/services/about-settings.service'
import type {ConnectionsCatalog} from '@/shared/config/connections-catalog.types'

const http = createHttpConfigApi()

export const configApi = {
    fetchAppConfig: () => http.fetchAppConfig(),
    saveAppConfig: (config: AppConfigFile) => http.saveAppConfig(config),
    fetchAppConfigXml: () => http.fetchAppConfigXml(),
    saveAppConfigXml: (xml: string) => http.saveAppConfigXml(xml),
    fetchSqlSnippets: (layer: 'shared' | 'personal') => http.fetchSqlSnippets(layer),
    saveSqlSnippets: (layer: 'shared' | 'personal', payload: SqlEditorShortcutsLayer) =>
        http.saveSqlSnippets(layer, payload),
    fetchUpdaterPreferences: () => http.fetchUpdaterPreferences(),
    saveUpdaterPreferences: (prefs: UpdatePreferences) => http.saveUpdaterPreferences(prefs),
    fetchConnectionsCatalog: () => http.fetchConnectionsCatalog(),
    saveConnectionsCatalog: (catalog: ConnectionsCatalog) => http.saveConnectionsCatalog(catalog),
    fetchConnectionsXml: () => http.fetchConnectionsXml(),
    saveConnectionsXml: (xml: string) => http.saveConnectionsXml(xml),
}
