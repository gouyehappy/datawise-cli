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
        ? t('nav.rail.showLeft')
        : t('nav.rail.showRight')
)

function restore() {
    if (props.side === 'left') {
        appConfig.setShowSideRailStrip(true)
        return
    }
    appConfig.setShowShortcutRailStrip(true)
}
</script>

<template>
  <button
      type="button"
      class="tool-rail-restore"
      :class="`tool-rail-restore--${side}`"
      :aria-label="label()"
      :title="label()"
      @click="restore"
  >
    <DwIcon :name="side === 'left' ? 'chevron-right' : 'chevron-left'" size="sm" :stroke-width="2"/>
  </button>
</template>

<style scoped>
.tool-rail-restore {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: stretch;
  width: var(--dw-icon-size-sm);
  min-height: 52px;
  padding: 0;
  border: 1px solid var(--dw-panel-border);
  background: var(--dw-bg-panel);
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: var(--dw-transition-colors);
}

.tool-rail-restore:hover {
  color: var(--dw-text);
  border-color: color-mix(in srgb, var(--dw-primary) 24%, var(--dw-panel-border));
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}

.tool-rail-restore--left {
  border-radius: 0 var(--dw-control-radius) var(--dw-control-radius) 0;
  border-left: none;
}

.tool-rail-restore--right {
  border-radius: var(--dw-control-radius) 0 0 var(--dw-control-radius);
  border-right: none;
}
</style>
