<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {settingsApi, type HealthSnapshot, type SystemMetricsSnapshot} from '@/api'
import {
    formatBytes,
    formatDuration,
    formatMetricTime,
    formatPercent,
} from '@/features/settings/services/system-metrics-format.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {DwButton} from '@/core/components'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'

const REFRESH_INTERVAL_MS = 15_000

const {t} = useI18n()
const layout = useLayoutStore()

const loading = ref(false)
const autoRefresh = ref(true)
const metrics = ref<SystemMetricsSnapshot | null>(null)
const health = ref<HealthSnapshot | null>(null)
const lastError = ref<string | null>(null)

let refreshTimer: ReturnType<typeof setInterval> | null = null

const healthOk = computed(() => {
    const status = metrics.value?.healthStatus?.toUpperCase()
    return status === 'UP' || health.value?.result?.ok === true
})

const heapUsagePercent = computed(() => metrics.value?.jvm.heapUsagePercent ?? null)

const heapBarWidth = computed(() => {
    const percent = heapUsagePercent.value
    if (percent == null) return '0%'
    return `${Math.min(100, Math.max(0, percent))}%`
})

const endpointLabel = settingsApi.resolveBackendEndpointLabel()

const heapTone = computed(() => {
    const percent = heapUsagePercent.value
    if (percent == null) return 'neutral'
    if (percent >= 90) return 'danger'
    if (percent >= 75) return 'warn'
    return 'ok'
})

async function refreshMetrics() {
    if (loading.value) return
    loading.value = true
    lastError.value = null
    try {
        const [nextMetrics, nextHealth] = await Promise.all([
            settingsApi.fetchMetrics(),
            settingsApi.pingHealth(),
        ])
        metrics.value = nextMetrics
        health.value = nextHealth
    } catch (error) {
        lastError.value = error instanceof Error ? error.message : String(error)
    } finally {
        loading.value = false
    }
}

function startAutoRefresh() {
    stopAutoRefresh()
    if (!autoRefresh.value) return
    refreshTimer = setInterval(() => {
        void refreshMetrics()
    }, REFRESH_INTERVAL_MS)
}

function stopAutoRefresh() {
    if (refreshTimer != null) {
        clearInterval(refreshTimer)
        refreshTimer = null
    }
}

function onToggleAutoRefresh() {
    autoRefresh.value = !autoRefresh.value
    if (autoRefresh.value) {
        startAutoRefresh()
        return
    }
    stopAutoRefresh()
}

onMounted(() => {
    void refreshMetrics()
    startAutoRefresh()
})

onUnmounted(() => {
    stopAutoRefresh()
})

function showRefreshToast() {
    if (lastError.value) {
        layout.showToast(lastError.value)
        return
    }
    layout.showToast(t('settings.systemMetrics.refreshed'))
}
</script>

<template>
  <SettingsPageShell
      :title="t('settings.systemMetrics.title')"
      :subtitle="t('settings.systemMetrics.subtitle')"
  >
    <template #actions>
      <div class="panel-actions">
        <label class="auto-refresh">
          <input
              type="checkbox"
              :checked="autoRefresh"
              @change="onToggleAutoRefresh"
          >
          <span>{{ t('settings.systemMetrics.autoRefresh') }}</span>
        </label>
        <DwButton
            variant="secondary"
            :loading="loading"
            :disabled="loading"
            @click="refreshMetrics().then(showRefreshToast)"
        >
          {{ loading ? t('settings.systemMetrics.refreshing') : t('settings.systemMetrics.refresh') }}
        </DwButton>
      </div>
    </template>

    <p v-if="lastError" class="metrics-error">{{ lastError }}</p>

    <div class="settings-groups">
      <section class="setting-block setting-block--compact">
        <div class="metrics-grid">
        <article class="metric-card" :class="healthOk ? 'tone-ok' : 'tone-danger'">
          <span class="metric-card__label">{{ t('settings.systemMetrics.health') }}</span>
          <strong class="metric-card__value">{{ metrics?.healthStatus ?? '—' }}</strong>
          <span class="metric-card__hint">
            {{ health?.result?.latencyMs != null
              ? t('settings.systemMetrics.latency', { ms: health.result.latencyMs })
              : t('settings.systemMetrics.latencyUnknown') }}
          </span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.uptime') }}</span>
          <strong class="metric-card__value">{{ formatDuration(metrics?.uptimeMs ?? 0) }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.processUptime') }}</span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.jdbcPools') }}</span>
          <strong class="metric-card__value">{{ metrics?.datawise.jdbcPoolsActive ?? '—' }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.jdbcPoolsHint') }}</span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.explorerSessions') }}</span>
          <strong class="metric-card__value">{{ metrics?.datawise.explorerSchemaSessionsActive ?? '—' }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.explorerSessionsHint') }}</span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.explorerCacheShortCircuit') }}</span>
          <strong class="metric-card__value">{{ metrics?.datawise.explorerLoadChildrenNotModifiedShortCircuit ?? '—' }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.explorerCacheShortCircuitHint') }}</span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.explorerCacheAfterLoad') }}</span>
          <strong class="metric-card__value">{{ metrics?.datawise.explorerLoadChildrenNotModifiedAfterLoad ?? '—' }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.explorerCacheAfterLoadHint') }}</span>
        </article>

        <article class="metric-card">
          <span class="metric-card__label">{{ t('settings.systemMetrics.explorerCacheModified') }}</span>
          <strong class="metric-card__value">{{ metrics?.datawise.explorerLoadChildrenModified ?? '—' }}</strong>
          <span class="metric-card__hint">{{ t('settings.systemMetrics.explorerCacheModifiedHint') }}</span>
        </article>
        </div>
      </section>

      <section class="setting-block metrics-section">
        <div class="section-head">
          <h3>{{ t('settings.systemMetrics.jvmTitle') }}</h3>
          <span class="section-meta">
            {{ t('settings.systemMetrics.collectedAt', { time: formatMetricTime(metrics?.collectedAt) }) }}
          </span>
        </div>

        <div class="jvm-panel">
          <div class="jvm-row">
            <span>{{ t('settings.systemMetrics.heapUsed') }}</span>
            <strong>
              {{ formatBytes(metrics?.jvm.heapUsedBytes ?? 0) }}
              <template v-if="metrics?.jvm.heapMaxBytes">
                / {{ formatBytes(metrics.jvm.heapMaxBytes) }}
              </template>
            </strong>
          </div>
          <div class="heap-bar" :data-tone="heapTone">
            <div class="heap-bar__fill" :style="{ width: heapBarWidth }"/>
          </div>
          <div class="jvm-foot">
            <span>{{ t('settings.systemMetrics.heapUsage', { value: formatPercent(heapUsagePercent) }) }}</span>
            <span>{{ t('settings.systemMetrics.processors', { n: metrics?.jvm.availableProcessors ?? '—' }) }}</span>
          </div>
        </div>
      </section>

      <section class="metrics-section">
        <div class="section-head">
          <h3>{{ t('settings.systemMetrics.poolsTitle') }}</h3>
          <span class="section-meta">{{ t('settings.systemMetrics.poolsCount', { n: metrics?.jdbcPools.length ?? 0 }) }}</span>
        </div>

        <p v-if="!metrics?.jdbcPools.length" class="metrics-empty">
          {{ t('settings.systemMetrics.noPools') }}
        </p>

        <div v-else class="pool-table-wrap">
          <table class="pool-table">
            <thead>
              <tr>
                <th>{{ t('settings.systemMetrics.poolConnection') }}</th>
                <th>{{ t('settings.systemMetrics.poolActive') }}</th>
                <th>{{ t('settings.systemMetrics.poolIdle') }}</th>
                <th>{{ t('settings.systemMetrics.poolPending') }}</th>
                <th>{{ t('settings.systemMetrics.poolMax') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="pool in metrics.jdbcPools" :key="pool.poolName">
                <td>
                  <div class="pool-id">{{ pool.connectionId }}</div>
                  <div class="pool-name">{{ pool.poolName }}</div>
                </td>
                <td>{{ pool.activeConnections ?? '—' }}</td>
                <td>{{ pool.idleConnections ?? '—' }}</td>
                <td :class="{ 'is-warn': (pool.pendingThreads ?? 0) > 0 }">
                  {{ pool.pendingThreads ?? '—' }}
                </td>
                <td>{{ pool.maxConnections ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="setting-block metrics-section metrics-footnote">
        <p>{{ t('settings.systemMetrics.footnote') }}</p>
        <code>{{ health?.endpoint ?? endpointLabel }}</code>
      </section>
    </div>
  </SettingsPageShell>
</template>
