type AuditEntry = { event_id: string; event_time: string }

const timestamp = (value: string) => Date.parse(value) * 1000
  + Number((value.match(/\.(\d+)/)?.[1] ?? '').padEnd(6, '0').slice(3, 6))

export const mergeAuditEvents = <T extends AuditEntry>(current: T[], incoming: T[]): T[] => {
  const events = new Map(current.map((event) => [event.event_id, event]))
  for (const event of incoming) events.set(event.event_id, event)
  return [...events.values()].sort((left, right) =>
    timestamp(right.event_time) - timestamp(left.event_time) || left.event_id.localeCompare(right.event_id))
}
