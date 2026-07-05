<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState, StatusPill} from '@/core/components'
import {workspacePanelApi} from '@/api'
import {
    formatDurationMs,
    truncateSql,
    type SqlExecutionStats,
} from '@/features/workspace/services/sql-stats.service'
import {DEFAULT_SLOW_QUERY_THRESHOLD_MS} from '@/features/workspace/services/slow-query.utils'

const props = withDefaults(defineProps<{
  connectionId?: string
  days?: number
  limit?: number
  slowThresholdMs?: number
  embedded?: boolean
}>(), {
  days: 7,
  limit: 8,
  slowThresholdMs: DEFAULT_SLOW_QUERY_THRESHOLD_MS,
  embedded: false,
})

const emit = defineEmits<{
  openSql: [sql: string]
}>()

const {t} = useI18n()
const loading = ref(false)
const stats = ref<SqlExecutionStats | null>(null)

const i18nPrefix = computed(() => props.embedded ? 'shortcut.slowSql' : 'dashboard.slowSql')

const trendMax = computed(() =>
    Math.max(...(stats.value?.trend.map((point) => point.maxDurationMs) ?? [0]), 1),
)

async function loadStats() {
  loading.value = true
  try {
    stats.value = await workspacePanelApi.fetchSqlStats({
      connectionId: props.connectionId,
      days: props.days,
      limit: props.limit,
      slowThresholdMs: props.slowThresholdMs,
    })
  } catch {
    stats.value = null
  } finally {
    loading.value = false
  }
}

function openEntry(sql: string) {
  emit('openSql', sql)
}

onMounted(() => {
  void loadStats()
})
</script>

<template>
  <section class="slow-sql-panel" :class="{ 'slow-sql-panel--embedded': embedded }">
    <header class="slow-sql-panel__head">
      <div>
        <h2 class="slow-sql-panel__title">{{ t(`${i18nPrefix}.title`) }}</h2>
        <p class="slow-sql-panel__hint">
          {{ t(`${i18nPrefix}.subtitle`, {days: props.days, threshold: props.slowThresholdMs}) }}
        </p>
      </div>
      <button class="slow-sql-panel__refresh" type="button" :disabled="loading" @click="loadStats">
        {{ loading ? t(`${i18nPrefix}.loading`) : t(`${i18nPrefix}.refresh`) }}
      </button>
    </header>

    <EmptyState v-if="loading && !stats" embedded bordered :title="t(`${i18nPrefix}.loading`)"/>
    <EmptyState v-else-if="!stats" embedded bordered :title="t(`${i18nPrefix}.loadFailed`)"/>
    <template v-else>
      <div class="slow-sql-panel__summary">
        <div class="summary-item">
          <span class="summary-item__value">{{ stats.totalRuns }}</span>
          <span class="summary-item__label">{{ t(`${i18nPrefix}.totalRuns`) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-item__value">{{ formatDurationMs(stats.avgDurationMs) }}</span>
          <span class="summary-item__label">{{ t(`${i18nPrefix}.avgDuration`) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-item__value">{{ stats.slowQueries.length }}</span>
          <span class="summary-item__label">{{ t(`${i18nPrefix}.slowCount`) }}</span>
        </div>
      </div>

      <div
          v-if="stats.trend.length"
          class="slow-sql-panel__trend"
          :aria-label="t(`${i18nPrefix}.trendTitle`)"
      >
        <div
            v-for="point in stats.trend"
            :key="point.date"
            class="trend-bar"
            :title="`${point.date}: ${point.runCount} runs, max ${formatDurationMs(point.maxDurationMs)}`"
        >
          <span
              class="trend-bar__fill"
              :style="{ height: `${Math.max(8, (point.maxDurationMs / trendMax) * 100)}%` }"
          />
          <span class="trend-bar__label">{{ point.date.slice(5) }}</span>
        </div>
      </div>

      <EmptyState v-if="!stats.slowQueries.length" embedded bordered :title="t(`${i18nPrefix}.noSlowQueries`)"/>
      <ol v-else class="slow-sql-panel__list">
        <li v-for="entry in stats.slowQueries" :key="entry.id">
          <button
              v-if="embedded"
              class="slow-sql-row slow-sql-row--clickable"
              type="button"
              @click="openEntry(entry.sql)"
          >
            <div class="slow-sql-row__meta">
              <span class="slow-sql-row__duration">{{ formatDurationMs(entry.durationMs) }}</span>
              <span v-if="entry.connectionId" class="slow-sql-row__conn">{{ entry.connectionId }}</span>
              <StatusPill v-if="entry.teamShared" variant="team" inline>{{ t(`${i18nPrefix}.teamShared`) }}</StatusPill>
              <span class="slow-sql-row__hint">{{ t('shortcut.openSql') }}</span>
            </div>
            <code class="slow-sql-row__sql">{{ truncateSql(entry.sql, embedded ? 96 : 120) }}</code>
          </button>
          <div v-else class="slow-sql-row">
            <div class="slow-sql-row__meta">
              <span class="slow-sql-row__duration">{{ formatDurationMs(entry.durationMs) }}</span>
              <span v-if="entry.connectionId" class="slow-sql-row__conn">{{ entry.connectionId }}</span>
              <StatusPill v-if="entry.teamShared" variant="team" inline>{{ t(`${i18nPrefix}.teamShared`) }}</StatusPill>
            </div>
            <code class="slow-sql-row__sql">{{ truncateSql(entry.sql) }}</code>
          </div>
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.slow-sql-panel {
  display: grid;
  gap: 14px;
}

.slow-sql-panel--embedded {
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--dw-border-light);
  margin-bottom: 4px;
}

.slow-sql-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.slow-sql-panel--embedded .slow-sql-panel__head {
  gap: 8px;
}

.slow-sql-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.slow-sql-panel--embedded .slow-sql-panel__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.slow-sql-panel__hint {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.slow-sql-panel--embedded .slow-sql-panel__hint {
  font-size: 11px;
  line-height: 1.4;
}

.slow-sql-panel__refresh {
  padding: 6px 10px;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 12px;
  cursor: pointer;
}

.slow-sql-panel--embedded .slow-sql-panel__refresh {
  padding: 4px 8px;
  font-size: 10px;
}

.slow-sql-panel__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.slow-sql-panel--embedded .slow-sql-panel__summary {
  gap: 6px;
}

.summary-item {
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.slow-sql-panel--embedded .summary-item {
  padding: 8px 9px;
  border-radius: 9px;
  background: var(--dw-bg);
}

.summary-item__value {
  display: block;
  font-size: 18px;
  font-weight: 600;
}

.slow-sql-panel--embedded .summary-item__value {
  font-size: 14px;
}

.summary-item__label {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.slow-sql-panel--embedded .summary-item__label {
  font-size: 10px;
}

.slow-sql-panel__trend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
  gap: 6px;
  align-items: end;
  min-height: 72px;
  padding: 8px 0 0;
}

.slow-sql-panel--embedded .slow-sql-panel__trend {
  min-height: 56px;
}

.trend-bar {
  display: grid;
  gap: 4px;
  justify-items: center;
  height: 72px;
}

.slow-sql-panel--embedded .trend-bar {
  height: 56px;
}

.trend-bar__fill {
  width: 100%;
  max-width: 18px;
  border-radius: 4px 4px 0 0;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.95), rgba(139, 92, 246, 0.35));
  align-self: end;
}

.trend-bar__label {
  font-size: 10px;
  color: var(--dw-text-muted);
}

.slow-sql-panel__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.slow-sql-row {
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.slow-sql-panel--embedded .slow-sql-row {
  padding: 9px 10px;
  border-radius: 10px;
  background: var(--dw-bg);
}

.slow-sql-row--clickable {
  width: 100%;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease;
}

.slow-sql-row--clickable:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 22%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 4%, var(--dw-bg));
}

.slow-sql-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.slow-sql-row__duration {
  font-size: 12px;
  font-weight: 600;
  color: rgb(139, 92, 246);
}

.slow-sql-row__conn,
.slow-sql-row__hint {
  font-size: 11px;
  color: var(--dw-text-muted);
}

.slow-sql-row__hint {
  opacity: 0;
  transition: opacity 0.12s ease, color 0.12s ease;
}

.slow-sql-row--clickable:hover .slow-sql-row__hint {
  opacity: 1;
  color: var(--dw-primary);
}

.slow-sql-row__sql {
  display: block;
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-mono);
}

.slow-sql-panel--embedded .slow-sql-row__sql {
  font-size: 11px;
  max-height: 3.6em;
  overflow: hidden;
}
</style>
