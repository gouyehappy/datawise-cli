<!--
  欢迎 Tab —IDEA 空状态风格：居中快捷键提—-->
<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {formatBindingParts} from '@/core/shortcuts/shortcut.service'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'
import type {ShortcutActionId} from '@/core/shortcuts/types'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useFeaturePermission} from '@/features/auth/composables/useFeaturePermission'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import {DwIcon} from '@/core/icons'

const {t} = useI18n()
const workspace = useWorkspaceStore()
const {can} = useFeaturePermission()

const shortcuts = useShortcutSettingsStore()

interface WelcomeAction {
  label: string
  actionId: ShortcutActionId
  visible: boolean
}

const actions = computed<WelcomeAction[]>(() => {
  const items: WelcomeAction[] = [
    {label: t('welcome.actions.search'), actionId: 'explorer.search', visible: can(FeaturePermission.WorkbenchExplorerSearch)},
    {label: t('welcome.actions.newConsole'), actionId: 'workspace.newConsole', visible: can(FeaturePermission.WorkbenchTabNew)},
    {label: t('welcome.actions.run'), actionId: 'workspace.runSql', visible: can(FeaturePermission.WorkbenchConsoleRun)},
    {label: t('welcome.actions.terminal'), actionId: 'app.toggleTerminal', visible: can(FeaturePermission.UtilTerminal)},
    {label: t('welcome.actions.settings'), actionId: 'app.openSettings', visible: can(FeaturePermission.ProfileSettings)},
  ]
  return items.filter((item) => item.visible)
})

function keyChips(actionId: ShortcutActionId): string[] {
  const binding = shortcuts.getBinding(actionId)
  if (!binding.trim()) return []
  return formatBindingParts(binding)
}
</script>

<template>
  <div class="welcome dw-workbench-page dw-workbench-page--center">
    <div class="welcome-hero" aria-hidden="true">
      <DwIcon name="tab-welcome" :size="40" :stroke-width="1.8"/>
    </div>

    <ul class="welcome-actions">
      <li v-for="item in actions" :key="item.actionId">
        <span class="welcome-actions__label">{{ item.label }}</span>
        <span v-if="keyChips(item.actionId).length" class="welcome-actions__keys">
          <kbd v-for="chip in keyChips(item.actionId)" :key="chip" class="welcome-actions__chip">{{ chip }}</kbd>
        </span>
        <span v-else class="welcome-actions__unassigned">{{ t('shortcuts.unassigned') }}</span>
      </li>
    </ul>

    <p class="welcome-hint">{{ t('welcome.actions.dropHint') }}</p>
    <button
        v-if="can(FeaturePermission.WorkbenchTabNew)"
        class="welcome-cta"
        type="button"
        @click="workspace.openConsole()"
    >
      {{ t('welcome.newConsole') }}
    </button>
  </div>
</template>

<style scoped>
.welcome {
  gap: var(--dw-space-10);
  padding: var(--dw-space-12) var(--dw-space-10);
}

.welcome-hero {
  color: var(--dw-text-muted);
  opacity: 0.85;
}

.welcome-actions {
  list-style: none;
  margin: 0;
  padding: 0;
  text-align: center;
}

.welcome-actions li {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--dw-space-7);
  margin: 0;
  padding: var(--dw-space-2) 0;
  line-height: var(--dw-leading);
  font-size: var(--dw-text-xl);
}

.welcome-actions__label {
  min-width: 9em;
  text-align: right;
  color: var(--dw-text-dim);
}

.welcome-actions__keys {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-xs);
  min-width: 10em;
  justify-content: flex-start;
}

.welcome-actions__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  min-height: var(--dw-control-h-xs);
  padding: 0 var(--dw-space-3);
  border: 1px solid var(--dw-wb-card-border);
  border-radius: var(--dw-control-radius-sm);
  background: linear-gradient(
      180deg,
      var(--dw-bg-panel) 0%,
      color-mix(in srgb, var(--dw-bg-muted) 80%, var(--dw-bg-panel)) 100%
  );
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-text) 5%, transparent);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text-secondary);
}

.welcome-actions__unassigned {
  min-width: 10em;
  text-align: left;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.welcome-hint {
  margin: var(--dw-space-2) 0 0;
  color: var(--dw-text-dim);
  font-size: var(--dw-text-md);
  line-height: var(--dw-leading-relaxed);
}

.welcome-cta {
  margin-top: var(--dw-space-2);
  padding: var(--dw-space-4) 18px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border));
  border-radius: var(--dw-radius-lg);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg));
  color: var(--dw-primary);
  font-size: var(--dw-text-md);
  font-weight: 500;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.welcome:hover .welcome-cta {
  opacity: 1;
}

.welcome-cta:hover {
  background: color-mix(in srgb, var(--dw-primary) 14%, var(--dw-bg));
  border-color: color-mix(in srgb, var(--dw-primary) 50%, var(--dw-border));
}
</style>
