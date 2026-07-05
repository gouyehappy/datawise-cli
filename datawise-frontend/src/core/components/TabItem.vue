<script setup lang="ts">
import {nextTick, ref, watch} from 'vue'
import TabCloseIcon from '@/core/components/TabCloseIcon.vue'

const props = withDefaults(
    defineProps<{
      tabId: string
      title: string
      active?: boolean
      closable?: boolean
      renamable?: boolean
      renaming?: boolean
      /** 重命名时可编辑的后缀；未提供时使用完整 title */
      renameSuffix?: string
      /** 仅编辑后缀（隐藏 host 等前缀，提交后由外部拼回） */
      renameSuffixOnly?: boolean
      /** SQL 控制台等内容已修改未保存 */
      dirty?: boolean
      setRef?: (el: unknown) => void
    }>(),
    {
      renamable: false,
      renaming: false,
      dirty: false,
    },
)

const emit = defineEmits<{
  select: []
  close: []
  contextmenu: [event: MouseEvent]
  rename: [title: string]
  'cancel-rename': []
  'request-rename': []
}>()

const draft = ref('')
const inputRef = ref<HTMLInputElement>()

watch(
    () => props.renaming,
    async (isRenaming) => {
      if (!isRenaming) return
      draft.value = props.renameSuffix ?? props.title
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    },
)

function commitRename() {
  const next = draft.value.trim()
  const current = (props.renameSuffix ?? props.title).trim()
  if (!next || next === current) {
    emit('cancel-rename')
    return
  }
  emit('rename', next)
}

function onTitleDblClick(event: MouseEvent) {
  if (!props.renamable) return
  event.preventDefault()
  event.stopPropagation()
  emit('request-rename')
}
</script>

<template>
  <button
      :ref="setRef"
      class="dw-tab"
      :class="{ active, 'is-renaming': renaming }"
      :data-tab-id="tabId"
      type="button"
      @click="!renaming && emit('select')"
      @contextmenu="emit('contextmenu', $event)"
  >
    <slot name="leading"/>
    <span
        v-if="!renaming"
        class="dw-tab__title"
        @dblclick="onTitleDblClick"
    >{{ title }}</span>
    <template v-else>
      <input
          ref="inputRef"
          v-model="draft"
          class="dw-tab__rename-input"
          :class="{ 'dw-tab__rename-input--suffix-only': renameSuffixOnly }"
          type="text"
          :aria-label="renameSuffix ?? title"
          @click.stop
          @mousedown.stop
          @keydown.enter.prevent="commitRename"
          @keydown.escape.prevent="emit('cancel-rename')"
          @blur="commitRename"
      />
    </template>
    <span
        v-if="dirty && !renaming"
        class="dw-tab__dirty"
        :title="title"
        aria-hidden="true"
    >●</span>
    <span
        v-if="closable && !renaming"
        class="dw-tab__close"
        role="button"
        tabindex="-1"
        @click.stop="emit('close')"
    >
      <TabCloseIcon/>
    </span>
  </button>
</template>
