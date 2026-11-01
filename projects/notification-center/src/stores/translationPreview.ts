import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import dayjs from 'dayjs'
interface ChatHistoryItem { id: string; sessionId: string; name: string; title: string; timestamp: number; createDate: string; hasNewResult: boolean }
import type { UserNotification } from '@/services/notificationService'

export const TRANSLATION_PENDING_TEXT = '文件已提交，正在后台翻译，请稍候。你可以继续其他对话，完成后会通知你，译文可回到本对话查看或下载。'
export const TRANSLATION_SAMPLE_TEXT = 'Demo Product Specification\n\nThis is fictional content for a local workflow demonstration.\nNo document has been uploaded or translated.\n\n本文件为本地设计预览的示例译文，不是所上传文件的真实翻译结果。'

interface PreviewTask {
  id: string
  fileName: string
  status: 'translating' | 'completed'
  hasNewResult: boolean
  createdAt: string
  prompt?: string
}

// 仅供 /notifications?preview=1 使用；所有状态保存在当前页面内存中。
export const useTranslationPreviewStore = defineStore('translation-preview', () => {
  const tasks = ref<PreviewTask[]>([
    { id: 'preview-1', fileName: '演示产品说明.pdf', status: 'completed', hasNewResult: true, createdAt: dayjs().toISOString() },
    { id: 'preview-2', fileName: '演示使用手册.pdf', status: 'completed', hasNewResult: false, createdAt: dayjs().subtract(1, 'day').toISOString() },
  ])

  function makeNotification(task: PreviewTask, readAt: string | null): UserNotification {
    return {
      id: task.id,
      category: 'task',
      notification_type: 'translation_completed',
      title: '翻译任务已完成',
      content: `《${task.fileName}》已完成中译英，回到原对话即可查看或下载译文。`,
      action_label: '回到对话',
      target: { type: 'conversation_message', conversation_id: task.id, message_id: `result-${task.id}`, task_id: task.id },
      created_at: task.createdAt,
      read_at: readAt,
    }
  }

  const notifications = ref(tasks.value.map((task) => makeNotification(task, task.hasNewResult ? null : task.createdAt)))
  const hasUnread = computed(() => notifications.value.some((item) => !item.read_at))
  const history = computed<ChatHistoryItem[]>(() => tasks.value.map((task) => ({
    id: task.id,
    sessionId: task.id,
    name: task.fileName,
    title: `翻译 ${task.fileName}`,
    timestamp: dayjs(task.createdAt).valueOf(),
    createDate: task.createdAt,
    hasNewResult: task.hasNewResult,
  })))

  function startTranslation(fileName: string, prompt?: string) {
    const id = `preview-${crypto.randomUUID()}`
    const task: PreviewTask = { id, fileName, prompt, status: 'translating', hasNewResult: false, createdAt: dayjs().toISOString() }
    tasks.value.unshift(task)
    // 定时器属于共享预览流程，切换到通知中心后仍会完成。
    setTimeout(() => {
      const completed = tasks.value.find((item) => item.id === id)!
      completed.status = 'completed'
      completed.hasNewResult = true
      completed.createdAt = dayjs().toISOString()
      notifications.value.unshift(makeNotification(completed, null))
    }, 8000)
    return id
  }

  function viewConversation(id: string) {
    const task = tasks.value.find((item) => item.id === id)
    if (task?.status !== 'completed') return
    task.hasNewResult = false
    const notification = notifications.value.find((item) => item.target.conversation_id === id)
    if (notification) notification.read_at ||= dayjs().toISOString()
  }

  function markAllRead() {
    notifications.value.forEach((item) => { item.read_at ||= dayjs().toISOString() })
  }

  return { tasks, notifications, history, hasUnread, startTranslation, viewConversation, markAllRead }
})
