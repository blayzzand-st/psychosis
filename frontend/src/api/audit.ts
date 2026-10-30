export type AuditEvent = {
  event_id: string
  event_time: string
  actor: string
  actor_label: string | null
  message: string
  display_message: string | null
}

export const connectAudit = () => new EventSource('/api/audit/stream')
