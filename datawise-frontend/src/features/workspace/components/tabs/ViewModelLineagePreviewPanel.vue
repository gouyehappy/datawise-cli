<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState} from '@/core/components'
import LineageColumnMapView from '@/features/lineage/components/LineageColumnMapView.vue'
import type {LineageGraph} from '@/features/lineage/types/lineage.types'
import {buildColumnLineageMap, hasColumnLineage} from '@/features/lineage/services/lineage-column-map.service'

const props = defineProps<{
    graph: LineageGraph | null
    loading: boolean
    error: string | null
    modelName: string
}>()

defineEmits<{
    refresh: []
}>()

const {t} = useI18n()

const columnMap = computed(() => buildColumnLineageMap(props.graph))
const hasContent = computed(() => hasColumnLineage(columnMap.value))
const status = computed(() => props.graph?.meta?.status ?? 'failed')
const warnings = computed(() => props.graph?.meta?.warnings ?? [])
</script>

<template>
  <div class="vm-lineage-preview">
    <header class="vm-lineage-preview__toolbar">
      <div class="vm-lineage-preview__title">
        <span>{{ t('viewModel.lineagePreviewTitle') }}</span>
        <span v-if="graph?.meta?.parser" class="vm-lineage-preview__meta">
          {{ graph.meta.parser }} · {{ t(`lineage.status.${status}`) }}
        </span>
      </div>
      <div class="vm-lineage-preview__actions">
        <button type="button" class="dw-btn dw-btn--sm" :disabled="loading" @click="$emit('refresh')">
          {{ t('lineage.refresh') }}
        </button>
      </div>
    </header>

    <div v-if="warnings.length" class="vm-lineage-preview__warnings">
      <p v-for="(warning, index) in warnings" :key="`${warning.code}-${index}`">
        {{ warning.message }}
      </p>
    </div>

    <div v-if="loading" class="vm-lineage-preview__state">{{ t('lineage.loading') }}</div>
    <EmptyState
        v-else-if="error"
        :title="t('lineage.loadFailed')"
        :description="error"
    />
    <EmptyState
        v-else-if="!hasContent"
        :title="t('lineage.emptyTitle')"
        :description="t('lineage.emptyHint')"
    />
    <LineageColumnMapView
        v-else
        :graph="graph"
        compact
    />
  </div>
</template>

<style scoped>
.vm-lineage-preview {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  border-top: 1px solid var(--dw-border-light);
  background: var(--dw-bg-base);
}

.vm-lineage-preview__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dw-border-subtle);
}

.vm-lineage-preview__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  font-weight: 600;
}

.vm-lineage-preview__meta {
  font-size: 11px;
  font-weight: 400;
  color: var(--dw-text-muted);
}

.vm-lineage-preview__actions {
  display: flex;
  gap: 6px;
}

.vm-lineage-preview__warnings {
  padding: 6px 10px;
  background: color-mix(in srgb, var(--dw-warning) 12%, transparent);
  color: var(--dw-text-secondary);
  font-size: 11px;
}

.vm-lineage-preview__state {
  padding: 12px;
  color: var(--dw-text-muted);
  font-size: 12px;
}
</style>
