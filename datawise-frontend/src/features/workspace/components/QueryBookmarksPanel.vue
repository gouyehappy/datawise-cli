<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {StatusPill, EmptyState} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {readStoredSharedSqlEditorShortcuts} from '@/features/settings/services/sql-editor-shortcuts.service'
import {
    collectBookmarkTags,
    filterQueryBookmarks,
    groupBookmarksByFolder,
    mergeQueryBookmarks,
    REPORT_TEMPLATE_FOLDER_PREFIX,
    type QueryBookmarkItem,
} from '@/features/workspace/services/query-bookmark.service'
import {
    REPORT_TEMPLATE_CATEGORIES,
    type ReportTemplateCategory,
} from '@/features/workspace/constants/report-sql-templates'

const emit = defineEmits<{
    saveBookmark: []
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const shortcutPanel = useShortcutPanelStore()
const workspace = useWorkspaceStore()

const search = ref('')
const activeTag = ref<string | null>(null)
const activeReportCategory = ref<ReportTemplateCategory | null>(null)

const allBookmarks = computed(() =>
    mergeQueryBookmarks(
        shortcutPanel.savedConsoles,
        readStoredSharedSqlEditorShortcuts().snippets ?? [],
    ),
)

const filteredBookmarks = computed(() =>
    filterQueryBookmarks(
        allBookmarks.value,
        search.value,
        activeTag.value,
        activeReportCategory.value,
    ),
)

const groupedBookmarks = computed(() => groupBookmarksByFolder(filteredBookmarks.value))
const tagOptions = computed(() => collectBookmarkTags(allBookmarks.value))
const showTagFilter = computed(() => tagOptions.value.length > 0)

function folderLabel(folder: string): string {
    if (folder.startsWith(`${REPORT_TEMPLATE_FOLDER_PREFIX}/`)) {
        const category = folder.slice(REPORT_TEMPLATE_FOLDER_PREFIX.length + 1) as ReportTemplateCategory
        return t(`shortcut.bookmarks.reportCategories.${category}`)
    }
    return folder
}

function displayTags(item: QueryBookmarkItem): string[] {
    return item.tags.filter((tag) => tag !== '报表模板')
}

function openBookmark(item: { connectionName?: string; sql: string }) {
    layout.setModule('database')
    workspace.openConsole({
        connectionName: item.connectionName && item.connectionName !== '—' ? item.connectionName : undefined,
        sql: item.sql || 'SELECT 1;',
    })
}
</script>

<template>
  <div class="bookmarks-panel">
    <div class="bookmarks-panel__toolbar">
      <input
          v-model="search"
          class="bookmarks-panel__search"
          type="search"
          :placeholder="t('shortcut.bookmarks.searchPlaceholder')"
      />
      <button class="bookmarks-panel__add" type="button" @click="emit('saveBookmark')">
        {{ t('shortcut.bookmarks.save') }}
      </button>
    </div>

    <div class="bookmarks-panel__filter-block">
      <span class="bookmarks-panel__filter-label">{{ t('shortcut.bookmarks.categoryLabel') }}</span>
      <div class="bookmarks-panel__chips">
        <button
            class="bookmarks-panel__chip"
            :class="{ 'is-active': !activeReportCategory }"
            type="button"
            @click="activeReportCategory = null"
        >
          {{ t('shortcut.bookmarks.allCategories') }}
        </button>
        <button
            v-for="category in REPORT_TEMPLATE_CATEGORIES"
            :key="category"
            class="bookmarks-panel__chip"
            :class="{ 'is-active': activeReportCategory === category }"
            type="button"
            @click="activeReportCategory = activeReportCategory === category ? null : category"
        >
          {{ t(`shortcut.bookmarks.reportCategories.${category}`) }}
        </button>
      </div>
    </div>

    <div v-if="showTagFilter" class="bookmarks-panel__filter-block bookmarks-panel__filter-block--tags">
      <span class="bookmarks-panel__filter-label">{{ t('shortcut.bookmarks.tagLabel') }}</span>
      <div class="bookmarks-panel__chips">
        <button
            class="bookmarks-panel__chip"
            :class="{ 'is-active': !activeTag }"
            type="button"
            @click="activeTag = null"
        >
          {{ t('shortcut.bookmarks.allTags') }}
        </button>
        <button
            v-for="tag in tagOptions"
            :key="tag"
            class="bookmarks-panel__chip"
            :class="{ 'is-active': activeTag === tag }"
            type="button"
            @click="activeTag = activeTag === tag ? null : tag"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <EmptyState
        v-if="!filteredBookmarks.length"
        :title="t('shortcut.bookmarks.empty')"
        :hint="t('shortcut.bookmarks.emptyHint')"
    />

    <div v-else class="bookmarks-panel__groups">
      <section v-for="[folder, items] in groupedBookmarks" :key="folder" class="bookmarks-group">
        <header class="bookmarks-group__head">
          <h5>{{ folderLabel(folder) }}</h5>
          <span class="bookmarks-group__count">{{ items.length }}</span>
        </header>
        <ul class="bookmarks-group__list">
          <li v-for="item in items" :key="item.id">
            <button class="bookmark-card" type="button" @click="openBookmark(item)">
              <span class="bookmark-card__icon" aria-hidden="true">
                <DwIcon name="console" size="sm" :stroke-width="1.6"/>
              </span>
              <span class="bookmark-card__body">
                <span class="bookmark-card__title-row">
                  <span class="bookmark-card__title">{{ item.name }}</span>
                  <StatusPill v-if="item.teamShared" variant="team">{{ t('shortcut.teamShared') }}</StatusPill>
                  <StatusPill v-if="item.source === 'shared-snippet'" variant="primary">{{ t('shortcut.bookmarks.sharedSnippet') }}</StatusPill>
                  <StatusPill v-if="item.source === 'report-template'" variant="accent">{{ t('shortcut.bookmarks.reportTemplate') }}</StatusPill>
                </span>
                <span v-if="item.description" class="bookmark-card__desc">{{ item.description }}</span>
                <span v-if="item.connectionName && item.connectionName !== '—'" class="bookmark-card__meta">{{ item.connectionName }}</span>
                <span v-else-if="displayTags(item).length" class="bookmark-card__meta">{{ displayTags(item).join(' · ') }}</span>
              </span>
              <span class="bookmark-card__chevron" aria-hidden="true">›</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.bookmarks-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bookmarks-panel__toolbar {
  display: flex;
  gap: 8px;
}

.bookmarks-panel__search {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 12px;
}

.bookmarks-panel__add {
  flex-shrink: 0;
  padding: 8px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.bookmarks-panel__add:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border-light));
  color: var(--dw-primary);
}

.bookmarks-panel__filter-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bookmarks-panel__filter-block--tags {
  padding-top: 2px;
  border-top: 1px dashed var(--dw-border-light);
}

.bookmarks-panel__filter-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.bookmarks-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bookmarks-panel__chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: 11px;
  line-height: 1.35;
  cursor: pointer;
}

.bookmarks-panel__chip.is-active {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}

.bookmarks-panel__groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bookmarks-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--dw-border-light);
}

.bookmarks-group__head h5 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--dw-text);
}

.bookmarks-group__count {
  min-width: 20px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  text-align: center;
}

.bookmarks-group__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bookmark-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 10px 11px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
}

.bookmark-card:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 22%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 4%, var(--dw-bg));
  box-shadow: 0 2px 8px color-mix(in srgb, var(--dw-text) 5%, transparent);
}

.bookmark-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-top: 1px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-muted));
  color: var(--dw-primary);
}

.bookmark-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.bookmark-card__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
}

.bookmark-card__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--dw-text);
  word-break: break-word;
}

.bookmark-card__desc {
  color: var(--dw-text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.bookmark-card__meta {
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.bookmark-card__chevron {
  flex-shrink: 0;
  align-self: center;
  color: var(--dw-text-muted);
  font-size: 18px;
  line-height: 1;
  opacity: 0.45;
}

.bookmark-card:hover .bookmark-card__chevron {
  opacity: 1;
  color: var(--dw-primary);
}
</style>
