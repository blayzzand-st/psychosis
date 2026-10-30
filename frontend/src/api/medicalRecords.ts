import { employeeFetch } from './userAuth.ts'
export type DiagnosisSnapshot = { diagnosis_id: number; code: string; name: string }
export type EditorSnapshot = { id: number; first_name: string; last_name: string; position: string }

export type MedicalRecord = {
  id: number
  patient_id: number
  version: number
  diagnoses: DiagnosisSnapshot[]
  prescriptions: string[]
  edited_by: EditorSnapshot | null
  updated_at: string | null
}

export type MedicalRecordContent = { diagnosis_ids: number[]; prescriptions: string[]; prescription_sources: (number | null)[] }
export type MedicalRecordWrite = MedicalRecordContent & { edit_token: string; version: number }
export type MedicalRecordChange =
  | { kind: 'record_created' | 'record_saved'; data: Record<string, never> }
  | { kind: 'diagnosis_added' | 'diagnosis_removed'; data: DiagnosisSnapshot }
  | { kind: 'prescription_added' | 'prescription_cancelled'; data: { text: string } }
export type MedicalRecordHistoryEntry = MedicalRecord & { changes: MedicalRecordChange[]; prescription_sources?: (number | null)[] | null }

export class MedicalRecordApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MedicalRecordApiError'
    this.status = status
  }
}

const request = async <T>(patientId: number, options: RequestInit = {}, suffix = ''): Promise<T> => {
  const timeout = AbortSignal.timeout(10000)
  const response = await employeeFetch(`/api/patients/${patientId}/medical-record${suffix}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
  })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}))
    const detail = typeof body === 'object' && body !== null && 'detail' in body ? body.detail : undefined
    throw new MedicalRecordApiError(response.status,
      typeof detail === 'string' ? detail : 'Проверьте медработника, диагнозы и назначения. Длина назначения — от 3 до 128 символов.',
    )
  }
  return response.json() as Promise<T>
}

export const getMedicalRecord = (patientId: number, signal: AbortSignal) => request<MedicalRecord>(patientId, { signal })
export const createMedicalRecord = (patientId: number) =>
  request<MedicalRecord>(patientId, { method: 'POST', body: JSON.stringify({}) })
export const saveMedicalRecord = (patientId: number, values: MedicalRecordWrite) =>
  request<MedicalRecord>(patientId, { method: 'PUT', body: JSON.stringify(values) })
export const getMedicalRecordHistory = (patientId: number, signal: AbortSignal) =>
  request<MedicalRecordHistoryEntry[]>(patientId, { signal }, '/history')
export const getMedicalRecordAt = (patientId: number, at: string, signal: AbortSignal) =>
  request<MedicalRecord>(patientId, { signal }, `?at=${encodeURIComponent(at)}`)

export const unlockMedicalRecord = (patientId: number) =>
  request<{ edit_token: string; version: number }>(patientId, { method: 'POST' }, '/unlock')
