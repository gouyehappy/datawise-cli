<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {SqlEditorSettingsShell} from '@datawise/sql-editor'
import {StatusPill} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {getAppSqlEditorShortcutsController} from '@/features/settings/services/sql-editor-shortcuts.controller'
import {useSqlEditorShortcutsStore} from '@/features/settings/stores/sql-editor-shortcuts-store'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import type {SqlSnippetLayerId} from '@/features/plugin/services/plugin-registry.service'

const {t} = useI18n()
const toast = useToastStore()
const store = useSqlEditorShortcutsStore()
const controller = getAppSqlEditorShortcutsController()
const pluginStore = usePluginStore()
const layout = useLayoutStore()
const {readOnly: sharedReadOnly, hint: sharedHint, denyIfReadOnly: denySharedWrite} =
    useResourceWriteGuard(UserResource.SqlSnippetsShared)
const {readOnly: personalReadOnly, denyIfReadOnly: denyPersonalWrite} =
    useResourceWriteGuard(UserResource.SqlSnippetsPersonal)
const readOnly = computed(() => sharedReadOnly.value || personalReadOnly.value)

const sharedFileInputRef = ref<HTMLInputElement>()

const snippetLayers: { id: SqlSnippetLayerId; pluginId: string }[] = [
    {id: 'bundled', pluginId: 'p-sql-snippets'},
    {id: 'team', pluginId: 'p-sql-snippets-team'},
    {id: 'personal', pluginId: 'p-sql-snippets-personal'},
]

function isLayerEnabled(layer: SqlSnippetLayerId): boolean {
    return pluginStore.isSnippetLayerEnabled(layer)
}

function layerPluginName(pluginId: string): string {
    const key = `plugin.items.${pluginId}.name`
    return t(key)
}

function openPluginCenter() {
    layout.setModule('plugin')
}

function openSnippetLayerPlugin(pluginId: string) {
    pluginStore.focusPlugin(pluginId)
}

function onImportSharedClick() {
  if (denySharedWrite()) return
  sharedFileInputRef.value?.click()
}

async function onSharedFileChange(event: Event) {
  if (denySharedWrite()) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const ok = store.importSharedConfigText(text)
    toast.show(ok ? t('settings.sqlEditor.sharedImportSuccess') : t('settings.sqlEditor.sharedImportFailed'))
  } catch {
    toast.show(t('settings.sqlEditor.sharedImportFailed'))
  }
}
</script>

<template>
  <div class="sql-shortcuts-settings">
    <header class="panel-head">
      <div class="panel-head__copy">
        <h2>{{ t('settings.sqlEditor.title') }}</h2>
        <p>{{ t('settings.sqlEditor.subtitle') }}</p>
      </div>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ sharedHint }}</p>

    <section class="snippet-layers-card">
      <div class="snippet-layers-card__head">
        <div>
          <h3>{{ t('settings.sqlEditor.pluginLayersTitle') }}</h3>
          <p>{{ t('settings.sqlEditor.pluginLayersHint') }}</p>
        </div>
        <button class="config-btn" type="button" @click="openPluginCenter">
          {{ t('settings.sqlEditor.openPluginCenter') }}
        </button>
      </div>
      <ul class="snippet-layers-card__list">
        <li v-for="layer in snippetLayers" :key="layer.id" class="snippet-layers-card__item">
          <button
              type="button"
              class="snippet-layers-card__link"
              @click="openSnippetLayerPlugin(layer.pluginId)"
          >
            <span class="snippet-layers-card__name">{{ layerPluginName(layer.pluginId) }}</span>
            <StatusPill :variant="isLayerEnabled(layer.id) ? 'success' : 'neutral'">
              {{ isLayerEnabled(layer.id) ? t('plugin.enabled') : t('plugin.disabled') }}
            </StatusPill>
          </button>
        </li>
      </ul>
    </section>

    <section class="shared-card">
      <div class="shared-card__head">
        <div>
          <h3>{{ t('settings.sqlEditor.pluginTitle') }}</h3>
          <p>{{ t('settings.sqlEditor.pluginHint') }}</p>
        </div>
        <span class="count-badge">
          {{ t('settings.sqlEditor.pluginCount', {count: store.pluginSnippetCount}) }}
        </span>
      </div>
      <p class="field-note">{{ t('settings.sqlEditor.pluginFileNote') }}</p>
    </section>

    <section class="shared-card">
      <div class="shared-card__head">
        <div>
          <h3>{{ t('settings.sqlEditor.sharedTitle') }}</h3>
          <p>{{ t('settings.sqlEditor.sharedHint') }}</p>
        </div>
        <span class="count-badge">
          {{ t('settings.sqlEditor.sharedCount', {count: store.sharedSnippetCount}) }}
        </span>
      </div>
      <div class="shared-actions">
        <button class="config-btn config-btn--primary" type="button" :disabled="sharedReadOnly" @click="onImportSharedClick">
          {{ t('settings.sqlEditor.sharedImport') }}
        </button>
        <button class="config-btn" type="button" :disabled="sharedReadOnly" @click="store.exportSharedConfig">
          {{ t('settings.sqlEditor.sharedExport') }}
        </button>
        <button
            class="config-btn"
            type="button"
            :disabled="!store.hasSharedLayer || sharedReadOnly"
            @click="store.clearShared()"
        >
          {{ t('settings.sqlEditor.sharedClear') }}
        </button>
        <input
            ref="sharedFileInputRef"
            type="file"
            accept="application/json,.json"
            hidden
            @change="onSharedFileChange"
        />
      </div>
      <p class="field-note">{{ t('settings.sqlEditor.mergeNote') }}</p>
    </section>

    <section class="tips-card">
      <div class="tips-card__icon" aria-hidden="true">
        <DwIcon name="terminal" :size="20" :stroke-width="1.7"/>
      </div>
      <div class="tips-card__body">
        <h3>{{ t('settings.sqlEditor.tipsTitle') }}</h3>
        <p>{{ t('settings.sqlEditor.tipsContent') }}</p>
      </div>
    </section>

    <div :class="{'is-readonly': personalReadOnly}">
    <SqlEditorSettingsShell
        layout="page"
        :controller="controller"
    />
    </div>
  </div>
</template>

<style scoped>
.sql-shortcuts-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.snippet-layers-card {
  padding: 16px 18px;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-lg, 12px);
  background: var(--dw-bg-panel);
}

.snippet-layers-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.snippet-layers-card__head h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.snippet-layers-card__head p {
  margin: 0;
  font-size: 0.875rem;
  color: var(--dw-text-secondary);
}

.snippet-layers-card__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snippet-layers-card__item {
  list-style: none;
}

.snippet-layers-card__link {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--dw-radius-md, 8px);
  border: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-surface-raised) 50%, transparent);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.snippet-layers-card__link:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border-light));
}

.snippet-layers-card__name {
  flex: 1 1 auto;
  font-size: 0.875rem;
}
</style>
