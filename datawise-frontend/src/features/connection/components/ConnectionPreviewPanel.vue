<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import TagChip from '@/core/components/TagChip.vue'
import {resolveConnectionEnvironmentLabel} from '@/features/connection/services/connection-environment.service'
import type {ConnectionConfig, DbType} from '@/core/types'

const props = defineProps<{
  dbType: DbType
  label: string
  form: ConnectionConfig
}>()

const {t} = useI18n()

const displayName = computed(
    () => props.form.name?.trim() || `${props.label}@${props.form.host || 'localhost'}`,
)
const endpoint = computed(() => {
  const host = props.form.host?.trim() || '—'
  const port = props.form.port?.trim() || '—'
  return `${host}:${port}`
})
const authLabel = computed(() => props.form.auth || 'NONE')
const databaseLabel = computed(() => {
  if (props.dbType === 'redis') {
    return props.form.database?.trim() || '0'
  }
  return props.form.database?.trim() || t('connection.preview.defaultDb')
})
const envLabel = computed(() =>
    resolveConnectionEnvironmentLabel(props.form.env, props.form.envCustom, t),
)
</script>

<template>
  <aside class="conn-preview">
    <div class="preview-card preview-card--hero">
      <DbTypeIcon class="preview-icon" :db-type="dbType" :size="DB_TYPE_ICON_SIZE.preview"/>
      <div class="preview-hero__text">
        <h2>{{ displayName }}</h2>
        <p>{{ label }}</p>
      </div>
    </div>

    <div class="preview-card">
      <h3>{{ t('connection.preview.summary') }}</h3>
      <dl class="preview-kv">
        <div class="preview-kv__row">
          <dt>{{ t('connection.preview.endpoint') }}</dt>
          <dd class="mono">{{ endpoint }}</dd>
        </div>
        <div class="preview-kv__row">
          <dt>{{ dbType === 'redis' ? t('connection.redisDbIndex') : t('connection.database') }}</dt>
          <dd>{{ databaseLabel }}</dd>
        </div>
        <div v-if="dbType !== 'redis'" class="preview-kv__row">
          <dt>{{ t('connection.auth') }}</dt>
          <dd>{{ authLabel }}</dd>
        </div>
        <div class="preview-kv__row">
          <dt>{{ t('connection.url') }}</dt>
          <dd class="mono url">{{ form.url || '—' }}</dd>
        </div>
      </dl>
      <div class="preview-tags">
        <TagChip v-if="form.env">{{ envLabel }}</TagChip>
        <TagChip v-if="form.storage">
          {{ t(`connection.storageOptions.${form.storage.toLowerCase()}`) }}
        </TagChip>
        <TagChip v-if="form.sshEnabled">{{ t('connection.sshSection') }}</TagChip>
      </div>
    </div>

    <div class="preview-card preview-card--tips">
      <h3>{{ t('connection.preview.tipsTitle') }}</h3>
      <ol class="preview-steps">
        <li>{{ t('connection.preview.tipTest') }}</li>
        <li>{{ t('connection.preview.tipSave') }}</li>
        <li>{{ t('connection.preview.tipManage') }}</li>
      </ol>
    </div>
  </aside>
</template>

<style scoped>
.conn-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
  padding: 20px 24px 24px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

.preview-card {
  padding: 14px 16px;
  border: 1px solid var(--dw-border-light);
  border-radius: 12px;
  background: var(--dw-bg);
}

.preview-card--hero {
  display: flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, var(--dw-bg-panel) 0%, var(--dw-bg) 100%);
}

.preview-card h3 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.preview-icon {
  flex-shrink: 0;
}

.preview-hero__text h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
}

.preview-hero__text p {
  margin: 4px 0 0;
  color: var(--dw-text-secondary);
  font-size: 12px;
}

.preview-kv {
  margin: 0;
}

.preview-kv__row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  padding: 6px 0;
}

.preview-kv__row + .preview-kv__row {
  border-top: 1px solid var(--dw-border-light);
}

.preview-kv__row dt {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.5;
}

.preview-kv__row dd {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  word-break: break-all;
}

.preview-kv__row dd.mono {
  font-family: var(--dw-mono);
}

.preview-kv__row dd.url {
  font-size: 11px;
  color: var(--dw-text-secondary);
}

.preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.preview-steps {
  margin: 0;
  padding-left: 18px;
  color: var(--dw-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.preview-steps li + li {
  margin-top: 6px;
}
</style>
