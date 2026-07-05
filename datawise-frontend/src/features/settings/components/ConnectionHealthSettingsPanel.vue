<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwCheckbox} from '@/core/components'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import {
    collectConnectionIds,
    extractDashboardConnections,
} from '@/features/dashboard/services/dashboard-summary.service'
import {
    isConnectionWatchedInUi,
    toggleWatchedConnectionId,
} from '@/features/explorer/services/connection-health-alert.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import type {ConnectionHealthProbeIntervalMinutes} from '@/shared/config/app-config.types'

const {t} = useI18n()
const appConfig = useAppConfigStore()
const explorer = useExplorerStore()
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.AppConfig)

const probeIntervals: ConnectionHealthProbeIntervalMinutes[] = [1, 5, 15, 30]

const healthPrefs = computed(() => appConfig.connectionHealthPreferences)
const connectionRows = computed(() =>
    extractDashboardConnections(explorer.tree, explorer.connectionHealthById),
)
const connectionIds = computed(() => collectConnectionIds(explorer.tree))

function isWatched(connectionId: string): boolean {
    return isConnectionWatchedInUi(connectionId, connectionIds.value, healthPrefs.value)
}

function onToggleWatch(connectionId: string) {
    if (denyIfReadOnly()) return
    appConfig.patchConnectionHealth({
        watchedConnectionIds: toggleWatchedConnectionId(
            connectionId,
            connectionIds.value,
            healthPrefs.value,
        ),
    })
}

function patchHealth(patch: Parameters<typeof appConfig.patchConnectionHealth>[0]) {
    if (denyIfReadOnly()) return
    appConfig.patchConnectionHealth(patch)
}
</script>

<template>
  <div class="connection-health-settings">
    <header class="panel-head">
      <h2>{{ t('settings.connectionHealth.title') }}</h2>
      <p>{{ t('settings.connectionHealth.subtitle') }}</p>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ hint }}</p>

    <section class="setting-block" :class="{'is-readonly': readOnly}">
      <DwCheckbox
          block
          class="health-toggle"
          :model-value="healthPrefs.alertsEnabled"
          @update:model-value="patchHealth({ alertsEnabled: $event })"
      >
        <strong>{{ t('settings.connectionHealth.alertsEnabled') }}</strong>
        <span class="hint">{{ t('settings.connectionHealth.alertsEnabledHint') }}</span>
      </DwCheckbox>

      <DwCheckbox
          block
          class="health-toggle"
          :model-value="healthPrefs.drawerAlertsEnabled !== false"
          @update:model-value="patchHealth({ drawerAlertsEnabled: $event })"
      >
        <strong>{{ t('settings.connectionHealth.drawerAlertsEnabled') }}</strong>
        <span class="hint">{{ t('settings.connectionHealth.drawerAlertsEnabledHint') }}</span>
      </DwCheckbox>

      <DwCheckbox
          block
          class="health-toggle"
          :model-value="healthPrefs.slowQueryAlertsEnabled !== false"
          @update:model-value="patchHealth({ slowQueryAlertsEnabled: $event })"
      >
        <strong>{{ t('settings.connectionHealth.slowQueryAlertsEnabled') }}</strong>
        <span class="hint">{{ t('settings.connectionHealth.slowQueryAlertsEnabledHint') }}</span>
      </DwCheckbox>

      <div class="health-field">
        <span class="health-field__label">{{ t('settings.connectionHealth.probeInterval') }}</span>
        <span class="hint">{{ t('settings.connectionHealth.probeIntervalHint') }}</span>
        <div class="interval-row">
          <button
              v-for="minutes in probeIntervals"
              :key="minutes"
              class="interval-chip"
              :class="{ active: healthPrefs.probeIntervalMinutes === minutes }"
              type="button"
              @click="patchHealth({ probeIntervalMinutes: minutes })"
          >
            {{ t('settings.connectionHealth.probeIntervalMinutes', { n: minutes }) }}
          </button>
        </div>
      </div>

      <DwCheckbox
          block
          class="health-toggle"
          :model-value="healthPrefs.alertOnOkToError"
          @update:model-value="patchHealth({ alertOnOkToError: $event })"
      >
        <strong>{{ t('settings.connectionHealth.alertOnOkToError') }}</strong>
        <span class="hint">{{ t('settings.connectionHealth.alertOnOkToErrorHint') }}</span>
      </DwCheckbox>

      <DwCheckbox
          block
          class="health-toggle"
          :model-value="healthPrefs.alertOnUnknownToError"
          @update:model-value="patchHealth({ alertOnUnknownToError: $event })"
      >
        <strong>{{ t('settings.connectionHealth.alertOnUnknownToError') }}</strong>
        <span class="hint">{{ t('settings.connectionHealth.alertOnUnknownToErrorHint') }}</span>
      </DwCheckbox>

      <div class="health-field">
        <span class="health-field__label">{{ t('settings.connectionHealth.watchList') }}</span>
        <span class="hint">{{ t('settings.connectionHealth.watchListHint') }}</span>
        <p v-if="!connectionRows.length" class="hint health-empty">
          {{ t('settings.connectionHealth.noConnections') }}
        </p>
        <div v-else class="watch-list">
          <DwCheckbox
              v-for="conn in connectionRows"
              :key="conn.id"
              class="watch-item"
              :model-value="isWatched(conn.id)"
              @update:model-value="() => onToggleWatch(conn.id)"
          >
            <DbTypeIcon :db-type="conn.dbType" :size="DB_TYPE_ICON_SIZE.compact"/>
            <span class="watch-item__name">{{ conn.name }}</span>
            <span class="watch-item__type">{{ conn.dbType }}</span>
          </DwCheckbox>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.connection-health-settings {
  max-width: clamp(480px, 58vw, 760px);
}
</style>
