<script setup lang="ts">
import {computed} from 'vue'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import type {DbType, TreeNodeType} from '@/core/types'

const props = defineProps<{
  type: TreeNodeType
  dbType?: DbType
  expanded?: boolean
  /** Win11 蓝色特殊文件夹（根分组、收藏等） */
  specialFolder?: boolean
  /** kafka-feature / redis-feature 子功能标识 */
  feature?: string
  /** 连接节点探测结果：展开加载成功/失败 */
  health?: 'ok' | 'error'
  /** 置顶：在节点图标角标叠加 pin，而非单独显示第二个图标 */
  pinned?: boolean
  /** load_more 分页加载中 */
  loading?: boolean
}>()

function resolveTreeIcon(type: TreeNodeType, expanded?: boolean, feature?: string): DwIconName {
  if (type === 'group' || type === 'folder') return expanded ? 'open' : 'folder'
  if (type === 'database') return 'database'
  if (type === 'schema') return 'table'
  if (type === 'table' || type === 'view') return 'table'
  if (type === 'columns') return 'comment-column'
  if (type === 'keys' || type === 'primary_key' || type === 'foreign_key' || type === 'redis-key') return 'key'
  if (type === 'indexes' || type === 'index') return 'list-ordered'
  if (type === 'column') return 'comment-table'
  if (type === 'sql_file') return 'editor'
  if (type === 'view_model') return 'view-model'
  if (type === 'platform_feature') return 'format'
  if (type === 'function' || type === 'procedure' || type === 'trigger') return 'command'
  if (type === 'console') return 'console'
  if (type === 'kafka-topic') return 'tab-kafka'
  if (type === 'kafka-feature') {
    return feature === 'consumer-groups' ? 'users' : feature === 'table-publish' ? 'export' : 'tab-kafka'
  }
  if (type === 'yarn-feature') {
    return feature === 'nodes' ? 'cpu' : feature === 'queues' ? 'menu-group' : 'tab-yarn'
  }
  if (type === 'redis-browser' || type === 'redis-feature') {
    return feature === 'command' ? 'console' : 'search'
  }
  if (type === 'ssh-terminal') return 'console'
  if (type === 'ssh-script-records') return 'folder'
  if (type === 'ssh-script-record') return 'editor'
  if (type === 'load_more') return 'ellipsis'
  return 'file'
}

const treeIcon = computed(() => resolveTreeIcon(props.type, props.expanded, props.feature))
</script>

<template>
  <span class="tree-node-icon-wrap">
    <span v-if="type === 'connection' && dbType" class="conn-icon-wrap">
      <DbTypeIcon :db-type="dbType" :size="DB_TYPE_ICON_SIZE.list"/>
      <span
          v-if="health"
          class="conn-health"
          :class="`conn-health--${health}`"
          :title="health === 'ok' ? 'Connected' : 'Connection failed'"
          aria-hidden="true"
      >
        <DwIcon
            :name="health === 'ok' ? 'submit' : 'close'"
            size="xs"
            :stroke-width="1.7"
            filled
        />
      </span>
    </span>
    <span
        v-else
        class="node-icon"
        :class="[
          `node-icon--${type}`,
          { 'node-icon--special-folder': specialFolder && (type === 'group' || type === 'folder') },
        ]"
        aria-hidden="true"
    >
      <span
          v-if="type === 'load_more' && loading"
          class="node-load-more-spinner"
      />
      <DwIcon
          v-else
          :name="treeIcon"
          :size="(type === 'group' || type === 'folder') ? 20 : 18"
          :stroke-width="1.55"
      />
    </span>

    <span v-if="pinned" class="node-pin-mark" aria-hidden="true">
      <DwIcon name="pin" size="xs" :stroke-width="1.9" filled/>
    </span>
  </span>
</template>

<style scoped>
.tree-node-icon-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.conn-icon-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.conn-health {
  position: absolute;
  right: -1px;
  bottom: -1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border-radius: var(--dw-radius-xs);
  color: var(--dw-on-accent);
  border: 1px solid var(--dw-bg-panel);
  box-shadow: 0 0 0 0.5px color-mix(in srgb, var(--dw-text) 8%, transparent);
}

.conn-health--ok {
  background: var(--dw-success);
}

.conn-health--error {
  background: var(--dw-danger);
}

.node-pin-mark {
  position: absolute;
  top: -2px;
  left: -3px;
  z-index: var(--dw-z-raised);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border-radius: var(--dw-radius-sm);
  color: var(--dw-on-accent);
  background: var(--dw-primary);
  border: 1px solid var(--dw-bg-panel);
  box-shadow: 0 0 0 0.5px color-mix(in srgb, var(--dw-text) 8%, transparent);
  pointer-events: none;
}

.node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 17px;
  height: 17px;
}

.node-icon--group {
  width: 24px;
  height: var(--dw-control-h-xs);
}

.node-icon--database {
  width: 21px;
  height: 21px;
  color: var(--dw-info-fg);
}

.node-icon--database svg {
  width: 19px;
  height: 19px;
}

.node-icon--schema {
  width: 21px;
  height: 21px;
}

.node-icon--folder {
  width: 22px;
  height: var(--dw-control-h-xs);
}

.node-icon--table,
.node-icon--view {
  width: 21px;
  height: 21px;
  color: var(--dw-primary);
}

.node-icon--columns {
  width: 21px;
  height: 21px;
  color: var(--mp-tone-indigo);
}

.node-icon--keys {
  color: var(--mp-tone-amber);
}

.node-icon--indexes {
  color: var(--mp-tone-emerald);
}

.node-icon--column {
  width: 21px;
  height: 21px;
  color: var(--dw-text-muted);
}

.node-icon--primary_key {
  color: var(--mp-tone-amber);
}

.node-icon--sql_file {
  color: var(--dw-link);
}

.node-icon--view_model {
  color: var(--dw-primary);
}

.node-icon--kafka-feature {
  color: var(--mp-tone-emerald);
}

.node-icon--redis-feature,
.node-icon--redis-browser {
  color: var(--dw-danger);
}

.node-icon--load_more {
  color: var(--dw-text-muted);
}

.node-load-more-spinner {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border: 1.5px solid color-mix(in srgb, var(--dw-text-muted) 35%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: node-load-more-spin 0.65s linear infinite;
}

@keyframes node-load-more-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
