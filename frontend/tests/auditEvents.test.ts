import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeAuditEvents } from '../src/pages/Admin/AuditList/auditEvents.ts'

test('Deduplicates stream events already included in the initial snapshot', () => {
  const entry = { event_id: 'a', event_time: '2026-10-29T12:00:00Z' }
  assert.deepEqual(mergeAuditEvents([entry], [entry]), [entry])
})

test('Shows newest events first, including delayed commits and equal timestamps', () => {
  const later = { event_id: 'z', event_time: '2026-10-29T12:00:00Z' }
  const earlier = { event_id: 'a', event_time: '2026-10-29T11:00:00Z' }
  const same = { event_id: 'b', event_time: later.event_time }
  assert.deepEqual(mergeAuditEvents([later], [earlier, same]), [same, later, earlier])
})

test('Preserves PostgreSQL microsecond ordering within a millisecond', () => {
  const first = { event_id: 'z', event_time: '2026-10-29T12:00:00.000001Z' }
  const second = { event_id: 'a', event_time: '2026-10-29T12:00:00.000002Z' }
  assert.deepEqual(mergeAuditEvents([second], [first]), [second, first])
})
