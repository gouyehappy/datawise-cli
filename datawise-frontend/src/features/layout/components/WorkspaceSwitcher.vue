<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {DwIcon} from '@/core/icons'
import {useWorkspaceSwitcher} from '@/features/layout/composables/useWorkspaceSwitcher'
import type {WorkspaceListEntry} from '@/features/settings/services/config-dir-settings.service'

defineEmits<{
  dblclickDrag: []
}>()

const {t} = useI18n()
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<{top: string; left: string} | undefined>()

const {
  loading,
  switching,
  canSwitch,
  activeEntry,
  recentOthers,
  displayName,
  displayInitials,
  displayAccent,
  confirmSwitch,
  createWorkspace,
  openFolder,
  useDefaultWorkspace,
  dismissRecent,
} = useWorkspaceSwitcher()

const active = computed(() => activeEntry())
const recents = computed(() => recentOthers())
const showDefaultAction = computed(() => active.value && !active.value.isDefault)

usePopoverEscape(
    () => open.value,
    () => close(),
)

function close() {
  open.value = false
  panelStyle.value = undefined
}

function updatePanelPlacement() {
  const trigger = triggerRef.value
  if (!trigger) return
  const rect = trigger.getBoundingClientRect()
  panelStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  }
}

function toggle() {
  if (!canSwitch.value || loading.value) return
  if (open.value) {
    close()
    return
  }
  open.value = true
  updatePanelPlacement()
}

async function onSelect(entry: WorkspaceListEntry) {
  close()
  confirmSwitch(entry)
}

function onCreateWorkspace() {
  close()
  createWorkspace()
}

async function onOpenFolder() {
  close()
  await openFolder()
}

function onUseDefault() {
  close()
  useDefaultWorkspace()
}

async function onRemove(entry: WorkspaceListEntry, event: MouseEvent) {
  event.stopPropagation()
  await dismissRecent(entry)
}

function onDocumentMouseDown(event: MouseEvent) {
  if (!open.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (triggerRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  close()
}

function onWindowResize() {
  if (open.value) close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown)
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown)
  window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <div class="ws-switcher">
    <button
        ref="triggerRef"
        type="button"
        class="ws-switcher__trigger"
        :class="{ 'is-open': open, 'is-disabled': !canSwitch || loading }"
        :disabled="!canSwitch || loading"
        :title="active?.path ?? t('app.titleBar.workspaceSwitcher.default')"
        @click="toggle"
        @dblclick.stop="$emit('dblclickDrag')"
    >
      <span
          v-if="active"
          class="ws-switcher__badge"
          :style="{ background: displayAccent(active).bg, color: displayAccent(active).fg }"
      >
        {{ displayInitials(active) }}
      </span>
      <span class="ws-switcher__name">
        {{ active ? displayName(active) : t('app.title') }}
      </span>
      <DwIcon class="ws-switcher__caret" name="chevron-down" size="xs" :stroke-width="1.3"/>
    </button>

    <Teleport to="body">
      <Transition name="ws-switcher-drop">
        <div
            v-if="open"
            ref="panelRef"
            class="ws-switcher__panel"
            :style="panelStyle"
            role="menu"
        >
          <div class="ws-switcher__actions">
            <button
                type="button"
                class="ws-switcher__action ws-switcher__action--primary"
                :disabled="switching"
                role="menuitem"
                @click="onCreateWorkspace"
            >
              <DwIcon name="plus" size="sm" :stroke-width="1.6"/>
              <span>{{ t('app.titleBar.workspaceSwitcher.newWorkspace') }}</span>
            </button>
            <button
                type="button"
                class="ws-switcher__action"
                :disabled="switching"
                role="menuitem"
                @click="onOpenFolder"
            >
              <DwIcon name="open" size="sm" :stroke-width="1.4"/>
              <span>{{ t('app.titleBar.workspaceSwitcher.openFolder') }}</span>
            </button>
            <button
                v-if="showDefaultAction"
                type="button"
                class="ws-switcher__action"
                :disabled="switching"
                role="menuitem"
                @click="onUseDefault"
            >
              <DwIcon name="submit" size="sm" :stroke-width="1.4"/>
              <span>{{ t('app.titleBar.workspaceSwitcher.useDefault') }}</span>
            </button>
          </div>

          <section v-if="active" class="ws-switcher__section">
            <header class="ws-switcher__section-head">{{ t('app.titleBar.workspaceSwitcher.current') }}</header>
            <button
                type="button"
                class="ws-switcher__row is-active"
                disabled
                role="menuitem"
            >
              <span
                  class="ws-switcher__row-badge"
                  :style="{ background: displayAccent(active).bg, color: displayAccent(active).fg }"
              >
                {{ displayInitials(active) }}
              </span>
              <span class="ws-switcher__row-copy">
                <span class="ws-switcher__row-name">{{ displayName(active) }}</span>
                <span class="ws-switcher__row-path">{{ active.path }}</span>
              </span>
            </button>
          </section>

          <section v-if="recents.length" class="ws-switcher__section">
            <header class="ws-switcher__section-head">{{ t('app.titleBar.workspaceSwitcher.recent') }}</header>
            <div class="ws-switcher__list">
              <div
                  v-for="entry in recents"
                  :key="entry.path"
                  class="ws-switcher__row-wrap"
              >
                <button
                    type="button"
                    class="ws-switcher__row"
                    :disabled="switching"
                    role="menuitem"
                    @click="onSelect(entry)"
                >
                  <span
                      class="ws-switcher__row-badge"
                      :style="{ background: displayAccent(entry).bg, color: displayAccent(entry).fg }"
                  >
                    {{ displayInitials(entry) }}
                  </span>
                  <span class="ws-switcher__row-copy">
                    <span class="ws-switcher__row-name">{{ displayName(entry) }}</span>
                    <span class="ws-switcher__row-path">{{ entry.path }}</span>
                  </span>
                </button>
                <button
                    type="button"
                    class="ws-switcher__remove"
                    :title="t('app.titleBar.workspaceSwitcher.removeRecent')"
                    :disabled="switching"
                    @click="onRemove(entry, $event)"
                >
                  ×
                </button>
              </div>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ws-switcher {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 100%;
  -webkit-app-region: no-drag;
}

.ws-switcher__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-space-3);
  height: var(--dw-titlebar-chip-size);
  max-width: min(240px, 32vw);
  padding: 0 var(--dw-space-5) 0 var(--dw-space-4);
  border: none;
  border-radius: var(--dw-titlebar-chip-radius);
  background: transparent;
  color: var(--dw-text);
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease);
}

.ws-switcher__trigger:hover:not(.is-disabled),
.ws-switcher__trigger.is-open {
  background: var(--dw-titlebar-chip-hover);
}

.ws-switcher__trigger.is-open {
  background: var(--dw-titlebar-chip-active);
}

.ws-switcher__trigger.is-disabled {
  cursor: default;
  opacity: 0.72;
}

.ws-switcher__badge,
.ws-switcher__row-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--dw-radius-sm);
  font-size: var(--dw-text-xs);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}

.ws-switcher__badge {
  width: 20px;
  height: 20px;
  border-radius: var(--dw-control-radius-sm);
}

.ws-switcher__row-badge {
  width: 28px;
  height: var(--dw-btn-height);
  font-size: var(--dw-text-xs);
}

.ws-switcher__name {
  min-width: 0;
  font-size: var(--dw-text-md);
  font-weight: 500;
  letter-spacing: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-switcher__caret {
  flex-shrink: 0;
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  opacity: 0.65;
  transition: transform var(--dw-duration) var(--dw-ease);
}

.ws-switcher__trigger.is-open .ws-switcher__caret {
  transform: rotate(180deg);
}

.ws-switcher__panel {
  position: fixed;
  z-index: var(--dw-z-max);
  width: min(420px, calc(100vw - 24px));
  max-height: min(520px, calc(100vh - 48px));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid color-mix(in srgb, var(--dw-border) 88%, var(--dw-primary) 12%);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.28),
      0 0 0 1px color-mix(in srgb, var(--dw-text) 4%, transparent);
  -webkit-app-region: no-drag;
}

.ws-switcher__actions {
  display: flex;
  flex-direction: column;
  padding: var(--dw-space-2) 0;
  border-bottom: 1px solid var(--dw-border-light);
}

.ws-switcher__action {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  width: 100%;
  min-height: var(--dw-tab-height);
  padding: 0 var(--dw-space-7);
  border: none;
  background: transparent;
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  text-align: left;
  cursor: pointer;
}

.ws-switcher__action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
}

.ws-switcher__action--primary {
  color: var(--dw-primary);
  font-weight: 600;
}

.ws-switcher__action--primary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dw-primary) 16%, transparent);
}

.ws-switcher__action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ws-switcher__section {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ws-switcher__section + .ws-switcher__section {
  border-top: 1px solid var(--dw-border-light);
}

.ws-switcher__section-head {
  padding: var(--dw-space-4) var(--dw-space-7) var(--dw-space-2);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text-muted);
  letter-spacing: 0.02em;
}

.ws-switcher__list {
  max-height: min(320px, 42vh);
  overflow-y: auto;
  padding: 0 0 var(--dw-space-2);
}

.ws-switcher__row-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dw-space-1);
  padding: 0 var(--dw-space-2) 0 0;
}

.ws-switcher__row {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  width: 100%;
  min-height: 44px;
  padding: var(--dw-space-3) var(--dw-space-5) var(--dw-space-3) var(--dw-space-7);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ws-switcher__row:hover:not(:disabled):not(.is-active) {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.ws-switcher__row.is-active {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
  cursor: default;
}

.ws-switcher__row:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ws-switcher__row-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-1);
}

.ws-switcher__row-name {
  font-size: var(--dw-text-sm);
  font-weight: 600;
  color: var(--dw-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-switcher__row.is-active .ws-switcher__row-name {
  color: var(--dw-primary);
}

.ws-switcher__row-path {
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading-snug);
  color: var(--dw-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ws-switcher__remove {
  width: 24px;
  height: var(--dw-control-h-xs);
  margin-right: var(--dw-space-3);
  border: none;
  border-radius: var(--dw-radius-sm);
  background: transparent;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xl);
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dw-duration-fast) var(--dw-ease), background var(--dw-duration-fast) var(--dw-ease);
}

.ws-switcher__row-wrap:hover .ws-switcher__remove {
  opacity: 1;
}

.ws-switcher__remove:hover:not(:disabled) {
  background: var(--dw-bg-hover);
  color: var(--dw-text);
}

.ws-switcher-drop-enter-active,
.ws-switcher-drop-leave-active {
  transition: opacity var(--dw-duration-fast) var(--dw-ease), transform var(--dw-duration-fast) var(--dw-ease);
}

.ws-switcher-drop-enter-from,
.ws-switcher-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
