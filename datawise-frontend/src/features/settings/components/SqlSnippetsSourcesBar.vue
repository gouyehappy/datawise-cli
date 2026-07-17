<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {StatusPill} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useSqlEditorShortcutsStore} from '@/features/settings/stores/sql-editor-shortcuts-store'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import type {SqlSnippetLayerId} from '@/features/plugin/services/plugin-registry.service'

const {t} = useI18n()
const store = useSqlEditorShortcutsStore()
const pluginStore = usePluginStore()
const layout = useLayoutStore()

const snippetLayers: { id: SqlSnippetLayerId; pluginId: string }[] = [
  {id: 'bundled', pluginId: 'p-sql-snippets'},
  {id: 'team', pluginId: 'p-sql-snippets-team'},
  {id: 'personal', pluginId: 'p-sql-snippets-personal'},
]

function layerPluginName(pluginId: string): string {
  return t(`plugin.items.${pluginId}.name`)
}

function isLayerEnabled(layer: SqlSnippetLayerId): boolean {
  return pluginStore.isSnippetLayerEnabled(layer)
}

function openPluginCenter() {
  layout.setModule('plugin')
}

function openSnippetLayerPlugin(pluginId: string) {
  pluginStore.focusPlugin(pluginId)
  layout.setModule('plugin')
}
</script>

<template>
  <section class="setting-block sql-snippets-sources">
    <h3 class="setting-block__title">{{ t('settings.sqlSnippets.sourcesTitle') }}</h3>
    <p class="setting-block__hint">{{ t('settings.sqlSnippets.sourcesHint') }}</p>

    <div class="sql-snippets-sources__layers">
      <button
          v-for="layer in snippetLayers"
          :key="layer.id"
          type="button"
          class="sql-snippets-sources__layer"
          @click="openSnippetLayerPlugin(layer.pluginId)"
      >
        <span class="sql-snippets-sources__layer-name">{{ layerPluginName(layer.pluginId) }}</span>
        <StatusPill :variant="isLayerEnabled(layer.id) ? 'success' : 'neutral'">
          {{ isLayerEnabled(layer.id) ? t('plugin.enabled') : t('plugin.disabled') }}
        </StatusPill>
      </button>
    </div>

    <div class="sql-snippets-sources__meta">
      <div class="sql-snippets-sources__counts">
        <span class="count-badge">
          {{ t('settings.sqlEditor.pluginCount', {count: store.pluginSnippetCount}) }}
        </span>
        <span class="count-badge">
          {{ t('settings.sqlEditor.sharedCount', {count: store.sharedSnippetCount}) }}
        </span>
        <span class="count-badge">
          {{ t('settings.sqlSnippets.personalCount', {count: store.personalSnippetCount}) }}
        </span>
      </div>
      <button class="btn-secondary" type="button" @click="openPluginCenter">
        <DwIcon name="plugins" size="sm" :stroke-width="1.5"/>
        {{ t('settings.sqlEditor.openPluginCenter') }}
      </button>
    </div>
  </section>
</template>
