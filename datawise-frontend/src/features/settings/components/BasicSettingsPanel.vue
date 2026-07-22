<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {currentLocale, setLocale, type AppLocale} from '@/i18n'
import {
    PRIMARY_PRESETS,
    type PrimaryTone,
    type ThemeAppearance,
} from '@/features/settings/constants/theme-presets'
import {UI_SKIN_DEFINITIONS} from '@/core/ui-skin'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import ThemeAppearanceCard from '@/features/settings/components/ThemeAppearanceCard.vue'
import ThemeSkinCard from '@/features/settings/components/ThemeSkinCard.vue'
import SettingsPageShell from '@/features/settings/components/SettingsPageShell.vue'
import SettingsSectionCard from '@/features/settings/components/SettingsSectionCard.vue'
import SettingsSegmentTabs from '@/features/settings/components/SettingsSegmentTabs.vue'
import {useThemeStore} from '@/features/settings/stores/theme-store'
import {DwButton, DwInput, FormField, ConfirmDialog, DwInlineAlert, DwActionFeedback} from '@/core/components'
import {DwIcon} from '@/core/icons'
import IconButton from '@/core/components/IconButton.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {settingsApi} from '@/api/modules/settings'
import {
    applyConfigDirectoryAndRestart,
    loadConfigDirSettings,
    pickConfigDirectory,
    resolveConfigDirectoryPath,
} from '@/features/settings/services/config-dir-settings.service'
import {DATA_DIRECTORY_SUBDIRS} from '@/shared/config/data-directory-layout'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {buildDeepLinkExample} from '@/shared/deep-link/deep-link.service'
import {
    loadApiServerPreferences,
    normalizeApiServerUrl,
    saveApiServerPreferences,
    type ApiServerMode,
} from '@/shared/api/api-server-prefs'
import {resolveLocalApiBaseUrlLabel} from '@/shared/api/mode'

const {t} = useI18n()
const theme = useThemeStore()
const layout = useLayoutStore()
const auth = useAuthStore()
const desktopApp = isDesktopApp()
const deepLinkExample = buildDeepLinkExample()
const deepLinkCopied = ref(false)
let deepLinkCopiedTimer: ReturnType<typeof setTimeout> | null = null

const deepLinkParamDefs = [
  {key: 'connectionId', optional: false, descKey: 'settings.basic.deepLink.connectionId'},
  {key: 'database', optional: true, descKey: 'settings.basic.deepLink.database'},
  {key: 'sql', optional: true, descKey: 'settings.basic.deepLink.sql'},
] as const

const deepLinkExampleParams = computed(() => {
  const url = new URL(deepLinkExample)
  return (['connectionId', 'database', 'sql'] as const)
      .map((key) => ({key, value: url.searchParams.get(key) ?? ''}))
      .filter((entry) => entry.value)
})
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.AppConfig)

const appearances: ThemeAppearance[] = ['light', 'dark', 'system']
const uiSkins = UI_SKIN_DEFINITIONS
const primaryTones: PrimaryTone[] = ['violet', 'blue', 'cyan', 'green', 'orange', 'rose']
const locales: AppLocale[] = ['zh-CN', 'en-US']

const configDirInput = ref('')
const previewPath = ref('')
const activeFromBackend = ref('')
const defaultPath = ref('')
const canChangeConfigDir = ref(false)
const configDirSaving = ref(false)
const configDirError = ref('')
const restartConfirmOpen = ref(false)

const workspacePathMismatch = computed(() => {
    const active = activeFromBackend.value.trim()
    const preview = previewPath.value.trim()
    if (!active || !preview) return false
    return active.replace(/[/\\]+$/, '').toLowerCase() !== preview.replace(/[/\\]+$/, '').toLowerCase()
})

const apiServerMode = ref<ApiServerMode>('local')
const apiServerRemoteUrl = ref('')
const apiServerSaving = ref(false)
const apiServerTesting = ref(false)
const apiServerError = ref('')
const apiServerTestMessage = ref<string | null>(null)
const apiServerTestOk = ref<boolean | null>(null)
const apiServerEndpointTick = ref(0)

const apiServerModeTabs = computed(() => [
    {id: 'local', label: t('settings.basic.apiServer.modes.local')},
    {id: 'remote', label: t('settings.basic.apiServer.modes.remote')},
])

const savedApiServerPrefs = computed(() => {
    apiServerEndpointTick.value
    return loadApiServerPreferences()
})

const localApiEndpointLabel = computed(() => {
    apiServerEndpointTick.value
    return resolveLocalApiBaseUrlLabel()
})

const draftRemoteNormalized = computed(() => normalizeApiServerUrl(apiServerRemoteUrl.value))

const apiServerDirty = computed(() => {
    const saved = savedApiServerPrefs.value
    if (apiServerMode.value !== saved.mode) return true
    if (apiServerMode.value === 'remote') {
        const draft = draftRemoteNormalized.value ?? apiServerRemoteUrl.value.trim().replace(/\/$/, '')
        return draft !== saved.remoteUrl
    }
    return false
})

const pendingEndpointLabel = computed(() => {
    if (!apiServerDirty.value) return null
    if (apiServerMode.value === 'local') return localApiEndpointLabel.value
    return draftRemoteNormalized.value
})

const apiServerStatusLabel = computed(() => {
    const saved = savedApiServerPrefs.value
    if (saved.mode === 'remote' && saved.remoteUrl) return saved.remoteUrl
    return localApiEndpointLabel.value
})

function refreshApiServerEndpointLabel() {
    apiServerEndpointTick.value += 1
}

function loadApiServerDraft() {
    const prefs = loadApiServerPreferences()
    apiServerMode.value = prefs.mode
    apiServerRemoteUrl.value = prefs.remoteUrl
    apiServerError.value = ''
    apiServerTestMessage.value = null
    apiServerTestOk.value = null
    refreshApiServerEndpointLabel()
}

function onApiServerModeChange(id: string) {
    apiServerMode.value = id === 'remote' ? 'remote' : 'local'
    apiServerError.value = ''
    apiServerTestMessage.value = null
    apiServerTestOk.value = null
}

function resolveLocalTestBaseUrl(): string {
    const label = resolveLocalApiBaseUrlLabel()
    if (label.endsWith('/api') && !label.includes('://')) return ''
    if (label.endsWith('/api')) return label.slice(0, -4)
    return label.startsWith('http') ? label : ''
}

async function testApiServer() {
    apiServerError.value = ''
    let target = ''
    if (apiServerMode.value === 'remote') {
        const normalized = normalizeApiServerUrl(apiServerRemoteUrl.value)
        if (!normalized) {
            apiServerError.value = t('settings.basic.apiServer.invalidUrl')
            return
        }
        target = normalized
    } else {
        target = resolveLocalTestBaseUrl()
    }

    apiServerTesting.value = true
    apiServerTestMessage.value = null
    apiServerTestOk.value = null
    try {
        const snapshot = await settingsApi.pingHealthAt(target)
        if (snapshot.result?.ok) {
            apiServerTestOk.value = true
            apiServerTestMessage.value = t('settings.basic.apiServer.testOk', {
                latency: snapshot.result.latencyMs,
            })
        } else {
            apiServerTestOk.value = false
            apiServerTestMessage.value = t('settings.basic.apiServer.testFailed')
        }
    } catch {
        apiServerTestOk.value = false
        apiServerTestMessage.value = t('settings.basic.apiServer.testFailed')
    } finally {
        apiServerTesting.value = false
    }
}

async function saveApiServer() {
    if (apiServerSaving.value) return
    if (!apiServerDirty.value) {
        layout.showToast(t('settings.basic.apiServer.unchanged'))
        return
    }

    let remoteUrl = apiServerRemoteUrl.value.trim().replace(/\/$/, '')
    if (apiServerMode.value === 'remote') {
        const normalized = normalizeApiServerUrl(remoteUrl)
        if (!normalized) {
            apiServerError.value = t('settings.basic.apiServer.invalidUrl')
            return
        }
        remoteUrl = normalized
        apiServerRemoteUrl.value = normalized
    }

    apiServerSaving.value = true
    apiServerError.value = ''
    try {
        const previous = loadApiServerPreferences()
        saveApiServerPreferences({
            mode: apiServerMode.value,
            remoteUrl: apiServerMode.value === 'remote' ? remoteUrl : previous.remoteUrl,
        })
        refreshApiServerEndpointLabel()
        await auth.signOut({silent: true})
        auth.openLoginDialog()
        layout.showSuccessToast(t('settings.basic.apiServer.saved'))
    } catch {
        apiServerError.value = t('settings.basic.apiServer.saveFailed')
    } finally {
        apiServerSaving.value = false
    }
}

onMounted(async () => {
    loadApiServerDraft()
    const settings = await loadConfigDirSettings()
    activeFromBackend.value = settings.activeFromBackend
    defaultPath.value = settings.defaultPath
    canChangeConfigDir.value = settings.canChange
    configDirInput.value = settings.configured ?? ''
    const trimmed = configDirInput.value.trim()
    previewPath.value = !trimmed
        ? (settings.defaultPath || settings.resolved || settings.activeFromBackend)
        : await resolveConfigDirectoryPath(trimmed)
})

watch(configDirInput, async (value) => {
    if (!canChangeConfigDir.value) return
    const trimmed = value.trim()
    previewPath.value = !trimmed
        ? defaultPath.value
        : await resolveConfigDirectoryPath(trimmed)
})

async function browseConfigDir() {
    const picked = await pickConfigDirectory()
    if (picked) configDirInput.value = picked
}

function resetConfigDir() {
    configDirInput.value = ''
    previewPath.value = defaultPath.value
}

async function saveConfigDir() {
    if (denyIfReadOnly()) return
    if (!canChangeConfigDir.value || configDirSaving.value) return
    restartConfirmOpen.value = true
}

async function confirmSaveConfigDir() {
    restartConfirmOpen.value = false
    configDirSaving.value = true
    configDirError.value = ''
    try {
        const ok = await applyConfigDirectoryAndRestart(configDirInput.value.trim() || null)
        if (!ok) {
            configDirError.value = t('settings.basic.workspaceRoot.saveFailed')
            configDirSaving.value = false
        }
    } catch {
        configDirError.value = t('settings.basic.workspaceRoot.saveFailed')
        configDirSaving.value = false
    }
}

async function copyDeepLinkExample() {
  try {
    await navigator.clipboard.writeText(deepLinkExample)
    deepLinkCopied.value = true
    layout.showSuccessToast(t('settings.basic.deepLink.copySuccess'))
    if (deepLinkCopiedTimer) clearTimeout(deepLinkCopiedTimer)
    deepLinkCopiedTimer = setTimeout(() => {
      deepLinkCopied.value = false
    }, 2000)
  } catch {
    layout.showErrorToast(t('settings.basic.deepLink.copyFailed'))
  }
}
</script>

<template>
  <SettingsPageShell
      :title="t('settings.basic.title')"
      :subtitle="t('settings.basic.subtitle')"
      :readonly="readOnly"
      :readonly-hint="hint"
  >
    <div class="settings-groups">
      <SettingsSectionCard
          :title="t('settings.basic.apiServer.title')"
          :hint="t('settings.basic.apiServer.hint')"
          icon="link"
          tone="sky"
      >
        <p class="hint basic-api-status">
          {{ t('settings.basic.apiServer.currentEndpoint') }}：
          <code>{{ apiServerStatusLabel }}</code>
          <span class="basic-api-status__mode">
            （{{
              savedApiServerPrefs.mode === 'remote'
                  ? t('settings.basic.apiServer.modes.remote')
                  : t('settings.basic.apiServer.modes.local')
            }}）
          </span>
        </p>

        <div class="health-field basic-api-mode">
          <span class="health-field__label">{{ t('settings.basic.apiServer.mode') }}</span>
          <SettingsSegmentTabs
              variant="inline"
              :model-value="apiServerMode"
              :tabs="apiServerModeTabs"
              :aria-label="t('settings.basic.apiServer.mode')"
              @update:model-value="onApiServerModeChange"
          />
        </div>

        <template v-if="apiServerMode === 'local'">
          <p class="hint">{{ t('settings.basic.apiServer.localHint') }}</p>
          <dl class="config-dir-meta">
            <div>
              <dt>{{ t('settings.basic.apiServer.localEndpoint') }}</dt>
              <dd><code class="config-dir-path">{{ localApiEndpointLabel }}</code></dd>
            </div>
          </dl>
        </template>

        <template v-else>
          <FormField
              :label="t('settings.basic.apiServer.remoteUrl')"
              input-id="basic-api-server-url"
              :error="apiServerError || undefined"
          >
            <DwInput
                id="basic-api-server-url"
                v-model="apiServerRemoteUrl"
                class="config-dir-input"
                :disabled="apiServerSaving"
                :placeholder="t('settings.basic.apiServer.remoteUrlPlaceholder')"
            />
          </FormField>
          <p class="hint">{{ t('settings.basic.apiServer.remoteUrlHint') }}</p>
        </template>

        <p v-if="pendingEndpointLabel" class="hint basic-api-pending">
          {{ t('settings.basic.apiServer.willConnect') }}：
          <code>{{ pendingEndpointLabel }}</code>
        </p>
        <DwInlineAlert v-if="apiServerMode === 'local'" :message="apiServerError"/>

        <div class="config-dir-actions">
          <DwButton
              variant="secondary"
              :disabled="apiServerSaving || apiServerTesting"
              :loading="apiServerTesting"
              @click="testApiServer"
          >
            {{ apiServerTesting ? t('settings.basic.apiServer.testing') : t('settings.basic.apiServer.test') }}
          </DwButton>
          <DwButton
              variant="primary"
              :disabled="apiServerSaving || apiServerTesting || !apiServerDirty"
              :loading="apiServerSaving"
              @click="saveApiServer"
          >
            {{ t('settings.basic.apiServer.save') }}
          </DwButton>
          <DwActionFeedback :message="apiServerTestMessage" :ok="apiServerTestOk"/>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
          :title="t('settings.basic.uiSkin')"
          :hint="t('settings.basic.uiSkinHint')"
          icon="settings-basic"
          tone="primary"
      >
        <div class="dw-choice-grid">
          <ThemeSkinCard
              v-for="skin in uiSkins"
              :key="skin.id"
              :variant="skin.id"
              :active="theme.uiSkin === skin.id"
              :label="t(skin.labelKey)"
              :hint="t(skin.hintKey)"
              @click="theme.setUiSkin(skin.id)"
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
          :title="t('settings.basic.background')"
          :hint="t('settings.basic.backgroundHint')"
          icon="settings-basic"
          tone="primary"
      >
        <div class="dw-choice-grid">
          <ThemeAppearanceCard
              v-for="appearance in appearances"
              :key="appearance"
              :variant="appearance"
              :active="theme.appearance === appearance"
              :label="t(`settings.basic.appearances.${appearance}`)"
              @click="theme.setAppearance(appearance)"
          />
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
          :title="t('settings.basic.primary')"
          :hint="t('settings.basic.primaryHint')"
          icon="settings-basic"
          tone="violet"
      >
        <div class="color-row">
          <button
              v-for="tone in primaryTones"
              :key="tone"
              class="color-swatch"
              :class="{ active: theme.primaryTone === tone }"
              type="button"
              :title="t(`settings.basic.primaries.${tone}`)"
              @click="theme.setPrimaryTone(tone)"
          >
            <span class="color-dot" :style="{ background: PRIMARY_PRESETS[tone].primary }"/>
            <span v-if="theme.primaryTone === tone" class="check">✓</span>
          </button>
        </div>
        <div class="primary-label">{{ t(`settings.basic.primaries.${theme.primaryTone}`) }}</div>
      </SettingsSectionCard>

      <SettingsSectionCard
          :title="t('settings.basic.language')"
          :hint="t('settings.basic.languageHint')"
          icon="settings-basic"
          tone="sky"
      >
        <div class="locale-grid">
          <button
              v-for="locale in locales"
              :key="locale"
              class="locale-card"
              :class="{ active: currentLocale === locale }"
              type="button"
              @click="setLocale(locale)"
          >
            <span class="locale-flag">{{ locale === 'zh-CN' ? '中' : 'En' }}</span>
            <span>{{ t(locale === 'zh-CN' ? 'locale.zhCN' : 'locale.enUS') }}</span>
          </button>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard
          v-if="activeFromBackend || previewPath || canChangeConfigDir"
          :title="t('settings.basic.workspaceRoot.title')"
          :hint="t('settings.basic.workspaceRoot.hint')"
          icon="folder"
          tone="panel"
      >
        <FormField :label="t('settings.basic.workspaceRoot.root')" input-id="basic-config-dir">
          <div class="config-dir-row">
            <DwInput
                id="basic-config-dir"
                v-model="configDirInput"
                class="config-dir-input"
                :disabled="!canChangeConfigDir || configDirSaving"
                :placeholder="t('settings.basic.workspaceRoot.placeholder')"
            />
            <DwButton
                v-if="canChangeConfigDir"
                variant="secondary"
                :disabled="configDirSaving"
                @click="browseConfigDir"
            >
              {{ t('settings.basic.workspaceRoot.browse') }}
            </DwButton>
          </div>
        </FormField>

        <dl class="config-dir-meta">
          <div v-if="activeFromBackend" class="config-dir-meta__row">
            <dt>{{ t('settings.basic.workspaceRoot.activeNow') }}</dt>
            <dd>
              <code class="workspace-root__path-code" :title="activeFromBackend">{{ activeFromBackend }}</code>
            </dd>
          </div>
          <div v-if="previewPath" class="config-dir-meta__row">
            <dt>{{ t('settings.basic.workspaceRoot.afterRestart') }}</dt>
            <dd>
              <code class="workspace-root__path-code" :title="previewPath">{{ previewPath }}</code>
            </dd>
          </div>
        </dl>

            <DwInlineAlert
                v-if="workspacePathMismatch"
                variant="warning"
                :message="t('settings.basic.workspaceRoot.mismatchHint')"
            />

        <div class="workspace-root__subs" :aria-label="t('settings.basic.workspaceRoot.layoutTitle')">
          <span
              v-for="entry in DATA_DIRECTORY_SUBDIRS"
              :key="entry.id"
              class="workspace-root__sub"
          >
            {{ entry.segment }}/
          </span>
        </div>
        <p class="hint workspace-root__subs-hint">{{ t('settings.basic.workspaceRoot.layoutHint') }}</p>

        <div v-if="canChangeConfigDir" class="config-dir-actions">
          <DwButton variant="secondary" :disabled="configDirSaving" @click="resetConfigDir">
            {{ t('settings.basic.workspaceRoot.reset') }}
          </DwButton>
          <DwButton variant="primary" :disabled="configDirSaving" @click="saveConfigDir">
            {{ t('settings.basic.workspaceRoot.save') }}
          </DwButton>
        </div>
        <DwInlineAlert :message="configDirError"/>
      </SettingsSectionCard>

      <section v-if="desktopApp" class="setting-block deep-link-block">
        <div class="deep-link-block__head">
          <div class="deep-link-block__icon" aria-hidden="true">
            <DwIcon name="link" :size="20" :stroke-width="1.7"/>
          </div>
          <div class="deep-link-block__copy">
            <div class="deep-link-block__title-row">
              <h3>{{ t('settings.basic.deepLink.title') }}</h3>
              <code class="deep-link-protocol">datawise://</code>
            </div>
            <p class="hint">{{ t('settings.basic.deepLink.hint') }}</p>
          </div>
        </div>

        <div class="deep-link-params">
          <article
              v-for="param in deepLinkParamDefs"
              :key="param.key"
              class="deep-link-param"
          >
            <div class="deep-link-param__top">
              <code class="deep-link-param__key">{{ param.key }}</code>
              <span
                  class="deep-link-param__badge"
                  :class="param.optional ? 'deep-link-param__badge--optional' : 'deep-link-param__badge--required'"
              >
                {{
                  param.optional
                      ? t('settings.basic.deepLink.paramOptional')
                      : t('settings.basic.deepLink.paramRequired')
                }}
              </span>
            </div>
            <p>{{ t(param.descKey) }}</p>
          </article>
        </div>

        <div class="deep-link-example-wrap">
          <p class="deep-link-example__label">{{ t('settings.basic.deepLink.exampleHint') }}</p>
          <div class="deep-link-example">
            <code class="deep-link-example__code">
              <span class="tok-scheme">datawise://</span><span class="tok-host">open</span><span
                  class="tok-punct"
              >?</span><template
                  v-for="(entry, index) in deepLinkExampleParams"
                  :key="entry.key"
              ><span v-if="index > 0" class="tok-punct">&amp;</span><span class="tok-key">{{ entry.key }}</span><span
                  class="tok-punct"
              >=</span><span class="tok-value">{{ entry.value }}</span></template>
            </code>
            <IconButton
                size="sm"
                :title="deepLinkCopied ? t('settings.basic.deepLink.copied') : t('settings.basic.deepLink.copyExample')"
                :active="deepLinkCopied"
                @click="copyDeepLinkExample"
            >
              <DwIcon v-if="!deepLinkCopied" name="copy" size="sm" :stroke-width="1.5"/>
              <DwIcon v-else name="submit" size="sm" :stroke-width="1.6"/>
            </IconButton>
          </div>
        </div>

        <p class="deep-link-footnote">
          <DwIcon name="about" size="sm" :stroke-width="1.5"/>
          {{ t('settings.basic.deepLink.desktopOnly') }}
        </p>
      </section>
    </div>
  </SettingsPageShell>

  <ConfirmDialog
      v-model:open="restartConfirmOpen"
      :title="t('settings.basic.workspaceRoot.title')"
      :message="t('settings.basic.workspaceRoot.restartConfirm')"
      :confirm-label="t('common.confirm')"
      :confirm-loading="configDirSaving"
      @confirm="confirmSaveConfigDir"
  />
</template>
