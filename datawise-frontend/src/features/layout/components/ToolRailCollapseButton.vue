<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'

const props = defineProps<{
    side: 'left' | 'right'
}>()

const {t} = useI18n()
const appConfig = useAppConfigStore()

const label = () => (
    props.side === 'left'
        ? t('nav.rail.hideLeft')
        : t('nav.rail.hideRight')
)

function collapse() {
    if (props.side === 'left') {
        appConfig.setShowSideRailStrip(false)
        return
    }
    appConfig.setShowShortcutRailStrip(false)
}
</script>

<template>
  <button
      type="button"
      class="tool-rail-collapse"
      :class="`tool-rail-collapse--${side}`"
      :aria-label="label()"
      :title="label()"
      @click="collapse"
  >
    <DwIcon :name="side === 'left' ? 'chevron-left' : 'chevron-right'" size="sm" :stroke-width="2"/>
  </button>
</template>

<style scoped>
.tool-rail-collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(100% - 8px);
  margin: 2px 4px 4px;
  min-height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.tool-rail-collapse:hover {
  background: var(--dw-tool-hover);
  color: var(--dw-text);
}
</style>
