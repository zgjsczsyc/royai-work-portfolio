<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as echarts from 'echarts/core';
import { ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { RadarEvent } from './types';
echarts.use([ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);
const props = defineProps<{ events: RadarEvent[] }>();
const emit = defineEmits<{ select: [id: string] }>();
const root = ref<HTMLElement>();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;
function update() {
  chart?.setOption({
    animationDuration: 350,
    grid: { left: 46, right: 25, top: 24, bottom: 45 },
    tooltip: { renderMode: 'richText', formatter: (p: any) => `${p.data.title}\n样本热度 ${p.value[0]}  ·  潜在影响 ${p.value[1]}\nFC 关联度 ${p.data.relevance} · 点击查看证据` },
    xAxis: { min: 0, max: 100, name: '样本热度 →', nameLocation: 'middle', nameGap: 28, nameTextStyle: { color: '#7f8b85', fontSize: 11 }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8c9791', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1ec' } } },
    yAxis: { min: 0, max: 100, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#8c9791', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef1ec' } } },
    series: [{ type: 'scatter',
      data: props.events.filter(e => e.heatScore !== null).map(e => ({ id: e.id, title: e.title, relevance: e.relevance, value: [e.heatScore, e.impact], symbolSize: 12 + e.relevance * .15, itemStyle: { color: e.direction === 'risk' ? '#c97953' : e.direction === 'opportunity' ? '#459b77' : '#a2aaa0', opacity: .8, borderWidth: 2, borderColor: '#fff' } })),
      markLine: { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#d7ddd3', type: 'dashed', width: 1 }, data: [{ xAxis: 50 }, { yAxis: 50 }] },
      emphasis: { itemStyle: { borderColor: '#263e32', borderWidth: 2 } },
    }],
  });
}
onMounted(() => {
  chart = echarts.init(root.value!);
  chart.on('click', (p: any) => { if (p.data?.id) emit('select', p.data.id); });
  observer = new ResizeObserver(() => chart?.resize()); observer.observe(root.value!); update();
});
watch(() => props.events, update, { deep: true });
onBeforeUnmount(() => { observer?.disconnect(); chart?.dispose(); });
</script>
<template><div ref="root" class="radar-chart" role="img" aria-label="事件样本热度与潜在影响散点图，详细数据见事件中心"></div></template>
