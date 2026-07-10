<script setup lang="ts">
import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton} from '@/core/components'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import SettingsSwitch from '@/core/components/SettingsSwitch.vue'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import {APP_VERSION} from '@/features/settings/services/about-settings.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useUpdateSettingsStore} from '@/features/settings/stores/update-settings'

const {t, tm} = useI18n()
const layout = useLayoutStore()
const updateSettings = useUpdateSettingsStore()
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.UpdatePreferences)
const showChangelog = ref(false)

const changelogItems = tm('settings.about.changelogItems') as {
  version: string
  date: string
  notes: string
}[]

async function handleCheckUpdate() {
  const result = await updateSettings.runUpdateCheck()
  if (result.hasUpdate) {
    layout.showToast(t('settings.about.updateAvailable', {version: result.latestVersion}))
    return
  }
  layout.showToast(t('settings.about.upToDate'))
}

function patchUpdatePrefs(patch: Partial<typeof updateSettings.preferences>) {
  if (denyIfReadOnly()) return
  updateSettings.patchPreferences(patch)
}
</script>

<template>
  <SettingsPageShell
      :title="t('settings.about.title')"
      :subtitle="t('settings.about.subtitle')"
      :readonly="readOnly"
      :readonly-hint="hint"
  >
    <div class="settings-groups">
      <section class="about-card">
        <div class="about-brand">
          <AppBrandLogo size="lg"/>
          <div>
            <h3>{{ t('settings.about.versionLabel', {version: APP_VERSION}) }}</h3>
            <p class="latest-line">
              {{ t('settings.about.latestVersion', {version: updateSettings.lastCheck?.latestVersion ?? APP_VERSION}) }}
            </p>
          </div>
        </div>

        <div class="about-actions">
          <DwButton
              variant="primary"
              :loading="updateSettings.checking"
              :disabled="updateSettings.checking"
              @click="handleCheckUpdate"
          >
            {{ updateSettings.checking ? t('settings.about.checking') : t('settings.about.checkUpdate') }}
          </DwButton>
          <DwButton variant="secondary" @click="showChangelog = true">
            {{ t('settings.about.changelog') }}
          </DwButton>
        </div>
      </section>

      <section class="setting-block update-section">
        <h3>{{ t('settings.about.softwareUpdate') }}</h3>
        <p class="update-intro">{{ t('settings.about.intro') }}</p>

        <div class="update-block">
          <h4>{{ t('settings.about.autoUpdateTitle') }}</h4>
          <p>{{ t('settings.about.autoUpdateDesc') }}</p>
        </div>

        <div class="update-block">
          <h4>{{ t('settings.about.networkTitle') }}</h4>
          <p>{{ t('settings.about.networkDesc') }}</p>
        </div>

        <div class="update-options">
          <SettingsSwitch
              :model-value="updateSettings.preferences.notifyOnUpdate"
              :label="t('settings.about.notifyOnUpdate')"
              :disabled="readOnly"
              @update:model-value="patchUpdatePrefs({ notifyOnUpdate: $event })"
          />
          <SettingsSwitch
              :model-value="updateSettings.preferences.autoDownload"
              :label="t('settings.about.autoDownload')"
              :disabled="readOnly"
              @update:model-value="patchUpdatePrefs({ autoDownload: $event })"
          />
        </div>
      </section>
    </div>

    <AppModal
        :open="showChangelog"
        :title="t('settings.about.changelogTitle')"
        width="480px"
        @close="showChangelog = false"
    >
      <ul class="modal-changelog-list">
        <li v-for="item in changelogItems" :key="item.version">
          <div class="modal-changelog-head">
            <strong>v{{ item.version }}</strong>
            <time>{{ item.date }}</time>
          </div>
          <p>{{ item.notes }}</p>
        </li>
      </ul>
    </AppModal>
  </SettingsPageShell>
</template>
