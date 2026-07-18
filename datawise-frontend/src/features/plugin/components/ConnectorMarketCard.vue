<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DwIcon} from '@/core/icons'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'
import {
    buildConnectorInstallGuide,
    canRemoteInstallConnector,
    CONNECTOR_PLUGIN_DIR,
    formatConnectorCapabilityLabel,
    formatConnectorIntegrityLabel,
} from '@/features/datasource/services/connector-market.service'
import {datasourcesApi} from '@/api/modules/datasources'
import {connectorMarketAccentVars} from '@/features/datasource/services/connector-market-theme.service'
import type {DbType} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {canMutateConnectionCatalog} from '@/features/auth/services/feature-permission.service'
import {SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR} from '@/features/plugin/services/plugin-navigation.service'

const props = withDefaults(defineProps<{
    entry: ConnectorMarketEntry
    index?: number
    lead?: boolean
    dense?: boolean
    standalone?: boolean
}>(), {
    index: 0,
    lead: false,
    dense: false,
    standalone: false,
})

const emit = defineEmits<{
    installed: []
}>()

const {t, te} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const auth = useAuthStore()
const copied = ref(false)
const installing = ref(false)
const canCreateConnection = computed(() => canMutateConnectionCatalog(auth.isGuest))
const canRemoteInstall = computed(() => canRemoteInstallConnector(props.entry, auth.isAdmin))

const capLimit = props.standalone ? (props.lead ? 6 : 5) : 4

function cardClasses() {
    return [
        'connector-card',
        props.entry.available ? 'connector-card--ready' : 'connector-card--pending',
        props.lead ? 'connector-card--lead' : '',
        props.dense ? 'connector-card--dense' : '',
        props.standalone ? 'connector-card--standalone' : '',
    ].filter(Boolean)
}

function capabilityLabel(cap: string) {
    return formatConnectorCapabilityLabel(cap, t, te)
}

const integrityLabel = computed(() =>
    formatConnectorIntegrityLabel(props.entry.integrityStatus, t, te),
)

const integrityClass = computed(() => {
    const status = props.entry.integrityStatus
    if (status === 'verified') return 'connector-card__integrity--verified'
    if (status === 'mismatch') return 'connector-card__integrity--mismatch'
    if (status === 'missing') return 'connector-card__integrity--missing'
    if (status === 'unsigned') return 'connector-card__integrity--unsigned'
    return ''
})

async function installRemote(event: Event) {
    event.stopPropagation()
    if (!canRemoteInstall.value || installing.value) return
    installing.value = true
    try {
        const result = await datasourcesApi.installFromMarket(props.entry.id)
        if (result.restartRequired) {
            layout.showWarningToast(result.message || t('plugin.connectorMarket.installSuccessRestart'))
        } else {
            layout.showSuccessToast(result.message || t('plugin.connectorMarket.installSuccess'))
        }
        emit('installed')
    } catch (error) {
        const message = error instanceof Error ? error.message : t('plugin.connectorMarket.installFailed')
        layout.showErrorToast(message)
    } finally {
        installing.value = false
    }
}

async function copyInstallGuide(event: Event) {
    event.stopPropagation()
    try {
        await navigator.clipboard.writeText(buildConnectorInstallGuide(props.entry))
        copied.value = true
        layout.showSuccessToast(t('plugin.connectorMarket.copyInstallSuccess'))
        window.setTimeout(() => {
            copied.value = false
        }, 2000)
    } catch {
        layout.showErrorToast(t('plugin.connectorMarket.copyInstallFailed'))
    }
}

async function copyPluginDir(event: Event) {
    event.stopPropagation()
    try {
        await navigator.clipboard.writeText(CONNECTOR_PLUGIN_DIR)
        layout.showSuccessToast(t('plugin.connectorMarket.copyPathSuccess'))
    } catch {
        layout.showErrorToast(t('plugin.connectorMarket.copyInstallFailed'))
    }
}

function openPluginSettings(event: Event) {
    event.stopPropagation()
    layout.openSettingsModule('plugins', SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR)
}

function openNewConnection(event?: Event) {
    event?.stopPropagation()
    if (!canCreateConnection.value) {
        layout.showErrorToast(t('auth.permissionDenied'))
        return
    }
    layout.setModule('database')
    workspace.openConnectionForm(props.entry.id as DbType)
}
</script>

<template>
  <article
      :class="cardClasses()"
      :style="{...connectorMarketAccentVars(entry.id), '--cm-i': index}"
  >
    <div class="connector-card__stripe" aria-hidden="true"/>

    <div class="connector-card__head">
      <div class="connector-card__icon">
        <DbTypeIcon :db-type="entry.id as DbType" :size="DB_TYPE_ICON_SIZE.compact"/>
      </div>
      <div class="connector-card__copy">
        <strong class="connector-card__name">{{ entry.label }}</strong>
        <span class="connector-card__id">{{ entry.id }}</span>
        <span v-if="entry.version" class="connector-card__version">v{{ entry.version }}</span>
      </div>
      <span
          v-if="!standalone"
          class="connector-card__badge"
          :class="entry.available ? 'connector-card__badge--ready' : 'connector-card__badge--pending'"
      >
        {{
          entry.available
              ? t('plugin.connectorMarket.statusAvailable')
              : t('plugin.connectorMarket.statusPending')
        }}
      </span>
    </div>

    <div v-if="entry.available && entry.capabilities.length" class="connector-card__caps">
      <span
          v-for="cap in entry.capabilities.slice(0, capLimit)"
          :key="`${entry.id}-${cap}`"
          class="connector-card__cap"
          :title="cap"
      >
        {{ capabilityLabel(cap) }}
      </span>
      <span
          v-if="entry.capabilities.length > capLimit"
          class="connector-card__cap connector-card__cap--more"
      >
        +{{ entry.capabilities.length - capLimit }}
      </span>
    </div>

    <p v-else-if="!entry.available && entry.installHint && !dense" class="connector-card__hint">
      {{ entry.installHint }}
    </p>

    <div
        v-if="integrityLabel"
        class="connector-card__integrity"
        :class="integrityClass"
    >
      {{ integrityLabel }}
    </div>

    <footer v-if="standalone" class="connector-card__footer">
      <span
          class="connector-card__badge connector-card__badge--inline"
          :class="entry.available ? 'connector-card__badge--ready' : 'connector-card__badge--pending'"
      >
        {{
          entry.available
              ? t('plugin.connectorMarket.statusAvailable')
              : t('plugin.connectorMarket.statusPending')
        }}
      </span>

      <div v-if="entry.available && canCreateConnection" class="connector-card__footer-actions">
        <button class="connector-card__link" type="button" @click="openNewConnection">
          {{ dense ? t('plugin.connectorMarket.newConnectionShort') : t('plugin.connectorMarket.newConnection') }}
          <DwIcon name="chevron-right" :size="14" :stroke-width="2"/>
        </button>
      </div>

      <div v-else class="connector-card__footer-actions">
        <button
            v-if="canRemoteInstall"
            class="connector-card__link"
            type="button"
            :disabled="installing"
            @click="installRemote"
        >
          {{ installing ? t('plugin.connectorMarket.installing') : t('plugin.connectorMarket.installRemote') }}
        </button>
        <button class="connector-card__link" type="button" @click="copyInstallGuide">
          {{ copied ? t('plugin.connectorMarket.copied') : t('plugin.connectorMarket.copyInstall') }}
        </button>
        <button
            v-if="!dense"
            class="connector-card__link connector-card__link--muted"
            type="button"
            @click="copyPluginDir"
        >
          {{ t('plugin.connectorMarket.copyPath') }}
        </button>
        <button
            v-if="!dense"
            class="connector-card__link connector-card__link--muted"
            type="button"
            @click="openPluginSettings"
        >
          {{ t('plugin.connectorMarket.openPluginSettings') }}
        </button>
      </div>
    </footer>
  </article>
</template>
