<template>
  <TranslationConversationPreview v-if="isPreview && route.query.conversation" />
  <div v-else class="notification-page">
    <header class="notification-header">
      <h1>通知中心</h1>
      <p>翻译完成后会在这里通知你，回到原对话即可查看或下载译文</p>
    </header>
    <div class="notification-list">
      <div class="notification-toolbar">
        <Button
          type="text"
          :loading="markingAll"
          :disabled="loading || !preview.hasUnread"
          @click="handleMarkAllRead"
        >
          <CheckOutlined /> 全部已读
        </Button>
      </div>
      <div v-if="errorMessage" class="notification-state" role="alert">
        <p>{{ errorMessage }}</p>
        <Button :loading="loading" @click="loadNotifications()"
          ><ReloadOutlined /> 重试</Button
        >
      </div>
      <div
        v-else-if="loading && !notifications.length"
        class="notification-state"
      >
        <Spin />
      </div>
      <Empty
        v-else-if="!notifications.length"
        class="notification-state"
        description="暂无通知"
        :image="Empty.PRESENTED_IMAGE_SIMPLE"
      />
      <section
        v-for="group in groupedNotifications"
        :key="group.label"
        class="notification-group"
      >
        <h2>{{ group.label }}</h2>
        <article
          v-for="item in group.items"
          :key="String(item.id)"
          class="notification-card"
          :class="{ unread: !item.read_at }"
          @click="handleOpen(item)"
        >
          <div class="notification-type-icon" :class="item.category">
            <TranslationOutlined
              v-if="item.notification_type === 'translation_completed'"
            />
            <BellOutlined v-else />
          </div>
          <div class="notification-body">
            <h3>
              <span
                v-if="!item.read_at"
                class="unread-dot"
                aria-label="未读"
              />{{ item.title }}
            </h3>
            <p>{{ item.content }}</p>
            <div class="notification-bottom">
              <time :datetime="item.created_at">{{
                formatTime(item.created_at)
              }}</time>
              <Button
                size="small"
                :loading="openingId === String(item.id)"
                @click.stop="handleOpen(item)"
              >
                {{ item.action_label || '去查看' }}
              </Button>
            </div>
          </div>
        </article>
      </section>
      <div v-if="hasMore && !errorMessage" class="load-more-row">
        <Button
          :loading="loading"
          @click="loadNotifications(nextCursor || undefined)"
          >加载更多</Button
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BellOutlined, CheckOutlined, ReloadOutlined, TranslationOutlined } from '@ant-design/icons-vue'
import { Button, Empty, Spin } from 'ant-design-vue'
import dayjs from 'dayjs'
import { notificationDateGroup } from '@/utils/notification'
import type { UserNotification } from '@/services/notificationService'
import { useTranslationPreviewStore } from '@/stores/translationPreview'
import TranslationConversationPreview from './TranslationConversationPreview.vue'
const router = useRouter()
const route = useRoute()
const isPreview = true
const preview = useTranslationPreviewStore()
const notifications = computed(() => preview.notifications)
const markingAll = ref(false), loading = ref(false), errorMessage = ref('')
const openingId = ref<string | null>(null), hasMore = ref(false), nextCursor = ref<string | null>(null)
const groupedNotifications = computed(() => ['今天', '昨天', '更早'].map(label => ({label, items: notifications.value.filter(item => notificationDateGroup(item.created_at) === label)})).filter(group => group.items.length))
function formatTime(value: string) {
 const group = notificationDateGroup(value)
 return group === '更早' ? dayjs(value).format('YYYY-MM-DD HH:mm') : `${group} ${dayjs(value).format('HH:mm')}`
}
function handleMarkAllRead() { preview.markAllRead() }
function loadNotifications(_cursor?: string) { /* 本地预览数据在内存中，无请求与分页。 */ }
async function handleOpen(item: UserNotification) {
 await router.push({path:'/notifications', query:{conversation:item.target.conversation_id, messageId:item.target.message_id}})
}
</script>

<style scoped>
.notification-page {
  min-height: 100%;
  padding: 60px 32px 40px;
  color: var(--text-primary);
}
.notification-header {
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border-primary);
}
.notification-header h1 {
  margin: 0 0 12px;
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.notification-header p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}
.notification-list {
  max-width: 1000px;
}
.notification-toolbar {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}
.notification-toolbar :deep(button) {
  color: var(--text-secondary);
}
.notification-state {
  padding: 64px 0;
  color: var(--text-secondary);
  text-align: center;
}
.notification-state p {
  margin-bottom: 16px;
}
.notification-group {
  margin-bottom: 28px;
}
.notification-group h2 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-tertiary);
}
.notification-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  min-height: 116px;
  margin-bottom: 10px;
  padding: 16px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-primary);
  cursor: pointer;
}
.notification-card:hover {
  border-color: #b9cdf3;
}
.notification-card.unread {
  border-color: #d6e5ff;
  background: #f0f6ff;
}
.notification-type-icon {
  display: flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--color-blue-primary);
  background: #dbeafe;
  font-size: 20px;
}
.notification-type-icon.content {
  color: #059669;
  background: #d1fae5;
}
.notification-type-icon.system {
  color: #6b7280;
  background: #f3f4f6;
}
.notification-body {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}
.notification-body h3 {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.notification-body p {
  margin: 4px 0 10px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 22px;
}
.notification-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.notification-bottom time {
  color: var(--text-tertiary);
  font-size: 12px;
}
.notification-bottom :deep(button) {
  min-width: 60px;
  flex-shrink: 0;
  color: var(--text-secondary);
  border-radius: 6px;
}
.unread-dot {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-blue-primary);
}
.load-more-row {
  text-align: center;
}
@media (max-width: 640px) {
  .notification-page {
    padding: 60px 16px 32px;
  }
  .notification-header h1 {
    font-size: 22px;
  }
  .notification-card {
    gap: 10px;
    padding: 12px;
  }
  .notification-type-icon {
    flex-basis: 32px;
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
}
</style>
