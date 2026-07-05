<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton, DwSelect, EmptyState} from '@/core/components'
import type {SelectOption} from '@/core/components/select.types'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {
    createDefaultDashboardPreferences,
    reorderWidgetInColumn,
    replaceDashboardWidgets,
    setWidgetColumn,
    setWidgetVisibility,
    widgetsForColumn,
    type DashboardPreferences,
    type DashboardWidgetColumn,
    type DashboardWidgetConfig,
    type DashboardWidgetId,
} from '@/features/dashboard/services/dashboard-widget.service'

const props = defineProps<{
    open: boolean
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
}>()

const {t} = useI18n()
const appConfig = useAppConfigStore()

const draft = ref<DashboardPreferences>(createDefaultDashboardPreferences())
const dragColumn = ref<DashboardWidgetColumn | null>(null)
const dragIndex = ref<number | null>(null)

const columns: DashboardWidgetColumn[] = ['left', 'main', 'right']

const columnOptions = computed<SelectOption[]>(() =>
    columns.map((col) => ({
      value: col,
      label: t(`dashboard.layoutDialog.columns.${col}`),
    })),
)

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return
        draft.value = {
            widgets: appConfig.dashboardPreferences.widgets.map((widget: DashboardWidgetConfig) => ({...widget})),
        }
    },
    {immediate: true},
)

function close() {
    emit('update:open', false)
}

function save() {
    appConfig.patchDashboardPreferences(replaceDashboardWidgets(draft.value.widgets))
    close()
}

function resetDefaults() {
    draft.value = createDefaultDashboardPreferences()
}

function columnWidgets(column: DashboardWidgetColumn): DashboardWidgetConfig[] {
    return widgetsForColumn(draft.value, column)
}

function allColumnWidgets(column: DashboardWidgetColumn): DashboardWidgetConfig[] {
    return draft.value.widgets.filter((widget) => widget.column === column)
}

function widgetLabel(id: DashboardWidgetId): string {
    return t(`dashboard.widgets.${id}`)
}

function toggleVisible(id: DashboardWidgetId, visible: boolean) {
    draft.value = setWidgetVisibility(draft.value, id, visible)
}

function onColumnChange(id: DashboardWidgetId, column: DashboardWidgetColumn) {
    draft.value = setWidgetColumn(draft.value, id, column)
}

function onDragStart(column: DashboardWidgetColumn, index: number) {
    dragColumn.value = column
    dragIndex.value = index
}

function onDrop(column: DashboardWidgetColumn, index: number) {
    if (dragColumn.value !== column || dragIndex.value == null) return
    draft.value = reorderWidgetInColumn(draft.value, column, dragIndex.value, index)
    dragColumn.value = null
    dragIndex.value = null
}

function onDragEnd() {
    dragColumn.value = null
    dragIndex.value = null
}

const hasHiddenWidgets = computed(() => draft.value.widgets.some((widget) => !widget.visible))
</script>

<template>
  <AppModal
      :open="open"
      :title="t('dashboard.layoutDialog.title')"
      :subtitle="t('dashboard.layoutDialog.subtitle')"
      width="560px"
      @close="close"
  >
    <div class="modal-sort-editor">
      <p v-if="hasHiddenWidgets" class="modal-body-hint">
        {{ t('dashboard.layoutDialog.hiddenHint') }}
      </p>

      <section
          v-for="column in columns"
          :key="column"
          class="modal-sort-section"
      >
        <h3 class="modal-sort-section__title">
          {{ t(`dashboard.layoutDialog.columns.${column}`) }}
        </h3>
        <EmptyState
            v-if="!columnWidgets(column).length"
            embedded
            compact
            :title="t('dashboard.layoutDialog.emptyColumn')"
        />
        <ul class="modal-sort-list">
          <li
              v-for="(widget, index) in allColumnWidgets(column)"
              :key="widget.id"
              class="modal-sort-item"
              :class="{
                'is-hidden': !widget.visible,
                'is-dragging': dragColumn === column && dragIndex === index,
              }"
              draggable="true"
              @dragstart="onDragStart(column, index)"
              @dragover.prevent
              @drop="onDrop(column, index)"
              @dragend="onDragEnd"
          >
            <span class="modal-sort-item__handle" aria-hidden="true">⋮⋮</span>
            <label class="modal-sort-item__label">
              <input
                  type="checkbox"
                  :checked="widget.visible"
                  @change="toggleVisible(widget.id, ($event.target as HTMLInputElement).checked)"
              >
              <span>{{ widgetLabel(widget.id) }}</span>
            </label>
            <DwSelect
                :model-value="widget.column"
                size="sm"
                :options="columnOptions"
                @update:model-value="onColumnChange(widget.id, $event as DashboardWidgetColumn)"
            />
          </li>
        </ul>
      </section>
    </div>

    <template #footer>
      <DwButton variant="ghost" type="button" @click="resetDefaults">
        {{ t('dashboard.layoutDialog.reset') }}
      </DwButton>
      <DwButton variant="secondary" type="button" @click="close">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton variant="primary" type="button" @click="save">
        {{ t('common.save') }}
      </DwButton>
    </template>
  </AppModal>
</template>
