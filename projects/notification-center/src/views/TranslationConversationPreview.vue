<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TRANSLATION_SAMPLE_TEXT, useTranslationPreviewStore } from '@/stores/translationPreview'
const store = useTranslationPreviewStore(), route = useRoute(), router = useRouter()
const task = computed(() => store.tasks.find(item => item.id === route.query.conversation))
const fileName = ref('示例文档.pdf'), showResult = ref(false)
watch(() => [route.query.conversation, task.value?.status], () => {
  showResult.value = false
  if(task.value?.status === 'completed') store.viewConversation(task.value.id)
}, {immediate:true})
function start() {
  if(!fileName.value.trim()) return
  const id=store.startTranslation(fileName.value.trim())
  router.push({path:'/notifications',query:{conversation:id}})
}
function download() {
  const url=URL.createObjectURL(new Blob([TRANSLATION_SAMPLE_TEXT],{type:'text/plain;charset=utf-8'}))
  const a=document.createElement('a');a.href=url;a.download='示例译文.txt';a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
</script>
<template>
  <section class="conversation">
    <RouterLink to="/notifications">← 返回通知中心</RouterLink>
    <h1>{{ task ? `翻译 ${task.fileName}` : '新建翻译任务' }}</h1>
    <template v-if="task">
      <div class="message user-message">请翻译《{{ task.fileName }}》，保留原文结构。</div>
      <div class="message">已提交模拟后台任务，你可以离开当前页面。约 8 秒后生成通知。</div>
      <div v-if="task.status === 'completed'" class="message result-message" data-testid="translation-result">
        <strong>模拟翻译已完成</strong><p>这是一份固定的示例译文，用于展示查看与下载流程。</p>
        <button @click="showResult=!showResult">{{ showResult ? '收起译文' : '查看译文' }}</button>
        <button @click="download">下载示例译文</button>
        <pre v-if="showResult">{{ TRANSLATION_SAMPLE_TEXT }}</pre>
      </div>
      <p v-else role="status">正在模拟后台处理…</p>
    </template>
    <form v-else @submit.prevent="start">
      <label for="filename">演示文件名</label><input id="filename" v-model="fileName" required maxlength="120">
      <p>仅录入一个虚构文件名，不会读取或上传文件。</p>
      <button type="submit">开始模拟翻译</button>
    </form>
  </section>
</template>
