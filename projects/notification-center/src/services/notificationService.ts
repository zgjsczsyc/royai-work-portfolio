export interface UserNotification {
  id: string | number
  category: 'task' | 'content' | 'system' | string
  notification_type: string
  title: string
  content: string
  action_label: string
  target: {
    type: string
    conversation_id: string
    message_id: string
    task_id: string
  }
  created_at: string
  read_at: string | null
}
