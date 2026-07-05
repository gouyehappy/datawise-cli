<script setup lang="ts">
import ShortcutRail from '@/features/layout/components/ShortcutRail.vue'
import TerminalPane from '@/features/layout/components/TerminalPane.vue'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'

const appConfig = useAppConfigStore()
</script>

<template>
  <div class="module-workbench">
    <slot name="side"/>
    <div class="module-workbench__center">
      <main class="module-panel">
        <slot/>
      </main>
      <TerminalPane/>
      <slot name="bottom"/>
    </div>
    <ShortcutRail v-if="appConfig.showShortcutRail"/>
  </div>
</template>
