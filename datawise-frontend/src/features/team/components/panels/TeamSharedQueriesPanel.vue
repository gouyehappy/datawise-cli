<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {ShareTeamSharedQueryPayload, TeamMember, TeamSharedQuerySummary} from '@/core/types'
import StatusPill from '@/core/components/ui/StatusPill.vue'
import {DwButton} from '@/core/components'
import ShareTeamQueryDialog from '@/features/team/components/ShareTeamQueryDialog.vue'
import TeamSharedQueryDetailDrawer from '@/features/team/components/TeamSharedQueryDetailDrawer.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useTeamStore} from '@/features/team/stores/team-store'
import {
    collectTeamSharedQueryTags,
    filterTeamSharedQueries,
} from '@/features/team/services/team-shared-query.service'

const props = defineProps<{
    teamId: string
    teamName: string
    members: TeamMember[]
    canManage: boolean
    currentUserId?: number
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const teamStore = useTeamStore()

const loading = ref(false)
const queries = ref<TeamSharedQuerySummary[]>([])
const search = ref('')
const activeTag = ref<string | null>(null)
const starredOnly = ref(false)
const dialogOpen = ref(false)
const dialogSaving = ref(false)
const editing = ref<TeamSharedQuerySummary | null>(null)
const editingSql = ref('')
const drawerOpen = ref(false)
const drawerSummary = ref<TeamSharedQuerySummary | null>(null)
const favoriteTogglingId = ref<string | null>(null)

const tagOptions = computed(() => collectTeamSharedQueryTags(queries.value))

const filteredQueries = computed(() =>
    filterTeamSharedQueries(queries.value, search.value, activeTag.value, starredOnly.value),
)

async function reloadQueries() {
    loading.value = true
    try {
        queries.value = await teamStore.fetchSharedQueries(props.teamId)
    } catch (error) {
        const message = error instanceof Error ? error.message : t('team.sharedQueries.loadFailed')
        layout.showToast(message)
        queries.value = []
    } finally {
        loading.value = false
    }
}

function canModify(query: TeamSharedQuerySummary): boolean {
    if (props.canManage) return true
    if (props.currentUserId == null) return false
    return query.sharedByUserId === props.currentUserId
}

function openQueryDrawer(summary: TeamSharedQuerySummary) {
    drawerSummary.value = summary
    drawerOpen.value = true
}

function onDrawerSummaryUpdated(patch: TeamSharedQuerySummary) {
    queries.value = queries.value.map((item) => (item.id === patch.id ? patch : item))
    if (drawerSummary.value?.id === patch.id) {
        drawerSummary.value = patch
    }
}

async function toggleFavorite(summary: TeamSharedQuerySummary, event: Event) {
    event.stopPropagation()
    if (favoriteTogglingId.value) return
    favoriteTogglingId.value = summary.id
    try {
        const updated = await teamStore.toggleSharedQueryFavorite(props.teamId, summary.id)
        onDrawerSummaryUpdated(updated)
    } catch (error) {
        const message = error instanceof Error ? error.message : t('team.sharedQueries.favoriteFailed')
        layout.showToast(message)
    } finally {
        favoriteTogglingId.value = null
    }
}

function openCreateDialog() {
    editing.value = null
    editingSql.value = ''
    dialogOpen.value = true
}

async function openEditDialog(summary: TeamSharedQuerySummary) {
    try {
        const detail = await teamStore.getSharedQuery(props.teamId, summary.id)
        editing.value = summary
        editingSql.value = detail.sql
        dialogOpen.value = true
    } catch {
        layout.showToast(t('team.sharedQueries.loadFailed'))
    }
}

async function onSave(payload: ShareTeamSharedQueryPayload) {
    dialogSaving.value = true
    try {
        if (editing.value) {
            await teamStore.updateSharedQuery(props.teamId, editing.value.id, payload)
            layout.showToast(t('team.sharedQueries.updated'))
        } else {
            await teamStore.shareQuery(props.teamId, payload)
            layout.showToast(t('team.sharedQueries.created'))
        }
        dialogOpen.value = false
        editing.value = null
        await reloadQueries()
    } catch (error) {
        const message = error instanceof Error ? error.message : t('team.sharedQueries.saveFailed')
        layout.showToast(message)
    } finally {
        dialogSaving.value = false
    }
}

async function onDelete(summary: TeamSharedQuerySummary) {
    if (!window.confirm(t('team.sharedQueries.deleteConfirm', {title: summary.title}))) return
    try {
        await teamStore.deleteSharedQuery(props.teamId, summary.id)
        layout.showToast(t('team.sharedQueries.deleted'))
        await reloadQueries()
    } catch (error) {
        const message = error instanceof Error ? error.message : t('team.sharedQueries.deleteFailed')
        layout.showToast(message)
    }
}

function formatDate(value: string) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

watch(
    () => props.teamId,
    () => {
        if (!props.teamId) return
        search.value = ''
        activeTag.value = null
        starredOnly.value = false
        void reloadQueries()
    },
    {immediate: true},
)
</script>

<template>
  <div class="tab-panel shared-queries-panel">
    <header class="shared-queries-toolbar">
      <input
          v-model="search"
          class="shared-queries-search"
          type="search"
          :placeholder="t('team.sharedQueries.searchPlaceholder')"
      />
      <div v-if="tagOptions.length" class="shared-queries-tags">
        <button
            type="button"
            class="tag-chip"
            :class="{ 'is-active': !activeTag }"
            @click="activeTag = null"
        >
          {{ t('team.sharedQueries.allTags') }}
        </button>
        <button
            v-for="tag in tagOptions"
            :key="tag"
            type="button"
            class="tag-chip"
            :class="{ 'is-active': activeTag === tag }"
            @click="activeTag = tag"
        >
          {{ tag }}
        </button>
      </div>
      <button
          type="button"
          class="tag-chip"
          :class="{ 'is-active': starredOnly }"
          @click="starredOnly = !starredOnly"
      >
        {{ t('team.sharedQueries.starredOnly') }}
      </button>
      <DwButton variant="primary" size="sm" @click="openCreateDialog">
        {{ t('team.sharedQueries.addAction') }}
      </DwButton>
    </header>

    <p v-if="loading" class="mp-empty">{{ t('team.loading') }}</p>
    <p v-else-if="!filteredQueries.length" class="mp-empty">{{ t('team.sharedQueries.empty') }}</p>

    <div v-else class="shared-query-cards">
      <article
          v-for="query in filteredQueries"
          :key="query.id"
          class="shared-query-card"
      >
        <button
            class="shared-query-card__main"
            type="button"
            @click="openQueryDrawer(query)"
        >
          <div class="shared-query-card__title-row">
            <h3>{{ query.title }}</h3>
            <button
                type="button"
                class="shared-query-card__star"
                :class="{ 'is-active': query.starredByCurrentUser }"
                :disabled="favoriteTogglingId === query.id"
                :title="query.starredByCurrentUser
                    ? t('team.sharedQueries.unfavoriteAction')
                    : t('team.sharedQueries.favoriteAction')"
                @click="toggleFavorite(query, $event)"
            >
              ★
            </button>
          </div>
          <p v-if="query.description" class="shared-query-card__desc">{{ query.description }}</p>
          <p class="shared-query-card__meta">
            {{ query.connectionName || t('team.sharedQueries.noConnection') }}
            <span v-if="query.database"> · {{ query.database }}</span>
          </p>
          <div v-if="query.tags?.length" class="shared-query-card__tags">
            <StatusPill v-for="tag in query.tags" :key="tag" variant="neutral" inline>{{ tag }}</StatusPill>
          </div>
          <p class="shared-query-card__foot">
            {{ query.sharedByUserName }} · {{ formatDate(query.updatedAt || query.sharedAt) }}
            <span v-if="query.commentCount"> · {{ t('team.sharedQueries.commentCount', {count: query.commentCount}) }}</span>
          </p>
        </button>
        <div v-if="canModify(query)" class="shared-query-card__actions">
          <DwButton variant="secondary" size="sm" @click="openEditDialog(query)">
            {{ t('team.sharedQueries.editAction') }}
          </DwButton>
          <DwButton variant="secondary" size="sm" @click="onDelete(query)">
            {{ t('team.sharedQueries.deleteAction') }}
          </DwButton>
        </div>
      </article>
    </div>

    <ShareTeamQueryDialog
        v-model:open="dialogOpen"
        :saving="dialogSaving"
        :editing="editing"
        :default-sql="editingSql"
        @save="onSave"
    />

    <TeamSharedQueryDetailDrawer
        v-model:open="drawerOpen"
        :team-id="teamId"
        :summary="drawerSummary"
        :can-manage="canManage"
        :current-user-id="currentUserId"
        @summary-updated="onDrawerSummaryUpdated"
    />
  </div>
</template>

<style scoped>
.shared-queries-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shared-queries-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.shared-queries-search {
  flex: 1;
  min-width: 180px;
  padding: 8px 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg);
  color: var(--dw-text);
  font: inherit;
}

.shared-queries-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  padding: 4px 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 999px;
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.tag-chip.is-active {
  border-color: color-mix(in srgb, var(--dw-primary) 40%, var(--dw-border));
  color: var(--dw-text);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}

.shared-query-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.shared-query-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dw-border-light);
  border-radius: 12px;
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.shared-query-card__main {
  flex: 1;
  padding: 14px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.shared-query-card__main:disabled {
  opacity: 0.7;
  cursor: wait;
}

.shared-query-card__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.shared-query-card__title-row h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.shared-query-card__star {
  border: none;
  background: transparent;
  color: var(--dw-text-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 0 2px;
}

.shared-query-card__star.is-active {
  color: var(--dw-warning, #d97706);
}

.shared-query-card__star:disabled {
  opacity: 0.6;
  cursor: wait;
}

.shared-query-card__main h3 {
  margin: 0 0 6px;
  font-size: 15px;
}

.shared-query-card__desc {
  margin: 0 0 8px;
  color: var(--dw-text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.shared-query-card__meta {
  margin: 0 0 8px;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.shared-query-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.shared-query-card__foot {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
}

.shared-query-card__actions {
  display: flex;
  gap: 8px;
  padding: 0 14px 14px;
}
</style>
