<script setup lang="ts">
import { useTranslationPreviewStore } from './stores/translationPreview'
const store = useTranslationPreviewStore()
</script>
<template>
  <div class="demo-banner">作品集演示 · 本地模拟翻译，不上传文件、不连接企业接口；刷新重置状态。</div>
  <div class="app-shell">
    <aside>
      <h2>工作助手</h2>
      <RouterLink to="/notifications" class="nav-item">通知中心 <span v-if="store.hasUnread" class="blue-dot" aria-label="有未读通知" /></RouterLink>
      <RouterLink :to="{path:'/notifications',query:{conversation:'new'}}" class="nav-item">＋ 新建翻译任务</RouterLink>
      <h3>历史对话</h3>
      <RouterLink v-for="item in store.history" :key="item.id" :to="{path:'/notifications',query:{conversation:item.id}}" class="history-item" :data-history="item.id">
        <span>{{ item.name }}</span><span v-if="item.hasNewResult" class="blue-dot" data-testid="history-unread" aria-label="有新译文" />
      </RouterLink>
      <p class="hint">“全部已读”只清通知未读。打开原对话才清除该对话的新结果蓝点。</p>
    </aside>
    <main><RouterView /></main>
  </div>
</template>
