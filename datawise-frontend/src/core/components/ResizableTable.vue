<script setup lang="ts">
import {computed} from 'vue'
import {
    useResizableColumns,
    type ResizableColumnDef,
} from '@/core/composables/useResizableColumns'

const props = withDefaults(
    defineProps<{
        columns: ResizableColumnDef[]
        storageKey?: string
        tableClass?: string
    }>(),
    {tableClass: ''},
)

const {widths, startResize} = useResizableColumns(props.columns, props.storageKey)

const tableMinWidth = computed(() =>
    props.columns.reduce((sum, column, index) => sum + (widths.value[index] ?? column.defaultWidth), 0),
)
</script>

<template>
  <div class="resizable-table-wrap">
    <table
        class="resizable-table"
        :class="tableClass"
        :style="{ minWidth: `${tableMinWidth}px` }"
    >
      <colgroup>
        <col
            v-for="(column, index) in columns"
            :key="column.key"
            :style="{ width: `${widths[index]}px` }"
        />
      </colgroup>
      <thead>
        <tr>
          <th
              v-for="(column, index) in columns"
              :key="column.key"
              :data-col="column.key"
          >
            <span class="resizable-table__label">{{ column.label }}</span>
            <span
                class="resizable-table__resize"
                :title="'拖动调整列宽'"
                @pointerdown="startResize(index, $event)"
            />
          </th>
        </tr>
      </thead>
      <tbody>
        <slot/>
      </tbody>
    </table>
  </div>
</template>
