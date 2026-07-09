<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()

const activeView = computed({
  get: () => props.tab.metadocView ?? 'preview',
  set: (value: 'preview' | 'markdown') => {
    props.tab.metadocView = value
  },
})

const html = computed(() => props.tab.metadocHtml ?? '')
const markdown = computed(() => props.tab.metadocMarkdown ?? '')
const loading = computed(() => props.tab.metadocLoading ?? false)
const loadError = computed(() => props.tab.metadocLoadError ?? '')
const detailsLoading = computed(() => props.tab.metadocDetailsLoading ?? false)

async function copyMarkdown() {
  if (!markdown.value.trim()) return
  try {
    await navigator.clipboard.writeText(markdown.value)
    layout.showToast(t('workspace.metadoc.copySuccess'))
  } catch {
    layout.showToast(t('workspace.metadoc.copyFailed'))
  }
}

function downloadCurrent() {
  const content = activeView.value === 'preview' ? html.value : markdown.value
  if (!content.trim()) return
  const isHtml = activeView.value === 'preview'
  const type = isHtml ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8'
  const blob = new Blob([content], {type})
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  const rawName = props.tab.metadocFileName?.trim() || 'metadoc.md'
  anchor.download = isHtml
      ? rawName.replace(/\.md$/i, '.html')
      : rawName.replace(/\.html$/i, '.md')
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="metadoc-tab">
    <header class="metadoc-tab__toolbar">
      <div class="metadoc-tab__view-switch">
        <button
            type="button"
            class="metadoc-tab__view-btn"
            :class="{active: activeView === 'preview'}"
            @click="activeView = 'preview'"
        >
          {{ t('workspace.metadoc.preview') }}
        </button>
        <button
            type="button"
            class="metadoc-tab__view-btn"
            :class="{active: activeView === 'markdown'}"
            @click="activeView = 'markdown'"
        >
          Markdown
        </button>
      </div>
      <div class="metadoc-tab__actions">
        <button type="button" class="metadoc-tab__action-btn" @click="copyMarkdown">
          {{ t('workspace.metadoc.copyMarkdown') }}
        </button>
        <button type="button" class="metadoc-tab__action-btn metadoc-tab__action-btn--primary" @click="downloadCurrent">
          {{ t('workspace.metadoc.download') }}
        </button>
      </div>
    </header>

    <div v-if="detailsLoading && !loading && !loadError" class="metadoc-tab__substatus" role="status" aria-live="polite">
      <span class="metadoc-tab__subspinner" aria-hidden="true"/>
      {{ t('workspace.metadoc.loadingDetails') }}
    </div>

    <div v-if="loading" class="metadoc-tab__state">
      <span class="metadoc-tab__spinner" aria-hidden="true"/>
      {{ t('workspace.metadoc.loading') }}
    </div>

    <div v-else-if="loadError" class="metadoc-tab__state metadoc-tab__state--error">
      <div class="metadoc-tab__state-title">{{ t('workspace.metadoc.loadFailed') }}</div>
      <div class="metadoc-tab__state-detail">{{ loadError }}</div>
    </div>

    <div v-else-if="activeView === 'preview'" class="metadoc-tab__preview-wrap">
      <iframe
          class="metadoc-tab__preview"
          :srcdoc="html"
          sandbox="allow-same-origin"
          :title="tab.title"
      />
    </div>
    <pre v-else class="metadoc-tab__markdown"><code>{{ markdown }}</code></pre>
  </div>
</template>

<style scoped>
.metadoc-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--color-bg, #fff);
}

.metadoc-tab__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.metadoc-tab__substatus {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
}

.metadoc-tab__subspinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #2563eb);
  animation: metadoc-spin 1s linear infinite;
}

.metadoc-tab__view-switch,
.metadoc-tab__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metadoc-tab__view-btn,
.metadoc-tab__action-btn {
  border: 1px solid var(--color-border, #d1d5db);
  background: var(--color-bg-soft, #f8fafc);
  color: var(--color-text, #111827);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.metadoc-tab__view-btn.active {
  background: var(--color-primary-soft, #eff6ff);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #2563eb);
}

.metadoc-tab__action-btn--primary {
  background: var(--color-primary, #2563eb);
  border-color: var(--color-primary, #2563eb);
  color: #fff;
}

.metadoc-tab__preview-wrap,
.metadoc-tab__markdown {
  flex: 1;
  min-height: 0;
}

.metadoc-tab__state {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 24px;
  color: var(--color-text, #111827);
}

.metadoc-tab__state--error {
  color: #b91c1c;
}

.metadoc-tab__state-title {
  font-weight: 600;
}

.metadoc-tab__state-detail {
  max-width: 760px;
  color: var(--color-text-muted, #6b7280);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.metadoc-tab__spinner {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 2px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #2563eb);
  animation: metadoc-spin 1s linear infinite;
}

@keyframes metadoc-spin {
  to { transform: rotate(360deg); }
}

.metadoc-tab__preview {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.metadoc-tab__markdown {
  margin: 0;
  padding: 16px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
