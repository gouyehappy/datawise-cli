<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {SettingsSection} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {resolveSettingsPanel} from '@/features/settings/settings-section-registry'
import {buildSettingsNavGroups} from '@/features/settings/constants/settings-nav.config'
import SettingsNavIcon from '@/features/settings/components/SettingsNavIcon.vue'

const {t} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const auth = useAuthStore()

const navGroups = computed(() => buildSettingsNavGroups({isAdmin: auth.isAdmin}))

const visibleNavGroups = computed(() =>
    navGroups.value
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => appConfig.canOpenSettingsSection(item.id)),
        }))
        .filter((group) => group.items.length > 0),
)

const activeSection = computed(() => layout.settingsSection)
const activePanel = computed(() => resolveSettingsPanel(activeSection.value))

function selectSection(section: SettingsSection) {
  if (!appConfig.canOpenSettingsSection(section)) return
  layout.setSettingsSection(section)
}

function backToWorkspace() {
  layout.setModule('database')
}
</script>

<template>
  <div class="module-shell">
    <aside class="module-shell__nav">
      <h1 class="module-shell__nav-title">{{ t('settings.title') }}</h1>
      <nav class="module-shell__nav-list">
        <section
            v-for="group in visibleNavGroups"
            :key="group.labelKey"
            class="module-shell__nav-group"
        >
          <h2 class="module-shell__nav-group-label">{{ t(group.labelKey) }}</h2>
          <button
              v-for="item in group.items"
              :key="item.id"
              class="module-shell__nav-item"
              :class="{'is-active': activeSection === item.id}"
              type="button"
              @click="selectSection(item.id)"
          >
            <span class="module-shell__nav-item-icon" aria-hidden="true">
              <SettingsNavIcon :section="item.id"/>
            </span>
            <span class="module-shell__nav-item-label">{{ t(item.labelKey) }}</span>
          </button>
        </section>
      </nav>
      <button class="module-shell__back" type="button" @click="backToWorkspace">
        {{ t('settings.backToWorkspace') }}
      </button>
    </aside>

    <main class="module-shell__main">
      <component :is="activePanel" v-if="activePanel"/>
    </main>
  </div>
</template>
