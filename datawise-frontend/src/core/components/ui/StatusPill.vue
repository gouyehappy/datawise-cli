<script setup lang="ts">
import {computed} from 'vue'
import {
    resolveStatusVariant,
    statusVariantClass,
    type StatusDomain,
    type StatusVariant,
} from '@/core/utils/status-variant'

const props = withDefaults(defineProps<{
    /** 直接指定视觉变体（优先级高于 status） */
    variant?: StatusVariant | 'team'
    /** 业务状态字符串，配合 domain 解析变体 */
    status?: string | null
    /** 业务域，用于歧义状态映射 */
    domain?: StatusDomain
    /** 摘要芯片样式（略大） */
    chip?: boolean
    /** 行内附加 */
    inline?: boolean
    /** 前置圆点指示器（连接状态等） */
    dot?: boolean
}>(), {
    chip: false,
    inline: false,
    dot: false,
})

const resolvedVariant = computed<StatusVariant | 'team'>(() => {
    if (props.variant) return props.variant
    return resolveStatusVariant(props.status, props.domain)
})

const classList = computed(() => [
    props.chip ? 'dw-status-chip' : 'dw-status',
    statusVariantClass(resolvedVariant.value === 'team' ? 'neutral' : resolvedVariant.value),
    resolvedVariant.value === 'team' ? 'dw-status--team' : '',
    props.inline ? 'dw-status--inline' : '',
    props.dot ? 'dw-status--dot' : '',
].filter(Boolean))
</script>

<template>
  <span :class="classList">
    <span v-if="dot" class="dw-status__dot" aria-hidden="true"/>
    <slot>{{ status }}</slot>
  </span>
</template>
