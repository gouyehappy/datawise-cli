<!--
  统一数据源树：Explorer 单选（无复选框）与 AI 多选（带复选框）共用
-->
<script setup lang="ts">
import {computed, onUnmounted, ref, toRef} from 'vue'
import {useI18n} from 'vue-i18n'
import {StatusPill} from '@/core/components'
import {DwIcon} from '@/core/icons'
import TreeNodeIcon from '@/features/explorer/components/TreeNodeIcon.vue'
import type {TreeNode} from '@/core/types'
import {canExpandTreeNode} from '@/core/utils/tree'
import {
  normalizeConnectionEnvironment,
  resolveConnectionEnvironmentLabel,
  resolveConnectionEnvironmentVariant,
} from '@/features/connection/services/connection-environment.service'
import {isConnectionFeatureNode} from '@/features/explorer/services/flat-connection-feature-tree.service'
import {
  isViewModelStatusMeta,
  viewModelStatusVariant,
} from '@/features/explorer/services/view-model-tree.service'
import {
  isExplorerFavoritesGroupId,
  isExplorerFavoritesViewAllId,
} from '@/features/explorer/services/explorer-favorites.constants'
import {resolveExplorerCatalogLabel} from '@/features/explorer/services/explorer-catalog-label.service'
import {resolvePlatformFeatureId} from '@/features/explorer/services/explorer-ai-tree.service'
import {platformFeatureTreeLabel} from '@/features/platform/services/platform-catalog.service'
import {
  resolveLastFlatNodeIndex,
  useTreeVirtualWindow,
} from '@/features/explorer/composables/useTreeVirtualWindow'

const DRAG_THRESHOLD_PX = 6

const props = withDefaults(
    defineProps<{
      flatNodes: { node: TreeNode; depth: number }[]
      emptyText: string
      selectedNodeId?: string | null
      flashNodeId?: string | null
      highlightNodeIds?: Set<string>
      loadingNodeIds?: Set<string>
      pinnedNodeIds?: Set<string>
      connectionHealth?: Record<string, 'ok' | 'error'>
      selectable?: boolean
      isCheckable?: (node: TreeNode) => boolean
      isChecked?: (node: TreeNode) => boolean
      showColumnComment?: boolean
      showTableComment?: boolean
      compact?: boolean
      connectionDragEnabled?: boolean
      canMoveConnectionToGroup?: (connectionId: string, groupId: string) => boolean
    }>(),
    {
      selectable: false,
      showColumnComment: true,
      showTableComment: true,
      compact: false,
      loadingNodeIds: () => new Set(),
      pinnedNodeIds: () => new Set(),
      connectionDragEnabled: false,
    },
)

const emit = defineEmits<{
  select: [node: TreeNode]
  open: [node: TreeNode]
  contextmenu: [event: MouseEvent, node: TreeNode]
  toggleExpand: [nodeId: string]
  toggleCheck: [node: TreeNode]
  moveConnection: [connectionId: string, groupId: string]
}>()

const {t} = useI18n()
const flatNodesRef = toRef(props, 'flatNodes')
const {
  rootRef,
  useVirtual,
  totalHeight,
  visibleNodes,
  visibleRangePaddingTop,
  visibleRangePaddingBottom,
  scrollToFlatIndex,
} = useTreeVirtualWindow(flatNodesRef)

const selectedFlatIndex = computed(() =>
    props.selectable
        ? -1
        : resolveLastFlatNodeIndex(props.flatNodes, props.selectedNodeId),
)

defineExpose({scrollToFlatIndex})
const draggingConnectionId = ref<string | null>(null)
const dropTargetGroupId = ref<string | null>(null)
const suppressNextClick = ref(false)

type PointerDragSession = { cleanup: () => void }
let activePointerDrag: PointerDragSession | null = null

onUnmounted(() => {
  cancelPointerDrag()
})

const INDENT_STEP = 14

function rowStyle(depth: number) {
  return {'--tree-depth': String(depth)}
}

function isTreeNodeSelected(_node: TreeNode, index: number): boolean {
  return !props.selectable && selectedFlatIndex.value >= 0 && selectedFlatIndex.value === index
}

function rowClass(node: TreeNode, index: number) {
  const checked = props.selectable && props.isChecked?.(node)
  const selected = isTreeNodeSelected(node, index)
  const flash = !props.selectable && props.flashNodeId === node.id
  const teamShared = !props.selectable && props.highlightNodeIds?.has(node.id)
  const loading = props.loadingNodeIds?.has(node.id)
  const expandable = canExpandTreeNode(node)
  const dragging = props.connectionDragEnabled && draggingConnectionId.value === node.id
  const dropTarget = props.connectionDragEnabled
      && node.type === 'group'
      && dropTargetGroupId.value === node.id
      && !isExplorerFavoritesGroupId(node.id)

  return [
    `tree-node--${node.type}`,
    {
      'tree-node--favorites-group': isExplorerFavoritesGroupId(node.id),
      'tree-node--favorites-view-all': isExplorerFavoritesViewAllId(node.id),
      'is-selected': selected,
      'is-locate-flash': flash,
      'is-team-shared': teamShared,
      'is-checked': checked,
      'is-expanded': !!node.expanded,
      'is-loading': loading,
      'is-selectable': props.selectable && props.isCheckable?.(node),
      'is-leaf': !expandable,
      'has-twistie': expandable,
      'is-dragging': dragging,
      'is-drop-target': dropTarget,
      'is-pinned': props.pinnedNodeIds?.has(node.id),
      'is-load-more': node.type === 'load_more',
    },
  ]
}

function canDropOnGroup(connectionId: string, groupId: string): boolean {
  if (props.canMoveConnectionToGroup) {
    return props.canMoveConnectionToGroup(connectionId, groupId)
  }
  return true
}

function cancelPointerDrag() {
  activePointerDrag?.cleanup()
  activePointerDrag = null
}

function resolveGroupDropTarget(clientX: number, clientY: number): string | null {
  const connectionId = draggingConnectionId.value
  if (!connectionId) return null
  const hit = document.elementFromPoint(clientX, clientY)?.closest('[data-tree-node-id]')
  if (!hit) return null
  const nodeId = hit.getAttribute('data-tree-node-id')
  if (!nodeId) return null
  const entry = props.flatNodes.find(({node: n}) => n.id === nodeId)
  if (!entry || entry.node.type !== 'group') return null
  if (!canDropOnGroup(connectionId, nodeId)) return null
  return nodeId
}

function onConnectionPointerDown(event: MouseEvent, node: TreeNode) {
  if (!props.connectionDragEnabled || node.type !== 'connection') return
  if (event.button !== 0) return

  cancelPointerDrag()

  const startX = event.clientX
  const startY = event.clientY
  let dragging = false

  function onMove(e: PointerEvent) {
    if (!dragging) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
      dragging = true
      draggingConnectionId.value = node.id
      suppressNextClick.value = true
      e.preventDefault()
    }
    dropTargetGroupId.value = resolveGroupDropTarget(e.clientX, e.clientY)
  }

  function onUp() {
    cleanupListeners()
    if (dragging) {
      const groupId = dropTargetGroupId.value
      if (groupId && canDropOnGroup(node.id, groupId)) {
        emit('moveConnection', node.id, groupId)
      }
      draggingConnectionId.value = null
      dropTargetGroupId.value = null
    }
    activePointerDrag = null
  }

  function cleanupListeners() {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  activePointerDrag = {
    cleanup() {
      cleanupListeners()
      if (dragging) {
        draggingConnectionId.value = null
        dropTargetGroupId.value = null
      }
      activePointerDrag = null
    },
  }
}

function onRowClick(node: TreeNode) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  if (props.selectable) {
    if (props.isCheckable?.(node)) {
      emit('toggleCheck', node)
    }
    return
  }
  if (node.type === 'load_more') {
    if (props.loadingNodeIds?.has(node.id)) return
    emit('toggleExpand', node.id)
    return
  }
  emit('select', node)
}

function onRowDblClick(node: TreeNode) {
  if (props.selectable) return
  emit('open', node)
}

function displayNodeLabel(node: TreeNode) {
  if (node.type === 'redis-browser') return t('explorer.redisBrowser.treeLabel')
  if (node.type === 'redis-feature') {
    if (node.meta === 'keys') return t('explorer.redisFeatures.keys')
    if (node.meta === 'command') return t('explorer.redisFeatures.command')
  }
  if (node.type === 'kafka-feature') {
    if (node.meta === 'topics') return t('explorer.kafkaFeatures.topics')
    if (node.meta === 'consumer-groups') return t('explorer.kafkaFeatures.consumerGroups')
  }
  if (node.type === 'load_more') return 'Load more'
  if (node.type === 'platform_feature') {
    return platformFeatureTreeLabel(resolvePlatformFeatureId(node) as import('@/features/platform/types/platform.types').PlatformFeatureId, t)
  }
  return resolveExplorerCatalogLabel(node, t)
}

function connectionEnvForNode(node: TreeNode) {
  return normalizeConnectionEnvironment(node.env, node.envCustom)
}

function connectionEnvLabel(node: TreeNode) {
  const normalized = connectionEnvForNode(node)
  return resolveConnectionEnvironmentLabel(normalized.env, normalized.envCustom, t)
}

function onCheckboxChange(node: TreeNode, event: Event) {
  event.stopPropagation()
  emit('toggleCheck', node)
}

function shouldShowComment(node: TreeNode) {
  if (!node.comment?.trim()) return false
  if (node.type === 'column') return props.showColumnComment
  if (node.type === 'table' || node.type === 'view') return props.showTableComment
  return props.showColumnComment || props.showTableComment
}

function viewModelStatusLabel(node: TreeNode) {
  if (node.meta === 'draft') return t('viewModel.treeBadgeDraft')
  return t('viewModel.treeBadgePublished')
}
</script>

<template>
  <div
      ref="rootRef"
      class="datasource-tree"
      :class="{
        'datasource-tree--compact': compact,
        'is-connection-dragging': !!draggingConnectionId,
        'is-virtualized': useVirtual,
      }"
      :style="{ '--tree-indent': `${INDENT_STEP}px` }"
  >
    <div v-if="!flatNodes.length" class="tree-empty">
      <span class="tree-empty-icon" aria-hidden="true">
        <DwIcon name="open" size="lg" :stroke-width="1.4"/>
      </span>
      <p>{{ emptyText }}</p>
    </div>

    <div
        v-else
        class="tree-virtual-track"
        :style="useVirtual ? { minHeight: `${totalHeight}px` } : undefined"
    >
      <div
          class="tree-virtual-window"
          :style="useVirtual ? {
            paddingTop: `${visibleRangePaddingTop}px`,
            paddingBottom: `${visibleRangePaddingBottom}px`,
          } : undefined"
      >
    <div
        v-for="({ node, depth, index }) in visibleNodes"
        :key="`${index}:${node.id}`"
        class="tree-node"
        :class="rowClass(node, index)"
        :data-tree-node-id="node.id"
        :style="rowStyle(depth)"
        :title="connectionDragEnabled && node.type === 'connection' ? t('explorer.moveConnectionDragHint') : undefined"
        @mousedown="onConnectionPointerDown($event, node)"
        @click="onRowClick(node)"
        @dblclick="onRowDblClick(node)"
        @contextmenu="!selectable && emit('contextmenu', $event, node)"
    >
      <span class="tree-node__guides" aria-hidden="true">
        <span
            v-for="level in depth"
            :key="level"
            class="tree-node__guide"
        />
      </span>

      <span class="tree-node__body">
        <button
            v-if="canExpandTreeNode(node)"
            class="tree-twistie"
            :class="{ 'is-expanded': node.expanded, 'is-loading': loadingNodeIds?.has(node.id) }"
            type="button"
            :aria-label="t('explorer.expandToggle')"
            :aria-expanded="node.expanded"
            @mousedown.stop
            @click.stop="emit('toggleExpand', node.id)"
        >
          <span v-if="loadingNodeIds?.has(node.id)" class="tree-twistie__spinner"/>
          <DwIcon v-else class="tree-twistie__icon" name="chevron-right" size="xs" :stroke-width="1.5"/>
        </button>
        <span v-else class="tree-twistie tree-twistie--spacer" aria-hidden="true"/>

        <label
            v-if="selectable && isCheckable?.(node)"
            class="tree-check"
            @click.stop
        >
          <input
              type="checkbox"
              :checked="!!isChecked?.(node)"
              :aria-label="displayNodeLabel(node)"
              @change="onCheckboxChange(node, $event)"
          />
        </label>

        <TreeNodeIcon
            :type="node.type"
            :db-type="node.dbType"
            :expanded="!!node.expanded"
            :feature="node.meta"
            :special-folder="node.type === 'group'"
            :health="node.type === 'connection' ? connectionHealth?.[node.id] : undefined"
            :pinned="pinnedNodeIds?.has(node.id)"
            :loading="node.type === 'load_more' && loadingNodeIds?.has(node.id)"
        />

        <span class="tree-label" :title="displayNodeLabel(node)">
          {{ displayNodeLabel(node) }}
        </span>

        <StatusPill
            v-if="node.type === 'connection'"
            inline
            class="tree-env-pill"
            :variant="resolveConnectionEnvironmentVariant(connectionEnvForNode(node).env)"
        >
          {{ connectionEnvLabel(node) }}
        </StatusPill>

        <StatusPill
            v-else-if="node.type === 'view_model' && isViewModelStatusMeta(node.meta)"
            inline
            class="tree-env-pill tree-vm-pill"
            :variant="viewModelStatusVariant(node.meta)"
        >
          {{ viewModelStatusLabel(node) }}
        </StatusPill>

        <span
            v-if="shouldShowComment(node)"
            class="tree-comment"
            :title="node.comment"
        >
          {{ node.comment }}
        </span>

        <span
            v-if="node.meta && node.type !== 'load_more' && !isConnectionFeatureNode(node) && !isViewModelStatusMeta(node.meta) && !node.meta.endsWith(':loaded')"
            class="tree-meta"
            :title="node.meta"
        >
          {{ node.meta }}
        </span>
      </span>
    </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datasource-tree {
  --tree-row-height: 28px;
  --tree-indent: 14px;
  --tree-twistie-size: 18px;
  --tree-guide-color: color-mix(in srgb, var(--dw-border) 55%, transparent);

  flex: 1;
  min-height: min-content;
  padding: 4px 0 8px;
}

.datasource-tree--compact {
  --tree-row-height: 26px;
  --tree-indent: 12px;
  padding: 2px 0 6px;
}

.tree-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  padding: 28px 16px;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.tree-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
}

.tree-empty-icon svg {
  width: 22px;
  height: 22px;
}

.tree-empty p {
  margin: 0;
  text-align: center;
  line-height: 1.5;
}

.tree-node {
  position: relative;
  display: flex;
  align-items: stretch;
  min-height: var(--tree-row-height);
  padding-left: calc(6px + var(--tree-depth, 0) * var(--tree-indent));
  padding-right: 6px;
  cursor: default;
  user-select: none;
}

.tree-node.is-selectable {
  cursor: pointer;
}

.tree-node.is-load-more {
  cursor: pointer;
}

.tree-node.is-load-more .tree-label {
  color: var(--dw-text-muted);
  font-weight: 500;
}

.tree-node.is-load-more.is-loading {
  pointer-events: none;
}

.tree-node.is-load-more.is-loading .tree-label {
  color: var(--dw-text-muted);
  opacity: 0.75;
}

.tree-node__guides {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 6px;
  display: flex;
  pointer-events: none;
}

.tree-node__guide {
  width: var(--tree-indent);
  flex-shrink: 0;
  border-right: 1px solid var(--tree-guide-color);
  opacity: 0.65;
}

.tree-node__guide:last-child {
  opacity: 0.9;
}

.tree-node__body {
  position: relative;
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
  min-height: var(--tree-row-height);
  padding: 0 6px 0 2px;
  border-radius: 4px;
  color: var(--dw-text);
  font-size: 12.5px;
  line-height: 1.3;
  transition: background 0.1s ease;
}

.datasource-tree--compact .tree-node__body {
  font-size: 12px;
  gap: 4px;
}

.tree-node__body::before {
  content: '';
  position: absolute;
  left: 0;
  top: 3px;
  bottom: 3px;
  width: 2px;
  border-radius: 1px;
  background: transparent;
  transition: background 0.1s ease;
}

.tree-node:hover .tree-node__body {
  background: var(--dw-bg-hover);
}

.tree-node.is-selected .tree-node__body {
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-hover));
}

.tree-node.is-selected .tree-node__body::before {
  background: var(--dw-primary);
}

.tree-node--connection.is-selected .tree-node__body,
.tree-node--database.is-selected .tree-node__body {
  background: color-mix(in srgb, #0891b2 10%, var(--dw-bg-hover));
}

.tree-node--connection.is-selected .tree-node__body::before,
.tree-node--database.is-selected .tree-node__body::before {
  background: #0891b2;
}

.tree-node--group.is-selected .tree-node__body {
  background: color-mix(in srgb, #d97706 10%, var(--dw-bg-hover));
}

.tree-node--group.is-selected .tree-node__body::before {
  background: #d97706;
}

.tree-node.is-checked .tree-node__body {
  background: var(--dw-primary-soft);
}

.tree-node.is-locate-flash .tree-node__body {
  animation: tree-locate-flash 0.85s ease-in-out;
}

.tree-node.is-team-shared .tree-node__body {
  box-shadow: inset 3px 0 0 var(--dw-primary);
}

@keyframes tree-locate-flash {
  0%,
  100% {
    background: transparent;
  }

  45% {
    background: color-mix(in srgb, var(--dw-primary-mild) 55%, transparent);
  }
}

.datasource-tree.is-connection-dragging {
  cursor: grabbing;
  user-select: none;
}

.tree-node--group .tree-label {
  font-weight: 600;
}

.tree-node.is-dragging {
  opacity: 0.45;
}

.tree-node.is-drop-target > .tree-node__body {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
  outline: 1px dashed color-mix(in srgb, var(--dw-primary) 45%, transparent);
  outline-offset: -1px;
}

.tree-node--connection .tree-label,
.tree-node--database .tree-label {
  font-weight: 500;
}

.tree-env-pill {
  flex-shrink: 0;
  margin-left: 6px;
}

.tree-node--table.is-selected .tree-label {
  color: var(--dw-primary-hover);
  font-weight: 600;
}

.tree-node--folder,
.tree-node--columns,
.tree-node--keys,
.tree-node--indexes {
  color: var(--dw-text-secondary);
}

.tree-node--folder .tree-label {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.tree-node--column {
  color: var(--dw-text-secondary);
  font-size: 12px;
}

.tree-node--column.is-selected .tree-node__body {
  background: var(--dw-bg-hover);
}

.tree-node--column.is-selected .tree-node__body::before {
  background: var(--dw-text-muted);
}

.tree-twistie {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--tree-twistie-size);
  height: var(--tree-twistie-size);
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.12s ease,
  color 0.12s ease,
  transform 0.14s ease;
}

.tree-node:hover .tree-twistie,
.tree-node.is-expanded .tree-twistie,
.tree-node.is-selected .tree-twistie {
  opacity: 1;
}

.tree-twistie:hover {
  color: var(--dw-text-secondary);
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
}

.tree-twistie__icon {
  width: 13px;
  height: 13px;
  display: block;
  transition: transform 0.14s ease;
}

.tree-twistie.is-expanded .tree-twistie__icon {
  transform: rotate(90deg);
}

.tree-twistie.is-loading {
  opacity: 1;
  pointer-events: none;
}

.tree-twistie__spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid color-mix(in srgb, var(--dw-text-muted) 35%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: tree-spin 0.65s linear infinite;
}

@keyframes tree-spin {
  to {
    transform: rotate(360deg);
  }
}

.tree-twistie--spacer {
  visibility: hidden;
  pointer-events: none;
}

.tree-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
}

.tree-check input {
  width: 12px;
  height: 12px;
  margin: 0;
  accent-color: var(--dw-primary);
  cursor: pointer;
}

.tree-label {
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

.tree-comment {
  flex-shrink: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
}

.tree-meta {
  margin-left: auto;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  font-family: var(--dw-mono);
  font-size: 10px;
  line-height: 1.5;
  flex-shrink: 0;
}

.tree-node.is-selected .tree-meta {
  background: color-mix(in srgb, var(--dw-bg) 70%, transparent);
  color: var(--dw-text-secondary);
}

[data-theme='dark'] .tree-node__guide {
  opacity: 0.45;
}

.tree-node--favorites-group > .tree-row {
  font-weight: 600;
  color: var(--dw-primary);
}

.tree-node--favorites-view-all > .tree-row .tree-label {
  color: var(--dw-text-secondary);
  font-style: italic;
}

[data-theme='dark'] .tree-twistie:hover {
  background: rgba(255, 255, 255, 0.06);
}
</style>
