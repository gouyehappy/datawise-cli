<script setup lang="ts">
import {computed, onMounted, reactive, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, DwCheckbox, DwInput, DwSecretInput, DwSelect, FormField} from '@/core/components'
import type {SelectOption} from '@/core/components'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import SettingsSectionCard from '@/features/settings/components/SettingsSectionCard.vue'
import {platformApi} from '@/api'
import {authApi} from '@/api'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {resolveDisplayApiErrorMessage} from '@/shared/api/http/api-error-message'
import type {OutboundWebhook, OidcConfig} from '@/shared/api/types'

const {t} = useI18n()
const auth = useAuthStore()
const toast = useAppToast()

function apiErrorMessage(error: unknown, fallbackKey: string) {
  return resolveDisplayApiErrorMessage(error, (key) => String(t(key))) || t(fallbackKey)
}

function eventTypeLabel(type: string) {
  const key = `settings.integrations.events.${type.replace(/\./g, '_')}`
  const label = t(key)
  return label === key ? type : label
}

const EVENT_OPTIONS = [
  'scheduled_task.ok',
  'scheduled_task.failed',
  'insight.digest',
  'insight.action',
  'data_quality.ok',
  'data_quality.failed',
  'orchestration.triggered',
  'orchestration.failed',
  'prod.approval.pending',
  'prod.approval.decided',
  'schema_drift.detected',
  'schema_drift.clean',
  'audit.appended',
  'outbound.test',
] as const

const hooks = ref<OutboundWebhook[]>([])
const loading = ref(false)
const saving = ref(false)
const form = reactive({
  id: '' as string,
  name: '',
  channel: 'webhook',
  url: '',
  secret: '',
  enabled: true,
  includeSql: false,
  timeoutMs: 5000,
  eventTypes: [] as string[],
})

const channelOptions = computed<SelectOption[]>(() => [
  {value: 'webhook', label: t('settings.integrations.channel.webhook')},
  {value: 'feishu', label: t('settings.integrations.channel.feishu')},
  {value: 'dingtalk', label: t('settings.integrations.channel.dingtalk')},
  {value: 'email', label: t('settings.integrations.channel.email')},
  {value: 'github_issue', label: t('settings.integrations.channel.github_issue')},
  {value: 'gitlab_issue', label: t('settings.integrations.channel.gitlab_issue')},
  {value: 'jira_issue', label: t('settings.integrations.channel.jira_issue')},
])

function channelLabel(channel: string | undefined) {
  const key = `settings.integrations.channel.${channel || 'webhook'}`
  const label = t(key)
  return label === key ? (channel || 'webhook') : label
}

function urlPlaceholder() {
  switch (form.channel) {
    case 'feishu':
      return 'https://open.feishu.cn/open-apis/bot/v2/hook/…'
    case 'dingtalk':
      return 'https://oapi.dingtalk.com/robot/send?access_token=…'
    case 'email':
      return 'mailto:ops@example.com  or  https://mail-gateway/send'
    case 'github_issue':
      return 'https://api.github.com/repos/{owner}/{repo}/issues'
    case 'gitlab_issue':
      return 'https://gitlab.example/api/v4/projects/{id}/issues'
    case 'jira_issue':
      return 'https://your-domain.atlassian.net/rest/api/3/issue?project=KEY'
    default:
      return 'https://example.com/hooks/datawise'
  }
}

function secretPlaceholder() {
  switch (form.channel) {
    case 'github_issue':
    case 'gitlab_issue':
    case 'jira_issue':
      return t('settings.integrations.issueTokenPlaceholder')
    case 'feishu':
    case 'dingtalk':
      return t('settings.integrations.botSecretPlaceholder')
    case 'email':
      return t('settings.integrations.emailSecretPlaceholder')
    default:
      return t('settings.integrations.secretPlaceholder')
  }
}

const oidc = reactive({
  enabled: false,
  issuer: '',
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  frontendRedirectBase: '',
  scopes: 'openid profile email',
  localLoginEnabled: true,
  hasClientSecret: false,
  tenantClaim: 'org_id',
  tenantClaimMapText: '',
  defaultOidcRoleKey: 'developer',
  autoProvisionMembership: true,
  roleClaim: 'groups',
  roleClaimMapText: '',
  syncRolesFromClaim: false,
  deprovisionMissingRoleClaim: false,
})
const oidcSaving = ref(false)

function parseClaimMap(text: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (key && value) map[key] = value
  }
  return map
}

function formatClaimMap(map?: Record<string, string> | null): string {
  if (!map) return ''
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('\n')
}

async function reloadHooks() {
  loading.value = true
  try {
    hooks.value = await platformApi.listOutboundWebhooks()
  } catch (error) {
    toast.error(apiErrorMessage(error, 'settings.integrations.loadFailed'))
  } finally {
    loading.value = false
  }
}

async function reloadOidc() {
  if (!auth.isAdmin) return
  try {
    const config: OidcConfig = await authApi.getOidcConfig()
    oidc.enabled = config.enabled
    oidc.issuer = config.issuer || ''
    oidc.clientId = config.clientId || ''
    oidc.redirectUri = config.redirectUri || ''
    oidc.frontendRedirectBase = config.frontendRedirectBase || ''
    oidc.scopes = config.scopes || 'openid profile email'
    oidc.localLoginEnabled = config.localLoginEnabled
    oidc.hasClientSecret = config.hasClientSecret
    oidc.clientSecret = ''
    oidc.tenantClaim = config.tenantClaim || 'org_id'
    oidc.tenantClaimMapText = formatClaimMap(config.tenantClaimMap)
    oidc.defaultOidcRoleKey = config.defaultOidcRoleKey || 'developer'
    oidc.autoProvisionMembership = config.autoProvisionMembership !== false
    oidc.roleClaim = config.roleClaim || 'groups'
    oidc.roleClaimMapText = formatClaimMap(config.roleClaimMap)
    oidc.syncRolesFromClaim = Boolean(config.syncRolesFromClaim)
    oidc.deprovisionMissingRoleClaim = Boolean(config.deprovisionMissingRoleClaim)
  } catch {
    // optional for non-admin
  }
}

function resetForm() {
  form.id = ''
  form.name = ''
  form.channel = 'webhook'
  form.url = ''
  form.secret = ''
  form.enabled = true
  form.includeSql = false
  form.timeoutMs = 5000
  form.eventTypes = []
}

function editHook(hook: OutboundWebhook) {
  form.id = hook.id
  form.name = hook.name
  form.channel = hook.channel || 'webhook'
  form.url = hook.url
  form.secret = ''
  form.enabled = hook.enabled
  form.includeSql = hook.includeSql
  form.timeoutMs = hook.timeoutMs
  form.eventTypes = [...(hook.eventTypes || [])]
}

function toggleEvent(type: string, checked: boolean) {
  if (checked) {
    if (!form.eventTypes.includes(type)) form.eventTypes.push(type)
  } else {
    form.eventTypes = form.eventTypes.filter((item) => item !== type)
  }
}

async function saveHook() {
  if (!form.name.trim() || !form.url.trim()) {
    toast.error(t('settings.integrations.webhookRequired'))
    return
  }
  saving.value = true
  try {
    await platformApi.saveOutboundWebhook({
      id: form.id || undefined,
      name: form.name.trim(),
      channel: form.channel,
      url: form.url.trim(),
      secret: form.secret,
      enabled: form.enabled,
      includeSql: form.includeSql,
      timeoutMs: form.timeoutMs,
      eventTypes: form.eventTypes,
    })
    toast.success(t('settings.integrations.webhookSaved'))
    resetForm()
    await reloadHooks()
  } catch (error) {
    toast.error(apiErrorMessage(error, 'settings.integrations.saveFailed'))
  } finally {
    saving.value = false
  }
}

async function removeHook(id: string) {
  try {
    await platformApi.deleteOutboundWebhook(id)
    toast.success(t('settings.integrations.webhookDeleted'))
    if (form.id === id) resetForm()
    await reloadHooks()
  } catch (error) {
    toast.error(apiErrorMessage(error, 'settings.integrations.saveFailed'))
  }
}

async function testHook(id: string) {
  try {
    const result = await platformApi.testOutboundWebhook(id)
    if (result.ok) toast.success(t('settings.integrations.testOk', {code: result.statusCode}))
    else toast.error(t('settings.integrations.testFailed', {msg: result.message}))
  } catch (error) {
    toast.error(apiErrorMessage(error, 'settings.integrations.saveFailed'))
  }
}

async function saveOidc() {
  oidcSaving.value = true
  try {
    const saved = await authApi.updateOidcConfig({
      enabled: oidc.enabled,
      issuer: oidc.issuer,
      clientId: oidc.clientId,
      clientSecret: oidc.clientSecret || undefined,
      redirectUri: oidc.redirectUri,
      frontendRedirectBase: oidc.frontendRedirectBase,
      scopes: oidc.scopes,
      localLoginEnabled: oidc.localLoginEnabled,
      tenantClaim: oidc.tenantClaim,
      tenantClaimMap: parseClaimMap(oidc.tenantClaimMapText),
      defaultOidcRoleKey: oidc.defaultOidcRoleKey,
      autoProvisionMembership: oidc.autoProvisionMembership,
      roleClaim: oidc.roleClaim,
      roleClaimMap: parseClaimMap(oidc.roleClaimMapText),
      syncRolesFromClaim: oidc.syncRolesFromClaim,
      deprovisionMissingRoleClaim: oidc.deprovisionMissingRoleClaim,
    })
    oidc.hasClientSecret = saved.hasClientSecret
    oidc.clientSecret = ''
    oidc.tenantClaim = saved.tenantClaim || 'org_id'
    oidc.tenantClaimMapText = formatClaimMap(saved.tenantClaimMap)
    oidc.defaultOidcRoleKey = saved.defaultOidcRoleKey || 'developer'
    oidc.autoProvisionMembership = saved.autoProvisionMembership !== false
    oidc.roleClaim = saved.roleClaim || 'groups'
    oidc.roleClaimMapText = formatClaimMap(saved.roleClaimMap)
    oidc.syncRolesFromClaim = Boolean(saved.syncRolesFromClaim)
    oidc.deprovisionMissingRoleClaim = Boolean(saved.deprovisionMissingRoleClaim)
    toast.success(t('settings.integrations.oidcSaved'))
  } catch (error) {
    toast.error(apiErrorMessage(error, 'settings.integrations.saveFailed'))
  } finally {
    oidcSaving.value = false
  }
}

onMounted(async () => {
  await Promise.all([reloadHooks(), reloadOidc()])
})
</script>

<template>
  <SettingsPageShell
      :title="t('settings.integrations.title')"
      :subtitle="t('settings.integrations.subtitle')"
  >
    <SettingsSectionCard :title="t('settings.integrations.webhookTitle')">
      <p class="hint">{{ t('settings.integrations.webhookHint') }}</p>
      <p v-if="!auth.isAdmin" class="hint">{{ t('settings.integrations.webhookAdminOnly') }}</p>
      <template v-if="auth.isAdmin">
        <div class="form-grid">
          <FormField :label="t('settings.integrations.name')">
            <DwInput v-model="form.name"/>
          </FormField>
          <FormField :label="t('settings.integrations.channelLabel')">
            <DwSelect v-model="form.channel" size="sm" :options="channelOptions"/>
          </FormField>
          <FormField :label="t('settings.integrations.url')">
            <DwInput v-model="form.url" :placeholder="urlPlaceholder()"/>
          </FormField>
          <FormField :label="t('settings.integrations.secret')">
            <DwSecretInput
                v-model="form.secret"
                :placeholder="secretPlaceholder()"
            />
          </FormField>
          <FormField :label="t('settings.integrations.timeoutMs')">
            <DwInput v-model.number="form.timeoutMs" type="number"/>
          </FormField>
        </div>
        <p class="hint">{{ t(`settings.integrations.channelHint.${form.channel}`) }}</p>
        <div class="checks">
          <DwCheckbox v-model="form.enabled" :label="t('settings.integrations.enabled')"/>
          <DwCheckbox v-model="form.includeSql" :label="t('settings.integrations.includeSql')"/>
        </div>
        <div class="events">
          <div class="events-title">{{ t('settings.integrations.eventTypes') }}</div>
          <label v-for="type in EVENT_OPTIONS" :key="type" class="event-item">
            <input
                type="checkbox"
                :checked="form.eventTypes.includes(type)"
                @change="toggleEvent(type, ($event.target as HTMLInputElement).checked)"
            >
            <span>{{ eventTypeLabel(type) }}</span>
          </label>
        </div>
        <div class="actions">
          <DwButton variant="primary" size="sm" :disabled="saving" @click="saveHook">
            {{ form.id ? t('settings.integrations.update') : t('settings.integrations.create') }}
          </DwButton>
          <DwButton v-if="form.id" variant="secondary" size="sm" @click="resetForm">
            {{ t('settings.integrations.reset') }}
          </DwButton>
        </div>
      </template>

      <div v-if="loading" class="hint">{{ t('settings.integrations.loading') }}</div>
      <ul v-else class="hook-list">
        <li v-for="hook in hooks" :key="hook.id" class="hook-item">
          <div>
            <strong>{{ hook.name }}</strong>
            <div class="meta">{{ channelLabel(hook.channel) }} · {{ hook.url }}</div>
            <div v-if="hook.lastError" class="error">{{ hook.lastError }}</div>
          </div>
          <div v-if="auth.isAdmin" class="hook-actions">
            <DwButton variant="secondary" size="sm" @click="editHook(hook)">{{ t('settings.integrations.edit') }}</DwButton>
            <DwButton variant="secondary" size="sm" @click="testHook(hook.id)">{{ t('settings.integrations.test') }}</DwButton>
            <DwButton variant="danger" size="sm" @click="removeHook(hook.id)">{{ t('settings.integrations.delete') }}</DwButton>
          </div>
        </li>
        <li v-if="!hooks.length" class="hint">{{ t('settings.integrations.empty') }}</li>
      </ul>
    </SettingsSectionCard>

    <SettingsSectionCard v-if="auth.isAdmin" :title="t('settings.integrations.oidcTitle')">
      <p class="hint">{{ t('settings.integrations.oidcHint') }}</p>
      <div class="checks">
        <DwCheckbox v-model="oidc.enabled" :label="t('settings.integrations.oidcEnabled')"/>
        <DwCheckbox v-model="oidc.localLoginEnabled" :label="t('settings.integrations.localLoginEnabled')"/>
      </div>
      <div class="form-grid">
        <FormField :label="t('settings.integrations.issuer')">
          <DwInput v-model="oidc.issuer" placeholder="https://idp.example.com/realms/datawise"/>
        </FormField>
        <FormField :label="t('settings.integrations.clientId')">
          <DwInput v-model="oidc.clientId"/>
        </FormField>
        <FormField :label="t('settings.integrations.clientSecret')">
          <DwSecretInput
              v-model="oidc.clientSecret"
              :placeholder="oidc.hasClientSecret ? t('settings.integrations.secretKeep') : ''"
          />
        </FormField>
        <FormField :label="t('settings.integrations.redirectUri')">
          <DwInput v-model="oidc.redirectUri" placeholder="http://localhost:18421/api/auth/oidc/callback"/>
        </FormField>
        <FormField :label="t('settings.integrations.frontendRedirectBase')">
          <DwInput v-model="oidc.frontendRedirectBase" placeholder="http://localhost:28413"/>
        </FormField>
        <FormField :label="t('settings.integrations.scopes')">
          <DwInput v-model="oidc.scopes"/>
        </FormField>
        <FormField :label="t('settings.integrations.tenantClaim')">
          <DwInput v-model="oidc.tenantClaim" placeholder="org_id"/>
        </FormField>
        <FormField :label="t('settings.integrations.defaultOidcRoleKey')">
          <DwInput v-model="oidc.defaultOidcRoleKey" placeholder="developer"/>
        </FormField>
      </div>
      <FormField :label="t('settings.integrations.tenantClaimMap')">
        <textarea
            v-model="oidc.tenantClaimMapText"
            class="claim-map"
            rows="4"
            :placeholder="t('settings.integrations.tenantClaimMapPlaceholder')"
        />
      </FormField>
      <div class="form-grid">
        <FormField :label="t('settings.integrations.roleClaim')">
          <DwInput v-model="oidc.roleClaim" placeholder="groups"/>
        </FormField>
      </div>
      <FormField :label="t('settings.integrations.roleClaimMap')">
        <textarea
            v-model="oidc.roleClaimMapText"
            class="claim-map"
            rows="4"
            :placeholder="t('settings.integrations.roleClaimMapPlaceholder')"
        />
      </FormField>
      <p class="hint">{{ t('settings.integrations.directorySyncHint') }}</p>
      <div class="checks">
        <DwCheckbox
            v-model="oidc.autoProvisionMembership"
            :label="t('settings.integrations.autoProvisionMembership')"
        />
        <DwCheckbox
            v-model="oidc.syncRolesFromClaim"
            :label="t('settings.integrations.syncRolesFromClaim')"
        />
        <DwCheckbox
            v-model="oidc.deprovisionMissingRoleClaim"
            :label="t('settings.integrations.deprovisionMissingRoleClaim')"
            :disabled="!oidc.syncRolesFromClaim"
        />
      </div>
      <DwButton variant="primary" size="sm" :disabled="oidcSaving" @click="saveOidc">
        {{ t('settings.integrations.saveOidc') }}
      </DwButton>
    </SettingsSectionCard>
  </SettingsPageShell>
</template>

<style scoped>
.hint {
  color: var(--dw-text-muted);
  font-size: 12px;
  margin: 0 0 12px;
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.checks, .actions, .hook-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin: 12px 0;
}
.events {
  margin: 8px 0 12px;
}
.events-title {
  font-size: 12px;
  margin-bottom: 6px;
}
.event-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 6px 0;
  font-size: 12px;
}
.hook-list {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
}
.hook-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-top: 1px solid var(--dw-border-subtle);
}
.meta {
  font-size: 12px;
  color: var(--dw-text-muted);
  word-break: break-all;
}
.error {
  color: var(--dw-danger);
  font-size: 12px;
}
@media (max-width: 900px) {
  .form-grid { grid-template-columns: 1fr; }
  .hook-item { flex-direction: column; }
}
.claim-map {
  width: 100%;
  min-height: 88px;
  padding: 8px 10px;
  border: 1px solid var(--dw-border-subtle);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg);
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  resize: vertical;
}
</style>
