<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, FormField, ModalActions} from '@/core/components'
import {
    DEFAULT_BOOKMARK_FOLDER,
    formatBookmarkTags,
    parseBookmarkTags,
} from '@/features/workspace/services/query-bookmark.service'

const props = defineProps<{
    open: boolean
    defaultName?: string
    defaultConnectionName?: string
    defaultSql?: string
    defaultFolder?: string
    defaultTags?: string[]
    saving?: boolean
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
    save: [payload: { name: string; connectionName: string; sql: string; folder: string; tags: string[] }]
}>()

const {t} = useI18n()

const name = ref('')
const connectionName = ref('')
const folder = ref(DEFAULT_BOOKMARK_FOLDER)
const tagsText = ref('')

const canSave = computed(() => name.value.trim().length > 0 && (props.defaultSql?.trim().length ?? 0) > 0)

watch(
    () => props.open,
    (open) => {
        if (!open) return
        name.value = props.defaultName?.trim() || ''
        connectionName.value = props.defaultConnectionName?.trim() || ''
        folder.value = props.defaultFolder?.trim() || DEFAULT_BOOKMARK_FOLDER
        tagsText.value = formatBookmarkTags(props.defaultTags ?? [])
    },
    {immediate: true},
)

function close() {
    emit('update:open', false)
}

function submit() {
    if (!canSave.value || !props.defaultSql?.trim()) return
    emit('save', {
        name: name.value.trim(),
        connectionName: connectionName.value.trim(),
        sql: props.defaultSql,
        folder: folder.value.trim() || DEFAULT_BOOKMARK_FOLDER,
        tags: parseBookmarkTags(tagsText.value),
    })
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('shortcut.bookmarks.saveTitle')"
      width="440px"
      @close="close"
  >
    <form class="modal-form" @submit.prevent="submit">
      <FormField :label="t('shortcut.bookmarks.fields.name')" input-id="bookmark-save-name">
        <template #default="{ id }">
          <input :id="id" v-model="name" class="dw-input" type="text" required />
        </template>
      </FormField>

      <FormField :label="t('shortcut.bookmarks.fields.connection')" input-id="bookmark-save-connection">
        <template #default="{ id }">
          <input
              :id="id"
              v-model="connectionName"
              class="dw-input"
              type="text"
              :placeholder="t('shortcut.bookmarks.fields.connectionPlaceholder')"
          />
        </template>
      </FormField>

      <FormField :label="t('shortcut.bookmarks.fields.folder')" input-id="bookmark-save-folder">
        <template #default="{ id }">
          <input :id="id" v-model="folder" class="dw-input" type="text" />
        </template>
      </FormField>

      <FormField :label="t('shortcut.bookmarks.fields.tags')" input-id="bookmark-save-tags">
        <template #default="{ id }">
          <input
              :id="id"
              v-model="tagsText"
              class="dw-input"
              type="text"
              :placeholder="t('shortcut.bookmarks.fields.tagsPlaceholder')"
          />
        </template>
      </FormField>
    </form>

    <template #footer>
      <ModalActions
          :confirm-disabled="!canSave || saving"
          :confirm-loading="saving"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>
