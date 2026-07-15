<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'
import type {WorkspaceTab} from '@/core/types'
import {explorerApi} from '@/api/modules/explorer'
import {
    buildCreateNamespaceSql,
    resolveCreateNamespaceErrorMessage,
    supportsMysqlCharsetOptions,
    type CreateNamespaceMode,
} from '@/features/explorer/services/create-namespace.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()

const mode = computed<CreateNamespaceMode>(() => props.tab.createNamespaceMode === 'schema' ? 'schema' : 'database')
const dbType = computed(() => props.tab.dbType)
const showMysqlOptions = computed(() => mode.value === 'database' && supportsMysqlCharsetOptions(dbType.value))
const showCatalog = computed(() => mode.value === 'schema' && (dbType.value === 'trino' || dbType.value === 'presto' || dbType.value === 'hive' || dbType.value === 'flink'))

const view = ref<'general' | 'sql'>('general')
const name = ref('')
const charset = ref('')
const collation = ref('')
const catalog = ref(props.tab.createNamespaceCatalog ?? '')
const saving = ref(false)
const loadingOptions = ref(false)
const charsets = ref<Array<{ name: string; description: string; defaultCollation: string }>>([])
const collations = ref<Array<{ name: string; charset: string; isDefault: boolean }>>([])

const previewSql = computed(() => buildCreateNamespaceSql(mode.value, dbType.value, {
    name: name.value,
    charset: charset.value,
    collation: collation.value,
    catalog: catalog.value,
}))

const filteredCollations = computed(() => {
    if (!charset.value) return collations.value
    return collations.value.filter((item) => item.charset === charset.value)
})

const canSave = computed(() => !!name.value.trim() && !saving.value)

onMounted(() => {
    if (showMysqlOptions.value && props.tab.connectionId) {
        void loadMysqlOptions(props.tab.connectionId)
    }
})

watch(charset, (next) => {
    if (!next) return
    const match = filteredCollations.value.find((item) => item.isDefault)
        ?? filteredCollations.value[0]
    if (match && (!collation.value || !filteredCollations.value.some((item) => item.name === collation.value))) {
        collation.value = match.name
    }
})

async function loadMysqlOptions(connectionId: string) {
    loadingOptions.value = true
    try {
        const result = await explorerApi.fetchMysqlCharsets(connectionId)
        charsets.value = result.charsets ?? []
        collations.value = result.collations ?? []
        if (!charset.value && charsets.value.length) {
            const utf8 = charsets.value.find((item) => item.name === 'utf8mb4') ?? charsets.value[0]
            charset.value = utf8.name
            collation.value = utf8.defaultCollation || ''
        }
    } catch {
        // Charset list is best-effort; save still works without it.
    } finally {
        loadingOptions.value = false
    }
}

async function copySql() {
    const sql = previewSql.value.trim()
    if (!sql) return
    try {
        await navigator.clipboard.writeText(sql)
        layout.showToast(t('explorer.createNamespace.sqlCopied'))
    } catch {
        layout.showErrorToast(t('explorer.createNamespace.copyFailed'))
    }
}

async function save() {
    const connectionId = props.tab.connectionId
    const trimmed = name.value.trim()
    if (!connectionId || !trimmed || saving.value) return
    saving.value = true
    try {
        if (mode.value === 'schema') {
            await explorerApi.createSchema(connectionId, {
                name: trimmed,
                catalog: catalog.value.trim() || undefined,
            })
        } else {
            await explorerApi.createDatabase(connectionId, {
                name: trimmed,
                charset: charset.value.trim() || undefined,
                collation: collation.value.trim() || undefined,
            })
        }
        await explorer.reloadConnectionCatalog(connectionId)
        layout.showToast(t('explorer.createNamespace.success', {name: trimmed}))
        workspace.closeTab(props.tab.id)
    } catch (error) {
        layout.showErrorToast(resolveCreateNamespaceErrorMessage(error, t))
    } finally {
        saving.value = false
    }
}
</script>

<template>
  <div class="create-db">
    <header class="create-db__toolbar">
      <DwButton variant="primary" size="sm" :disabled="!canSave" @click="save">
        {{ saving ? t('explorer.createNamespace.saving') : t('common.save') }}
      </DwButton>
      <div class="create-db__tabs" role="tablist">
        <button
            type="button"
            class="create-db__tab"
            :class="{ 'is-active': view === 'general' }"
            @click="view = 'general'"
        >
          {{ t('explorer.createNamespace.general') }}
        </button>
        <button
            type="button"
            class="create-db__tab"
            :class="{ 'is-active': view === 'sql' }"
            @click="view = 'sql'"
        >
          {{ t('explorer.createNamespace.sqlPreview') }}
        </button>
      </div>
    </header>

    <section v-if="view === 'general'" class="create-db__general">
      <label class="create-db__row">
        <span>{{ mode === 'schema' ? t('explorer.createNamespace.schemaName') : t('explorer.createNamespace.databaseName') }}</span>
        <input v-model="name" type="text" class="create-db__input" autocomplete="off" />
      </label>
      <label v-if="showCatalog" class="create-db__row">
        <span>{{ t('explorer.createNamespace.catalog') }}</span>
        <input v-model="catalog" type="text" class="create-db__input" autocomplete="off" />
      </label>
      <label v-if="showMysqlOptions" class="create-db__row">
        <span>{{ t('explorer.createNamespace.charset') }}</span>
        <select v-model="charset" class="create-db__input" :disabled="loadingOptions">
          <option value="">{{ t('explorer.createNamespace.charsetDefault') }}</option>
          <option v-for="item in charsets" :key="item.name" :value="item.name">
            {{ item.name }}
          </option>
        </select>
      </label>
      <label v-if="showMysqlOptions" class="create-db__row">
        <span>{{ t('explorer.createNamespace.collation') }}</span>
        <select v-model="collation" class="create-db__input" :disabled="loadingOptions">
          <option value="">{{ t('explorer.createNamespace.collationDefault') }}</option>
          <option v-for="item in filteredCollations" :key="item.name" :value="item.name">
            {{ item.name }}
          </option>
        </select>
      </label>
    </section>

    <section v-else class="create-db__sql">
      <div class="create-db__sql-actions">
        <button type="button" class="create-db__link" @click="copySql">
          {{ t('explorer.createNamespace.copy') }}
        </button>
      </div>
      <pre class="create-db__sql-code">{{ previewSql || '--' }}</pre>
    </section>
  </div>
</template>

<style scoped>
.create-db {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-surface, #fff);
}

.create-db__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dw-border, #e5e7eb);
}

.create-db__tabs {
  display: flex;
  gap: 4px;
}

.create-db__tab {
  border: none;
  background: transparent;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--dw-text-secondary, #6b7280);
  font-size: 13px;
}

.create-db__tab.is-active {
  background: var(--dw-surface-muted, #f3f4f6);
  color: var(--dw-text, #111827);
  font-weight: 600;
}

.create-db__general {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
  max-width: 640px;
}

.create-db__row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: var(--dw-text, #111827);
}

.create-db__input {
  height: 32px;
  border: 1px solid var(--dw-border, #d1d5db);
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  color: inherit;
}

.create-db__sql {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  padding: 12px 16px;
}

.create-db__sql-actions {
  margin-bottom: 8px;
}

.create-db__link {
  border: none;
  background: transparent;
  color: var(--dw-accent, #2563eb);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.create-db__sql-code {
  margin: 0;
  flex: 1;
  overflow: auto;
  padding: 12px;
  border-radius: 8px;
  background: var(--dw-surface-muted, #f8fafc);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}
</style>
