<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'

defineProps<{
  testing: boolean
  saving: boolean
  saveDisabled?: boolean
  testMessage: string | null
  testOk: boolean | null
}>()

const emit = defineEmits<{
  test: []
  cancel: []
  save: []
}>()

const {t} = useI18n()
</script>

<template>
  <footer class="conn-footer">
    <div class="conn-footer__left">
      <DwButton
          variant="secondary"
          class="btn-test"
          :disabled="testing || saving"
          :loading="testing"
          @click="emit('test')"
      >
        {{ testing ? t('connection.testing') : t('connection.test') }}
      </DwButton>
      <p
          v-if="testMessage"
          class="test-result"
          :class="{ ok: testOk, fail: testOk === false }"
      >
        {{ testMessage }}
      </p>
    </div>
    <div class="conn-footer__right">
      <DwButton variant="secondary" :disabled="saving" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton
          variant="primary"
          :loading="saving"
          :disabled="saving || saveDisabled"
          :title="saveDisabled ? t('auth.permissionDenied') : undefined"
          @click="emit('save')"
      >
        {{ saving ? t('common.saving') : t('common.save') }}
      </DwButton>
    </div>
  </footer>
</template>

<style scoped>
.conn-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
  flex-shrink: 0;
  padding: var(--dw-space-6) var(--dw-space-10) var(--dw-space-7);
  border-top: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
}

.conn-footer__left {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  min-width: 0;
  flex: 1;
}

.conn-footer__right {
  display: flex;
  gap: var(--dw-gap);
  flex-shrink: 0;
}

.test-result {
  margin: 0;
  padding: var(--dw-space-2) var(--dw-space-4);
  border-radius: var(--dw-control-radius-sm);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading-snug);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.test-result.ok {
  background: color-mix(in srgb, var(--dw-success) 12%, var(--dw-bg));
  color: var(--dw-success);
}

.test-result.fail {
  background: color-mix(in srgb, var(--dw-danger) 12%, var(--dw-bg));
  color: var(--dw-danger);
}
</style>
