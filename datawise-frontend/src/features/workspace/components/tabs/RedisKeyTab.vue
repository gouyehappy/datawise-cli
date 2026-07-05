<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {DwButton, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import {
    formatRedisSize,
    formatRedisTtl,
    type RedisKeyDetail,
} from '@/features/explorer/services/redis-key.service'

const props = defineProps<{
    tab: WorkspaceTab
}>()

const {t} = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)
const detail = ref<RedisKeyDetail | null>(null)

const redisKey = computed(() => props.tab.redisKey ?? '')
const connectionId = computed(() => props.tab.connectionId ?? '')

const ttlLabel = computed(() => {
    if (!detail.value) return '—'
    if (detail.value.ttlSeconds === -1) return t('explorer.redisKey.ttlPersistent')
    if (detail.value.ttlSeconds === -2) return t('explorer.redisKey.ttlMissing')
    return formatRedisTtl(detail.value.ttlSeconds)
})

const sizeLabel = computed(() =>
    detail.value ? formatRedisSize(detail.value.type, detail.value.size) : '—',
)

async function loadDetail() {
    if (!connectionId.value || !redisKey.value) return
    loading.value = true
    error.value = null
    try {
        detail.value = await explorerApi.fetchRedisKey(connectionId.value, redisKey.value)
    } catch (err) {
        detail.value = null
        error.value = err instanceof Error ? err.message : t('explorer.redisKey.loadFailed')
    } finally {
        loading.value = false
    }
}

watch([connectionId, redisKey], loadDetail, {immediate: true})

onMounted(loadDetail)
</script>

<template>
  <div class="redis-key-tab">
    <header class="redis-key-tab__head">
      <div>
        <h2>{{ t('explorer.redisKey.title') }}</h2>
        <p class="redis-key-tab__key">{{ redisKey }}</p>
      </div>
      <DwButton variant="secondary" :loading="loading" :disabled="loading" @click="loadDetail">
        {{ loading ? t('explorer.redisKey.loading') : t('explorer.redisKey.refresh') }}
      </DwButton>
    </header>

    <p v-if="error" class="redis-key-tab__error">{{ error }}</p>
    <EmptyState v-else-if="loading && !detail" embedded bordered :title="t('explorer.redisKey.loading')"/>

    <section v-else-if="detail" class="redis-key-tab__meta">
      <div class="redis-key-tab__field">
        <span class="redis-key-tab__label">{{ t('explorer.redisKey.type') }}</span>
        <span class="redis-key-tab__value">{{ detail.type }}</span>
      </div>
      <div class="redis-key-tab__field">
        <span class="redis-key-tab__label">{{ t('explorer.redisKey.ttl') }}</span>
        <span class="redis-key-tab__value">{{ ttlLabel }}</span>
      </div>
      <div class="redis-key-tab__field">
        <span class="redis-key-tab__label">{{ t('explorer.redisKey.size') }}</span>
        <span class="redis-key-tab__value">{{ sizeLabel }}</span>
      </div>
    </section>

    <section v-if="detail" class="redis-key-tab__preview">
      <div class="redis-key-tab__preview-head">
        <h3>{{ t('explorer.redisKey.preview') }}</h3>
        <span v-if="detail.previewTruncated" class="redis-key-tab__truncated">
          {{ t('explorer.redisKey.truncated') }}
        </span>
      </div>
      <pre class="redis-key-tab__code">{{ detail.preview || t('explorer.redisKey.emptyValue') }}</pre>
    </section>
  </div>
</template>

<style scoped>
.redis-key-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 20px 24px;
  overflow: auto;
}

.redis-key-tab__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.redis-key-tab__head h2 {
  margin: 0 0 4px;
  font-size: 18px;
}

.redis-key-tab__key {
  margin: 0;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 13px;
  color: var(--dw-text-secondary);
  word-break: break-all;
}

.redis-key-tab__error {
  margin: 0;
  color: var(--dw-danger, #dc2626);
  font-size: 13px;
}

.redis-key-tab__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}

.redis-key-tab__field {
  padding: 12px 14px;
  border: 1px solid var(--dw-panel-border);
  border-radius: 10px;
  background: var(--dw-bg-muted);
}

.redis-key-tab__label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-secondary);
}

.redis-key-tab__value {
  font-size: 14px;
  font-weight: 600;
}

.redis-key-tab__preview {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 180px;
}

.redis-key-tab__preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.redis-key-tab__preview-head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.redis-key-tab__truncated {
  font-size: 11px;
  color: var(--dw-text-muted);
}

.redis-key-tab__code {
  flex: 1;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--dw-panel-border);
  border-radius: 10px;
  background: var(--dw-bg-muted);
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}
</style>
