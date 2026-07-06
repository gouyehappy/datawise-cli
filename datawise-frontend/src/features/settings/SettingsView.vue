<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {SettingsSection} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {resolveSettingsPanel} from '@/features/settings/settings-section-registry'
import SettingsNavIcon from '@/features/settings/components/SettingsNavIcon.vue'

const {t} = useI18n()
const layout = useLayoutStore()

interface NavItem {
  id: SettingsSection
  labelKey: string
}

interface NavGroup {
  labelKey: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    labelKey: 'settings.nav.groups.general',
    items: [
      {id: 'basic', labelKey: 'settings.nav.basic'},
      {id: 'layout', labelKey: 'settings.nav.layout'},
      {id: 'profile', labelKey: 'settings.nav.profile'},
    ],
  },
  {
    labelKey: 'settings.nav.groups.workspace',
    items: [
      {id: 'editor', labelKey: 'settings.nav.editor'},
      {id: 'sqlEditor', labelKey: 'settings.nav.sqlEditor'},
      {id: 'shortcuts', labelKey: 'settings.nav.shortcuts'},
    ],
  },
  {
    labelKey: 'settings.nav.groups.runtime',
    items: [
      {id: 'connectionHealth', labelKey: 'settings.nav.connectionHealth'},
      {id: 'systemMetrics', labelKey: 'settings.nav.systemMetrics'},
    ],
  },
  {
    labelKey: 'settings.nav.groups.ai',
    items: [
      {id: 'ai', labelKey: 'settings.nav.aiModels'},
      {id: 'dataAgent', labelKey: 'settings.nav.dataAgent'},
      {id: 'platform', labelKey: 'settings.nav.platform'},
    ],
  },
  {
    labelKey: 'settings.nav.groups.more',
    items: [
      {id: 'plugins', labelKey: 'settings.nav.plugins'},
      {id: 'about', labelKey: 'settings.nav.about'},
    ],
  },
]

const activeSection = computed(() => layout.settingsSection)
const activePanel = computed(() => resolveSettingsPanel(activeSection.value))

function selectSection(section: SettingsSection) {
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
            v-for="group in navGroups"
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
