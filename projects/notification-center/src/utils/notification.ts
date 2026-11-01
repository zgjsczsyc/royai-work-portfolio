import dayjs from 'dayjs'
import type { RouteLocationRaw } from 'vue-router'
import type { UserNotification } from '@/services/notificationService'

export function notificationDateGroup(value: string, now = dayjs()): string {
  const date = dayjs(value)
  if (date.isSame(now, 'day')) return '今天'
  if (date.isSame(now.subtract(1, 'day'), 'day')) return '昨天'
  return '更早'
}

// 后续类型在这里增加目标路由；目前只开放翻译完成通知。
export function notificationRoute(
  item: UserNotification,
): RouteLocationRaw | null {
  const target = item.target
  if (
    item.notification_type !== 'translation_completed' ||
    target?.type !== 'conversation_message' ||
    !target.conversation_id ||
    !target.message_id
  )
    return null
  return {
    name: 'home',
    query: {
      sessionId: String(target.conversation_id),
      messageId: String(target.message_id),
    },
  }
}
