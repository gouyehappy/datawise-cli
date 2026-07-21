<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'

const viewMode = defineModel<'grid' | 'chart'>({required: true})

const {t} = useI18n()
</script>

<template>
  <div class="dw-segment dw-segment--ghost" role="tablist" :aria-label="t('queryResult.chart.viewMode')">
    <button
        type="button"
        class="dw-segment__btn dw-segment__btn--label"
        :class="{ 'is-active': viewMode === 'grid' }"
        role="tab"
        :aria-selected="viewMode === 'grid'"
        @click="viewMode = 'grid'"
    >
      <DwIcon name="table" size="sm" :stroke-width="1.5"/>
      <span>{{ t('queryResult.chart.grid') }}</span>
    </button>
    <button
        type="button"
        class="dw-segment__btn dw-segment__btn--label"
        :class="{ 'is-active': viewMode === 'chart' }"
        role="tab"
        :aria-selected="viewMode === 'chart'"
        @click="viewMode = 'chart'"
    >
      <DwIcon name="chart" size="sm" :stroke-width="1.5"/>
      <span>{{ t('queryResult.chart.chart') }}</span>
    </button>
  </div>
</template>
