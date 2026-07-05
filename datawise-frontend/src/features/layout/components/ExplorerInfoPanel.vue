<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState, SectionHeader} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'

const {t} = useI18n()
const shortcutPanel = useShortcutPanelStore()

const info = computed(() => shortcutPanel.explorerInfo)

const titleKey = computed(() => {
  const kind = info.value.kind
  if (kind === 'empty') return 'shortcut.objectInfo'
  return `shortcut.infoKinds.${kind}`
})

const listTitle = computed(() =>
    info.value.listTitleKey ? t(`shortcut.infoLists.${info.value.listTitleKey}`) : '',
)
</script>

<template>
  <div class="sp-body">
    <EmptyState
        v-if="info.kind === 'empty' && !info.title"
        :title="t('shortcut.infoEmpty')"
        :hint="t('shortcut.infoEmptyHint')"
    >
      <template #icon>
        <DwIcon name="about" size="lg" :stroke-width="1.4"/>
      </template>
    </EmptyState>

    <template v-else>
      <div class="sp-hero">
        <div class="sp-hero__icon" aria-hidden="true">
          <DwIcon name="table" :size="18" :stroke-width="1.6"/>
        </div>
        <div class="sp-hero__text">
          <span class="sp-hero__kind">{{ t(titleKey) }}</span>
          <h4>{{ info.title }}</h4>
          <p v-if="info.breadcrumb" class="sp-breadcrumb">{{ info.breadcrumb }}</p>
          <p v-if="info.comment">{{ info.comment }}</p>
          <p v-else-if="!info.breadcrumb" class="sp-muted">—</p>
        </div>
      </div>

      <div v-if="info.fields.length" class="sp-stat-grid">
        <div
            v-for="field in info.fields"
            :key="field.key"
            class="sp-stat"
            :class="{ 'sp-stat--wide': field.wide }"
        >
          <span class="sp-stat__label">{{ t(`shortcut.infoFields.${field.key}`) }}</span>
          <span class="sp-stat__value">{{ field.value }}</span>
        </div>
      </div>

      <section v-if="info.listItems.length" class="sp-section">
        <SectionHeader
            :title="listTitle"
            :count="t('shortcut.itemCount', {count: info.listItems.length})"
        />
        <ul class="sp-col-list">
          <li v-for="item in info.listItems" :key="item.name + (item.meta ?? '')" class="sp-col-item">
            <div class="sp-col-item__main">
              <span class="sp-col-item__name">{{ item.name }}</span>
              <span v-if="item.comment" class="sp-col-item__comment">{{ item.comment }}</span>
            </div>
            <code v-if="item.meta" class="sp-col-item__type">{{ item.meta }}</code>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
