<script setup lang="ts">
import {useI18n} from 'vue-i18n'

const viewMode = defineModel<'grid' | 'chart'>({required: true})

const {t} = useI18n()
</script>

<template>
  <div class="dw-segment" role="tablist" :aria-label="t('queryResult.chart.viewMode')">
    <button
        type="button"
        class="dw-segment__btn"
        :class="{ 'is-active': viewMode === 'grid' }"
        role="tab"
        :aria-selected="viewMode === 'grid'"
        @click="viewMode = 'grid'"
    >
      {{ t('queryResult.chart.grid') }}
    </button>
    <button
        type="button"
        class="dw-segment__btn"
        :class="{ 'is-active': viewMode === 'chart' }"
        role="tab"
        :aria-selected="viewMode === 'chart'"
        @click="viewMode = 'chart'"
    >
      {{ t('queryResult.chart.chart') }}
    </button>
  </div>
</template>
