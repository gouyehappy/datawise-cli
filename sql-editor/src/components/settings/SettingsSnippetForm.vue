<script setup lang="ts">
import {useSqlEditorI18n} from '@sql-editor/composables/useSqlEditorI18n'

/**
 * 片段编辑表单字段（标签 / 插入内容 / 说明）。
 * 新建与编辑共用，减少 settings 面板重复 markup。
 */
const props = withDefaults(
    defineProps<{
      label: string
      insertText: string
      detail?: string
      showDetail?: boolean
      insertPlaceholder?: string
      insertRows?: number
    }>(),
    {showDetail: true},
)

const emit = defineEmits<{
  'update:label': [value: string]
  'update:insertText': [value: string]
  'update:detail': [value: string]
}>()

const {t} = useSqlEditorI18n()
</script>
