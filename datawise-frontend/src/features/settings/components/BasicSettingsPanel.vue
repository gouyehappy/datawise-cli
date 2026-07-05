<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {currentLocale, setLocale, type AppLocale} from '@/i18n'
import {PRIMARY_PRESETS, type PrimaryTone, type ThemeAppearance} from '@/features/settings/constants/theme-presets'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import ThemeAppearanceCard from '@/features/settings/components/ThemeAppearanceCard.vue'
import {useThemeStore} from '@/features/settings/stores/theme-store'
import {DwButton, DwInput, FormField} from '@/core/components'
import {DwIcon} from '@/core/icons'
import IconButton from '@/core/components/IconButton.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {
    applyConfigDirectoryAndRestart,
    loadDataDirectorySettings,
    pickConfigDirectory,
    resolveConfigDirectoryPath,
} from '@/features/settings/services/config-dir-settings.service'
import {
    resolveDataDirectoryLayout,
    type ResolvedDataDirectoryLayout,
} from '@/shared/config/data-directory-layout'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {buildDeepLinkExample} from '@/shared/deep-link/deep-link.service'

const {t} = useI18n()
const theme = useThemeStore()
const layout = useLayoutStore()
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
const primaryTones: PrimaryTone[] = ['violet', 'blue', 'cyan', 'green', 'orange', 'rose']
const locales: AppLocale[] = ['zh-CN', 'en-US']

const configDirInput = ref('')
const resolvedPath = ref('')
const defaultPath = ref('')
const canChangeConfigDir = ref(false)
const configDirSaving = ref(false)
const dataDirLayout = ref<ResolvedDataDirectoryLayout | null>(null)

onMounted(async () => {
    const settings = await loadDataDirectorySettings()
    configDirInput.value = settings.configured ?? ''
    resolvedPath.value = settings.resolved
    defaultPath.value = settings.defaultPath
    canChangeConfigDir.value = settings.canChange
    dataDirLayout.value = settings.layout
})

watch(configDirInput, async (value) => {
    if (!canChangeConfigDir.value) return
    const trimmed = value.trim()
    const nextRoot = !trimmed
        ? defaultPath.value
        : await resolveConfigDirectoryPath(trimmed)
    resolvedPath.value = nextRoot
    const scriptsPath = dataDirLayout.value?.entries.find((entry) => entry.id === 'scripts')?.resolved
    dataDirLayout.value = resolveDataDirectoryLayout(nextRoot, scriptsPath)
})

async function browseConfigDir() {
    const picked = await pickConfigDirectory()
    if (picked) configDirInput.value = picked
}

function resetConfigDir() {
    configDirInput.value = ''
    resolvedPath.value = defaultPath.value
    const scriptsPath = dataDirLayout.value?.entries.find((entry) => entry.id === 'scripts')?.resolved
    dataDirLayout.value = resolveDataDirectoryLayout(resolvedPath.value, scriptsPath)
}

async function saveConfigDir() {
    if (denyIfReadOnly()) return
    if (!canChangeConfigDir.value || configDirSaving.value) return
    if (!window.confirm(t('settings.basic.workspaceRoot.restartConfirm'))) return
    configDirSaving.value = true
    try {
        const ok = await applyConfigDirectoryAndRestart(configDirInput.value.trim() || null)
        if (!ok) {
            layout.showToast(t('settings.basic.workspaceRoot.saveFailed'))
            configDirSaving.value = false
        }
    } catch {
        layout.showToast(t('settings.basic.workspaceRoot.saveFailed'))
        configDirSaving.value = false
    }
}

async function copyDeepLinkExample() {
  try {
    await navigator.clipboard.writeText(deepLinkExample)
    deepLinkCopied.value = true
    layout.showToast(t('settings.basic.deepLink.copySuccess'))
    if (deepLinkCopiedTimer) clearTimeout(deepLinkCopiedTimer)
    deepLinkCopiedTimer = setTimeout(() => {
      deepLinkCopied.value = false
    }, 2000)
  } catch {
    layout.showToast(t('settings.basic.deepLink.copyFailed'))
  }
}
</script>

<template>
  <div class="basic-settings">
    <header class="panel-head">
      <h2>{{ t('settings.basic.title') }}</h2>
      <p>{{ t('settings.basic.subtitle') }}</p>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ hint }}</p>

    <div class="basic-settings__body" :class="{'is-readonly': readOnly}">
    <section class="setting-block">
      <h3>{{ t('settings.basic.background') }}</h3>
      <p class="hint">{{ t('settings.basic.backgroundHint') }}</p>
      <div class="appearance-grid">
        <ThemeAppearanceCard
            v-for="appearance in appearances"
            :key="appearance"
            :variant="appearance"
            :active="theme.appearance === appearance"
            :label="t(`settings.basic.appearances.${appearance}`)"
            @click="theme.setAppearance(appearance)"
        />
      </div>
    </section>

    <section class="setting-block">
      <h3>{{ t('settings.basic.primary') }}</h3>
      <p class="hint">{{ t('settings.basic.primaryHint') }}</p>
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
    </section>

    <section class="setting-block">
      <h3>{{ t('settings.basic.language') }}</h3>
      <p class="hint">{{ t('settings.basic.languageHint') }}</p>
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
    </section>

    <section v-if="resolvedPath" class="setting-block">
      <h3>{{ t('settings.basic.workspaceRoot.title') }}</h3>
      <p class="hint">{{ t('settings.basic.workspaceRoot.hint') }}</p>
      <FormField :label="t('settings.basic.workspaceRoot.root')" input-id="basic-config-dir">
        <template #default>
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
        </template>
      </FormField>
      <p v-if="canChangeConfigDir" class="hint">{{ t('settings.basic.workspaceRoot.restartHint') }}</p>
      <p v-if="canChangeConfigDir && desktopApp" class="hint">{{ t('settings.basic.workspaceRoot.titleBarHint') }}</p>

      <dl class="config-dir-meta">
        <div>
          <dt>{{ t('settings.basic.workspaceRoot.resolved') }}</dt>
          <dd><code class="config-dir-path">{{ resolvedPath }}</code></dd>
        </div>
        <div v-if="defaultPath">
          <dt>{{ t('settings.basic.workspaceRoot.default') }}</dt>
          <dd><code class="config-dir-path">{{ defaultPath }}</code></dd>
        </div>
      </dl>

      <div v-if="dataDirLayout?.entries.length" class="data-dir-layout">
        <h4 class="data-dir-layout__title">{{ t('settings.basic.workspaceRoot.layoutTitle') }}</h4>
        <p class="hint data-dir-layout__hint">{{ t('settings.basic.workspaceRoot.layoutHint') }}</p>
        <ul class="data-dir-layout__list">
          <li v-for="entry in dataDirLayout.entries" :key="entry.id" class="data-dir-layout__item">
            <div class="data-dir-layout__head">
              <code class="data-dir-layout__segment">{{ entry.segment }}/</code>
              <span class="data-dir-layout__label">{{ t(entry.labelKey) }}</span>
            </div>
            <p class="data-dir-layout__desc">{{ t(entry.hintKey) }}</p>
            <code class="config-dir-path data-dir-layout__path">{{ entry.resolved }}</code>
          </li>
        </ul>
      </div>

      <div v-if="canChangeConfigDir" class="config-dir-actions">
        <DwButton variant="secondary" :disabled="configDirSaving" @click="resetConfigDir">
          {{ t('settings.basic.workspaceRoot.reset') }}
        </DwButton>
        <DwButton variant="primary" :disabled="configDirSaving" @click="saveConfigDir">
          {{ t('settings.basic.workspaceRoot.save') }}
        </DwButton>
      </div>
    </section>

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
  </div>
</template>

<style scoped>
.basic-settings {
  max-width: clamp(480px, 58vw, 760px);
}

.basic-settings__body.is-readonly {
  opacity: 0.72;
  pointer-events: none;
}
</style>
