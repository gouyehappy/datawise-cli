<script setup lang="ts">
import * as echarts from 'echarts'
import {onBeforeUnmount, onMounted, ref, watch} from 'vue'
import type {EChartsOption} from 'echarts'

const props = defineProps<{
  option: EChartsOption | null
}>()

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let lastOptionJson = ''

function render() {
  if (!chartRef.value || !props.option) return
  chart ??= echarts.init(chartRef.value)
  chart.setOption(props.option, true)
  chart.resize()
}

function scheduleRender() {
  if (!props.option) return
  const nextJson = JSON.stringify(props.option)
  if (nextJson === lastOptionJson) return
  lastOptionJson = nextJson
  render()
}

function onWindowResize() {
  if (resizeTimer) clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => {
    resizeTimer = null
    chart?.resize()
  }, 120)
}

function dispose() {
  chart?.dispose()
  chart = null
}

onMounted(() => {
  scheduleRender()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  if (resizeTimer) clearTimeout(resizeTimer)
  window.removeEventListener('resize', onWindowResize)
  dispose()
})

watch(() => props.option, () => scheduleRender())
</script>

<template>
  <div v-if="option" ref="chartRef" class="ai-analysis-chart"/>
</template>

<style scoped>
.ai-analysis-chart {
  width: 100%;
  height: 320px;
  padding: 12px 12px 8px;
  box-sizing: border-box;
  background: radial-gradient(ellipse 70% 60% at 50% 100%, color-mix(in srgb, var(--dw-primary) 5%, transparent), transparent 70%),
  linear-gradient(180deg, color-mix(in srgb, var(--dw-bg-panel) 40%, var(--dw-bg)), var(--dw-bg));
}
</style>
