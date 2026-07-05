<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {authApi} from '@/api'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useToastStore} from '@/features/layout/stores/toast-store'
import ProfileEditDialog from '@/features/settings/components/ProfileEditDialog.vue'
import ChangePasswordDialog from '@/features/settings/components/ChangePasswordDialog.vue'

const {t} = useI18n()
const layout = useLayoutStore()
const auth = useAuthStore()
const toast = useToastStore()
const showEditDialog = ref(false)
const showPasswordDialog = ref(false)
const sessionTtlMinutes = ref(60)
const sessionSlidingRenewal = ref(true)
const savingSessionPolicy = ref(false)

onMounted(async () => {
  if (auth.isGuest) return
  try {
    const policy = await authApi.getSessionPolicy()
    sessionTtlMinutes.value = policy.ttlMinutes
    sessionSlidingRenewal.value = policy.slidingRenewal
  } catch {
    // 后端不可达时保留默认值
  }
})

function editProfile() {
  showEditDialog.value = true
}

function saveProfile(payload: { name: string; email: string }) {
  layout.updateProfile(payload.name, payload.email)
}

function changePassword() {
  showPasswordDialog.value = true
}

function onPasswordChanged() {
  layout.showToast(t('profile.changePasswordSuccess'))
}

async function saveSessionPolicy() {
  if (auth.isGuest || savingSessionPolicy.value) return
  savingSessionPolicy.value = true
  try {
    const policy = await authApi.updateSessionPolicy({
      ttlMinutes: sessionTtlMinutes.value,
      slidingRenewal: sessionSlidingRenewal.value,
    })
    sessionTtlMinutes.value = policy.ttlMinutes
    sessionSlidingRenewal.value = policy.slidingRenewal
    toast.show(t('settings.profile.sessionPolicySaved'))
  } catch (err) {
    const message = err instanceof Error ? err.message : t('settings.profile.sessionPolicySaveFailed')
    toast.show(message)
  } finally {
    savingSessionPolicy.value = false
  }
}
</script>

<template>
  <div class="profile-settings">
    <header class="panel-head">
      <h2>{{ t('settings.profile.title') }}</h2>
      <p>{{ t('settings.profile.subtitle') }}</p>
    </header>

    <div class="profile-card">
      <div class="avatar">{{ layout.profileName.charAt(0) }}</div>
      <div class="info">
        <div class="name">{{ layout.profileName }}</div>
        <div class="email">{{ layout.profileEmail }}</div>
      </div>
    </div>

    <div class="actions">
      <button class="action-btn" type="button" @click="editProfile">{{ t('profile.editProfile') }}</button>
      <button v-if="!auth.isGuest" class="action-btn" type="button" @click="changePassword">{{ t('profile.changePassword') }}</button>
    </div>

    <section v-if="!auth.isGuest" class="setting-block session-policy">
      <h3>{{ t('settings.profile.sessionPolicyTitle') }}</h3>
      <p class="session-policy__hint hint">{{ t('settings.profile.sessionPolicyHint') }}</p>
      <label class="session-policy__field">
        <span>{{ t('settings.profile.sessionTtlMinutes') }}</span>
        <input
            v-model.number="sessionTtlMinutes"
            class="dw-input"
            type="number"
            min="5"
            max="1440"
            step="5"
        />
      </label>
      <label class="session-policy__checkbox">
        <input v-model="sessionSlidingRenewal" type="checkbox"/>
        <span>{{ t('settings.profile.sessionSlidingRenewal') }}</span>
      </label>
      <button
          class="action-btn"
          type="button"
          :disabled="savingSessionPolicy"
          @click="saveSessionPolicy"
      >
        {{ savingSessionPolicy ? '…' : t('settings.profile.sessionPolicySave') }}
      </button>
    </section>

    <ProfileEditDialog
        v-model:open="showEditDialog"
        :name="layout.profileName"
        :email="layout.profileEmail"
        @save="saveProfile"
    />
    <ChangePasswordDialog
        v-model:open="showPasswordDialog"
        @success="onPasswordChanged"
    />
  </div>
</template>

<style scoped>
.profile-settings {
  max-width: clamp(480px, 52vw, 520px);
}
</style>
