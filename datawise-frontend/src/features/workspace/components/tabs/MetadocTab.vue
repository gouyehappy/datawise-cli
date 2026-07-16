<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwPanelState} from '@/core/components'
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
    layout.showSuccessToast(t('workspace.metadoc.copySuccess'))
  } catch {
    layout.showErrorToast(t('workspace.metadoc.copyFailed'))
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

    <DwPanelState
        v-if="loading"
        status="loading"
        :message="t('workspace.metadoc.loading')"
        fill
    />

    <DwPanelState
        v-else-if="loadError"
        status="error"
        :title="t('workspace.metadoc.loadFailed')"
        :message="loadError"
        fill
    />

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
  background: var(--dw-bg);
}

.metadoc-tab__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
  padding: var(--dw-space-6) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
}

.metadoc-tab__substatus {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  padding: var(--dw-space-4) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
}

.metadoc-tab__subspinner {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border-radius: var(--dw-radius-pill);
  border: 2px solid var(--dw-border);
  border-top-color: var(--dw-link);
  animation: metadoc-spin 1s linear infinite;
}

.metadoc-tab__view-switch,
.metadoc-tab__actions {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
}

.metadoc-tab__view-btn,
.metadoc-tab__action-btn {
  border: 1px solid var(--dw-border);
  background: var(--dw-bg-muted);
  color: var(--dw-text);
  border-radius: var(--dw-control-radius);
  padding: var(--dw-space-3) var(--dw-space-6);
  cursor: pointer;
}

.metadoc-tab__view-btn.active {
  background: var(--dw-info-soft);
  border-color: var(--dw-link);
  color: var(--dw-link);
}

.metadoc-tab__action-btn--primary {
  background: var(--dw-link);
  border-color: var(--dw-link);
  color: var(--dw-on-accent);
}

.metadoc-tab__preview-wrap,
.metadoc-tab__markdown {
  flex: 1;
  min-height: 0;
}

@keyframes metadoc-spin {
  to { transform: rotate(360deg); }
}

.metadoc-tab__preview {
  width: 100%;
  height: 100%;
  border: 0;
  background: var(--dw-bg);
}

.metadoc-tab__markdown {
  margin: 0;
  padding: var(--dw-space-8);
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  white-space: pre-wrap;
}
</style>
