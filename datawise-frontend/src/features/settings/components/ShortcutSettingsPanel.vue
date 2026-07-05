<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import ShortcutActionIcon from '@/core/shortcuts/ShortcutActionIcon.vue'
import type {ShortcutCategory} from '@/core/shortcuts/types'
import ShortcutKeyInput from '@/features/settings/components/ShortcutKeyInput.vue'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'

const {t} = useI18n()
const shortcuts = useShortcutSettingsStore()
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.AppConfig)

const categories: ShortcutCategory[] = ['explorer', 'workspace', 'app']

const categoryIcon: Record<ShortcutCategory, DwIconName> = {
  explorer: 'database',
  workspace: 'terminal',
  app: 'shortcuts',
}

const categoryMeta: Record<
    ShortcutCategory,
    { hintKey: string; tone: 'primary' | 'sky' | 'violet' }
> = {
  explorer: {hintKey: 'shortcuts.categoryHints.explorer', tone: 'primary'},
  workspace: {hintKey: 'shortcuts.categoryHints.workspace', tone: 'sky'},
  app: {hintKey: 'shortcuts.categoryHints.app', tone: 'violet'},
}

const assignedCount = computed(() => {
  const counts: Record<ShortcutCategory, number> = {
    explorer: 0,
    workspace: 0,
    app: 0,
  }
  for (const category of categories) {
    for (const def of shortcuts.groupedDefinitions[category]) {
      if (shortcuts.getBinding(def.id).trim()) counts[category] += 1
    }
  }
  return counts
})

function resetAll() {
  if (denyIfReadOnly()) return
  shortcuts.resetAll()
}
</script>

<template>
  <div class="shortcut-settings">
    <header class="panel-head">
      <div class="panel-head__copy">
        <h2>{{ t('shortcuts.title') }}</h2>
        <p>{{ t('shortcuts.subtitle') }}</p>
      </div>
      <button class="reset-all-btn" type="button" :disabled="readOnly" @click="resetAll">
        <DwIcon name="refresh" size="sm" :stroke-width="1.5"/>
        {{ t('shortcuts.resetAll') }}
      </button>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ hint }}</p>

    <section class="tips-card">
      <div class="tips-card__icon" aria-hidden="true">
        <DwIcon name="shortcuts" :size="20" :stroke-width="1.7"/>
      </div>
      <div class="tips-card__body">
        <h3>{{ t('shortcuts.tipsTitle') }}</h3>
        <p>{{ t('shortcuts.tipsContent') }}</p>
      </div>
    </section>

    <div class="shortcut-groups">
      <section
          v-for="category in categories"
          :key="category"
          class="shortcut-card"
      >
        <div class="shortcut-card__head">
          <div
              class="shortcut-card__icon"
              :class="`shortcut-card__icon--${categoryMeta[category].tone}`"
              aria-hidden="true"
          >
            <DwIcon :name="categoryIcon[category]" :size="18" :stroke-width="1.7"/>
          </div>
          <div class="shortcut-card__copy">
            <h3>{{ t(`shortcuts.categories.${category}`) }}</h3>
            <p class="hint">{{ t(categoryMeta[category].hintKey) }}</p>
          </div>
          <span class="count-badge">
            {{ assignedCount[category] }}/{{ shortcuts.groupedDefinitions[category].length }}
          </span>
        </div>

        <div class="shortcut-table">
          <div class="shortcut-table__header">
            <span>{{ t('shortcuts.columnAction') }}</span>
            <span>{{ t('shortcuts.columnBinding') }}</span>
          </div>
          <div
              v-for="def in shortcuts.groupedDefinitions[category]"
              :key="def.id"
              class="shortcut-row"
          >
            <div class="shortcut-row__action">
              <span class="shortcut-row__icon">
                <ShortcutActionIcon :action-id="def.id" :size="15"/>
              </span>
              <span class="shortcut-row__label">{{ t(def.labelKey) }}</span>
            </div>
            <ShortcutKeyInput :action-id="def.id"/>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.shortcut-settings {
  max-width: clamp(720px, 78vw, 860px);
}

.shortcut-groups {
  display: flex;
  flex-direction: column;
  gap: var(--mp-gap-lg);
}

.shortcut-table__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: clamp(12px, 1.4vmin, 16px);
  padding: 0 clamp(10px, 1.2vmin, 12px) clamp(6px, 0.8vmin, 8px);
  color: var(--dw-text-muted);
  font-size: clamp(10px, 1.05vmin, 11px);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.shortcut-table__header span:last-child {
  text-align: right;
  min-width: 188px;
}

.shortcut-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: clamp(12px, 1.4vmin, 16px);
  align-items: center;
  padding: clamp(8px, 1vmin, 10px) clamp(10px, 1.2vmin, 12px);
  border-radius: var(--dw-panel-radius);
  transition: background 0.12s ease;
}

.shortcut-row:hover {
  background: var(--dw-bg-hover);
}

.shortcut-row + .shortcut-row {
  margin-top: 2px;
}

.shortcut-row__action {
  display: flex;
  align-items: center;
  gap: clamp(8px, 1vmin, 10px);
  min-width: 0;
}

.shortcut-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: clamp(28px, 3.2vmin, 30px);
  height: clamp(28px, 3.2vmin, 30px);
  border-radius: clamp(6px, 0.8vmin, 8px);
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

.shortcut-row:hover .shortcut-row__icon {
  background: color-mix(in srgb, var(--dw-bg-muted) 70%, var(--dw-bg-hover));
  color: var(--dw-text);
}

.shortcut-row__label {
  font-size: var(--mp-sub);
  font-weight: 500;
  line-height: 1.35;
}

@media (max-width: 720px) {
  .panel-head {
    flex-direction: column;
  }

  .shortcut-table__header {
    display: none;
  }

  .shortcut-row {
    grid-template-columns: 1fr;
    gap: clamp(8px, 1vmin, 10px);
  }
}
</style>
