<script setup lang="ts">
export type WizardStepItem = {
    id: string
    label: string
    number: number
}

defineProps<{
    steps: WizardStepItem[]
    activeStep: string
    ariaLabel: string
    isStepAccessible: (id: string) => boolean
    isStepCompleted: (id: string) => boolean
}>()

const emit = defineEmits<{
    'step-click': [id: string]
}>()
</script>

<template>
  <nav class="migration-flow" :aria-label="ariaLabel">
    <button
        v-for="step in steps"
        :key="step.id"
        type="button"
        class="migration-flow__step"
        :class="{
          'is-active': activeStep === step.id,
          'is-complete': isStepCompleted(step.id),
          'is-disabled': !isStepAccessible(step.id) && activeStep !== step.id,
        }"
        :disabled="!isStepAccessible(step.id) && activeStep !== step.id"
        @click="emit('step-click', step.id)"
    >
      <span class="migration-flow__index">{{ step.number }}</span>
      <span class="migration-flow__label">{{ step.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.migration-flow {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
}

.migration-flow__step {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border: 1px solid var(--dw-border-light);
    border-radius: 999px;
    background: var(--dw-bg);
    font-size: 12px;
    transition: border-color 0.12s ease, background 0.12s ease;
}

.migration-flow__step.is-active {
    border-color: var(--dw-primary);
    background: var(--dw-primary-soft);
    color: var(--dw-primary);
}

.migration-flow__step.is-complete:not(.is-active) {
    border-color: color-mix(in srgb, #16a34a 30%, var(--dw-border-light));
    color: #15803d;
}

.migration-flow__step.is-disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.migration-flow__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--dw-bg-muted);
    font-size: 11px;
    font-weight: 700;
}

.migration-flow__label {
    font-weight: 500;
}
</style>
