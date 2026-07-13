<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useProfileSidebarMenuGroups} from '@/features/layout/composables/useProfileMenuGroups'

const emit = defineEmits<{ close: [] }>()

const props = defineProps<{
  menuStyle?: {top: string; left: string}
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const auth = useAuthStore()
const menuGroups = useProfileSidebarMenuGroups(() => emit('close'))
</script>

<template>
  <div
      class="profile-menu"
      :class="{ 'profile-menu--anchored': !!props.menuStyle }"
      :style="props.menuStyle"
      @click.stop
  >
    <header class="menu-head">
      <div class="menu-avatar" :class="{ 'menu-avatar--guest': auth.isGuest }">
        <span>{{ layout.profileName.charAt(0) }}</span>
      </div>
      <div class="menu-user">
        <div class="menu-name-row">
          <div class="menu-name">{{ layout.profileName }}</div>
          <span v-if="auth.isGuest" class="menu-guest-badge">{{ t('auth.guestBadge') }}</span>
        </div>
        <div class="menu-email">{{ layout.profileEmail }}</div>
      </div>
    </header>

    <nav class="menu-list">
      <template v-for="(group, groupIndex) in menuGroups" :key="group[0]?.id ?? groupIndex">
        <div v-if="groupIndex > 0" class="menu-divider"/>
        <button
            v-for="item in group"
            :key="item.id"
            class="menu-item"
            :class="{'menu-item--accent': item.accent}"
            type="button"
            @click="item.onClick"
        >
          <DwIcon :name="item.icon" size="menu" :stroke-width="item.icon === 'users' ? 1.35 : 1.4"/>
          <span class="menu-item-label">{{ t(item.labelKey) }}</span>
          <span v-if="item.badgeKey" class="menu-badge">{{ t(item.badgeKey) }}</span>
        </button>
      </template>
    </nav>
  </div>
</template>

<style scoped>
.profile-menu {
  position: fixed;
  left: calc(var(--dw-rail-width) + 8px);
  top: 10px;
  z-index: 1200;
  width: 268px;
  padding: 6px;
  border: 1px solid var(--dw-border-light);
  border-radius: 12px;
  background: var(--dw-bg);
  box-shadow: 0 10px 32px rgba(15, 23, 42, 0.12);
}

.profile-menu--anchored {
  left: auto;
  top: auto;
}

.menu-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 10px 8px;
}

.menu-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}

.menu-avatar--guest {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.menu-user {
  min-width: 0;
}

.menu-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.menu-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-guest-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-text-muted) 12%, transparent);
  color: var(--dw-text-secondary);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
}

.menu-email {
  margin-top: 2px;
  color: var(--dw-text-muted);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: 13px;
  text-align: left;
  transition: background 0.12s ease, color 0.12s ease;
}

.menu-item svg {
  flex-shrink: 0;
  width: 17px;
  height: 17px;
  color: var(--dw-text-muted);
}

.menu-item:hover {
  background: var(--dw-bg-hover);
  color: var(--dw-text);
}

.menu-item-label {
  flex: 1;
  min-width: 0;
}

.menu-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.5;
}

.menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--dw-border-light);
}
</style>
