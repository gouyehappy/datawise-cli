<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {userAdminApi} from '@/api'
import {DwCheckbox, DwInput, ConfirmDialog, DwInlineAlert} from '@/core/components'
import {DwIcon} from '@/core/icons'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {
    createPreset,
    detectPreset,
    normalizeFeaturePermissionMap,
} from '@/features/auth/services/feature-permission.service'
import {FEATURE_PERMISSION_GROUPS} from '@/features/auth/constants/feature-permission-groups'
import {
    type FeaturePermissionKey,
    type FeaturePermissionMap,
    type PermissionPresetId,
    type UserPermissionSummary,
} from '@/features/auth/types/feature-permission.types'

const QUICK_PRESETS: PermissionPresetId[] = ['full', 'workbench']
const DEFAULT_EXPANDED_GROUPS = new Set(['nav', 'workbenchConsole', 'workbenchExplorerContext'])

const {t} = useI18n()
const toast = useAppToast()
const auth = useAuthStore()

const users = ref<UserPermissionSummary[]>([])
const selectedUserId = ref<number | null>(null)
const draftPermissions = ref<FeaturePermissionMap>(createPreset('full'))
const draftPreset = ref<PermissionPresetId>('full')
const savedPermissionsJson = ref('')
const loading = ref(false)
const saving = ref(false)
const panelError = ref('')
const permissionQuery = ref('')
const expandedGroups = ref<Set<string>>(new Set(DEFAULT_EXPANDED_GROUPS))
const switchConfirmOpen = ref(false)
const pendingUserId = ref<number | null>(null)

const selectedUser = computed(() =>
    users.value.find((user) => user.id === selectedUserId.value) ?? null,
)

const isEditable = computed(() => Boolean(selectedUser.value && !selectedUser.value.admin))

const displayPermissionGroups = computed(() => {
    const seen = new Set<FeaturePermissionKey>()
    return FEATURE_PERMISSION_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
            if (seen.has(item.key)) return false
            seen.add(item.key)
            return true
        }),
    })).filter((group) => group.items.length > 0)
})

const totalPermissionCount = computed(() =>
    displayPermissionGroups.value.reduce((sum, group) => sum + group.items.length, 0),
)

const enabledPermissionCount = computed(() =>
    displayPermissionGroups.value.reduce(
        (sum, group) => sum + group.items.filter((item) => draftPermissions.value[item.key]).length,
        0,
    ),
)

const isDirty = computed(
    () => JSON.stringify(draftPermissions.value) !== savedPermissionsJson.value,
)

const filteredGroups = computed(() => {
    const query = permissionQuery.value.trim().toLowerCase()
    if (!query) return displayPermissionGroups.value
    return displayPermissionGroups.value
        .map((group) => ({
            ...group,
            items: group.items.filter((item) =>
                t(item.labelKey).toLowerCase().includes(query),
            ),
        }))
        .filter((group) => group.items.length > 0)
})

const allGroupsExpanded = computed(() =>
    filteredGroups.value.every((group) => expandedGroups.value.has(group.id)),
)

onMounted(() => {
    void loadUsers()
})

watch(selectedUserId, (userId) => {
    const user = users.value.find((entry) => entry.id === userId)
    if (!user) return
    syncDraftFromUser(user)
    permissionQuery.value = ''
    expandedGroups.value = new Set(DEFAULT_EXPANDED_GROUPS)
})

watch(permissionQuery, (query) => {
    if (!query.trim()) return
    expandedGroups.value = new Set(filteredGroups.value.map((group) => group.id))
})

function syncDraftFromUser(user: UserPermissionSummary) {
    const normalized = normalizeFeaturePermissionMap(user.featurePermissions)
    draftPermissions.value = normalized
    draftPreset.value = detectPreset(normalized)
    savedPermissionsJson.value = JSON.stringify(normalized)
}

async function loadUsers() {
    loading.value = true
    panelError.value = ''
    try {
        users.value = await userAdminApi.listUsers()
        if (!selectedUserId.value && users.value.length > 0) {
            const firstEditable = users.value.find((user) => !user.admin) ?? users.value[0]
            selectedUserId.value = firstEditable.id
        }
    } catch (error) {
        panelError.value = error instanceof Error ? error.message : t('settings.userPermissions.loadFailed')
    } finally {
        loading.value = false
    }
}

function requestSelectUser(userId: number) {
    if (userId === selectedUserId.value) return
    if (isDirty.value) {
        pendingUserId.value = userId
        switchConfirmOpen.value = true
        return
    }
    selectedUserId.value = userId
}

function confirmSwitchUser() {
    if (pendingUserId.value != null) {
        selectedUserId.value = pendingUserId.value
    }
    pendingUserId.value = null
    switchConfirmOpen.value = false
}

function cancelSwitchUser() {
    pendingUserId.value = null
    switchConfirmOpen.value = false
}

function applyPreset(preset: PermissionPresetId) {
    if (!isEditable.value || preset === 'custom') return
    draftPreset.value = preset
    draftPermissions.value = createPreset(preset)
}

function togglePermission(key: FeaturePermissionKey, enabled: boolean) {
    if (!isEditable.value) return
    draftPreset.value = 'custom'
    draftPermissions.value = normalizeFeaturePermissionMap({
        ...draftPermissions.value,
        [key]: enabled,
    })
}

function setGroupPermissions(groupId: string, enabled: boolean) {
    if (!isEditable.value) return
    const group = displayPermissionGroups.value.find((entry) => entry.id === groupId)
    if (!group) return
    draftPreset.value = 'custom'
    const next = {...draftPermissions.value}
    for (const item of group.items) {
        next[item.key] = enabled
    }
    draftPermissions.value = normalizeFeaturePermissionMap(next)
}

function groupEnabledCount(groupId: string): number {
    const group = displayPermissionGroups.value.find((entry) => entry.id === groupId)
    if (!group) return 0
    return group.items.filter((item) => draftPermissions.value[item.key]).length
}

function toggleGroupExpanded(groupId: string) {
    const next = new Set(expandedGroups.value)
    if (next.has(groupId)) next.delete(groupId)
    else next.add(groupId)
    expandedGroups.value = next
}

function setAllGroupsExpanded(expanded: boolean) {
    expandedGroups.value = expanded
        ? new Set(filteredGroups.value.map((group) => group.id))
        : new Set<string>()
}

function accountMeta(user: UserPermissionSummary): string {
    if (user.admin) return t('settings.userPermissions.adminBadge')
    if (user.guest) return t('settings.userPermissions.guestBadge')
    return user.username
}

async function savePermissions() {
    if (!selectedUser.value || !isEditable.value || saving.value || !isDirty.value) return
    saving.value = true
    panelError.value = ''
    const sent = normalizeFeaturePermissionMap(draftPermissions.value)
    try {
        const updated = await userAdminApi.updateUserPermissions(
            selectedUser.value.id,
            sent,
        )
        const resolved = normalizeFeaturePermissionMap(updated.featurePermissions ?? sent)
        draftPermissions.value = resolved
        draftPreset.value = detectPreset(resolved)
        savedPermissionsJson.value = JSON.stringify(resolved)
        users.value = users.value.map((user) =>
            user.id === updated.id ? {...updated, featurePermissions: resolved} : user,
        )
        const affectsCurrentSession =
            (auth.isGuest && updated.guest) ||
            (auth.user?.userId != null && auth.user.userId === updated.id)
        if (affectsCurrentSession) {
            await auth.refreshSessionPermissions()
            toast.success(t('settings.userPermissions.saved'))
        } else if (updated.guest) {
            toast.show(t('settings.userPermissions.guestReLoginHint'), {variant: 'info'})
        } else {
            toast.success(t('settings.userPermissions.saved'))
        }
    } catch (error) {
        panelError.value = error instanceof Error ? error.message : t('settings.userPermissions.saveFailed')
    } finally {
        saving.value = false
    }
}
</script>

<template>
  <SettingsPageShell
      width="wide"
      :title="t('settings.userPermissions.title')"
      :subtitle="t('settings.userPermissions.subtitle')"
  >
    <template #actions>
      <span v-if="isDirty && isEditable" class="perm-unsaved-badge">
        {{ t('settings.userPermissions.unsavedBadge') }}
      </span>
      <button
          v-if="selectedUser && isEditable"
          class="dw-text-btn"
          type="button"
          :disabled="saving || !isDirty"
          @click="savePermissions"
      >
        {{ saving ? '…' : t('settings.userPermissions.save') }}
      </button>
    </template>

    <DwInlineAlert :message="panelError"/>

    <div class="perm-workbench">
      <aside class="perm-sidebar">
        <div class="perm-sidebar__head">
          <h3>{{ t('settings.userPermissions.accountsTitle') }}</h3>
          <p class="hint">{{ t('settings.userPermissions.accountsHint') }}</p>
        </div>

        <p v-if="loading" class="hint perm-sidebar__loading">
          {{ t('settings.userPermissions.loading') }}
        </p>

        <div v-else class="perm-sidebar__list" role="listbox" :aria-label="t('settings.userPermissions.accountsTitle')">
          <button
              v-for="user in users"
              :key="user.id"
              type="button"
              class="perm-account"
              :class="{
                'is-active': selectedUserId === user.id,
                'is-locked': user.admin,
              }"
              role="option"
              :aria-selected="selectedUserId === user.id"
              @click="requestSelectUser(user.id)"
          >
            <span class="perm-account__avatar" aria-hidden="true">
              {{ user.displayName.slice(0, 1).toUpperCase() }}
            </span>
            <span class="perm-account__copy">
              <span class="perm-account__name">{{ user.displayName }}</span>
              <span class="perm-account__meta">{{ accountMeta(user) }}</span>
            </span>
            <DwIcon
                v-if="user.admin"
                name="lock"
                class="perm-account__lock"
                :size="14"
                :stroke-width="1.6"
            />
          </button>
        </div>
      </aside>

      <section class="perm-editor">
        <template v-if="selectedUser">
          <header class="perm-editor__head">
            <div>
              <h3>{{ selectedUser.displayName }}</h3>
              <p class="hint">
                <template v-if="selectedUser.admin">
                  {{ t('settings.userPermissions.adminLocked') }}
                </template>
                <template v-else>
                  {{ t('settings.userPermissions.permissionSummary', {
                    enabled: enabledPermissionCount,
                    total: totalPermissionCount,
                  }) }}
                </template>
              </p>
            </div>
          </header>

          <p v-if="selectedUser.admin" class="guest-notice guest-notice--embedded">
            {{ t('settings.userPermissions.adminLocked') }}
          </p>

          <template v-else>
            <div class="perm-presets">
              <button
                  v-for="preset in QUICK_PRESETS"
                  :key="preset"
                  type="button"
                  class="perm-preset-card"
                  :class="{'is-active': draftPreset === preset}"
                  @click="applyPreset(preset)"
              >
                <span class="perm-preset-card__title">
                  {{ t(`settings.userPermissions.presets.${preset}`) }}
                </span>
                <span class="perm-preset-card__hint">
                  {{
                    preset === 'full'
                        ? t('settings.userPermissions.presetFullHint')
                        : t('settings.userPermissions.presetWorkbenchHint')
                  }}
                </span>
              </button>
              <div
                  class="perm-preset-card perm-preset-card--custom"
                  :class="{'is-active': draftPreset === 'custom'}"
              >
                <span class="perm-preset-card__title">
                  {{ t('settings.userPermissions.presets.custom') }}
                </span>
                <span class="perm-preset-card__hint">
                  {{ t('settings.userPermissions.presetCustomHint') }}
                </span>
              </div>
            </div>

            <div class="perm-toolbar">
              <DwInput
                  v-model="permissionQuery"
                  class="perm-toolbar__search"
                  :placeholder="t('settings.userPermissions.searchPlaceholder')"
              />
              <div class="perm-toolbar__actions">
                <button
                    type="button"
                    class="perm-toolbar__btn"
                    @click="setAllGroupsExpanded(!allGroupsExpanded)"
                >
                  {{
                    allGroupsExpanded
                        ? t('settings.userPermissions.collapseAll')
                        : t('settings.userPermissions.expandAll')
                  }}
                </button>
              </div>
            </div>

            <p v-if="!filteredGroups.length" class="hint perm-empty">
              {{ t('settings.userPermissions.noSearchResults') }}
            </p>

            <div v-else class="perm-groups">
              <section
                  v-for="group in filteredGroups"
                  :key="group.id"
                  class="perm-group"
                  :class="{'is-expanded': expandedGroups.has(group.id)}"
              >
                <button
                    type="button"
                    class="perm-group__head"
                    :aria-expanded="expandedGroups.has(group.id)"
                    @click="toggleGroupExpanded(group.id)"
                >
                  <DwIcon
                      class="perm-group__chevron"
                      name="chevron-down"
                      :size="14"
                      :stroke-width="1.4"
                  />
                  <span class="perm-group__title">{{ t(group.labelKey) }}</span>
                  <span class="perm-group__count">
                    {{ groupEnabledCount(group.id) }}/{{ group.items.length }}
                  </span>
                  <span class="perm-group__actions" @click.stop>
                    <button
                        type="button"
                        class="perm-group__action"
                        @click="setGroupPermissions(group.id, true)"
                    >
                      {{ t('settings.userPermissions.enableGroup') }}
                    </button>
                    <button
                        type="button"
                        class="perm-group__action"
                        @click="setGroupPermissions(group.id, false)"
                    >
                      {{ t('settings.userPermissions.disableGroup') }}
                    </button>
                  </span>
                </button>

                <div v-show="expandedGroups.has(group.id)" class="perm-group__body">
                  <div class="perm-check-grid">
                    <DwCheckbox
                        v-for="item in group.items"
                        :key="item.key"
                        class="perm-check"
                        :model-value="draftPermissions[item.key]"
                        @update:model-value="togglePermission(item.key, $event)"
                    >
                      {{ t(item.labelKey) }}
                    </DwCheckbox>
                  </div>
                </div>
              </section>
            </div>
          </template>
        </template>

        <div v-else-if="!loading" class="perm-editor__empty">
          <p>{{ t('settings.userPermissions.selectAccountHint') }}</p>
        </div>
      </section>
    </div>

    <footer
        v-if="selectedUser && isEditable && isDirty"
        class="perm-save-bar"
    >
      <p class="hint perm-save-bar__hint">{{ t('settings.userPermissions.customHint') }}</p>
      <button
          class="btn-secondary"
          type="button"
          :disabled="saving"
          @click="savePermissions"
      >
        {{ saving ? '…' : t('settings.userPermissions.save') }}
      </button>
    </footer>

    <ConfirmDialog
        v-model:open="switchConfirmOpen"
        :title="t('settings.userPermissions.unsavedSwitchTitle')"
        :message="t('settings.userPermissions.unsavedConfirm')"
        :confirm-label="t('settings.userPermissions.unsavedSwitchConfirm')"
        @update:open="(open) => { if (!open) cancelSwitchUser() }"
        @confirm="confirmSwitchUser"
    />
  </SettingsPageShell>
</template>

<style scoped>
.perm-workbench {
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: var(--mp-gap-lg);
  align-items: start;
  min-height: clamp(420px, 58vh, 640px);
}

.perm-sidebar,
.perm-editor {
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-editor);
  box-shadow: var(--dw-panel-shadow);
  min-height: 0;
}

.perm-sidebar {
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  max-height: clamp(420px, 58vh, 640px);
}

.perm-sidebar__head {
  padding: var(--dw-space-7);
  border-bottom: 1px solid var(--dw-border-light);
}

.perm-sidebar__head h3 {
  margin: 0;
  font-size: var(--mp-section);
  font-weight: 600;
}

.perm-sidebar__head .hint {
  margin: var(--dw-space-2) 0 0;
}

.perm-sidebar__loading {
  padding: var(--dw-space-6);
}

.perm-sidebar__list {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-xs);
  padding: var(--dw-space-5);
  overflow: auto;
}

.perm-account {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  width: 100%;
  padding: var(--dw-pad-control-lg);
  border: 1px solid transparent;
  border-radius: var(--dw-radius-lg);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease), border-color 0.12s ease;
}

.perm-account:hover {
  background: var(--dw-bg-hover);
}

.perm-account.is-active {
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 7%, var(--dw-bg-panel));
}

.perm-account.is-locked {
  opacity: 0.88;
}

.perm-account__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: var(--dw-tab-height);
  border-radius: var(--dw-control-radius);
  background: color-mix(in srgb, var(--dw-primary) 12%, var(--dw-bg-muted));
  color: var(--dw-primary);
  font-size: var(--dw-text-md);
  font-weight: 700;
  flex-shrink: 0;
}

.perm-account__copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-1);
}

.perm-account__name {
  font-size: var(--mp-sub);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.perm-account__meta {
  font-size: var(--mp-caption);
  color: var(--dw-text-muted);
}

.perm-account__lock {
  flex-shrink: 0;
  color: var(--dw-text-muted);
}

.perm-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.perm-editor__head {
  padding: var(--dw-space-7) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border-light);
}

.perm-editor__head h3 {
  margin: 0;
  font-size: var(--mp-section);
  font-weight: 650;
}

.perm-editor__head .hint {
  margin: var(--dw-space-2) 0 0;
}

.perm-editor__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--dw-space-12) var(--dw-space-9);
  color: var(--dw-text-muted);
  font-size: var(--mp-sub);
}

.perm-presets {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--dw-gap-md);
  padding: var(--dw-space-6) clamp(16px, 1.8vmin, 18px);
  border-bottom: 1px solid var(--dw-border-light);
}

.perm-preset-card {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-xs);
  min-height: 72px;
  padding: var(--dw-space-6) var(--dw-space-7);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  text-align: left;
  cursor: pointer;
  transition: var(--dw-transition-colors), box-shadow 0.12s ease;
}

.perm-preset-card:hover:not(.perm-preset-card--custom) {
  border-color: color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
}

.perm-preset-card.is-active {
  border-color: var(--dw-primary-border);
  background: var(--dw-primary-softer);
  box-shadow: inset 0 0 0 1px var(--dw-primary-ring);
}

.perm-preset-card--custom {
  cursor: default;
}

.perm-preset-card__title {
  font-size: var(--mp-sub);
  font-weight: 650;
  color: var(--dw-text);
}

.perm-preset-card.is-active .perm-preset-card__title {
  color: var(--dw-primary);
}

.perm-preset-card__hint {
  font-size: var(--mp-caption);
  line-height: var(--dw-leading);
  color: var(--dw-text-muted);
}

.perm-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dw-gap-md);
  padding: clamp(10px, 1.2vmin, 12px) clamp(16px, 1.8vmin, 18px);
  border-bottom: 1px solid var(--dw-border-light);
}

.perm-toolbar__search {
  flex: 1 1 220px;
  min-width: 0;
}

.perm-toolbar__actions {
  display: flex;
  gap: var(--dw-gap);
  flex-shrink: 0;
}

.perm-toolbar__btn,
.perm-group__action {
  height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-5);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: var(--mp-caption);
  cursor: pointer;
  transition: var(--dw-transition-colors);
}

.perm-toolbar__btn:hover,
.perm-group__action:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border-light));
  color: var(--dw-primary);
}

.perm-groups {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-5) clamp(12px, 1.4vmin, 14px) clamp(14px, 1.6vmin, 16px);
}

.perm-group + .perm-group {
  margin-top: var(--dw-space-4);
}

.perm-group {
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.perm-group__head {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: var(--dw-gap);
  width: 100%;
  padding: var(--dw-pad-control-lg);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.perm-group__head:hover {
  background: var(--dw-bg-hover);
}

.perm-group__chevron {
  color: var(--dw-text-muted);
  transition: transform var(--dw-duration) var(--dw-ease);
}

.perm-group.is-expanded .perm-group__chevron {
  transform: rotate(180deg);
}

.perm-group__title {
  font-size: var(--mp-sub);
  font-weight: 600;
}

.perm-group__count {
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  border: 1px solid var(--dw-border-light);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text-muted);
  font-variant-numeric: tabular-nums;
}

.perm-group__actions {
  display: inline-flex;
  gap: var(--dw-gap-sm);
}

.perm-group__body {
  padding: 0 var(--dw-space-6) var(--dw-space-6);
  border-top: 1px solid var(--dw-border-light);
}

.perm-check-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--dw-space-4) var(--dw-space-7);
  padding-top: var(--dw-space-6);
}

.perm-check {
  font-size: var(--mp-caption);
}

.perm-empty {
  padding: var(--dw-space-9) var(--dw-space-8);
  text-align: center;
}

.perm-unsaved-badge {
  display: inline-flex;
  align-items: center;
  height: var(--dw-btn-height);
  padding: 0 var(--dw-space-5);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-warning) 12%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, var(--dw-warning) 35%, transparent);
  color: var(--dw-warning-fg);
  font-size: var(--mp-caption);
  font-weight: 600;
}

.perm-save-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
  margin-top: var(--mp-gap-lg);
  padding: var(--dw-space-6) var(--dw-space-8);
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-editor);
  box-shadow: var(--dw-panel-shadow);
  position: sticky;
  bottom: 0;
  z-index: var(--dw-z-raised);
}

.perm-save-bar__hint {
  flex: 1 1 240px;
  margin: 0;
  min-width: 0;
}

@media (max-width: 900px) {
  .perm-workbench {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .perm-sidebar {
    position: static;
    max-height: 280px;
  }

  .perm-presets {
    grid-template-columns: 1fr;
  }

  .perm-check-grid {
    grid-template-columns: 1fr;
  }

  .perm-group__head {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .perm-group__count {
    grid-column: 2;
  }

  .perm-group__actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>
