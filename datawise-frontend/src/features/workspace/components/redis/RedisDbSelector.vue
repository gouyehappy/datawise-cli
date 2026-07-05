<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {DwIcon} from '@/core/icons'
import {
    clampRedisDbIndex,
    parseRedisDbInput,
    REDIS_DB_MAX,
    redisDbQuickPicks,
} from '@/features/explorer/services/redis-db.service'

const model = defineModel<number>({required: true})

const {t} = useI18n()

const rootRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const open = ref(false)
const draft = ref('')
const flashing = ref(false)

const quickPicks = computed(() => redisDbQuickPicks(model.value))
const canApply = computed(() => parseRedisDbInput(draft.value) != null)
const draftDb = computed(() => parseRedisDbInput(draft.value))

usePopoverEscape(open, cancelEdit)

watch(
    () => model.value,
    (value) => {
        if (!open.value) draft.value = String(value)
    },
)

function syncDraft() {
    draft.value = String(model.value)
}

function pulseFlash() {
    flashing.value = true
    window.setTimeout(() => {
        flashing.value = false
    }, 360)
}

function commitDb(next: number) {
    if (next === model.value) return
    model.value = next
    draft.value = String(next)
    pulseFlash()
}

function stepModel(delta: number) {
    commitDb(clampRedisDbIndex(model.value + delta))
}

async function togglePopover() {
    if (open.value) {
        cancelEdit()
        return
    }
    syncDraft()
    open.value = true
    await nextTick()
    inputRef.value?.focus()
    inputRef.value?.select()
}

function cancelEdit() {
    open.value = false
    syncDraft()
}

function applyDraft() {
    const next = parseRedisDbInput(draft.value)
    if (next == null) return
    if (next === model.value) {
        cancelEdit()
        return
    }
    commitDb(next)
    open.value = false
}

function pickQuick(db: number) {
    commitDb(db)
    open.value = false
}

function onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault()
        applyDraft()
    }
    if (event.key === 'Escape') {
        event.preventDefault()
        cancelEdit()
    }
}
</script>

<template>
  <div class="redis-db-picker">
    <span class="redis-db-picker__label">{{ t('explorer.redisConsole.dbLabel') }}</span>

    <div
        ref="rootRef"
        class="redis-db-picker__root"
        :class="{ 'is-open': open, 'is-flash': flashing }"
    >
      <button
          class="redis-db-picker__step"
          type="button"
          :disabled="model <= 0"
          :title="t('explorer.redisConsole.dbPrev')"
          @click="stepModel(-1)"
      >
        <DwIcon name="minus" size="sm" :stroke-width="1.5"/>
      </button>

      <button
          class="redis-db-picker__trigger"
          type="button"
          :aria-expanded="open"
          :title="t('explorer.redisConsole.dbSwitchHint')"
          @click="togglePopover"
      >
        <span class="redis-db-picker__mono">DB</span>
        <span class="redis-db-picker__value">{{ model }}</span>
        <DwIcon class="redis-db-picker__chevron" name="chevron-down" size="sm" :stroke-width="1.5"/>
      </button>

      <button
          class="redis-db-picker__step"
          type="button"
          :disabled="model >= REDIS_DB_MAX"
          :title="t('explorer.redisConsole.dbNext')"
          @click="stepModel(1)"
      >
        <DwIcon name="plus" size="sm" :stroke-width="1.5"/>
      </button>

      <Transition name="redis-db-menu">
        <div
            v-if="open"
            class="redis-db-picker__menu"
            role="dialog"
            :aria-label="t('explorer.redisConsole.dbPopoverTitle')"
        >
          <div class="redis-db-picker__field">
            <span class="redis-db-picker__field-prefix">DB</span>
            <input
                ref="inputRef"
                v-model="draft"
                class="redis-db-picker__field-input"
                type="text"
                inputmode="numeric"
                spellcheck="false"
                maxlength="2"
                :placeholder="t('explorer.redisConsole.dbInputPlaceholder')"
                @keydown="onInputKeydown"
            />
            <button
                class="redis-db-picker__field-go"
                type="button"
                :disabled="!canApply"
                @click="applyDraft"
            >
              {{ t('explorer.redisConsole.dbApply') }}
            </button>
          </div>

          <ul class="redis-db-picker__list">
            <li v-for="db in quickPicks" :key="db">
              <button
                  class="redis-db-picker__item"
                  type="button"
                  :class="{ 'is-active': db === (draftDb ?? model) }"
                  @click="pickQuick(db)"
              >
                <span class="redis-db-picker__item-label">DB{{ db }}</span>
                <DwIcon
                    v-if="db === model"
                    class="redis-db-picker__check"
                    name="submit"
                    size="sm"
                    :stroke-width="1.6"
                />
              </button>
            </li>
          </ul>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.redis-db-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.redis-db-picker__label {
  font-size: var(--mp-sub, 12px);
  color: var(--dw-text-muted);
  white-space: nowrap;
}

.redis-db-picker__root {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  height: 34px;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-panel-radius, 8px);
  background: var(--dw-bg, var(--dw-bg-panel));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.redis-db-picker__root:hover:not(.is-open) {
  border-color: color-mix(in srgb, var(--dw-primary) 18%, var(--dw-border));
}

.redis-db-picker__root.is-open {
  border-color: var(--dw-primary-border);
  box-shadow: 0 0 0 3px var(--dw-primary-soft);
}

.redis-db-picker__root.is-flash .redis-db-picker__trigger {
  animation: redis-db-flash 0.36s ease;
}

@keyframes redis-db-flash {
  0%, 100% {
    background: transparent;
  }
  50% {
    background: var(--dw-primary-softer, var(--dw-primary-mild));
  }
}

.redis-db-picker__step {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  border: none;
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.redis-db-picker__step svg {
  width: 14px;
  height: 14px;
}

.redis-db-picker__step:first-child {
  border-right: 1px solid var(--dw-border);
  border-radius: calc(var(--dw-panel-radius, 8px) - 1px) 0 0 calc(var(--dw-panel-radius, 8px) - 1px);
}

.redis-db-picker__step:last-child {
  border-left: 1px solid var(--dw-border);
  border-radius: 0 calc(var(--dw-panel-radius, 8px) - 1px) calc(var(--dw-panel-radius, 8px) - 1px) 0;
}

.redis-db-picker__step:hover:not(:disabled) {
  background: var(--dw-bg-muted);
  color: var(--dw-text);
}

.redis-db-picker__step:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.redis-db-picker__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 78px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--dw-text);
  font: inherit;
  cursor: pointer;
  transition: background 0.12s ease;
}

.redis-db-picker__trigger:hover {
  background: var(--dw-bg-muted);
}

.redis-db-picker__mono {
  font-family: var(--dw-font-mono, ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace);
  font-size: 11px;
  font-weight: 500;
  color: var(--dw-text-muted);
}

.redis-db-picker__value {
  font-family: var(--dw-font-mono, ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.redis-db-picker__chevron {
  width: 14px;
  height: 14px;
  margin-left: 1px;
  color: var(--dw-text-muted);
  transition: transform 0.18s ease, color 0.15s ease;
}

.redis-db-picker__root.is-open .redis-db-picker__chevron {
  transform: rotate(180deg);
  color: var(--dw-primary);
}

.redis-db-picker__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 120;
  min-width: 188px;
  padding: 5px;
  border: 1px solid var(--dw-border-light, var(--dw-border));
  border-radius: calc(var(--dw-panel-radius, 8px) + 2px);
  background: var(--dw-bg, var(--dw-bg-panel));
  box-shadow: var(--dw-menu-shadow, 0 10px 28px rgba(15, 23, 42, 0.1));
}

.redis-db-picker__field {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  padding: 4px;
  border-radius: calc(var(--dw-panel-radius, 8px) - 1px);
  background: var(--dw-bg-muted, color-mix(in srgb, var(--dw-text) 3%, transparent));
}

.redis-db-picker__field-prefix {
  padding-left: 6px;
  font-family: var(--dw-font-mono, ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace);
  font-size: 11px;
  font-weight: 500;
  color: var(--dw-text-muted);
}

.redis-db-picker__field-input {
  width: 36px;
  border: none;
  background: transparent;
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  outline: none;
}

.redis-db-picker__field-input::placeholder {
  color: var(--dw-text-muted);
  font-weight: 400;
}

.redis-db-picker__field-go {
  margin-left: auto;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: calc(var(--dw-panel-radius, 8px) - 2px);
  background: transparent;
  color: var(--dw-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.12s ease;
}

.redis-db-picker__field-go:hover:not(:disabled) {
  background: var(--dw-primary-soft);
}

.redis-db-picker__field-go:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.redis-db-picker__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.redis-db-picker__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: calc(var(--dw-panel-radius, 8px) - 1px);
  background: transparent;
  color: var(--dw-text-secondary);
  font: inherit;
  font-size: var(--mp-sub, 12px);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.redis-db-picker__item-label {
  font-family: var(--dw-font-mono, ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, monospace);
  font-weight: 500;
}

.redis-db-picker__item:hover {
  background: var(--dw-bg-hover, color-mix(in srgb, var(--dw-text) 4%, transparent));
  color: var(--dw-text);
}

.redis-db-picker__item.is-active {
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}

.redis-db-picker__check {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--dw-primary);
}

.redis-db-menu-enter-active,
.redis-db-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.redis-db-menu-enter-from,
.redis-db-menu-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
