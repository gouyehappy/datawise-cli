<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import IconButton from '@/core/components/IconButton.vue'
import {DwPanelState, EmptyState, StatusPill} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {StatusVariant} from '@/core/utils/status-variant'
import type {WorkspaceTab} from '@/core/types'
import TableDataTab from '@/features/workspace/components/tabs/TableDataTab.vue'
import TableRelationsPanel from '@/features/workspace/components/tabs/TableRelationsPanel.vue'
import TableRelationGraphPanel from '@/features/workspace/components/tabs/TableRelationGraphPanel.vue'
import AlterColumnDialog from '@/features/workspace/components/AlterColumnDialog.vue'
import {useTableDetail} from '@/features/workspace/composables/useTableDetail'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useTeamStore} from '@/features/team/stores/team-store'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {supportsAlterColumnWizard} from '@/features/workspace/services/alter-column-ddl.service'
import {executeAlterColumnSql} from '@/features/workspace/services/execute-alter-column.service'
import {supportsSqlExecute} from '@/shared/capabilities/db-type-capabilities'
import {useDatasourceCatalogStore} from '@/features/datasource/stores/datasource-catalog'
import {canDdlConnection} from '@/features/team/services/connection-access.service'
import {isProductionEnvironment} from '@/features/connection/services/connection-environment.service'
import type {ModalFeedback} from '@/core/composables/useModalFeedback'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()
const teamStore = useTeamStore()
const auth = useAuthStore()
const catalogStore = useDatasourceCatalogStore()

type TableView = NonNullable<WorkspaceTab['tableView']>
type TableSection = NonNullable<WorkspaceTab['tableSection']>

const views: TableView[] = ['properties', 'data', 'ddl', 'relations', 'relationGraph']
const sections: TableSection[] = ['columns', 'indexes', 'foreignKeys']

const activeView = computed({
  get: () => props.tab.tableView ?? 'properties',
  set: (value: TableView) => {
    props.tab.tableView = value
  },
})

const activeSection = computed({
  get: () => props.tab.tableSection ?? 'columns',
  set: (value: TableSection) => {
    props.tab.tableSection = value
  },
})

const {
  properties,
  ddl,
  loadingProperties,
  loadingDdl,
  propertiesError,
  ddlError,
  loadProperties,
  loadDdl,
} = useTableDetail(props.tab, {
  shouldLoadDdl: () => activeView.value === 'ddl',
})

const ddlCopied = ref(false)
const alterColumnOpen = ref(false)
const alterExecuting = ref(false)
const alterActionFeedback = ref<ModalFeedback | null>(null)

const connectionNode = computed(() => {
  if (!props.tab.connectionId) return undefined
  return explorer.findNode(props.tab.connectionId)
})

const connectionDbType = computed(() => connectionNode.value?.dbType)

const canAlterColumn = computed(() => {
  if ((props.tab.relationKind ?? 'table') !== 'table') return false
  if (!supportsAlterColumnWizard(connectionDbType.value)) return false
  return supportsSqlExecute(connectionDbType.value, catalogStore.items)
})

const canExecuteAlter = computed(() => {
  if (auth.isGuest) return false
  if (!props.tab.connectionId) return false
  return canDdlConnection(props.tab.connectionId, teamStore.teams)
})

const alterExecuteDisabledHint = computed(() => {
  if (auth.isGuest) return t('workspace.tableDetail.alterColumn.guestDenied')
  if (!canExecuteAlter.value) return t('workspace.tableDetail.alterColumn.writeDenied')
  return undefined
})

const alterProductionEnv = computed(() =>
    isProductionEnvironment(connectionNode.value?.env, connectionNode.value?.envCustom),
)

const databaseName = computed(() => props.tab.database?.trim() || undefined)

function openAlterColumn() {
  if (!canAlterColumn.value) {
    workspace.setStatus(t('workspace.tableDetail.alterColumn.unsupported'))
    return
  }
  alterColumnOpen.value = true
}

function openAlterSqlInConsole(sql: string) {
  void workspace.openConsole({
    connectionId: props.tab.connectionId,
    instanceId: props.tab.instanceId,
    database: databaseName.value,
    sql,
  })
}

async function executeAlterColumn(sql: string) {
  if (!props.tab.connectionId || alterExecuting.value) return
  if (!canExecuteAlter.value) {
    alterActionFeedback.value = {
      variant: 'warning',
      message: alterExecuteDisabledHint.value ?? t('workspace.tableDetail.alterColumn.writeDenied'),
    }
    return
  }
  alterExecuting.value = true
  alterActionFeedback.value = null
  try {
    const result = await executeAlterColumnSql(sql, {
      connectionId: props.tab.connectionId,
      database: databaseName.value,
      dbType: connectionDbType.value,
    })
    if (!result.ok) {
      alterActionFeedback.value = {
        variant: 'error',
        message: t('workspace.tableDetail.alterColumn.failedWithDetail', {message: result.message}),
      }
      return
    }
    alterColumnOpen.value = false
    await loadProperties()
    if (activeView.value === 'ddl') {
      await loadDdl()
    }
    workspace.bumpTableDataRefresh(props.tab.id)
    layout.showSuccessToast(t('workspace.tableDetail.alterColumn.success'))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('workspace.tableDetail.alterColumn.failed')
    alterActionFeedback.value = {
      variant: 'error',
      message: t('workspace.tableDetail.alterColumn.failedWithDetail', {message}),
    }
  } finally {
    alterExecuting.value = false
  }
}

watch(
    activeView,
    (view) => {
      if (view === 'ddl') {
        void loadDdl()
      }
    },
    {immediate: true},
)

const tableTitle = computed(() => properties.value.tableName || props.tab.tableName || '—')

const tableComment = computed(() => properties.value.comment?.trim() || '')

const statFields = computed(() => {
  const p = properties.value
  return [
    {key: 'engine', value: p.engine, icon: 'engine'},
    {key: 'autoIncrement', value: p.autoIncrement, icon: 'counter'},
    {key: 'charset', value: p.charset, icon: 'charset'},
    {key: 'collation', value: p.collation, icon: 'collation'},
  ].filter((item) => item.value)
})

const sectionCounts = computed(() => ({
  columns: properties.value.columns.length,
  indexes: properties.value.indexes.length,
  foreignKeys: properties.value.foreignKeys.length,
}))

const activeSectionCount = computed(() => sectionCounts.value[activeSection.value])

const ddlLineCount = computed(() => {
  const text = ddl.value?.ddl?.trim()
  if (!text) return 0
  return text.split('\n').length
})

function keyTypeVariant(keyType?: string | null): StatusVariant {
  const normalized = (keyType ?? '').trim().toUpperCase()
  if (normalized === 'PRI') return 'warn'
  if (normalized === 'UNI') return 'primary'
  return 'neutral'
}

async function copyDdl() {
  const text = ddl.value?.ddl
  if (!text?.trim()) return
  try {
    await navigator.clipboard.writeText(text)
    ddlCopied.value = true
    layout.showSuccessToast(t('workspace.tableDetail.copyDdlSuccess'))
    window.setTimeout(() => {
      ddlCopied.value = false
    }, 2000)
  } catch {
    layout.showErrorToast(t('workspace.tableDetail.copyDdlFailed'))
  }
}
</script>

<template>
  <div class="table-detail dw-workbench-page">
    <header class="table-detail__header">
      <nav class="table-detail__views" :aria-label="t('workspace.tableDetail.views')">
        <button
            v-for="view in views"
            :key="view"
            type="button"
            class="table-detail__view-btn"
            :class="{ active: activeView === view }"
            @click="activeView = view"
        >
          {{ t(`workspace.tableDetail.${view}`) }}
        </button>
      </nav>
    </header>

    <div v-if="activeView === 'properties'" class="table-detail__properties">
      <DwPanelState
          v-if="loadingProperties"
          status="loading"
          :message="t('workspace.tableDetail.loading')"
      />
      <DwPanelState
          v-else-if="propertiesError"
          status="error"
          :message="propertiesError"
      />
      <template v-else>
        <section class="table-detail__hero">
          <div class="table-detail__hero-icon" aria-hidden="true">
            <DwIcon name="table" size="lg" :stroke-width="1.5"/>
          </div>
          <div class="table-detail__hero-text">
            <span class="table-detail__hero-kind">{{ t('workspace.tableDetail.tableObject') }}</span>
            <h2 class="table-detail__hero-title">{{ tableTitle }}</h2>
            <p v-if="tableComment" class="table-detail__hero-desc">{{ tableComment }}</p>
            <p v-else class="table-detail__hero-desc table-detail__hero-desc--muted">
              {{ t('workspace.tableDetail.noDescription') }}
            </p>
          </div>
        </section>

        <div v-if="statFields.length" class="table-detail__stats">
          <article
              v-for="field in statFields"
              :key="field.key"
              class="table-detail__stat"
          >
            <span class="table-detail__stat-label">{{ t(`workspace.tableDetail.${field.key}`) }}</span>
            <span class="table-detail__stat-value">{{ field.value }}</span>
          </article>
        </div>

        <div class="table-detail__properties-body">
          <aside class="table-detail__sidebar">
            <button
                v-for="section in sections"
                :key="section"
                type="button"
                class="table-detail__section-btn"
                :class="{ active: activeSection === section }"
                @click="activeSection = section"
            >
              <span class="table-detail__section-label">
                <DwIcon v-if="section === 'columns'" name="comment-column" size="sm" :stroke-width="1.2"/>
                <DwIcon v-else-if="section === 'indexes'" name="list-ordered" size="sm" :stroke-width="1.2"/>
                <DwIcon v-else name="link" size="sm" :stroke-width="1.2"/>
                {{ t(`workspace.tableDetail.${section}`) }}
              </span>
              <span class="table-detail__section-badge">{{ sectionCounts[section] }}</span>
            </button>
          </aside>

          <section class="table-detail__panel">
            <header class="table-detail__panel-head">
              <h3>{{ t(`workspace.tableDetail.${activeSection}`) }}</h3>
              <div class="table-detail__panel-actions">
                <button
                    v-if="activeSection === 'columns' && canAlterColumn"
                    type="button"
                    class="dw-text-btn"
                    @click="openAlterColumn"
                >
                  {{ t('workspace.tableDetail.alterColumn.action') }}
                </button>
                <span class="table-detail__panel-count">
                  {{ t('workspace.tableDetail.itemCount', {count: activeSectionCount}) }}
                </span>
              </div>
            </header>

            <div v-if="activeSection === 'columns'" class="table-detail__grid-wrap">
              <table class="table-detail__grid">
                <thead>
                <tr>
                  <th class="col-narrow">#</th>
                  <th>{{ t('workspace.tableDetail.columnName') }}</th>
                  <th>{{ t('workspace.tableDetail.dataType') }}</th>
                  <th class="col-center">{{ t('workspace.tableDetail.nullable') }}</th>
                  <th class="col-center">{{ t('workspace.tableDetail.autoIncrement') }}</th>
                  <th>{{ t('workspace.tableDetail.key') }}</th>
                  <th>{{ t('workspace.tableDetail.default') }}</th>
                  <th>{{ t('workspace.tableDetail.extra') }}</th>
                  <th>{{ t('workspace.tableDetail.comment') }}</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="column in properties.columns" :key="column.name">
                  <td class="col-muted">{{ column.ordinal }}</td>
                  <td class="mono col-name">{{ column.name }}</td>
                  <td class="mono">
                    <StatusPill chip variant="info" class="table-detail__type-pill">
                      {{ column.dataType }}
                    </StatusPill>
                  </td>
                  <td class="col-center">
                    <StatusPill
                        v-if="!column.nullable"
                        variant="success"
                        :title="t('workspace.tableDetail.nullable')"
                    >
                      �?                    </StatusPill>
                  </td>
                  <td class="col-center">
                    <StatusPill v-if="column.autoIncrement" variant="primary">�?/StatusPill>
                  </td>
                  <td>
                    <StatusPill v-if="column.keyType" :variant="keyTypeVariant(column.keyType)">
                      {{ column.keyType }}
                    </StatusPill>
                  </td>
                  <td class="mono col-muted">{{ column.defaultValue ?? '�? }}</td>
                  <td class="mono col-muted">{{ column.extra ?? '�? }}</td>
                  <td>{{ column.comment || '�? }}</td>
                </tr>
                </tbody>
              </table>
            </div>

            <div v-else-if="activeSection === 'indexes'" class="table-detail__grid-wrap">
              <table class="table-detail__grid">
                <thead>
                <tr>
                  <th>{{ t('workspace.tableDetail.indexName') }}</th>
                  <th class="col-center">{{ t('workspace.tableDetail.unique') }}</th>
                  <th>{{ t('workspace.tableDetail.columns') }}</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="index in properties.indexes" :key="index.name">
                  <td class="mono col-name">{{ index.name }}</td>
                  <td class="col-center">
                    <StatusPill :variant="index.unique ? 'primary' : 'neutral'">
                      {{ index.unique ? t('workspace.tableDetail.uniqueYes') : t('workspace.tableDetail.uniqueNo') }}
                    </StatusPill>
                  </td>
                  <td class="mono">{{ index.columns }}</td>
                </tr>
                <tr v-if="!properties.indexes.length">
                  <td colspan="3">
                    <EmptyState embedded compact :title="t('workspace.tableDetail.emptySection')"/>
                  </td>
                </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="table-detail__grid-wrap">
              <table class="table-detail__grid">
                <thead>
                <tr>
                  <th>{{ t('workspace.tableDetail.fkName') }}</th>
                  <th>{{ t('workspace.tableDetail.columns') }}</th>
                  <th>{{ t('workspace.tableDetail.referenceTable') }}</th>
                  <th>{{ t('workspace.tableDetail.referenceColumns') }}</th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="fk in properties.foreignKeys" :key="fk.name + fk.columns">
                  <td class="mono col-name">{{ fk.name }}</td>
                  <td class="mono">{{ fk.columns }}</td>
                  <td class="mono">{{ fk.referenceTable }}</td>
                  <td class="mono">{{ fk.referenceColumns || '�? }}</td>
                </tr>
                <tr v-if="!properties.foreignKeys.length">
                  <td colspan="4">
                    <EmptyState embedded compact :title="t('workspace.tableDetail.emptySection')"/>
                  </td>
                </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </template>
    </div>

    <TableDataTab v-else-if="activeView === 'data'" class="table-detail__data" :tab="tab"/>

    <TableRelationsPanel v-else-if="activeView === 'relations'" :tab="tab"/>

    <TableRelationGraphPanel v-else-if="activeView === 'relationGraph'" :tab="tab"/>

    <section v-else-if="activeView === 'ddl'" class="table-detail__ddl">
      <DwPanelState
          v-if="loadingDdl"
          status="loading"
          :message="t('workspace.tableDetail.loading')"
      />
      <DwPanelState
          v-else-if="ddlError"
          status="error"
          :message="ddlError"
      />
      <div v-else-if="ddl?.ddl" class="table-detail__ddl-card">
        <header class="table-detail__ddl-head">
          <div class="table-detail__ddl-head-text">
            <span class="table-detail__ddl-kicker">SQL</span>
            <h3>{{ t('workspace.tableDetail.ddlTitle', {name: tableTitle}) }}</h3>
            <p>{{ t('workspace.tableDetail.ddlLines', {count: ddlLineCount}) }}</p>
          </div>
          <IconButton
              size="sm"
              :title="ddlCopied ? t('workspace.tableDetail.copyDdlDone') : t('workspace.tableDetail.copyDdl')"
              :active="ddlCopied"
              @click="copyDdl"
          >
            <DwIcon v-if="ddlCopied" name="submit" fit :stroke-width="1.5"/>
            <DwIcon v-else name="copy" fit :stroke-width="1.5"/>
          </IconButton>
        </header>
        <div class="table-detail__ddl-body">
          <pre class="table-detail__ddl-code"><code>{{ ddl.ddl }}</code></pre>
        </div>
      </div>
      <DwPanelState
          v-else
          status="empty"
          :message="t('workspace.tableDetail.noDdl')"
      />
    </section>

    <AlterColumnDialog
        v-model:open="alterColumnOpen"
        :db-type="connectionDbType"
        :table-name="properties.tableName || tab.tableName || ''"
        :database="databaseName"
        :columns="properties.columns"
        :can-execute="canExecuteAlter"
        :execute-disabled-hint="alterExecuteDisabledHint"
        :executing="alterExecuting"
        :production-env="alterProductionEnv"
        :action-feedback="alterActionFeedback"
        @open-console="openAlterSqlInConsole"
        @execute="executeAlterColumn"
        @clear-action-feedback="alterActionFeedback = null"
    />
  </div>
</template>

<style scoped>
.table-detail {
  min-height: 0;
  min-width: 0;
}

.table-detail__header {
  flex-shrink: 0;
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-wb-card-bg);
}

.table-detail__views {
  display: flex;
  gap: var(--dw-gap-xs);
  padding: var(--dw-space-4) var(--dw-space-6) 0;
}

.table-detail__view-btn {
  position: relative;
  padding: 7px var(--dw-space-7) 9px;
  border: none;
  border-radius: var(--dw-control-radius) var(--dw-control-radius) 0 0;
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
  font-weight: 500;
  cursor: pointer;
}

.table-detail__view-btn:hover {
  color: var(--dw-text-primary);
  background: color-mix(in srgb, var(--dw-bg-muted) 70%, transparent);
}

.table-detail__view-btn.active {
  color: var(--dw-primary);
  background: var(--dw-bg-editor);
  font-weight: 600;
}

.table-detail__view-btn.active::after {
  content: '';
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 0;
  height: 2px;
  border-radius: var(--dw-radius-xs) var(--dw-radius-xs) 0 0;
  background: var(--dw-primary);
}

.table-detail__properties {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--dw-space-6);
  padding: var(--dw-space-6);
  overflow: auto;
}

.table-detail__hero {
  display: flex;
  align-items: flex-start;
  gap: var(--dw-space-6);
  padding: var(--dw-space-7) var(--dw-space-8);
  border: 1px solid var(--dw-wb-card-border);
  border-radius: var(--dw-radius-xl);
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--dw-primary) 7%, var(--dw-bg-panel)) 0%,
      var(--dw-bg-panel) 58%
  );
  box-shadow: var(--dw-panel-shadow));
}

.table-detail__hero-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: var(--dw-radius-lg);
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}

.table-detail__hero-text {
  min-width: 0;
}

.table-detail__hero-kind {
  display: block;
  margin-bottom: var(--dw-space-1);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.table-detail__hero-title {
  margin: 0;
  font-size: var(--dw-text-2xl);
  font-weight: 650;
  line-height: var(--dw-leading-snug);
  word-break: break-all;
}

.table-detail__hero-desc {
  margin: var(--dw-space-3) 0 0;
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-relaxed);
}

.table-detail__hero-desc--muted {
  color: var(--dw-text-muted);
  font-style: italic;
}

.table-detail__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--dw-gap);
}

.table-detail__stat {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-xs);
  padding: var(--dw-pad-control-lg);
  border: 1px solid var(--dw-wb-card-border);
  border-radius: var(--dw-radius-lg);
  background: var(--dw-wb-card-bg);
}

.table-detail__stat-label {
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.table-detail__stat-value {
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
  font-weight: 500;
  line-height: var(--dw-leading-snug);
  word-break: break-word;
}

.table-detail__properties-body {
  display: flex;
  flex: 1;
  min-height: 280px;
  border: 1px solid var(--dw-wb-card-border);
  border-radius: var(--dw-radius-xl);
  overflow: hidden;
  background: var(--dw-wb-card-bg);
  box-shadow: var(--dw-panel-shadow));
}

.table-detail__sidebar {
  flex-shrink: 0;
  width: 148px;
  padding: var(--dw-space-5);
  background: color-mix(in srgb, var(--dw-bg-muted) 35%, var(--dw-bg-panel));
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-xs);
}

.table-detail__section-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  width: 100%;
  padding: var(--dw-pad-control);
  border: 1px solid transparent;
  border-radius: var(--dw-wb-card-radius);
  box-shadow: var(--dw-wb-card-shadow);
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
  text-align: left;
  cursor: pointer;
}

.table-detail__section-btn:hover {
  background: var(--dw-bg-muted);
  color: var(--dw-text-primary);
}

.table-detail__section-btn.active {
  border-color: color-mix(in srgb, var(--dw-primary) 22%, var(--dw-border-light));
  background: var(--dw-wb-card-bg);
  color: var(--dw-primary);
  box-shadow: var(--dw-shadow-xs);
}

.table-detail__section-label {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-space-3);
  min-width: 0;
}

.table-detail__section-label .dw-icon-root {
  flex-shrink: 0;
  opacity: 0.85;
}

.table-detail__section-badge {
  flex-shrink: 0;
  min-width: 20px;
  padding: 1px var(--dw-space-3);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  text-align: center;
}

.table-detail__section-btn.active .table-detail__section-badge {
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}

.table-detail__panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-detail__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap-md);
  padding: var(--dw-space-5) var(--dw-space-7);
  border-bottom: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-bg-muted) 25%, var(--dw-bg-panel));
}

.table-detail__panel-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  flex-shrink: 0;
}

.table-detail__panel-head h3 {
  margin: 0;
  font-size: var(--dw-text-md);
  font-weight: 600;
}

.table-detail__panel-count {
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
}

.table-detail__grid-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.table-detail__grid {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--dw-text-sm);
}

.table-detail__grid th,
.table-detail__grid td {
  padding: var(--dw-space-4) var(--dw-space-6);
  border-bottom: 1px solid var(--dw-border-light);
  text-align: left;
  vertical-align: middle;
}

.table-detail__grid th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--dw-wb-card-bg);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.table-detail__grid tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--dw-bg-muted) 28%, transparent);
}

.table-detail__grid tbody tr:hover {
  background: color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-panel));
}

.table-detail__grid .mono {
  font-family: var(--dw-mono);
}

.table-detail__grid .col-narrow {
  width: 42px;
  color: var(--dw-text-muted);
}

.table-detail__grid .col-center,
.col-center {
  text-align: center;
}

.table-detail__grid .col-name {
  font-weight: 600;
  color: var(--dw-text-primary);
}

.table-detail__grid .col-muted {
  color: var(--dw-text-secondary);
}

.table-detail__type-pill {
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
}

.table-detail__grid-wrap :deep(.dw-empty--compact) {
  min-height: 80px;
  padding: var(--dw-space-8) var(--dw-space-6);
}

.table-detail__data {
  flex: 1;
  min-height: 0;
}

.table-detail__ddl {
  flex: 1;
  min-height: 0;
  padding: var(--dw-space-6);
  overflow: auto;
}

.table-detail__ddl-card {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  border: 1px solid var(--dw-wb-card-border);
  border-radius: var(--dw-radius-xl);
  overflow: hidden;
  background: var(--dw-wb-card-bg);
  box-shadow: var(--dw-panel-shadow));
}

.table-detail__ddl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dw-space-6);
  padding: var(--dw-space-6) var(--dw-space-7);
  border-bottom: 1px solid var(--dw-border-light);
  background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-panel)) 0%,
      var(--dw-bg-panel) 100%
  );
}

.table-detail__ddl-kicker {
  display: block;
  margin-bottom: var(--dw-space-1);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.table-detail__ddl-head-text h3 {
  margin: 0;
  font-size: var(--dw-text-xl);
  font-weight: 600;
  line-height: var(--dw-leading-snug);
}

.table-detail__ddl-head-text p {
  margin: var(--dw-space-2) 0 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
}

.table-detail__ddl-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: color-mix(in srgb, var(--dw-bg-editor) 88%, #101828 12%);
}

.table-detail__ddl-code {
  margin: 0;
  padding: var(--dw-wb-content-pad-y) var(--dw-wb-content-pad-x);
  color: color-mix(in srgb, var(--dw-text-primary) 92%, #dbeafe 8%);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  white-space: pre-wrap;
  word-break: break-word;
}

.table-detail__ddl-code code {
  font-family: inherit;
}
</style>
