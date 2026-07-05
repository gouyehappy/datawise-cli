<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {AiAnalysisReport} from '@/features/ai/types/analysis'
import {parseAnalysisReport} from '@/features/ai/analysis/services/analysis-report-markdown.service'
import {useToastStore} from '@/features/layout/stores/toast-store'

const props = defineProps<{
  report: AiAnalysisReport
  defaultExpanded?: boolean
}>()

const {t} = useI18n()
const toast = useToastStore()

const expanded = ref(props.defaultExpanded ?? false)

const parsed = computed(() => parseAnalysisReport(props.report.markdown))

const sectionCount = computed(() => parsed.value.sections.length)

async function copyMarkdown(event: MouseEvent) {
  event.stopPropagation()
  try {
    await navigator.clipboard.writeText(props.report.markdown)
    toast.show(t('ai.analysis.reportCopied'))
  } catch {
    toast.showError(t('ai.analysis.reportCopyFailed'))
  }
}

function toggleExpanded() {
  expanded.value = !expanded.value
}
</script>

<template>
  <section
      class="analysis-report-panel"
      :class="{ 'is-expanded': expanded }"
  >
    <button
        class="analysis-report-panel__header"
        type="button"
        :aria-expanded="expanded"
        @click="toggleExpanded"
    >
      <div class="analysis-report-panel__summary">
        <span class="analysis-report-panel__icon" aria-hidden="true">R</span>
        <div class="analysis-report-panel__titles">
          <span class="analysis-report-panel__eyebrow">{{ t('ai.analysis.reportSection') }}</span>
          <span class="analysis-report-panel__title">{{ parsed.title }}</span>
          <span
              v-if="!expanded && parsed.excerpt"
              class="analysis-report-panel__excerpt"
          >
            {{ parsed.excerpt }}
          </span>
        </div>
      </div>

      <div class="analysis-report-panel__meta">
        <span v-if="sectionCount" class="analysis-report-panel__count">
          {{ t('ai.analysis.reportSectionCount', {count: sectionCount}) }}
        </span>
        <button
            class="analysis-report-panel__copy ai-text-action"
            type="button"
            :title="t('ai.analysis.reportCopy')"
            @click="copyMarkdown"
        >
          {{ t('ai.analysis.reportCopy') }}
        </button>
        <span class="analysis-report-panel__chevron" aria-hidden="true"/>
      </div>
    </button>

    <div v-show="expanded" class="analysis-report-panel__body">
      <article
          v-for="(section, index) in parsed.sections"
          :key="`${section.title}-${index}`"
          class="analysis-report-panel__section"
      >
        <h4 class="analysis-report-panel__section-title">{{ section.title }}</h4>
        <div class="analysis-report-panel__section-content" v-html="section.html"/>
      </article>
    </div>
  </section>
</template>

<style scoped>
.analysis-report-panel {
  border: 1px solid var(--dw-border-light);
  border-radius: 14px;
  background: var(--dw-bg);
  overflow: hidden;
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-text) 3%, transparent);
  transition: border-color 0.2s ease,
  box-shadow 0.2s ease;
}

.analysis-report-panel:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 16%, var(--dw-border-light));
}

.analysis-report-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 15px;
  border: none;
  background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--dw-bg-panel) 80%, var(--dw-bg)),
      color-mix(in srgb, var(--dw-bg-panel) 40%, var(--dw-bg))
  );
  text-align: left;
  cursor: pointer;
}

.analysis-report-panel__summary {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.analysis-report-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  flex-shrink: 0;
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--dw-primary) 18%, var(--dw-primary-soft)),
      var(--dw-primary-soft)
  );
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 700;
}

.analysis-report-panel__titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.analysis-report-panel__eyebrow {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.analysis-report-panel__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--dw-text);
}

.analysis-report-panel__excerpt {
  margin-top: 2px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dw-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.analysis-report-panel__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.analysis-report-panel__count {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 20%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-bg) 85%, var(--dw-primary-soft));
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.analysis-report-panel__copy {
  font-size: 11px;
  padding: 4px 8px;
}

.analysis-report-panel__chevron {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--dw-text-muted);
  border-bottom: 2px solid var(--dw-text-muted);
  transform: rotate(45deg);
  transition: transform 0.25s ease;
}

.analysis-report-panel.is-expanded .analysis-report-panel__chevron {
  transform: rotate(-135deg);
  margin-top: 4px;
}

.analysis-report-panel__body {
  padding: 4px 16px 16px;
  border-top: 1px solid var(--dw-border-light);
  background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--dw-bg-panel) 25%, var(--dw-bg)),
      var(--dw-bg)
  );
}

.analysis-report-panel__section + .analysis-report-panel__section {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--dw-border-light);
}

.analysis-report-panel__section-title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.analysis-report-panel__section-content :deep(.report-paragraph) {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--dw-text);
}

.analysis-report-panel__section-content :deep(.report-paragraph:last-child) {
  margin-bottom: 0;
}

.analysis-report-panel__section-content :deep(.report-list) {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--dw-text);
}

.analysis-report-panel__section-content :deep(.report-code) {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--dw-text) 12%, transparent);
  background: color-mix(in srgb, #1a1b22 94%, var(--dw-bg-panel));
}

.analysis-report-panel__section-content :deep(.report-code__lang) {
  display: block;
  padding: 6px 12px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
  border-bottom: 1px solid color-mix(in srgb, var(--dw-text) 10%, transparent);
}

.analysis-report-panel__section-content :deep(.report-code pre) {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
}

.analysis-report-panel__section-content :deep(.report-code code) {
  font-family: var(--dw-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  color: color-mix(in srgb, #e4e4e7 95%, var(--dw-text));
}

.analysis-report-panel__section-content :deep(.report-table-wrap) {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--dw-border-light);
}

.analysis-report-panel__section-content :deep(.report-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.analysis-report-panel__section-content :deep(.report-table th),
.analysis-report-panel__section-content :deep(.report-table td) {
  padding: 8px 12px;
  border-bottom: 1px solid var(--dw-border-light);
  text-align: left;
  white-space: nowrap;
}

.analysis-report-panel__section-content :deep(.report-table th) {
  background: color-mix(in srgb, var(--dw-bg-panel) 70%, var(--dw-bg));
  color: var(--dw-text-secondary);
  font-weight: 600;
  font-size: 11px;
}

.analysis-report-panel__section-content :deep(.report-table tr:last-child td) {
  border-bottom: none;
}
</style>
