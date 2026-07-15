<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import ConnectionFormFields from '@/features/connection/components/ConnectionFormFields.vue'
import ConnectionFormFooter from '@/features/connection/components/ConnectionFormFooter.vue'
import ConnectionPreviewPanel from '@/features/connection/components/ConnectionPreviewPanel.vue'
import {useConnectionForm} from '@/features/connection/composables/useConnectionForm'
import {useConnectionTabActions} from '@/features/connection/composables/useConnectionTabActions'
import {useConnectionTest} from '@/features/connection/composables/useConnectionTest'
import {isUnsavedConnectionId} from '@/features/connection/utils/connection-defaults'
import {isJdbcSshTunnelEnabled} from '@/features/ssh/services/ssh-jdbc-tunnel.service'
import IconButton from '@/core/components/IconButton.vue'
import {DwIcon} from '@/core/icons'
import type {WorkspaceTab} from '@/core/types'
import {fetchConnectionFromCatalog} from '@/shared/config/connections-catalog.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

const workspace = useWorkspaceStore()

const {t} = useI18n()
const props = defineProps<{ tab: WorkspaceTab }>()
const layout = useLayoutStore()

const dbType = computed(() => props.tab.dbType!)
const isEdit = computed(() =>
    !!props.tab.connectionId && !isUnsavedConnectionId(props.tab.connectionId),
)
const loading = ref(false)

const {form, label, getPayload, applyConfig} = useConnectionForm(dbType.value)

const {testing, testMessage, testOk, testConnection} = useConnectionTest(
    getPayload,
    () => props.tab.connectionId,
)
const {saveConnection, cancel, saving, canSave} = useConnectionTabActions({
  tabId: props.tab.id,
  form,
  getPayload,
  getLabel: () => label.value,
  editingConnectionId: () => props.tab.connectionId,
  targetGroupId: () => props.tab.targetGroupId,
})

const busy = computed(() => saving.value || testing.value)
const readOnly = computed(() => !canSave.value)
const jdbcTunnelSshReady = computed(() =>
    isEdit.value && isJdbcSshTunnelEnabled(form),
)
const busyHint = computed(() =>
    saving.value ? t('connection.savingHint') : t('connection.testingHint'),
)

onMounted(() => {
  if (!props.tab.connectionId || isUnsavedConnectionId(props.tab.connectionId)) return
  loading.value = true
  void fetchConnectionFromCatalog(props.tab.connectionId)
      .then((config) => {
        if (!config) {
          layout.showToast(t('connection.loadFailed'))
          return
        }
        applyConfig(config)
      })
      .catch(() => {
        layout.showToast(t('connection.loadFailed'))
      })
      .finally(() => {
        loading.value = false
      })
})

function openJdbcTunnelSshTerminal() {
  const connectionId = props.tab.connectionId
  if (!connectionId || !jdbcTunnelSshReady.value) return
  workspace.openSshTerminal({
    connectionId,
    connectionName: form.name || connectionId,
    explorerNodeId: connectionId,
  })
}
</script>

<template>
  <div class="conn-layout">
    <section class="conn-editor">
      <header class="conn-head">
        <DbTypeIcon class="conn-head__icon" :db-type="dbType" :size="DB_TYPE_ICON_SIZE.header"/>
        <div class="conn-head__text">
          <h1>
            {{
              isEdit
                  ? t('connection.editTitle', {name: form.name || tab.connectionId})
                  : t('connection.newTitle', {dbType: label})
            }}
          </h1>
          <p>{{ t('connection.formIntro') }}</p>
        </div>
        <IconButton
            v-if="jdbcTunnelSshReady"
            size="sm"
            :title="t('connection.openJdbcSshTunnel')"
            @click="openJdbcTunnelSshTerminal"
        >
          <DwIcon name="terminal" size="sm" :stroke-width="1.5"/>
        </IconButton>
      </header>

      <div v-if="loading" class="conn-loading">{{ t('connection.loading') }}</div>

      <div v-else class="conn-body-wrap">
        <p v-if="readOnly" class="conn-readonly-hint" role="status">{{ t('connection.formReadOnlyHint') }}</p>
        <div class="conn-body" :class="{'conn-body--busy': busy, 'conn-body--readonly': readOnly}">
          <ConnectionFormFields
              v-model:form="form"
              :db-type="dbType"
              :read-only="readOnly"
          />
        </div>
        <div v-if="busy" class="conn-busy" role="status" aria-live="polite">
          <span class="conn-busy__spinner" aria-hidden="true"/>
          <p class="conn-busy__text">{{ busyHint }}</p>
        </div>
      </div>

      <ConnectionFormFooter
          :testing="testing"
          :saving="saving"
          :save-disabled="!canSave"
          :test-message="testMessage"
          :test-ok="testOk"
          @test="testConnection"
          @cancel="cancel"
          @save="saveConnection"
      />
    </section>

    <ConnectionPreviewPanel :db-type="dbType" :label="label" :form="form"/>
  </div>
</template>

<style scoped>
.conn-layout {
  display: grid;
  grid-template-columns: minmax(360px, 520px) minmax(280px, 1fr);
  min-height: 0;
  height: 100%;
  background: var(--dw-bg);
  overflow: hidden;
}

.conn-editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  border-right: 1px solid var(--dw-border-light);
}

.conn-head {
  display: flex;
  align-items: center;
  gap: var(--dw-space-6);
  flex-shrink: 0;
  padding: var(--dw-space-8) var(--dw-space-10);
  border-bottom: 1px solid var(--dw-border-light);
}

.conn-head__icon {
  flex-shrink: 0;
}

.conn-head__text {
  flex: 1;
  min-width: 0;
}

.conn-head__text h1 {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 700;
  line-height: var(--dw-leading-snug);
}

.conn-head__text p {
  margin: var(--dw-space-1) 0 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
}

.conn-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-md);
}

.conn-body-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.conn-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--dw-space-8) var(--dw-space-10) var(--dw-space-4);
  scrollbar-gutter: stable;
  transition: opacity 0.2s ease;
}

.conn-body--busy {
  pointer-events: none;
  opacity: 0.45;
}

.conn-readonly-hint {
  flex-shrink: 0;
  margin: 0;
  padding: var(--dw-space-5) var(--dw-space-10) 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading);
}

.conn-body--readonly:not(.conn-body--busy) {
  opacity: 0.92;
}

.conn-busy {
  position: absolute;
  inset: 0;
  z-index: var(--dw-z-raised);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--dw-gap-md);
  padding: var(--dw-space-10);
  text-align: center;
  background: color-mix(in srgb, var(--dw-bg-panel) 72%, transparent);
  backdrop-filter: blur(2px);
}

.conn-busy__spinner {
  width: 24px;
  height: var(--dw-control-h-xs);
  border: 2px solid color-mix(in srgb, var(--dw-primary) 20%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: conn-busy-spin 0.75s linear infinite;
}

.conn-busy__text {
  margin: 0;
  max-width: 240px;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading);
}

@keyframes conn-busy-spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.conn-preview) {
  min-height: 0;
  height: 100%;
  background: var(--dw-bg-muted);
}

@media (max-width: 900px) {
  .conn-layout {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .conn-editor {
    border-right: none;
    height: auto;
    min-height: min-content;
  }

  :deep(.conn-preview) {
    display: none;
  }
}

@media (max-width: 520px) {
  .conn-head,
  .conn-body,
  .conn-footer {
    padding-left: var(--dw-space-8);
    padding-right: var(--dw-space-8);
  }
}
</style>
