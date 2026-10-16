import assert from 'node:assert/strict'
import test from 'node:test'
import type { MedicalRecordChange, MedicalRecordHistoryEntry } from '../src/api/medicalRecords.ts'
import { buildPrescriptionTimeline } from '../src/pages/MedicalRecord/MedicalRecordPrescriptions/prescriptionTimeline.ts'

const revision = (version: number, prescriptions: string[], sources: (number | null)[] | null = null,
  changes: MedicalRecordChange[] = []): MedicalRecordHistoryEntry => ({
  id: 1, patient_id: 1, version, diagnoses: [], prescriptions, edited_by: null,
  updated_at: `2026-10-16T10:00:0${version}Z`, prescription_sources: sources, changes,
})

test('Legacy snapshots preserve dates of unchanged prescriptions and retain cancelled text', () => {
  const history = [revision(1, ['Первичный осмотр']), revision(2, ['Первичный осмотр', 'Контроль']), revision(3, ['Контроль'])]
  const before = structuredClone(history)
  const result = buildPrescriptionTimeline(history, 3)
  assert.deepEqual(result.map((item) => [item.text, item.active, item.addedVersion, item.endedVersion, item.source]), [
    ['Первичный осмотр', false, 1, 3, null], ['Контроль', true, 2, null, 0],
  ])
  assert.deepEqual(history, before)
})

test('Cancellation and re-addition of identical text creates a new episode', () => {
  const result = buildPrescriptionTimeline([
    revision(1, ['Контроль']), revision(2, ['Контроль'], null, [
      { kind: 'prescription_cancelled', data: { text: 'Контроль' } },
      { kind: 'prescription_added', data: { text: 'Контроль' } },
    ]),
  ], 2)
  assert.equal(result.length, 2)
  assert.equal(result[0].active, false)
  assert.equal(result[1].addedVersion, 2)
  assert.equal(result[1].active, true)
})

test('Stored links identify which duplicate was cancelled', () => {
  const result = buildPrescriptionTimeline([
    revision(1, ['Контроль'], [null]), revision(2, ['Контроль', 'Контроль'], [0, null]), revision(3, ['Контроль'], [1]),
  ], 3)
  assert.equal(result[0].active, false)
  assert.equal(result[0].endedVersion, 3)
  assert.equal(result[1].active, true)
  assert.equal(result[1].addedAt, '2026-10-16T10:00:02Z')
  assert.equal(result[1].source, 0)
})

test('Reordering duplicate rows retains the dates belonging to each row', () => {
  const result = buildPrescriptionTimeline([
    revision(1, ['Контроль'], [null]), revision(2, ['Контроль', 'Контроль'], [0, null]), revision(3, ['Контроль', 'Контроль'], [1, 0]),
  ], 3)
  assert.equal(result.length, 2)
  assert.equal(result[0].source, 1)
  assert.equal(result[1].source, 0)
})

test('Editing to the text of a cancelled second row records both old rows as inactive', () => {
  const result = buildPrescriptionTimeline([
    revision(1, ['Осмотр', 'Контроль'], [null, null]), revision(2, ['Контроль'], [0]),
  ], 2)
  assert.deepEqual(result.map((item) => [item.text, item.active, item.addedVersion, item.endedVersion]), [
    ['Осмотр', false, 1, 2], ['Контроль', false, 1, 2], ['Контроль', true, 2, null],
  ])
})

test('Stops at the version shown in the form', () => {
  const result = buildPrescriptionTimeline([revision(1, ['Осмотр']), revision(2, [], [])], 1)
  assert.equal(result.length, 1)
  assert.equal(result[0].active, true)
})

test('Does not invent lineage dates for ambiguous legacy duplicates', () => {
  const result = buildPrescriptionTimeline([
    revision(1, ['Контроль']), revision(2, ['Контроль', 'Контроль']),
    revision(3, ['Контроль'], null, [{ kind: 'prescription_cancelled', data: { text: 'Контроль' } }]),
  ], 3)
  assert.ok(result.every((episode) => episode.addedAt === null))
  assert.equal(result.filter((episode) => episode.active).length, 1)
  assert.deepEqual(buildPrescriptionTimeline([], 0), [])
})
