<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {TableColumn, TableRow} from '@/core/types'
import type {SqlReviewFinding} from '@/features/platform/types/platform.types'
import type {DangerousSqlPreview} from '@/features/workspace/services/dangerous-sql-preview.service'

const props = defineProps<{
  preview: DangerousSqlPreview | null
  loading: boolean
  affectedCount: number | null
  sampleRows: TableRow[]
  sampleColumns: TableColumn[]
  errorMessage: string | null
  productionForced?: boolean
  productionApprovalRequired?: boolean
  sqlReviewFindings?: SqlReviewFinding[]
  sqlReviewBlocked?: boolean
  sqlReviewSuggestedSql?: string | null
  sqlReviewRewriteNote?: string | null
  sqlReviewRewriteLoading?: boolean
}>()

const emit = defineEmits<{
  applySuggestedSql: []
}>()

const {t} = useI18n()

const kindLabel = computed(() => {
  const kind = props.preview?.kind
  if (!kind) return ''
  return t(`console.dangerousSql.kind.${kind}`)
})

const statusMessage = computed(() => {
  if (props.loading) return t('console.dangerousSql.loading')
  if (props.errorMessage) return props.errorMessage
  if (props.preview?.fullTableRisk && props.affectedCount == null) {
    return t('console.dangerousSql.fullTableRisk')
  }
  if (props.affectedCount != null) {
    return t('console.dangerousSql.affectedRows', {count: props.affectedCount})
  }
  return t('console.dangerousSql.confirmHint')
})
</script>

<template>
  <div class="dangerous-pending" role="status" aria-live="polite">
    <p v-if="productionApprovalRequired" class="dangerous-pending__prod">
      {{ t('console.productionApproval.pendingHint') }}
    </p>
    <p v-else-if="productionForced" class="dangerous-pending__prod">
      {{ t('console.dangerousSql.prodForced') }}
    </p>
    <div class="dangerous-pending__body">
      <span class="dangerous-pending__badge">{{ kindLabel }}</span>
      <span v-if="preview?.tableName" class="dangerous-pending__table">
        {{ t('console.dangerousSql.table', {name: preview.tableName}) }}
      </span>
      <span class="dangerous-pending__hint">{{ statusMessage }}</span>
    </div>
    <ul v-if="sqlReviewFindings?.length" class="dangerous-pending__review">
      <li class="dangerous-pending__review-title">{{ t('platform.sqlReview.title') }}</li>
      <li v-if="sqlReviewBlocked" class="dangerous-pending__review-blocked">
        {{ t('platform.sqlReview.blocked') }}
      </li>
      <li
          v-for="(finding, index) in sqlReviewFindings"
          :key="`${finding.code}-${index}`"
          class="dangerous-pending__finding"
      >
        <strong>[{{ finding.severity }}]</strong> {{ finding.message }}
        <span v-if="finding.suggestion" class="dangerous-pending__suggestion">{{ finding.suggestion }}</span>
      </li>
    </ul>
    <div v-if="sqlReviewSuggestedSql?.trim()" class="dangerous-pending__rewrite">
      <p class="dangerous-pending__rewrite-note">
        {{ sqlReviewRewriteNote || t('platform.sqlReview.rewriteReady') }}
      </p>
      <pre class="dangerous-pending__rewrite-sql">{{ sqlReviewSuggestedSql }}</pre>
      <button
          type="button"
          class="dangerous-pending__rewrite-btn"
          :disabled="sqlReviewRewriteLoading"
          @click="emit('applySuggestedSql')"
      >
        {{ t('platform.sqlReview.applyRewrite') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.dangerous-pending {
  flex-shrink: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-warning, #f59e0b) 8%, var(--dw-bg-panel));
}

.dangerous-pending__prod {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--dw-danger, #dc2626);
}

.dangerous-pending__body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 1.4;
}

.dangerous-pending__badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--dw-danger, #dc2626);
  background: color-mix(in srgb, var(--dw-danger, #dc2626) 12%, transparent);
}

.dangerous-pending__table {
  color: var(--dw-text-muted);
}

.dangerous-pending__hint {
  color: var(--dw-text);
}

.dangerous-pending__review {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.dangerous-pending__review-title {
  list-style: none;
  margin-left: -18px;
  font-weight: 600;
  color: var(--dw-text);
}

.dangerous-pending__review-blocked {
  color: var(--dw-danger, #dc2626);
}

.dangerous-pending__finding {
  margin-top: 2px;
}

.dangerous-pending__suggestion {
  display: block;
  opacity: 0.85;
}

.dangerous-pending__rewrite {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed color-mix(in srgb, var(--dw-border-light) 80%, transparent);
}

.dangerous-pending__rewrite-note {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--dw-text);
}

.dangerous-pending__rewrite-sql {
  margin: 0 0 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--dw-bg-subtle);
  font-size: 11px;
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}

.dangerous-pending__rewrite-btn {
  border: 1px solid var(--dw-accent);
  background: transparent;
  color: var(--dw-accent);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.dangerous-pending__rewrite-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
