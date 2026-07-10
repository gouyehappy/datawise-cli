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
  width: 14px;
  min-height: 52px;
  padding: 0;
  border: 1px solid var(--dw-panel-border);
  background: var(--dw-bg-panel);
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.tool-rail-restore:hover {
  color: var(--dw-text);
  border-color: color-mix(in srgb, var(--dw-primary) 24%, var(--dw-panel-border));
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}

.tool-rail-restore--left {
  border-radius: 0 8px 8px 0;
  border-left: none;
}

.tool-rail-restore--right {
  border-radius: 8px 0 0 8px;
  border-right: none;
}
</style>
