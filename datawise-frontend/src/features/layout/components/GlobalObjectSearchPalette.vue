<script setup lang="ts">
import {computed, ref, watch, onUnmounted} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppPalette, EmptyState} from '@/core/components'
import {formatBindingParts} from '@/core/shortcuts/shortcut.service'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'
import {useGlobalObjectSearch} from '@/features/layout/composables/useGlobalObjectSearch'
import {
    indexGlobalObjectSearchEntries,
    searchGlobalObjectEntries,
    type GlobalObjectSearchEntry,
} from '@/features/explorer/services/global-object-search.service'
import {activateGlobalObjectSearchEntry} from '@/features/explorer/services/global-object-search.actions'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {executeShortcutAction} from '@/core/shortcuts/execute-action'
import {
    isPaletteCommandMode,
    searchPaletteCommands,
    type PaletteCommandEntry,
} from '@/features/layout/services/palette-command.service'
import type {AiKnowledgeEntry} from '@/features/ai/knowledge/types/ai-knowledge.types'
import {fetchAiKnowledgeEntries} from '@/features/ai/knowledge/services/ai-knowledge.service'
import {
    isPaletteKnowledgeMode,
    knowledgeEntrySubtitle,
    searchKnowledgeEntries,
} from '@/features/layout/services/palette-knowledge.service'
import {activatePaletteKnowledgeEntry} from '@/features/layout/services/palette-knowledge.actions'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {canAccessFeature} from '@/features/auth/services/feature-permission.service'
import {usePluginPresetSummary} from '@/features/plugin/composables/usePluginPresetSummary'
import {
    buildPaletteNavigationEntries,
    searchPaletteNavigationEntries,
    type PaletteNavigationEntry,
} from '@/features/layout/services/palette-navigation.service'

type PaletteListItem =
    | {kind: 'object'; entry: GlobalObjectSearchEntry}
    | {kind: 'command'; entry: PaletteCommandEntry}
    | {kind: 'knowledge'; entry: AiKnowledgeEntry}
    | {kind: 'navigation'; entry: PaletteNavigationEntry}

const {t, te} = useI18n()
const {globalObjectSearchOpen, closeGlobalObjectSearch} = useGlobalObjectSearch()
const explorer = useExplorerStore()
const shortcuts = useShortcutSettingsStore()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const shortcutPanel = useShortcutPanelStore()
const pluginStore = usePluginStore()
const appConfig = useAppConfigStore()
const {referencePresetId, referencePresetConflictCount} = usePluginPresetSummary()

const bookmarksEnabled = computed(() => pluginStore.isEnabled('p-sql-bookmarks'))
const sqlHistoryEnabled = computed(() => pluginStore.isEnabled('p-sql-history'))

const query = ref('')
const activeIndex = ref(0)
const knowledgeEntries = ref<AiKnowledgeEntry[]>([])
const knowledgeLoaded = ref(false)

const indexedEntries = computed(() => {
    if (!globalObjectSearchOpen.value) return []
    void explorer.treeVersion
    return indexGlobalObjectSearchEntries(explorer.tree)
})

const commandMode = computed(() => isPaletteCommandMode(query.value))
const knowledgeMode = computed(() => isPaletteKnowledgeMode(query.value))

const navigationEntries = computed(() =>
    searchPaletteNavigationEntries(
        buildPaletteNavigationEntries({
            query: query.value,
            t,
            te,
            setModule: (module) => layout.setModule(module),
            openConsole: (options) => workspace.openConsole(options),
            toggleShortcutPanel: (panel) => layout.toggleShortcutPanel(panel),
            openPluginDevTools: () => pluginStore.openPluginDevTools(),
            openConnectorMarket: () => pluginStore.openConnectorMarket(),
            openSettingsModule: (module, anchor) => layout.openSettingsModule(module, anchor),
            isPluginDevToolsVisible: () => appConfig.isPluginDevToolsVisible(),
            bookmarksEnabled: bookmarksEnabled.value,
            sqlHistoryEnabled: sqlHistoryEnabled.value,
            sqlLogs: shortcutPanel.sqlLogs,
            savedConsoles: shortcutPanel.savedConsoles,
            plugins: pluginStore.items,
            referencePresetId: referencePresetId.value,
            referencePresetConflictCount: referencePresetConflictCount.value,
            isPluginEnabled: (id) => pluginStore.isEnabled(id),
            focusPlugin: (id) => pluginStore.focusPlugin(id),
            setPluginEnabled: (id, enabled) => pluginStore.setEnabled(id, enabled),
            applyPreset: (presetId) => pluginStore.applyPreset(presetId),
            setReferencePresetId: (presetId) => pluginStore.setReferencePresetId(presetId),
            alignToReferencePreset: () => pluginStore.alignToReferencePreset(),
            openPluginPresetDiff: () => pluginStore.openPluginPresetDiff(),
            getReferencePresetId: () => pluginStore.referencePresetId(),
            canAccessFeature,
            canAccessNavModule: (module) => layout.canAccessNavModule(module),
        }),
        query.value,
    ),
)

const filteredObjects = computed(() => {
    if (commandMode.value || knowledgeMode.value) return []
    return searchGlobalObjectEntries(indexedEntries.value, query.value)
})

const filteredKnowledge = computed(() =>
    searchKnowledgeEntries(knowledgeEntries.value, query.value),
)

const filteredCommands = computed(() =>
    searchPaletteCommands(query.value, (key) => t(key)),
)

const listItems = computed<PaletteListItem[]>(() => {
    if (commandMode.value) {
        return filteredCommands.value.map((entry) => ({kind: 'command' as const, entry}))
    }
    if (knowledgeMode.value) {
        return filteredKnowledge.value.map((entry) => ({kind: 'knowledge' as const, entry}))
    }

    const items: PaletteListItem[] = navigationEntries.value.map((entry) => ({
        kind: 'navigation' as const,
        entry,
    }))

    for (const entry of filteredObjects.value) {
        items.push({kind: 'object' as const, entry})
    }

    if (query.value.trim()) {
        const knowledgeItems = filteredKnowledge.value.slice(0, 6).map((entry) => ({
            kind: 'knowledge' as const,
            entry,
        }))
        const commandItems = filteredCommands.value.slice(0, 4).map((entry) => ({
            kind: 'command' as const,
            entry,
        }))
        if (!filteredObjects.value.length && !navigationEntries.value.length) {
            return [...knowledgeItems, ...commandItems]
        }
        return [...items, ...knowledgeItems, ...commandItems]
    }

    if (filteredCommands.value.length) {
        return [
            ...items,
            ...filteredCommands.value.slice(0, 4).map((entry) => ({kind: 'command' as const, entry})),
        ]
    }
    return items
})

async function ensureKnowledgeLoaded() {
    if (knowledgeLoaded.value) return
    try {
        knowledgeEntries.value = await fetchAiKnowledgeEntries()
    } catch {
        knowledgeEntries.value = []
    } finally {
        knowledgeLoaded.value = true
    }
}

watch(globalObjectSearchOpen, (open) => {
    if (open) {
        query.value = ''
        activeIndex.value = 0
        void ensureKnowledgeLoaded()
        window.addEventListener('keydown', onKeydown)
    } else {
        window.removeEventListener('keydown', onKeydown)
    }
})

watch(listItems, () => {
    activeIndex.value = 0
})

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
})

function kindLabel(entry: GlobalObjectSearchEntry): string {
    return t(`globalObjectSearch.types.${entry.kind}`)
}

function commandBindingChips(id: PaletteCommandEntry['id']): string[] {
    const binding = shortcuts.getBinding(id)
    if (!binding.trim()) return []
    return formatBindingParts(binding)
}

function runItem(item: PaletteListItem) {
    if (item.kind === 'object') {
        void activateGlobalObjectSearchEntry(item.entry)
    } else if (item.kind === 'knowledge') {
        void activatePaletteKnowledgeEntry(item.entry)
    } else if (item.kind === 'navigation') {
        item.entry.run()
    } else {
        executeShortcutAction(item.entry.id)
    }
    closeGlobalObjectSearch()
}

function listItemKey(item: PaletteListItem): string {
    if (item.kind === 'object') return item.entry.nodeId
    if (item.kind === 'knowledge') return item.entry.id
    if (item.kind === 'navigation') return item.entry.id
    return item.entry.id
}

function onKeydown(event: KeyboardEvent) {
    if (!globalObjectSearchOpen.value) return
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        activeIndex.value = Math.min(activeIndex.value + 1, Math.max(listItems.value.length - 1, 0))
    } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex.value = Math.max(activeIndex.value - 1, 0)
    } else if (event.key === 'Enter') {
        event.preventDefault()
        const item = listItems.value[activeIndex.value]
        if (item) runItem(item)
    }
}
</script>

<template>
  <AppPalette
      :open="globalObjectSearchOpen"
      :ariaLabel="t('globalObjectSearch.title')"
      width="min(720px, calc(100vw - 32px))"
      :maxHeight="'min(60vh, 520px)'"
      @close="closeGlobalObjectSearch"
  >
    <input
        v-model="query"
        class="app-palette__input"
        type="search"
        autofocus
        :placeholder="t('globalObjectSearch.placeholder')"
    />
    <p v-if="commandMode" class="app-palette__hint">
      {{ t('globalObjectSearch.commandModeHint') }}
    </p>
    <p v-else-if="knowledgeMode" class="app-palette__hint">
      {{ t('globalObjectSearch.knowledgeModeHint') }}
    </p>
    <template v-else-if="!query.trim()">
      <p class="app-palette__hint">{{ t('commandPalette.pluginsSearchHint') }}</p>
      <p class="app-palette__hint app-palette__hint--reference">
        {{ t('commandPalette.presets.currentReference', {
          preset: t(`plugin.presets.${referencePresetId}.label`),
        }) }}
        <template v-if="referencePresetConflictCount > 0">
          · {{ t('commandPalette.presets.currentReferenceConflicts', { count: referencePresetConflictCount }) }}
        </template>
      </p>
    </template>
    <p v-else-if="!indexedEntries.length && !knowledgeEntries.length && !navigationEntries.length" class="app-palette__hint">
      {{ t('globalObjectSearch.noIndexedObjects') }}
    </p>
    <ul v-if="listItems.length" class="app-palette__list">
      <li v-for="(item, index) in listItems" :key="listItemKey(item)">
        <button
            class="app-palette__item"
            :class="{ 'is-active': index === activeIndex }"
            type="button"
            @click="runItem(item)"
        >
          <template v-if="item.kind === 'object'">
            <span class="app-palette__label app-palette__label--mono">{{ item.entry.qualifiedLabel }}</span>
            <span class="app-palette__meta">
              {{ kindLabel(item.entry) }} · {{ item.entry.connectionLabel }}
            </span>
          </template>
          <template v-else-if="item.kind === 'knowledge'">
            <span class="app-palette__label">{{ item.entry.term }}</span>
            <span class="app-palette__meta">
              {{ t('globalObjectSearch.knowledgeLabel') }}
              <span v-if="knowledgeEntrySubtitle(item.entry)"> · {{ knowledgeEntrySubtitle(item.entry) }}</span>
            </span>
          </template>
          <template v-else-if="item.kind === 'navigation'">
            <span class="app-palette__label">{{ item.entry.label }}</span>
            <span class="app-palette__meta">
              {{ item.entry.group }}<template v-if="item.entry.hint"> · {{ item.entry.hint }}</template>
            </span>
          </template>
          <template v-else>
            <span class="app-palette__label">{{ t(item.entry.labelKey) }}</span>
            <span class="app-palette__meta">
              {{ t('globalObjectSearch.commandLabel') }}
              <span v-if="commandBindingChips(item.entry.id).length" class="app-palette__keys">
                <kbd
                    v-for="chip in commandBindingChips(item.entry.id)"
                    :key="chip"
                    class="app-palette__chip"
                >{{ chip }}</kbd>
              </span>
            </span>
          </template>
        </button>
      </li>
    </ul>
    <EmptyState v-else embedded compact :title="t('globalObjectSearch.empty')"/>
  </AppPalette>
</template>

<style scoped>
.app-palette__hint--reference {
  margin-top: -6px;
  color: var(--dw-text-muted);
  font-size: 0.8125rem;
}
</style>
