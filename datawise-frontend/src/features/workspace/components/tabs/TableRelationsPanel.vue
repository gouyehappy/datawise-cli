<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState} from '@/core/components'
import type {WorkspaceTab} from '@/core/types'
import {useTableRelations} from '@/features/workspace/composables/useTableRelations'
import {openRelatedTableFromRelation} from '@/features/workspace/services/table-relations.actions'
import {parseRelationColumnList} from '@/features/workspace/services/table-relation-graph-columns.service'
import type {TableRelationEdge} from '@/shared/api/types'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()

const {relations, loading, error, databaseName} = useTableRelations(props.tab, {
  shouldLoad: () => true,
})

const totalRelations = computed(() =>
    relations.value.references.length + relations.value.referencedBy.length,
)

async function openRelation(edge: TableRelationEdge, direction: 'references' | 'referencedBy') {
  await openRelatedTableFromRelation(props.tab, edge, direction, databaseName.value)
}
</script>

<template>
  <div class="table-relations">
    <div v-if="loading" class="table-relations__state">
      <span class="table-relations__spinner" aria-hidden="true"/>
      {{ t('workspace.tableDetail.loading') }}
    </div>
    <div v-else-if="error" class="table-relations__state table-relations__state--error">
      {{ error }}
    </div>
    <template v-else>
      <header class="table-relations__summary">
        <article class="table-relations__summary-card">
          <span class="table-relations__summary-label">{{ t('workspace.tableDetail.relationsOutgoing') }}</span>
          <strong class="table-relations__summary-value">{{ relations.references.length }}</strong>
        </article>
        <article class="table-relations__summary-card">
          <span class="table-relations__summary-label">{{ t('workspace.tableDetail.relationsIncoming') }}</span>
          <strong class="table-relations__summary-value">{{ relations.referencedBy.length }}</strong>
        </article>
        <article class="table-relations__summary-card table-relations__summary-card--total">
          <span class="table-relations__summary-label">{{ t('workspace.tableDetail.relationsTotal') }}</span>
          <strong class="table-relations__summary-value">{{ totalRelations }}</strong>
        </article>
      </header>

      <div class="table-relations__columns">
        <section class="table-relations__section">
          <header class="table-relations__head">
            <div>
              <h3>{{ t('workspace.tableDetail.relationsOutgoing') }}</h3>
              <p>{{ t('workspace.tableDetail.relationsOutgoingHint') }}</p>
            </div>
            <span class="table-relations__count">{{ relations.references.length }}</span>
          </header>

          <div v-if="relations.references.length" class="table-relations__cards">
            <button
                v-for="edge in relations.references"
                :key="`${edge.constraintName}-${edge.sourceColumns}-${edge.targetTable}`"
                type="button"
                class="table-relations__card table-relations__card--outgoing"
                @click="openRelation(edge, 'references')"
            >
              <div class="table-relations__card-top">
                <span class="table-relations__constraint mono">{{ edge.constraintName }}</span>
              </div>
              <div class="table-relations__flow">
                <div class="table-relations__flow-block">
                  <span class="table-relations__flow-label">{{ t('workspace.tableDetail.relationsLocalColumns') }}</span>
                  <div class="table-relations__chips">
                    <span
                        v-for="column in parseRelationColumnList(edge.sourceColumns)"
                        :key="column"
                        class="table-relations__chip"
                    >
                      {{ column }}
                    </span>
                  </div>
                </div>
                <span class="table-relations__arrow" aria-hidden="true">→</span>
                <div class="table-relations__flow-block table-relations__flow-block--target">
                  <span class="table-relations__flow-label">{{ t('workspace.tableDetail.relationsRemoteTable') }}</span>
                  <span class="table-relations__target mono">{{ edge.targetTable }}</span>
                  <div class="table-relations__chips">
                    <span
                        v-for="column in parseRelationColumnList(edge.targetColumns)"
                        :key="column"
                        class="table-relations__chip table-relations__chip--muted"
                    >
                      {{ column }}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
          <EmptyState
              v-else
              embedded
              compact
              :title="t('workspace.tableDetail.relationsEmptyOutgoing')"
          />
        </section>

        <section class="table-relations__section">
          <header class="table-relations__head">
            <div>
              <h3>{{ t('workspace.tableDetail.relationsIncoming') }}</h3>
              <p>{{ t('workspace.tableDetail.relationsIncomingHint') }}</p>
            </div>
            <span class="table-relations__count">{{ relations.referencedBy.length }}</span>
          </header>

          <div v-if="relations.referencedBy.length" class="table-relations__cards">
            <button
                v-for="edge in relations.referencedBy"
                :key="`${edge.constraintName}-${edge.sourceTable}-${edge.targetColumns}`"
                type="button"
                class="table-relations__card table-relations__card--incoming"
                @click="openRelation(edge, 'referencedBy')"
            >
              <div class="table-relations__card-top">
                <span class="table-relations__constraint mono">{{ edge.constraintName }}</span>
              </div>
              <div class="table-relations__flow">
                <div class="table-relations__flow-block">
                  <span class="table-relations__flow-label">{{ t('workspace.tableDetail.relationsRemoteTable') }}</span>
                  <span class="table-relations__target mono">{{ edge.sourceTable }}</span>
                  <div class="table-relations__chips">
                    <span
                        v-for="column in parseRelationColumnList(edge.sourceColumns)"
                        :key="column"
                        class="table-relations__chip table-relations__chip--muted"
                    >
                      {{ column }}
                    </span>
                  </div>
                </div>
                <span class="table-relations__arrow" aria-hidden="true">→</span>
                <div class="table-relations__flow-block table-relations__flow-block--target">
                  <span class="table-relations__flow-label">{{ t('workspace.tableDetail.relationsLocalColumns') }}</span>
                  <div class="table-relations__chips">
                    <span
                        v-for="column in parseRelationColumnList(edge.targetColumns)"
                        :key="column"
                        class="table-relations__chip"
                    >
                      {{ column }}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          </div>
          <EmptyState
              v-else
              embedded
              compact
              :title="t('workspace.tableDetail.relationsEmptyIncoming')"
          />
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.table-relations {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}

.table-relations__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.table-relations__summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.table-relations__summary-card--total {
  background: color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg-panel));
  border-color: color-mix(in srgb, var(--dw-primary) 20%, var(--dw-border-light));
}

.table-relations__summary-label {
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.table-relations__summary-value {
  font-size: 20px;
  line-height: 1.1;
  color: var(--dw-text);
}

.table-relations__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: start;
}

.table-relations__section {
  border: 1px solid var(--dw-border-light);
  border-radius: 12px;
  background: var(--dw-bg-panel);
  overflow: hidden;
  min-width: 0;
}

.table-relations__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-bg-muted) 25%, var(--dw-bg-panel));
}

.table-relations__head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.table-relations__head p {
  margin: 4px 0 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.table-relations__count {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.table-relations__cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.table-relations__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-editor);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}

.table-relations__card:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 4%, var(--dw-bg-editor));
  transform: translateY(-1px);
}

.table-relations__card--outgoing {
  border-left: 3px solid color-mix(in srgb, var(--dw-primary) 55%, var(--dw-border-light));
}

.table-relations__card--incoming {
  border-left: 3px solid color-mix(in srgb, #0ea5e9 55%, var(--dw-border-light));
}

.table-relations__card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.table-relations__constraint {
  color: var(--dw-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.table-relations__flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.table-relations__flow-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.table-relations__flow-label {
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.table-relations__target {
  color: var(--dw-primary);
  font-size: 12px;
  font-weight: 700;
  word-break: break-all;
}

.table-relations__arrow {
  color: var(--dw-text-muted);
  font-size: 16px;
  font-weight: 700;
}

.table-relations__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.table-relations__chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-panel));
  color: var(--dw-text);
  font-family: var(--dw-mono);
  font-size: 10px;
  line-height: 1.4;
}

.table-relations__chip--muted {
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

.table-relations__mono,
.mono {
  font-family: var(--dw-mono);
}

.table-relations__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 160px;
  color: var(--dw-text-muted);
  font-size: 13px;
}

.table-relations__state--error {
  color: var(--dw-danger, #c0392b);
}

.table-relations__spinner {
  width: 22px;
  height: 22px;
  border: 2px solid color-mix(in srgb, var(--dw-primary) 20%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: table-relations-spin 0.75s linear infinite;
}

@media (max-width: 1080px) {
  .table-relations__columns {
    grid-template-columns: 1fr;
  }
}

@keyframes table-relations-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
