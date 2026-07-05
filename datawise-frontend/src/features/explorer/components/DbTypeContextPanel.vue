<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
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
      <div v-if="catalogStore.loading" class="panel-empty">{{ t('explorer.dbTypeLoading') }}</div>
      <div v-else-if="catalogStore.error" class="panel-empty">{{ t('explorer.dbTypeLoadFailed') }}</div>
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

      <div v-else class="panel-empty">{{ t('explorer.dbTypeNotFound') }}</div>
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
  gap: 8px;
  padding: 4px 12px 6px;
}

.panel-title {
  font-size: 10px;
  font-weight: 500;
  color: var(--dw-text-muted);
  letter-spacing: 0.02em;
}

.panel-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.panel-search {
  padding: 0 8px 6px;
}

.panel-search :deep(.dw-search) {
  height: 28px;
  border: none;
  border-radius: 6px;
  background: var(--dw-bg-muted);
}

.panel-search :deep(.dw-search input) {
  font-size: 11px;
}

.panel-body {
  max-height: 280px;
  overflow-y: auto;
  padding: 0 4px 4px;
}

.panel-section + .panel-section {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--dw-border-light);
}

.section-label {
  padding: 2px 8px 4px;
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.panel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 26px;
  padding: 0 8px;
  border-radius: 0;
  text-align: left;
  color: var(--dw-text);
  transition: background 0.1s ease;
}

.panel-item:hover {
  background: color-mix(in srgb, var(--dw-primary) 14%, var(--dw-bg-hover));
}

[data-theme='dark'] .panel-item:hover {
  background: #2d4f7c;
}

.panel-item__icon {
  flex-shrink: 0;
}

.panel-item__label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
}

.panel-empty {
  padding: 12px 10px;
  color: var(--dw-text-muted);
  font-size: 11px;
  text-align: center;
}
</style>
