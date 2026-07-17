<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import LayoutToggleChip from '@/features/settings/components/LayoutToggleChip.vue'
import LayoutWorkbenchPreview from '@/features/settings/components/LayoutWorkbenchPreview.vue'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {UserResource} from '@/features/auth/types/user-resource.types'

const {t} = useI18n()
const appConfig = useAppConfigStore()
const toast = useAppToast()
const {readOnly: guestReadOnly, hint: guestReadOnlyHint, denyIfReadOnly} = useResourceWriteGuard(UserResource.LayoutMenu)
const fileInputRef = ref<HTMLInputElement>()

const leftMainItems = computed(() =>
    appConfig.sideRailItems.filter((item) => item.section === 'main'),
)
const leftUtilItems = computed(() =>
    appConfig.sideRailItems.filter((item) => item.section === 'util'),
)
const leftBottomItems = computed(() =>
    appConfig.sideRailItems.filter((item) => item.section === 'bottom'),
)

const leftVisibleCount = computed(
    () => appConfig.sideRailItems.filter((item) => item.visible).length,
)
const rightVisibleCount = computed(
    () => appConfig.shortcutRailItems.filter((item) => item.visible).length,
)

function onExport() {
  if (denyIfReadOnly()) return
  appConfig.exportConfig()
  toast.success(t('settings.layout.exportSuccess'))
}

function onImportClick() {
  fileInputRef.value?.click()
}

async function onFileChange(event: Event) {
  if (denyIfReadOnly()) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const ok = appConfig.importConfigText(text)
    if (ok) toast.success(t('settings.layout.importSuccess'))
    else toast.error(t('settings.layout.importFailed'))
  } catch {
    toast.error(t('settings.layout.importFailed'))
  }
}
</script>

<template>
  <SettingsPageShell
      :title="t('settings.layout.title')"
      :subtitle="t('settings.layout.subtitle')"
      :readonly="guestReadOnly"
      :readonly-hint="guestReadOnlyHint"
  >
    <div class="settings-groups">
      <section class="preview-section">
        <LayoutWorkbenchPreview/>
      </section>

      <div class="settings-grid">
        <section class="setting-card">
          <div class="setting-card__head">
            <div class="setting-card__icon setting-card__icon--left" aria-hidden="true">
              <DwIcon name="layout" :size="18" :stroke-width="1.7"/>
            </div>
            <div>
              <h3>{{ t('settings.layout.leftRail') }}</h3>
              <p class="hint">{{ t('settings.layout.leftRailHint') }}</p>
            </div>
            <span class="count-badge">{{ leftVisibleCount }}/{{ appConfig.sideRailItems.length }}</span>
          </div>

          <div class="toggle-group">
            <span class="toggle-group__label">{{ t('settings.layout.groupMain') }}</span>
            <div class="toggle-grid">
              <LayoutToggleChip
                  v-for="item in leftMainItems"
                  :key="item.id"
                  :label="t(item.labelKey)"
                  :caption="item.caption"
                  :active="item.visible"
                  @toggle="appConfig.setSideRailVisible(item.id, !item.visible)"
              />
            </div>
          </div>

          <div class="toggle-group">
            <span class="toggle-group__label">{{ t('settings.layout.groupUtil') }}</span>
            <div class="toggle-grid">
              <LayoutToggleChip
                  v-for="item in leftUtilItems"
                  :key="item.id"
                  :label="t(item.labelKey)"
                  :caption="item.caption"
                  :active="item.visible"
                  @toggle="appConfig.setSideRailVisible(item.id, !item.visible)"
              />
            </div>
          </div>

          <div v-if="leftBottomItems.length" class="toggle-group">
            <span class="toggle-group__label">{{ t('settings.layout.groupBottom') }}</span>
            <div class="toggle-grid">
              <LayoutToggleChip
                  v-for="item in leftBottomItems"
                  :key="item.id"
                  :label="t(item.labelKey)"
                  :caption="item.caption"
                  :active="item.visible"
                  @toggle="appConfig.setSideRailVisible(item.id, !item.visible)"
              />
            </div>
          </div>
        </section>

        <section class="setting-card">
          <div class="setting-card__head">
            <div class="setting-card__icon setting-card__icon--right" aria-hidden="true">
              <DwIcon name="tree" :size="18" :stroke-width="1.7"/>
            </div>
            <div>
              <h3>{{ t('settings.layout.rightRail') }}</h3>
              <p class="hint">{{ t('settings.layout.rightRailHint') }}</p>
            </div>
            <span class="count-badge">{{ rightVisibleCount }}/{{ appConfig.shortcutRailItems.length }}</span>
          </div>

          <div class="toggle-grid">
            <LayoutToggleChip
                v-for="item in appConfig.shortcutRailItems"
                :key="item.id"
                :label="t(item.labelKey)"
                :caption="item.caption"
                :active="item.visible"
                @toggle="appConfig.setShortcutVisible(item.id, !item.visible)"
            />
          </div>
        </section>
      </div>

      <section class="setting-card setting-card--panel">
        <div class="setting-card__head setting-card__head--compact">
          <div class="setting-card__icon setting-card__icon--panel" aria-hidden="true">
            <DwIcon name="open" :size="18" :stroke-width="1.7"/>
          </div>
          <div class="panel-toggle-copy">
            <h3>{{ t('settings.layout.panels') }}</h3>
            <p class="hint">{{ t('settings.layout.panelsHint') }}</p>
          </div>
          <LayoutToggleChip
              class="panel-explorer-toggle"
              :label="t('settings.layout.showExplorer')"
              :caption="t('settings.layout.showExplorerHint')"
              :active="appConfig.showExplorerPanel"
              @toggle="appConfig.setShowExplorerPanel(!appConfig.showExplorerPanel)"
          />
        </div>
      </section>

      <section class="config-card">
        <div class="config-card__icon" aria-hidden="true">
          <DwIcon name="file" :size="22" :stroke-width="1.6"/>
        </div>
        <div class="config-card__body">
          <h3>{{ t('settings.layout.configFile') }}</h3>
          <p class="hint">{{ t('settings.layout.configFileHint') }}</p>
          <div class="config-actions">
            <button class="btn-primary" type="button" @click="onExport">
              <DwIcon name="export" size="sm" :stroke-width="1.5"/>
              {{ t('settings.layout.export') }}
            </button>
            <button class="btn-secondary" type="button" @click="onImportClick">
              <DwIcon name="import" size="sm" :stroke-width="1.5"/>
              {{ t('settings.layout.import') }}
            </button>
            <input
                ref="fileInputRef"
                type="file"
                accept="application/json,.json"
                hidden
                @change="onFileChange"
            />
          </div>
          <p class="config-note">{{ t('settings.layout.configNote') }}</p>
        </div>
      </section>
    </div>
  </SettingsPageShell>
</template>

<style scoped>
.toggle-group + .toggle-group {
  margin-top: clamp(10px, 1.2vmin, 12px);
}

.toggle-group__label {
  display: block;
  margin-bottom: clamp(6px, 0.8vmin, 8px);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.toggle-grid {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap);
}

.panel-toggle-copy {
  min-width: 0;
}

.panel-explorer-toggle {
  grid-column: 1 / -1;
  margin-top: clamp(10px, 1.2vmin, 12px);
}

.config-card__body {
  min-width: 0;
}

.config-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap-md);
  margin-top: clamp(10px, 1.2vmin, 12px);
}
</style>
