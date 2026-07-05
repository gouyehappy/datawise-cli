<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwInput, DwSecretInput} from '@/core/components'
import SettingsSelect from '@/core/components/SettingsSelect.vue'
import ConnectionFormField from '@/features/connection/components/ConnectionFormField.vue'
import ConnectionMoreOptions from '@/features/connection/components/ConnectionMoreOptions.vue'
import {
  CONNECTION_AUTH_OPTIONS,
  CONNECTION_ENV_OPTIONS,
  CONNECTION_STORAGE_OPTIONS,
} from '@/features/connection/constants/connection-options'
import type {ConnectionConfig, DbType} from '@/core/types'

const form = defineModel<ConnectionConfig>('form', {required: true})

defineProps<{
  dbType: DbType
}>()

const {t} = useI18n()

const envOptions = computed(() =>
    CONNECTION_ENV_OPTIONS.map((value) => ({
      value,
      label: t(`connection.envOptions.${value}`),
    })),
)
const showEnvCustom = computed(() => form.value.env === 'custom')
const storageOptions = computed(() =>
    CONNECTION_STORAGE_OPTIONS.map((value) => ({
      value,
      label: t(`connection.storageOptions.${value.toLowerCase()}`),
    })),
)
const authOptions = computed(() =>
    CONNECTION_AUTH_OPTIONS.map((value) => ({value, label: value})),
)
</script>

<template>
  <div class="conn-grid">
    <ConnectionFormField wide :label="t('connection.name')" :hint="t('connection.hints.name')">
      <DwInput
          v-model="form.name"
          variant="sm"
          :placeholder="t('connection.namePlaceholder')"
      />
    </ConnectionFormField>

    <ConnectionFormField :label="t('connection.env')" :hint="t('connection.hints.env')">
      <SettingsSelect v-model="form.env" size="sm" :options="envOptions"/>
    </ConnectionFormField>
    <ConnectionFormField
        v-if="showEnvCustom"
        :label="t('connection.envCustom')"
        :hint="t('connection.hints.envCustom')"
    >
      <DwInput
          v-model="form.envCustom"
          variant="sm"
          :placeholder="t('connection.envCustomPlaceholder')"
      />
    </ConnectionFormField>
    <ConnectionFormField :label="t('connection.storage')">
      <SettingsSelect v-model="form.storage" size="sm" :options="storageOptions"/>
    </ConnectionFormField>

    <ConnectionFormField
        :label="t('connection.host')"
        :hint="dbType === 'kafka' ? t('connection.hints.kafkaBootstrap') : undefined"
    >
      <DwInput
          v-model="form.host"
          variant="sm"
          placeholder="localhost"
      />
    </ConnectionFormField>
    <ConnectionFormField :label="t('connection.port')">
      <DwInput v-model="form.port" variant="sm"/>
    </ConnectionFormField>

    <ConnectionFormField v-if="dbType === 'oracle'" wide :label="t('connection.sid')">
      <DwInput v-model="form.sid" variant="sm"/>
    </ConnectionFormField>

    <ConnectionFormField
        v-if="dbType === 'redis'"
        wide
        :label="t('connection.redisDbIndex')"
        :hint="t('connection.hints.redisDbIndex')"
    >
      <DwInput v-model="form.database" variant="sm" placeholder="0"/>
    </ConnectionFormField>

    <ConnectionFormField
        v-else-if="dbType !== 'oracle' && dbType !== 'kafka'"
        wide
        :label="t('connection.database')"
        :hint="t('connection.hints.database')"
    >
      <DwInput v-model="form.database" variant="sm"/>
    </ConnectionFormField>

    <ConnectionFormField wide :label="t('connection.url')">
      <DwInput v-model="form.url" variant="sm" class="url-input" readonly/>
    </ConnectionFormField>

    <template v-if="dbType === 'redis'">
      <ConnectionFormField
          :label="t('connection.username')"
          :hint="t('connection.hints.redisUsername')"
      >
        <DwInput
            v-model="form.user"
            variant="sm"
            :placeholder="t('connection.redisUsernameOptional')"
        />
      </ConnectionFormField>
      <ConnectionFormField
          :label="t('connection.password')"
          :hint="t('connection.hints.redisPassword')"
      >
        <DwSecretInput
            v-model="form.password"
            variant="sm"
            :placeholder="t('connection.redisPasswordOptional')"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
    </template>

    <template v-else>
    <ConnectionFormField wide :label="t('connection.auth')">
      <SettingsSelect v-model="form.auth" size="sm" :options="authOptions"/>
    </ConnectionFormField>

    <template v-if="form.auth !== 'NONE'">
      <ConnectionFormField :label="t('connection.username')">
        <DwInput v-model="form.user" variant="sm"/>
      </ConnectionFormField>
      <ConnectionFormField :label="t('connection.password')">
        <DwSecretInput
            v-model="form.password"
            variant="sm"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
    </template>
    </template>
  </div>

  <ConnectionMoreOptions :form="form"/>
</template>

<style scoped>
.conn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 14px;
}

.url-input {
  font-family: var(--dw-mono);
  font-size: 12px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

@media (max-width: 520px) {
  .conn-grid {
    grid-template-columns: 1fr;
  }
}
</style>
