<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {
    resolveConnectionEnvBadgeTone,
    resolveConnectionEnvTreeLabel,
} from '@/features/connection/services/connection-environment.service'

const props = defineProps<{
    env?: string | null
    envCustom?: string | null
}>()

const {t} = useI18n()

const tone = computed(() => resolveConnectionEnvBadgeTone(props.env, props.envCustom))
const label = computed(() => resolveConnectionEnvTreeLabel(props.env, props.envCustom, t))
</script>

<template>
  <span
      class="conn-env-badge"
      :class="`conn-env-badge--${tone}`"
      :title="label"
  >
    {{ label }}
  </span>
</template>

<style scoped>
.conn-env-badge {
    flex-shrink: 0;
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 30px;
    height: 18px;
    padding: 0 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    font-size: 10px;
    font-weight: 600;
    line-height: 1;
    letter-spacing: 0.04em;
    white-space: nowrap;
}

.conn-env-badge--prod {
    background: color-mix(in srgb, #dc2626 10%, var(--dw-bg));
    color: #b91c1c;
    border-color: color-mix(in srgb, #dc2626 24%, transparent);
}

.conn-env-badge--staging {
    background: color-mix(in srgb, #d97706 10%, var(--dw-bg));
    color: #b45309;
    border-color: color-mix(in srgb, #d97706 24%, transparent);
}

.conn-env-badge--dev {
    background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg));
    color: var(--dw-primary);
    border-color: color-mix(in srgb, var(--dw-primary) 24%, transparent);
}

.conn-env-badge--custom {
    background: color-mix(in srgb, #64748b 8%, var(--dw-bg));
    color: var(--dw-text-secondary);
    border-color: color-mix(in srgb, var(--dw-border) 90%, transparent);
}
</style>
