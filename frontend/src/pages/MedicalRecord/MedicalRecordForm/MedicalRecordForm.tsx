import { useState, type FormEvent } from 'react'
import type { Diagnosis } from '../../../api/diagnoses'
import type { MedicalRecordTab, PrescriptionDraft } from '../../../types/medicalRecord'
import { MedicalRecordApiError, type MedicalRecord, type MedicalRecordContent, type DiagnosisSnapshot } from '../../../api/medicalRecords'
import MedicalRecordDiagnoses from '../MedicalRecordDiagnoses/MedicalRecordDiagnoses'
import MedicalRecordPrescriptions from '../MedicalRecordPrescriptions/MedicalRecordPrescriptions'
import * as Styled from './MedicalRecordForm.styles'

type MedicalRecordFormProps = {
  record: MedicalRecord
  registry: Diagnosis[]
  editing: boolean
  busy: boolean
  selectedTab: MedicalRecordTab
  onInvalidPrescriptions: () => void
  onSubmit: (values: MedicalRecordContent) => Promise<void>
  onCancel: () => void
}

const MedicalRecordForm = ({ record, registry, editing, busy, selectedTab, onInvalidPrescriptions, onSubmit, onCancel }: MedicalRecordFormProps) => {
  const [diagnoses, setDiagnoses] = useState<DiagnosisSnapshot[]>(record.diagnoses)
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>(record.prescriptions.map((text, source) => ({ text, source })))
  const [errors, setErrors] = useState<string[]>([])
  const [serverError, setServerError] = useState('')
  const disabled = !editing || busy

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disabled) return
    const trimmed = prescriptions.map((item) => item.text.trim())
    const fieldErrors = trimmed.map((text) => [...text].length < 3 || [...text].length > 128 ? 'Введите от 3 до 128 символов.' : '')
    setErrors(fieldErrors)
    setServerError('')
    if (fieldErrors.some(Boolean)) {
      onInvalidPrescriptions()
      return
    }
    try {
      await onSubmit({ diagnosis_ids: diagnoses.map((diagnosis) => diagnosis.diagnosis_id), prescriptions: trimmed,
        prescription_sources: prescriptions.map((item) => item.source) })
    } catch (error) {
      setServerError(error instanceof MedicalRecordApiError ? error.message : 'Не удалось сохранить ЭМК. Повторите попытку.')
    }
  }

  return (
    <Styled.Form noValidate onSubmit={handleSubmit} aria-busy={busy} hidden={selectedTab === 'history'}>
      {serverError && <Styled.Feedback severity="error">{serverError}</Styled.Feedback>}
      <Styled.DiagnosisPicker id="record-panel-diagnoses" role="tabpanel" aria-labelledby="record-tab-diagnoses" hidden={selectedTab !== 'diagnoses'}>
        <MedicalRecordDiagnoses record={record} registry={registry} diagnoses={diagnoses} editing={editing} busy={busy}
          onChange={(values) => { setDiagnoses(values); setServerError('') }} />
      </Styled.DiagnosisPicker>
      <Styled.Section id="record-panel-prescriptions" role="tabpanel" aria-labelledby="record-tab-prescriptions" hidden={selectedTab !== 'prescriptions'}>
        <MedicalRecordPrescriptions record={record} prescriptions={prescriptions} errors={errors} editing={editing} busy={busy}
          onChange={(values) => { setPrescriptions(values); setErrors([]); setServerError('') }} />
      </Styled.Section>
      {editing && (
        <Styled.Actions>
          <Styled.ActionButton type="submit" variant="contained" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</Styled.ActionButton>
          <Styled.ActionButton type="button" variant="outlined" disabled={busy} onClick={onCancel}>Отмена</Styled.ActionButton>
        </Styled.Actions>
      )}
    </Styled.Form>
  )
}

export default MedicalRecordForm
