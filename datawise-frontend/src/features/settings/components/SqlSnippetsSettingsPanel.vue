<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {SqlSnippetsEditorWorkbench} from '@datawise/sql-editor'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {getAppSqlEditorShortcutsController} from '@/features/settings/services/sql-editor-shortcuts.controller'
import {useSqlEditorShortcutsStore} from '@/features/settings/stores/sql-editor-shortcuts-store'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import SettingsTipsCard from '@/features/settings/components/SettingsTipsCard.vue'
import SqlSnippetsSourcesBar from '@/features/settings/components/SqlSnippetsSourcesBar.vue'

const {t} = useI18n()
const toast = useToastStore()
const store = useSqlEditorShortcutsStore()
const controller = getAppSqlEditorShortcutsController()
const workbenchRef = ref<InstanceType<typeof SqlSnippetsEditorWorkbench> | null>(null)
const sharedFileInputRef = ref<HTMLInputElement>()
const newSnippetSignal = ref(0)

const {readOnly: sharedReadOnly, denyIfReadOnly: denySharedWrite} =
    useResourceWriteGuard(UserResource.SqlSnippetsShared)
const {readOnly: personalReadOnly, hint: personalHint, denyIfReadOnly: denyPersonalWrite} =
    useResourceWriteGuard(UserResource.SqlSnippetsPersonal)
const readOnly = computed(() => sharedReadOnly.value || personalReadOnly.value)

function onAddSnippet() {
  if (denyPersonalWrite()) return
  newSnippetSignal.value += 1
}

function onImportShared() {
  if (denySharedWrite()) return
  sharedFileInputRef.value?.click()
}

function onResetPersonal() {
  if (denyPersonalWrite()) return
  store.resetPersonal()
  workbenchRef.value?.closeEditor()
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
  <SettingsPageShell
      :title="t('settings.sqlSnippets.title')"
      :subtitle="t('settings.sqlSnippets.subtitle')"
      :readonly="personalReadOnly"
      :readonly-hint="personalHint"
  >
    <template #actions>
      <button
          class="reset-all-btn"
          type="button"
          :disabled="readOnly"
          @click="onResetPersonal"
      >
        <DwIcon name="refresh" size="sm" :stroke-width="1.5"/>
        {{ t('settings.sqlEditor.resetPersonal') }}
      </button>
    </template>

    <template #tips>
      <SettingsTipsCard
          :title="t('settings.sqlEditor.tipsTitle')"
          :content="t('settings.sqlEditor.tipsContent')"
          icon="terminal"
      />
    </template>

    <div class="settings-groups">
      <SqlSnippetsSourcesBar/>

      <div class="sql-snippets-settings__toolbar">
        <button
            class="config-btn config-btn--primary"
            type="button"
            :disabled="readOnly"
            @click="onAddSnippet"
        >
          + {{ t('settings.sqlSnippets.add') }}
        </button>
        <button
            class="config-btn"
            type="button"
            :disabled="sharedReadOnly"
            @click="onImportShared"
        >
          {{ t('settings.sqlEditor.sharedImport') }}
        </button>
        <button
            class="config-btn"
            type="button"
            :disabled="sharedReadOnly"
            @click="store.exportSharedConfig"
        >
          {{ t('settings.sqlEditor.sharedExport') }}
        </button>
      </div>

      <SqlSnippetsEditorWorkbench
          ref="workbenchRef"
          :controller="controller"
          :readonly="readOnly"
          :new-snippet-signal="newSnippetSignal"
      />
    </div>

    <input
        ref="sharedFileInputRef"
        type="file"
        accept="application/json,.json"
        hidden
        @change="onSharedFileChange"
    />
  </SettingsPageShell>
</template>
