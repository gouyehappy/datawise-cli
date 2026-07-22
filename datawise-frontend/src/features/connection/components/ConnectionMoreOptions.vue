<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import CollapsibleSection from '@/core/components/CollapsibleSection.vue'
import {DwIcon} from '@/core/icons'
import SettingsSwitch from '@/core/components/SettingsSwitch.vue'
import ConnectionFormField from '@/features/connection/components/ConnectionFormField.vue'
import {resolveJdbcDriver} from '@/features/datasource/services/datasource-catalog.service'
import {isJdbcDriverRequired} from '@/features/connection/utils/connection-defaults'
import {supportsSshTunnel} from '@/shared/capabilities/db-type-capabilities'
import {useDatasourceCatalogStore} from '@/features/datasource/stores/datasource-catalog'
import {
    resolveApiErrorMessage,
    resolveDisplayApiErrorMessage,
} from '@/shared/api/http/api-error-message'
import type {ConnectionConfig, DbType} from '@/core/types'

const props = defineProps<{ form: ConnectionConfig; readOnly?: boolean }>()

const {t} = useI18n()
const catalogStore = useDatasourceCatalogStore()
const resolving = ref(false)
const resolveMessage = ref<string | null>(null)
const resolveOk = ref<boolean | null>(null)

const dbType = computed(() => (props.form.dbType ?? 'mysql') as DbType)
const catalogItem = computed(() => catalogStore.items.find((item) => item.id === dbType.value))
const showDriverSection = computed(() => isJdbcDriverRequired(dbType.value, catalogItem.value))
const showSshSection = computed(() => supportsSshTunnel(dbType.value, catalogStore.items))

const driverBadge = computed(() => {
  const coords = props.form.driver?.trim()
  if (!coords) return ''
  const parts = coords.split(':')
  if (parts.length >= 2) return `${parts[1]}:${parts[2] ?? ''}`
  return coords.length > 22 ? `${coords.slice(0, 20)}…` : coords
})

async function onResolveDriver() {
  const mavenCoordinates = props.form.driver?.trim() ?? ''
  const driverClass = props.form.driverClass?.trim() ?? ''
  if (!mavenCoordinates || !driverClass) {
    resolveOk.value = false
    resolveMessage.value = t('connection.driverResolveRequired')
    return
  }
  resolving.value = true
  resolveMessage.value = null
  try {
    const result = await resolveJdbcDriver(mavenCoordinates, driverClass)
    // Do not rewrite form.driver from the resolve response — backend jar-name remapping
    // used to snap elasticsearch 7.3.0 back to a locally cached 8.x coordinate.
    resolveOk.value = true
    resolveMessage.value = result.cached
        ? t('connection.driverResolveCached')
        : t('connection.driverResolveSuccess')
  } catch (err) {
    resolveOk.value = false
    resolveMessage.value = resolveDisplayApiErrorMessage(err, t) || resolveApiErrorMessage(err)
  } finally {
    resolving.value = false
  }
}
</script>

<template>
  <div class="conn-more">
    <div class="conn-more__head">
      <span class="conn-more__label">{{ t('connection.sections.more') }}</span>
      <span class="conn-more__count">{{ t('connection.moreCount') }}</span>
    </div>

    <div class="more-list">
      <CollapsibleSection
          v-if="showDriverSection"
          :title="t('connection.driverSection')"
          :description="t('connection.collapseDesc.driver')"
      >
        <template #icon>
          <DwIcon name="database" size="md" filled/>
        </template>
        <template v-if="driverBadge" #badge>
          <span class="more-badge">{{ driverBadge }}</span>
        </template>

        <ConnectionFormField :label="t('connection.driverMaven')" :hint="t('connection.hints.driverMaven')">
          <input
              v-model="form.driver"
              class="dw-input dw-input--sm more-mono"
              :disabled="readOnly"
              :placeholder="t('connection.driverMavenPlaceholder')"
          />
        </ConnectionFormField>
        <ConnectionFormField :label="t('connection.driverClass')">
          <input v-model="form.driverClass" class="dw-input dw-input--sm more-mono" :disabled="readOnly"/>
        </ConnectionFormField>
        <button
            class="dw-link-btn more-upload"
            type="button"
            :disabled="resolving || readOnly"
            @click="onResolveDriver"
        >
          {{ resolving ? t('connection.driverResolving') : t('connection.downloadDriver') }}
        </button>
        <p
            v-if="resolveMessage"
            class="more-resolve-msg"
            :class="resolveOk ? 'more-resolve-msg--ok' : 'more-resolve-msg--err'"
        >
          {{ resolveMessage }}
        </p>
      </CollapsibleSection>

      <CollapsibleSection
          v-if="showSshSection"
          :title="t('connection.sshSection')"
          :description="t('connection.collapseDesc.ssh')"
      >
        <template #icon>
          <DwIcon name="lock" size="md" :stroke-width="1.3"/>
        </template>
        <template v-if="form.sshEnabled" #badge>
          <span class="more-badge more-badge--on">{{ t('connection.sshOn') }}</span>
        </template>

        <SettingsSwitch
            :model-value="!!form.sshEnabled"
            :label="t('connection.sshEnable')"
            :disabled="readOnly"
            @update:model-value="form.sshEnabled = $event"
        />

        <div v-if="form.sshEnabled" class="more-subpanel">
          <div class="more-grid">
            <ConnectionFormField :label="t('connection.sshHost')">
              <input v-model="form.sshHost" class="dw-input dw-input--sm" :disabled="readOnly"/>
            </ConnectionFormField>
            <ConnectionFormField :label="t('connection.sshPort')">
              <input v-model="form.sshPort" class="dw-input dw-input--sm" :disabled="readOnly"/>
            </ConnectionFormField>
          </div>
          <ConnectionFormField :label="t('connection.sshUser')">
            <input v-model="form.sshUser" class="dw-input dw-input--sm" :disabled="readOnly"/>
          </ConnectionFormField>
          <ConnectionFormField :label="t('connection.sshPassword')">
            <input v-model="form.sshPassword" class="dw-input dw-input--sm" type="password" :disabled="readOnly"/>
          </ConnectionFormField>
          <ConnectionFormField
              :label="t('connection.sshPrivateKey')"
              :hint="t('connection.hints.sshPrivateKey')"
          >
            <textarea
                v-model="form.sshPrivateKey"
                class="dw-input more-textarea"
                rows="4"
                :disabled="readOnly"
                :placeholder="t('connection.sshPrivateKeyPlaceholder')"
            />
          </ConnectionFormField>
          <ConnectionFormField :label="t('connection.sshPassphrase')">
            <input v-model="form.sshPassphrase" class="dw-input dw-input--sm" type="password" :disabled="readOnly"/>
          </ConnectionFormField>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
          :title="t('connection.advancedSection')"
          :description="t('connection.collapseDesc.advanced')"
      >
        <template #icon>
          <DwIcon name="settings-basic" size="md" :stroke-width="1.3"/>
        </template>
        <template v-if="form.advancedConfig?.trim()" #badge>
          <span class="more-badge">{{ t('connection.advancedSet') }}</span>
        </template>

        <ConnectionFormField :hint="t('connection.hints.advanced')">
          <textarea v-model="form.advancedConfig" class="dw-input more-textarea" rows="3" :disabled="readOnly"/>
        </ConnectionFormField>
      </CollapsibleSection>
    </div>
  </div>
</template>

<style scoped>
.conn-more {
  margin-top: var(--dw-space-8);
  padding-top: var(--dw-space-7);
  border-top: 1px solid var(--dw-border-light);
}

.conn-more__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-5);
}

.conn-more__label {
  font-size: var(--dw-text-xs);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.conn-more__count {
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
}

.more-list {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap);
}

.more-badge {
  max-width: 120px;
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  font-weight: 500;
  line-height: var(--dw-leading);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.more-badge--on {
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}

.more-mono {
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
}

.more-upload {
  align-self: flex-start;
  font-size: var(--dw-text-sm);
}

.more-resolve-msg {
  margin: 0;
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
}

.more-resolve-msg--ok {
  color: var(--dw-success);
}

.more-resolve-msg--err {
  color: var(--dw-danger);
}

.more-subpanel {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-md);
  padding: var(--dw-space-5);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg);
  border: 1px solid var(--dw-border-light);
}

.more-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--dw-gap-md);
}

.more-textarea {
  min-height: 72px;
  resize: vertical;
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
}

:deep(.settings-switch) {
  padding: var(--dw-space-2) 0 var(--dw-space-1);
}
</style>
