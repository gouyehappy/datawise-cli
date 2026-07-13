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
  gap: 12px;
  flex-shrink: 0;
  padding: 12px 24px 14px;
  border-top: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
}

.conn-footer__left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.conn-footer__right {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.test-result {
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.test-result.ok {
  background: color-mix(in srgb, #16a34a 12%, var(--dw-bg));
  color: #16a34a;
}

.test-result.fail {
  background: color-mix(in srgb, #dc2626 12%, var(--dw-bg));
  color: #dc2626;
}
</style>
