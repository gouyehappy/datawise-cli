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
  z-index: var(--dw-z-toast);
  width: 268px;
  padding: var(--dw-space-3);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-xl);
  background: var(--dw-bg);
  box-shadow: var(--dw-shadow-float);
}

.profile-menu--anchored {
  left: auto;
  top: auto;
}

.menu-head {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  padding: var(--dw-space-5) var(--dw-space-5) var(--dw-space-4);
}

.menu-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: var(--dw-radius-lg);
  background: linear-gradient(135deg, var(--dw-primary), var(--dw-primary-hover));
  color: var(--dw-on-accent);
  font-size: var(--dw-text-2xl);
  font-weight: 700;
  flex-shrink: 0;
}

.menu-avatar--guest {
  background: linear-gradient(135deg, var(--dw-text-muted), var(--dw-text-secondary));
}

.menu-user {
  min-width: 0;
}

.menu-name-row {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.menu-name {
  font-size: var(--dw-text-xl);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-guest-badge {
  flex-shrink: 0;
  padding: 1px var(--dw-space-3);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-text-muted) 12%, transparent);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  line-height: var(--dw-leading-relaxed);
}

.menu-email {
  margin-top: var(--dw-space-1);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-1);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  width: 100%;
  min-height: var(--dw-control-h);
  padding: 0 var(--dw-space-5);
  border: none;
  border-radius: var(--dw-control-radius);
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-md);
  text-align: left;
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
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
  padding: 1px var(--dw-space-3);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  line-height: var(--dw-leading-relaxed);
}

.menu-divider {
  height: 1px;
  margin: var(--dw-space-2) var(--dw-space-4);
  background: var(--dw-border-light);
}
</style>
