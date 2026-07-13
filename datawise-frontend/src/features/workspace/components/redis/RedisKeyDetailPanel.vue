<script setup lang="ts">

import {computed, ref, watch} from 'vue'

import {useI18n} from 'vue-i18n'

import {ConfirmDialog, DwButton, EmptyState} from '@/core/components'

import {useLayoutStore} from '@/features/layout/stores/layout'

import {explorerApi} from '@/api'

import {

    formatRedisSize,

    formatRedisTtl,

    type RedisKeyDetail,

} from '@/features/explorer/services/redis-key.service'

import {

    buildRedisDelCommand,

    buildRedisGetCommand,

    buildRedisTtlCommand,

    buildRedisTypeCommand,

} from '@/features/explorer/services/redis-command-hints.service'



const props = defineProps<{

    connectionId: string

    redisKey: string

    database?: number

}>()



const emit = defineEmits<{

    runCommand: [command: string]

    openTab: [key: string]

    deleted: [key: string]

}>()



const {t} = useI18n()

const layout = useLayoutStore()



const loading = defineModel<boolean>('loading', {default: false})

const detail = defineModel<RedisKeyDetail | null>('detail', {default: null})

const error = defineModel<string | null>('error', {default: null})

const deleteConfirmOpen = ref(false)



const ttlLabel = computed(() => {

    if (!detail.value) return '—'

    if (detail.value.ttlSeconds === -1) return t('explorer.redisKey.ttlPersistent')

    if (detail.value.ttlSeconds === -2) return t('explorer.redisKey.ttlMissing')

    return formatRedisTtl(detail.value.ttlSeconds)

})



const sizeLabel = computed(() =>

    detail.value ? formatRedisSize(detail.value.type, detail.value.size) : '—',

)



const typeClass = computed(() => {

    const type = detail.value?.type?.toLowerCase() ?? ''

    return type ? `is-${type}` : ''

})



async function loadDetail() {

    if (!props.connectionId || !props.redisKey) return

    loading.value = true

    error.value = null

    try {

        detail.value = await explorerApi.fetchRedisKey(props.connectionId, props.redisKey, {

            database: props.database,

        })

    } catch (err) {

        detail.value = null

        error.value = err instanceof Error ? err.message : t('explorer.redisKey.loadFailed')

    } finally {

        loading.value = false

    }

}



function onRunGet() {

    emit('runCommand', buildRedisGetCommand(props.redisKey))

}



function onRunTtl() {

    emit('runCommand', buildRedisTtlCommand(props.redisKey))

}



function onRunType() {

    emit('runCommand', buildRedisTypeCommand(props.redisKey))

}



async function copyText(text: string) {

    try {

        await navigator.clipboard.writeText(text)

        layout.showToast(t('explorer.redisConsole.copied'))

    } catch {

        // ignore clipboard failures

    }

}



async function onDeleteKey() {
    deleteConfirmOpen.value = true
}

async function confirmDeleteKey() {

    try {

        const result = await explorerApi.executeRedisCommand(

            props.connectionId,

            buildRedisDelCommand(props.redisKey),

            {database: props.database},

        )

        if (!result.success) {

            layout.showToast(result.error ?? result.output)

            return

        }

        deleteConfirmOpen.value = false

        emit('deleted', props.redisKey)

    } catch (err) {

        layout.showToast(err instanceof Error ? err.message : String(err))

    }

}



watch(

    () => [props.connectionId, props.redisKey, props.database] as const,

    () => {

        void loadDetail()

    },

    {immediate: true},

)

</script>



<template>

  <section class="redis-key-detail-panel">

    <header class="redis-key-detail-panel__head">

      <div class="redis-key-detail-panel__title">

        <div class="redis-key-detail-panel__title-row">

          <h3>{{ t('explorer.redisKey.title') }}</h3>

          <span v-if="detail" class="redis-key-detail-panel__type" :class="typeClass">

            {{ detail.type }}

          </span>

        </div>

        <p class="redis-key-detail-panel__key">{{ redisKey }}</p>

      </div>

      <div class="redis-key-detail-panel__actions">

        <DwButton variant="secondary" size="sm" :loading="loading" :disabled="loading" @click="loadDetail">

          {{ loading ? t('explorer.redisKey.loading') : t('explorer.redisKey.refresh') }}

        </DwButton>

        <DwButton variant="secondary" size="sm" @click="copyText(redisKey)">

          {{ t('explorer.redisConsole.copyKey') }}

        </DwButton>

        <DwButton variant="secondary" size="sm" :disabled="!detail" @click="copyText(detail?.preview ?? '')">

          {{ t('explorer.redisConsole.copyValue') }}

        </DwButton>

        <DwButton variant="secondary" size="sm" @click="onRunGet">

          GET

        </DwButton>

        <DwButton variant="secondary" size="sm" @click="onRunTtl">

          TTL

        </DwButton>

        <DwButton variant="secondary" size="sm" @click="onRunType">

          TYPE

        </DwButton>

        <DwButton variant="secondary" size="sm" @click="emit('openTab', redisKey)">

          {{ t('explorer.redisBrowser.openInTab') }}

        </DwButton>

        <DwButton variant="danger" size="sm" @click="onDeleteKey">

          {{ t('explorer.redisConsole.deleteKey') }}

        </DwButton>

      </div>

    </header>



    <p v-if="error" class="redis-key-detail-panel__error">{{ error }}</p>

    <EmptyState v-else-if="loading && !detail" embedded bordered :title="t('explorer.redisKey.loading')"/>



    <div v-else-if="detail" class="redis-key-detail-panel__meta">

      <div class="redis-key-detail-panel__field">

        <span>{{ t('explorer.redisKey.ttl') }}</span>

        <strong>{{ ttlLabel }}</strong>

      </div>

      <div class="redis-key-detail-panel__field">

        <span>{{ t('explorer.redisKey.size') }}</span>

        <strong>{{ sizeLabel }}</strong>

      </div>

    </div>



    <pre v-if="detail" class="redis-key-detail-panel__preview">{{ detail.preview || t('explorer.redisKey.emptyValue') }}</pre>

  </section>

  <ConfirmDialog
      v-model:open="deleteConfirmOpen"
      :title="t('explorer.redisConsole.deleteKey')"
      :message="t('explorer.redisConsole.deleteConfirm', {key: redisKey})"
      :confirm-label="t('explorer.redisConsole.deleteKey')"
      @confirm="confirmDeleteKey"
  />

</template>



<style scoped>

.redis-key-detail-panel {

  display: flex;

  flex-direction: column;

  min-height: 0;

  border: 1px solid var(--dw-border);

  border-radius: 8px;

  background: var(--dw-bg-panel);

  padding: 12px;

}



.redis-key-detail-panel__head {

  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: 12px;

}



.redis-key-detail-panel__title-row {

  display: flex;

  align-items: center;

  gap: 8px;

}



.redis-key-detail-panel__head h3 {

  margin: 0;

  font-size: 13px;

  font-weight: 600;

}



.redis-key-detail-panel__type {

  padding: 1px 8px;

  border-radius: 999px;

  font-size: 10px;

  font-weight: 600;

  text-transform: uppercase;

  background: color-mix(in srgb, var(--dw-text-muted) 15%, transparent);

  color: var(--dw-text-muted);

}



.redis-key-detail-panel__type.is-string {

  background: color-mix(in srgb, #16a34a 15%, transparent);

  color: #16a34a;

}



.redis-key-detail-panel__type.is-hash {

  background: color-mix(in srgb, #2563eb 15%, transparent);

  color: #2563eb;

}



.redis-key-detail-panel__type.is-list {

  background: color-mix(in srgb, #d97706 15%, transparent);

  color: #d97706;

}



.redis-key-detail-panel__type.is-set,

.redis-key-detail-panel__type.is-zset {

  background: color-mix(in srgb, #7c3aed 15%, transparent);

  color: #7c3aed;

}



.redis-key-detail-panel__key {

  margin: 4px 0 0;

  color: var(--dw-text-muted);

  font-family: var(--dw-font-mono, ui-monospace, monospace);

  font-size: 11px;

  word-break: break-all;

}



.redis-key-detail-panel__actions {

  display: flex;

  flex-wrap: wrap;

  justify-content: flex-end;

  gap: 6px;

}



.redis-key-detail-panel__error {

  margin: 8px 0 0;

  color: var(--dw-danger);

  font-size: 12px;

}



.redis-key-detail-panel__meta {

  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 8px;

  margin-top: 10px;

}



.redis-key-detail-panel__field {

  display: flex;

  flex-direction: column;

  gap: 2px;

  font-size: 11px;

  color: var(--dw-text-muted);

}



.redis-key-detail-panel__field strong {

  color: var(--dw-text);

  font-size: 12px;

}



.redis-key-detail-panel__preview {

  flex: 1;

  min-height: 0;

  margin: 10px 0 0;

  padding: 10px;

  overflow: auto;

  border: 1px solid var(--dw-border);

  border-radius: 6px;

  background: var(--dw-bg-editor);

  font-family: var(--dw-font-mono, ui-monospace, monospace);

  font-size: 11px;

  line-height: 1.5;

  white-space: pre-wrap;

  word-break: break-word;

}

</style>


