<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DwPanelState} from '@/core/components'
import SearchInput from '@/core/components/SearchInput.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import {useDatasourceCatalogStore} from '@/features/datasource/stores/datasource-catalog'
import {resolveDbTypesForPlugins} from '@/features/plugin/services/plugin-registry.service'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import type {DbType} from '@/core/types'

const emit = defineEmits<{
  select: [dbType: DbType]
}>()

const {t} = useI18n()
const pluginStore = usePluginStore()
const catalogStore = useDatasourceCatalogStore()
const dbSearch = ref('')

onMounted(() => {
  void catalogStore.ensureLoaded().catch(() => undefined)
})

const availableDbTypes = computed(() =>
    resolveDbTypesForPlugins(
        catalogStore.ids as DbType[],
        (id) => pluginStore.isEnabled(id),
    ),
)

const primaryDbTypes = computed(() =>
    catalogStore.primaryItems
        .map((item) => item.id as DbType)
        .filter((type) => availableDbTypes.value.includes(type)),
)

const secondaryDbTypes = computed(() =>
    availableDbTypes.value.filter((type) => !primaryDbTypes.value.includes(type)),
)

function labelFor(dbType: DbType) {
  return catalogStore.items.find((item) => item.id === dbType)?.label ?? dbType
}

function matchesQuery(dbType: DbType) {
  const q = dbSearch.value.trim().toLowerCase()
  if (!q) return true
  return labelFor(dbType).toLowerCase().includes(q)
}

const filteredPrimary = computed(() => primaryDbTypes.value.filter(matchesQuery))
const filteredSecondary = computed(() => secondaryDbTypes.value.filter(matchesQuery))
const hasDbResults = computed(
    () => filteredPrimary.value.length > 0 || filteredSecondary.value.length > 0,
)

function onSelect(dbType: DbType) {
  emit('select', dbType)
}
</script>

<template>
  <div class="db-type-panel" @click.stop>
    <div class="panel-head">
      <span class="panel-title">{{ t('explorer.pickDbType') }}</span>
      <span class="panel-count">{{ availableDbTypes.length }}</span>
    </div>

    <div class="panel-search">
      <SearchInput
          v-model="dbSearch"
          size="sm"
          :placeholder="t('explorer.searchDbType')"
      />
    </div>

    <div class="panel-body">
      <DwPanelState
          v-if="catalogStore.loading"
          status="loading"
          :message="t('explorer.dbTypeLoading')"
          compact
      />
      <DwPanelState
          v-else-if="catalogStore.error"
          status="error"
          :message="t('explorer.dbTypeLoadFailed')"
          compact
      />
      <template v-else-if="hasDbResults">
        <section v-if="filteredPrimary.length" class="panel-section">
          <div class="section-label">{{ t('explorer.dbTypeCommon') }}</div>
          <button
              v-for="dbType in filteredPrimary"
              :key="dbType"
              class="panel-item"
              type="button"
              @click="onSelect(dbType)"
          >
            <DbTypeIcon class="panel-item__icon" :db-type="dbType" :size="DB_TYPE_ICON_SIZE.list"/>
            <span class="panel-item__label">{{ labelFor(dbType) }}</span>
          </button>
        </section>

        <section v-if="filteredSecondary.length" class="panel-section">
          <div class="section-label">{{ t('explorer.dbTypeMore') }}</div>
          <button
              v-for="dbType in filteredSecondary"
              :key="dbType"
              class="panel-item"
              type="button"
              @click="onSelect(dbType)"
          >
            <DbTypeIcon class="panel-item__icon" :db-type="dbType" :size="DB_TYPE_ICON_SIZE.list"/>
            <span class="panel-item__label">{{ labelFor(dbType) }}</span>
          </button>
        </section>
      </template>

      <DwPanelState
          v-else
          status="empty"
          :message="t('explorer.dbTypeNotFound')"
          compact
      />
    </div>
  </div>
</template>

<style scoped>
.db-type-panel {
  width: 220px;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  padding: var(--dw-space-2) var(--dw-space-6) var(--dw-space-3);
}

.panel-title {
  font-size: var(--dw-text-xs);
  font-weight: 500;
  color: var(--dw-text-muted);
  letter-spacing: 0.02em;
}

.panel-count {
  min-width: var(--dw-icon-size-lg);
  height: var(--dw-icon-size-lg);
  padding: 0 var(--dw-space-2);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  line-height: var(--dw-text-xl);
  text-align: center;
}

.panel-search {
  padding: 0 var(--dw-space-4) var(--dw-space-3);
}

.panel-search :deep(.dw-search) {
  height: var(--dw-btn-height);
  border: none;
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-muted);
}

.panel-search :deep(.dw-search input) {
  font-size: var(--dw-text-xs);
}

.panel-body {
  max-height: 280px;
  overflow-y: auto;
  padding: 0 var(--dw-space-2) var(--dw-space-2);
}

.panel-section + .panel-section {
  margin-top: var(--dw-space-2);
  padding-top: var(--dw-space-2);
  border-top: 1px solid var(--dw-border-light);
}

.section-label {
  padding: var(--dw-space-1) var(--dw-space-4) var(--dw-space-2);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
}

.panel-item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  width: 100%;
  min-height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-4);
  border-radius: 0;
  text-align: left;
  color: var(--dw-text);
  transition: var(--dw-transition-bg);
}

.panel-item:hover {
  background: color-mix(in srgb, var(--dw-primary) 14%, var(--dw-bg-hover));
}

[data-theme='dark'] .panel-item:hover {
  background: var(--dw-selection-bg);
}

.panel-item__icon {
  flex-shrink: 0;
}

.panel-item__label {
  flex: 1;
  min-width: 0;
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-tight);
}
</style>
