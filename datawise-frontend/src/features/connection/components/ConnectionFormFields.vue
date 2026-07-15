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
  readOnly?: boolean
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
          :disabled="readOnly"
          :placeholder="t('connection.namePlaceholder')"
      />
    </ConnectionFormField>

    <ConnectionFormField :label="t('connection.env')" :hint="t('connection.hints.env')">
      <SettingsSelect v-model="form.env" size="sm" :disabled="readOnly" :options="envOptions"/>
    </ConnectionFormField>
    <ConnectionFormField
        v-if="showEnvCustom"
        :label="t('connection.envCustom')"
        :hint="t('connection.hints.envCustom')"
    >
      <DwInput
          v-model="form.envCustom"
          variant="sm"
          :disabled="readOnly"
          :placeholder="t('connection.envCustomPlaceholder')"
      />
    </ConnectionFormField>
    <ConnectionFormField :label="t('connection.storage')">
      <SettingsSelect v-model="form.storage" size="sm" :disabled="readOnly" :options="storageOptions"/>
    </ConnectionFormField>

    <ConnectionFormField
        :label="t('connection.host')"
        :hint="dbType === 'kafka' ? t('connection.hints.kafkaBootstrap') : dbType === 'yarn' ? t('connection.hints.yarnResourceManager') : dbType === 'ssh' ? t('connection.hints.sshHost') : undefined"
    >
      <DwInput
          v-model="form.host"
          variant="sm"
          :disabled="readOnly"
          placeholder="localhost"
      />
    </ConnectionFormField>
    <ConnectionFormField :label="t('connection.port')">
      <DwInput v-model="form.port" variant="sm" :disabled="readOnly"/>
    </ConnectionFormField>

    <ConnectionFormField v-if="dbType === 'oracle'" wide :label="t('connection.sid')">
      <DwInput v-model="form.sid" variant="sm" :disabled="readOnly"/>
    </ConnectionFormField>

    <ConnectionFormField
        v-if="dbType === 'redis'"
        wide
        :label="t('connection.redisDbIndex')"
        :hint="t('connection.hints.redisDbIndex')"
    >
      <DwInput v-model="form.database" variant="sm" :disabled="readOnly" placeholder="0"/>
    </ConnectionFormField>

    <ConnectionFormField
        v-else-if="dbType !== 'oracle' && dbType !== 'kafka' && dbType !== 'yarn' && dbType !== 'ssh'"
        wide
        :label="t('connection.database')"
        :hint="t('connection.hints.database')"
    >
      <DwInput v-model="form.database" variant="sm" :disabled="readOnly"/>
    </ConnectionFormField>

    <ConnectionFormField v-if="dbType !== 'ssh'" wide :label="t('connection.url')">
      <DwInput v-model="form.url" variant="sm" class="url-input" readonly/>
    </ConnectionFormField>

    <template v-if="dbType === 'ssh'">
      <ConnectionFormField :label="t('connection.username')">
        <DwInput v-model="form.user" variant="sm" :disabled="readOnly"/>
      </ConnectionFormField>
      <ConnectionFormField :label="t('connection.password')" :hint="t('connection.hints.sshPassword')">
        <DwSecretInput
            v-model="form.password"
            variant="sm"
            :disabled="readOnly"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
      <ConnectionFormField
          wide
          :label="t('connection.sshPrivateKey')"
          :hint="t('connection.hints.sshPrivateKey')"
      >
        <textarea
            v-model="form.sshPrivateKey"
            class="dw-input ssh-key-input"
            rows="4"
            :disabled="readOnly"
            :placeholder="t('connection.sshPrivateKeyPlaceholder')"
        />
      </ConnectionFormField>
      <ConnectionFormField :label="t('connection.sshPassphrase')">
        <DwSecretInput
            v-model="form.sshPassphrase"
            variant="sm"
            :disabled="readOnly"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
    </template>

    <template v-else-if="dbType === 'redis'">
      <ConnectionFormField
          :label="t('connection.username')"
          :hint="t('connection.hints.redisUsername')"
      >
        <DwInput
            v-model="form.user"
            variant="sm"
            :disabled="readOnly"
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
            :disabled="readOnly"
            :placeholder="t('connection.redisPasswordOptional')"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
    </template>

    <template v-else>
    <ConnectionFormField wide :label="t('connection.auth')">
      <SettingsSelect v-model="form.auth" size="sm" :disabled="readOnly" :options="authOptions"/>
    </ConnectionFormField>

    <template v-if="form.auth !== 'NONE'">
      <ConnectionFormField :label="t('connection.username')">
        <DwInput v-model="form.user" variant="sm" :disabled="readOnly"/>
      </ConnectionFormField>
      <ConnectionFormField :label="t('connection.password')">
        <DwSecretInput
            v-model="form.password"
            variant="sm"
            :disabled="readOnly"
            :show-label="t('connection.showPassword')"
            :hide-label="t('connection.hidePassword')"
        />
      </ConnectionFormField>
    </template>
    </template>
  </div>

  <ConnectionMoreOptions v-if="dbType !== 'ssh'" :form="form" :read-only="readOnly"/>
</template>

<style scoped>
.conn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--dw-space-6) var(--dw-space-7);
}

.url-input {
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

.ssh-key-input {
  min-height: 88px;
  resize: vertical;
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
}

@media (max-width: 520px) {
  .conn-grid {
    grid-template-columns: 1fr;
  }
}
</style>
