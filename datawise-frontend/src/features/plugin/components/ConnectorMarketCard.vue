<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'
import {
    buildConnectorInstallGuide,
    canRemoteInstallConnector,
    canRemoteReinstallConnector,
    canUninstallConnector,
    CONNECTOR_PLUGIN_DIR,
    formatConnectorCapabilityLabel,
    formatConnectorIntegrityLabel,
    isConnectorUpgradeAvailable,
    isRedundantPluginJar,
} from '@/features/datasource/services/connector-market.service'
import {
    connectorCardCapLimit,
    type ConnectorCardSize,
} from '@/features/datasource/services/connector-market-layout.service'
import {datasourcesApi} from '@/api/modules/datasources'
import {DwButton} from '@/core/components'
import {connectorMarketAccentVars} from '@/features/datasource/services/connector-market-theme.service'
import type {DbType} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {canMutateConnectionCatalog} from '@/features/auth/services/feature-permission.service'

const props = withDefaults(defineProps<{
    entry: ConnectorMarketEntry
    index?: number
    standalone?: boolean
    size?: ConnectorCardSize
    reorderable?: boolean
    dragging?: boolean
    dropTarget?: boolean
}>(), {
    index: 0,
    standalone: false,
    size: 'standard',
    reorderable: false,
    dragging: false,
    dropTarget: false,
})

const emit = defineEmits<{
    installed: []
    dragStart: [id: string]
    dragOver: [id: string]
    drop: [id: string]
    dragEnd: []
}>()

const {t, te} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const auth = useAuthStore()
const copied = ref(false)
const installing = ref(false)
const uninstalling = ref(false)

const canCreateConnection = computed(() => canMutateConnectionCatalog(auth.isGuest))
const canRemoteInstall = computed(() => canRemoteInstallConnector(props.entry, auth.isAdmin))
const canRemoteReinstall = computed(() => canRemoteReinstallConnector(props.entry, auth.isAdmin))
const canUninstall = computed(() => canUninstallConnector(props.entry, auth.isAdmin))
const redundantJar = computed(() => isRedundantPluginJar(props.entry))
const upgradeAvailable = computed(() => isConnectorUpgradeAvailable(props.entry))
const capLimit = computed(() => connectorCardCapLimit(props.size))
const iconSize = computed(() => {
    if (props.size === 'hero') return DB_TYPE_ICON_SIZE.header
    if (props.size === 'wide' || props.size === 'tall') return DB_TYPE_ICON_SIZE.list
    return DB_TYPE_ICON_SIZE.compact
})

const cardClassList = computed(() => [
    'connector-card',
    `connector-card--${props.size}`,
    props.entry.available ? 'connector-card--ready' : 'connector-card--pending',
    props.standalone ? 'connector-card--page' : '',
    props.reorderable ? 'connector-card--reorderable' : '',
    props.dragging ? 'is-dragging' : '',
    props.dropTarget ? 'is-drop-target' : '',
].filter(Boolean))

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

function onGripDragStart(event: DragEvent) {
    if (!props.reorderable) return
    event.dataTransfer?.setData('text/plain', props.entry.id)
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        const card = (event.currentTarget as HTMLElement | null)?.closest('.connector-card')
        if (card instanceof HTMLElement) {
            event.dataTransfer.setDragImage(card, 28, 28)
        }
    }
    emit('dragStart', props.entry.id)
}

function onDragOver(event: DragEvent) {
    if (!props.reorderable) return
    event.preventDefault()
    if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
    }
    emit('dragOver', props.entry.id)
}

function onDrop(event: DragEvent) {
    if (!props.reorderable) return
    event.preventDefault()
    emit('drop', props.entry.id)
}

function onDragEnd() {
    emit('dragEnd')
}

async function installRemote(event: Event, reinstall = false) {
    event.stopPropagation()
    if (installing.value) return
    if (reinstall) {
        if (!canRemoteReinstall.value) return
    } else if (!canRemoteInstall.value) {
        return
    }
    installing.value = true
    try {
        const result = await datasourcesApi.installFromMarket(props.entry.id)
        if (result.restartRequired) {
            layout.showWarningToast(result.message || t('plugin.connectorMarket.installSuccessRestart'))
        } else {
            layout.showSuccessToast(
                result.message
                || (reinstall
                    ? t('plugin.connectorMarket.reinstallSuccess')
                    : t('plugin.connectorMarket.installSuccess')),
            )
        }
        emit('installed')
    } catch (error) {
        const message = error instanceof Error
            ? error.message
            : (reinstall
                ? t('plugin.connectorMarket.reinstallFailed')
                : t('plugin.connectorMarket.installFailed'))
        layout.showErrorToast(message)
    } finally {
        installing.value = false
    }
}

async function uninstallRemote(event: Event) {
    event.stopPropagation()
    if (uninstalling.value || !canUninstall.value) return
    uninstalling.value = true
    try {
        const result = await datasourcesApi.uninstallFromMarket(props.entry.id)
        if (result.restartRequired) {
            layout.showWarningToast(result.message || t('plugin.connectorMarket.uninstallSuccessRestart'))
        } else {
            layout.showSuccessToast(result.message || t('plugin.connectorMarket.uninstallSuccess'))
        }
        emit('installed')
    } catch (error) {
        layout.showErrorToast(
            error instanceof Error ? error.message : t('plugin.connectorMarket.uninstallFailed'),
        )
    } finally {
        uninstalling.value = false
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
      :class="cardClassList"
      :style="{...connectorMarketAccentVars(entry.id), '--cm-i': index}"
      @dragover="onDragOver"
      @drop="onDrop"
  >
    <button
        v-if="reorderable"
        class="connector-card__grip"
        type="button"
        draggable="true"
        :title="t('plugin.connectorMarket.dragToReorder')"
        :aria-label="t('plugin.connectorMarket.dragToReorder')"
        @click.stop
        @dragstart="onGripDragStart"
        @dragend="onDragEnd"
    >
      <span class="connector-card__grip-dots" aria-hidden="true"/>
    </button>

    <div class="connector-card__head">
      <div class="connector-card__icon">
        <DbTypeIcon :db-type="entry.id as DbType" :size="iconSize"/>
      </div>
      <div class="connector-card__copy">
        <strong class="connector-card__name">{{ entry.label }}</strong>
        <span class="connector-card__id">{{ entry.id }}</span>
        <span v-if="entry.version" class="connector-card__version">v{{ entry.version }}</span>
      </div>
      <span
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

    <p v-else-if="!entry.available && entry.installHint" class="connector-card__hint">
      {{ entry.installHint }}
    </p>

    <div class="connector-card__meta">
      <div
          v-if="integrityLabel"
          class="connector-card__integrity"
          :class="integrityClass"
      >
        {{ integrityLabel }}
      </div>
      <div
          v-if="upgradeAvailable"
          class="connector-card__integrity connector-card__integrity--mismatch"
      >
        {{ t('plugin.connectorMarket.upgradeAvailable') }}
      </div>
    </div>

    <footer v-if="standalone" class="connector-card__footer">
      <div v-if="entry.available" class="connector-card__footer-actions">
        <DwButton
            v-if="canCreateConnection"
            size="sm"
            @click="openNewConnection"
        >
          {{
            size === 'compact'
                ? t('plugin.connectorMarket.newConnectionShort')
                : t('plugin.connectorMarket.newConnection')
          }}
        </DwButton>
        <DwButton
            v-if="canRemoteReinstall"
            size="sm"
            variant="secondary"
            :disabled="installing"
            :loading="installing"
            @click="installRemote($event, true)"
        >
          {{
            upgradeAvailable
                ? t('plugin.connectorMarket.upgradeRemote')
                : t('plugin.connectorMarket.reinstallRemote')
          }}
        </DwButton>
        <DwButton
            v-if="canUninstall"
            size="sm"
            variant="ghost"
            :disabled="uninstalling"
            :loading="uninstalling"
            @click="uninstallRemote"
        >
          {{
            redundantJar
                ? t('plugin.connectorMarket.cleanRedundant')
                : t('plugin.connectorMarket.uninstall')
          }}
        </DwButton>
      </div>

      <div v-else class="connector-card__footer-actions">
        <DwButton
            v-if="canRemoteInstall"
            size="sm"
            :disabled="installing"
            :loading="installing"
            @click="installRemote($event, false)"
        >
          {{ t('plugin.connectorMarket.installRemote') }}
        </DwButton>
        <DwButton size="sm" variant="secondary" @click="copyInstallGuide">
          {{ copied ? t('plugin.connectorMarket.copied') : t('plugin.connectorMarket.copyInstall') }}
        </DwButton>
        <DwButton
            v-if="size !== 'compact'"
            size="sm"
            variant="ghost"
            @click="copyPluginDir"
        >
          {{ t('plugin.connectorMarket.copyPath') }}
        </DwButton>
      </div>
    </footer>
  </article>
</template>
