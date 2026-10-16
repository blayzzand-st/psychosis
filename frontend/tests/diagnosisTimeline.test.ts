import assert from 'node:assert/strict'
import test from 'node:test'
import type { DiagnosisSnapshot, MedicalRecordHistoryEntry } from '../src/api/medicalRecords.ts'
import { buildDiagnosisTimeline } from '../src/pages/MedicalRecord/MedicalRecordDiagnoses/diagnosisTimeline.ts'

const first: DiagnosisSnapshot = { diagnosis_id: 1, code: '4A40.0', name: 'Системная красная волчанка' }
const second: DiagnosisSnapshot = { diagnosis_id: 2, code: 'CA23.0', name: 'Аллергическая астма' }
const revision = (version: number, diagnoses: DiagnosisSnapshot[], updatedAt: string | null = `2026-10-16T10:00:0${version}Z`): MedicalRecordHistoryEntry => ({
  id: 1, patient_id: 1, version, diagnoses, prescriptions: [], edited_by: null, updated_at: updatedAt, changes: [],
})

test('Preserves placement date through unchanged saves and records removal time', () => {
  const history = [revision(4, [second]), revision(1, []), revision(3, [first, second]), revision(2, [first])]
  const before = structuredClone(history)
  const result = buildDiagnosisTimeline(history, 4)
  assert.equal(result.length, 2)
  assert.deepEqual(result.map((item) => [item.diagnosis.diagnosis_id, item.active, item.addedAt, item.removedAt]), [
    [1, false, '2026-10-16T10:00:02Z', '2026-10-16T10:00:04Z'],
    [2, true, '2026-10-16T10:00:03Z', null],
  ])
  assert.deepEqual(history, before)
})

test('Re-adding a diagnosis creates a distinct episode and preserves old name and code', () => {
  const changed = { ...first, code: '4A40.1', name: 'Изменённое название' }
  const result = buildDiagnosisTimeline([revision(1, [first]), revision(2, []), revision(3, [changed])], 3)
  assert.equal(result.length, 2)
  assert.notEqual(result[0].key, result[1].key)
  assert.deepEqual(result[0].diagnosis, first)
  assert.equal(result[0].active, false)
  assert.equal(result[0].removedVersion, 2)
  assert.deepEqual(result[1].diagnosis, changed)
  assert.equal(result[1].active, true)
  assert.equal(result[1].addedVersion, 3)
})

test('Uses the version shown in the form when the server already has newer changes', () => {
  const result = buildDiagnosisTimeline([revision(1, [first]), revision(2, [first, second]), revision(3, [])], 2)
  assert.equal(result.length, 2)
  assert.ok(result.every((episode) => episode.active && episode.removedAt === null))
})

test('Version ordering distinguishes removal and re-addition with equal timestamps', () => {
  const timestamp = '2026-10-16T10:00:00Z'
  const result = buildDiagnosisTimeline([revision(3, [first], timestamp), revision(2, [], timestamp), revision(1, [first], timestamp)], 3)
  assert.equal(result.length, 2)
  assert.equal(result[0].active, false)
  assert.equal(result[1].active, true)
})

test('Does not invent dates for old entries with unknown time or empty records', () => {
  const [episode] = buildDiagnosisTimeline([revision(1, [first], null), revision(2, [], null)], 2)
  assert.equal(episode.addedAt, null)
  assert.equal(episode.removedAt, null)
  assert.equal(episode.active, false)
  assert.deepEqual(buildDiagnosisTimeline([], 0), [])
})
