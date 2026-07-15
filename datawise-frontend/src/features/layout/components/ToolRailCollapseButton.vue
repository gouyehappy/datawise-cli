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
  margin: var(--dw-space-1) var(--dw-space-2) var(--dw-space-2);
  min-height: var(--dw-control-h-xs);
  border: none;
  border-radius: var(--dw-control-radius-sm);
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
}

.tool-rail-collapse:hover {
  background: var(--dw-tool-hover);
  color: var(--dw-text);
}
</style>
