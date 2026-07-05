<script setup lang="ts">
import {computed, ref} from 'vue'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {DwIcon} from '@/core/icons'
import {EXPLORER_ICONS} from '@/features/explorer/constants/icons'

export interface TabOverflowItem {
  id: string
  label: string
}

const props = withDefaults(
    defineProps<{
      open: boolean
      visible: boolean
      items: TabOverflowItem[]
      activeId: string | null
      title: string
      searchPlaceholder?: string
      searchable?: boolean
    }>(),
    {searchable: true},
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [id: string]
}>()

const icons = EXPLORER_ICONS
const rootRef = ref<HTMLElement>()
const search = ref('')

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.items
  return props.items.filter((item) => item.label.toLowerCase().includes(q))
})

usePopoverEscape(() => props.open, () => emit('update:open', false))

function toggle() {
  emit('update:open', !props.open)
}

function select(id: string) {
  emit('select', id)
  emit('update:open', false)
  search.value = ''
}
</script>

<template>
  <div
      ref="rootRef"
      class="dw-tab-overflow"
      :class="{ 'dw-tab-overflow--visible': visible }"
  >
    <button
        class="dw-tab-overflow__btn"
        :title="title"
        type="button"
        @click="toggle"
    >
      <DwIcon :name="icons.menuArrow" size="xs"/>
    </button>
    <div v-if="open" class="dw-tab-overflow__menu">
      <input
          v-if="searchable"
          v-model="search"
          class="dw-tab-overflow__search"
          :placeholder="searchPlaceholder"
      />
      <button
          v-for="item in filteredItems"
          :key="item.id"
          class="dw-menu-item dw-tab-overflow__item"
          :class="{ 'is-active': activeId === item.id }"
          type="button"
          @click="select(item.id)"
      >
        {{ item.label }}
      </button>
    </div>
  </div>
</template>
