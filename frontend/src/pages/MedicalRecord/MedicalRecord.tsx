import { useEffect, useState } from 'react'
import MenuItem from '@mui/material/MenuItem'
import { useParams } from 'react-router'
import { getPatient, PatientApiError, type Patient } from '../../api/patients'
import { getMedicalWorkers, type MedicalWorker } from '../../api/medicalWorkers'
import { getDiagnoses, type Diagnosis } from '../../api/diagnoses'
import {
  createMedicalRecord, getMedicalRecord, saveMedicalRecord, MedicalRecordApiError,
  type MedicalRecord as MedicalRecordData, type MedicalRecordContent,
} from '../../api/medicalRecords'
import BackButton from '../../shared/ui/BackButton/BackButton'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import { administrativeSexOptions } from '../../types/patient'
import type { MedicalRecordTab } from '../../types/medicalRecord'
import MedicalRecordForm from './MedicalRecordForm/MedicalRecordForm'
import MedicalRecordHistory from './MedicalRecordHistory/MedicalRecordHistory'
import * as Styled from './MedicalRecord.styles'

type PageState =
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'loaded'; patient: Patient; record: MedicalRecordData | null; workers: MedicalWorker[]; diagnoses: Diagnosis[] }

const MedicalRecord = () => {
  const { patientId } = useParams()
  const [state, setState] = useState<PageState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)
  const [workerId, setWorkerId] = useState<number | ''>('')
  const [editing, setEditing] = useState(false)
  const [formReset, setFormReset] = useState(0)
  const [action, setAction] = useState<'creating' | 'saving' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [conflict, setConflict] = useState(false)
  const [selectedTab, setSelectedTab] = useState<MedicalRecordTab>('diagnoses')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setState({ status: 'loading' })
      setEditing(false)
      setWorkerId('')
      setError('')
      setSuccess('')
      setConflict(false)
      setSelectedTab('diagnoses')
      const id = Number(patientId)
      if (!patientId || !/^\d+$/.test(patientId) || !Number.isSafeInteger(id) || id < 1) {
        setState({ status: 'error', notFound: true })
        return
      }
      try {
        const [patient, record, workers, diagnoses] = await Promise.all([
          getPatient(id, controller.signal),
          getMedicalRecord(id, controller.signal).catch((failure) => {
            if (failure instanceof MedicalRecordApiError && failure.status === 404) return null
            throw failure
          }),
          getMedicalWorkers(controller.signal),
          getDiagnoses(controller.signal),
        ])
        if (!controller.signal.aborted) setState({ status: 'loaded', patient, record, workers, diagnoses })
      } catch (failure) {
        if (!controller.signal.aborted) setState({ status: 'error', notFound: failure instanceof PatientApiError && failure.status === 404 })
      }
    }
    void load()
    return () => controller.abort()
  }, [patientId, requestVersion])

  const handleCreate = async () => {
    if (state.status !== 'loaded' || state.record || !workerId || action) return
    setAction('creating')
    setError('')
    try {
      const record = await createMedicalRecord(state.patient.id, workerId)
      setState((previous) => previous.status === 'loaded' && previous.patient.id === record.patient_id
        ? { ...previous, record, patient: { ...previous.patient, has_medical_record: true } } : previous)
      setEditing(false)
      setWorkerId('')
      setSuccess('ЭМК создана. Редактирование заблокировано.')
    } catch (failure) {
      setError(failure instanceof MedicalRecordApiError ? failure.message : 'Не удалось создать ЭМК. Повторите попытку.')
      if (failure instanceof MedicalRecordApiError && failure.status === 409) setConflict(true)
    } finally {
      setAction(null)
    }
  }

  const handleSave = async (values: MedicalRecordContent) => {
    if (state.status !== 'loaded' || !state.record || !editing || !workerId) {
      throw new MedicalRecordApiError(422, 'Выберите медработника и разблокируйте карту.')
    }
    setAction('saving')
    setSuccess('')
    try {
      const record = await saveMedicalRecord(state.patient.id, { ...values, worker_id: workerId, version: state.record.version })
      setState((previous) => previous.status === 'loaded' && previous.patient.id === record.patient_id ? { ...previous, record } : previous)
      setEditing(false)
      setWorkerId('')
      setConflict(false)
      setSuccess('ЭМК сохранена. Редактирование заблокировано.')
    } catch (failure) {
      if (failure instanceof MedicalRecordApiError && failure.status === 409) setConflict(true)
      throw failure
    } finally {
      setAction(null)
    }
  }

  const cancelEditing = () => {
    setEditing(false)
    setWorkerId('')
    setFormReset((previous) => previous + 1)
    setConflict(false)
    setError('')
    setSuccess('')
  }

  const title = state.status === 'loaded'
    ? 'Электронная медицинская карта'
    : state.status === 'error' ? (state.notFound ? 'Пациент не найден' : 'Не удалось открыть ЭМК') : undefined
  const subtitle = state.status === 'loaded' ? (
    <>
      <Styled.PatientName>{[state.patient.last_name, state.patient.first_name, state.patient.patronymic].filter(Boolean).join(' ')}</Styled.PatientName>
      <Styled.PatientInfo>
        {state.patient.date_of_birth.split('-').reverse().join('.')}
        {' · '}{administrativeSexOptions.find((option) => option.value === state.patient.administrative_sex)?.label}
      </Styled.PatientInfo>
    </>
  ) : undefined
  const backPath = patientId && /^\d+$/.test(patientId) ? `/personal/patients/${patientId}` : '/personal'

  return (
    <Styled.Page>
      <Styled.BackNav><BackButton fallbackTo={backPath} /></Styled.BackNav>
      <DetailsCard title={title} subtitle={subtitle} busy={state.status === 'loading' || action !== null}>
        {state.status === 'loading' && <Styled.Message role="status">Загрузка ЭМК…</Styled.Message>}
        {state.status === 'error' && (
          <>
            <Styled.Message role="alert">{state.notFound ? 'Пациент не существует или был удалён.' : 'Проверьте соединение и повторите попытку.'}</Styled.Message>
            {!state.notFound && <Styled.ActionButton onClick={() => setRequestVersion((previous) => previous + 1)}>Повторить</Styled.ActionButton>}
          </>
        )}
        {state.status === 'loaded' && (
          <>
            {error && <Styled.Feedback severity="error">{error}</Styled.Feedback>}
            {success && <Styled.Feedback severity="success" role="status">{success}</Styled.Feedback>}
            <Styled.EditorControls>
              <Styled.Status role="status">
                {!state.record ? 'ЭМК ещё не создана.' : editing ? 'Редактирование разрешено' : 'Редактирование заблокировано'}
              </Styled.Status>
              <Styled.Field
                select label="Медработник" required fullWidth disabled={action !== null || editing || state.workers.length === 0}
                value={workerId}
                helperText={state.workers.length === 0 ? 'Нет активных медработников. Добавьте или восстановите сотрудника в режиме администратора.'
                  : !state.record ? 'Укажите, кто создаёт ЭМК.' : editing ? 'Будет указан автором изменений.' : 'Укажите, кто разблокирует ЭМК.'}
                onChange={(event) => { setWorkerId(Number(event.target.value)); setError(''); setSuccess('') }}
              >
                <MenuItem value="" disabled>Выберите медработника</MenuItem>
                {state.workers.map((worker) => <MenuItem key={worker.id} value={worker.id}>{worker.first_name} {worker.last_name}</MenuItem>)}
              </Styled.Field>
              {!editing && (
                <Styled.ActionButton variant="contained" disabled={!workerId || action !== null}
                  onClick={() => {
                    if (state.record) { setEditing(true); setSuccess('') }
                    else void handleCreate()
                  }}>
                  {action === 'creating' ? 'Создание…' : state.record ? 'Разблокировать' : 'Создать ЭМК'}
                </Styled.ActionButton>
              )}
            </Styled.EditorControls>
            {state.record?.edited_by && state.record.updated_at && (
              <Styled.Metadata>
                Последнее сохранение: {new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(new Date(state.record.updated_at))}
                {' · '}{state.record.edited_by.first_name} {state.record.edited_by.last_name}
              </Styled.Metadata>
            )}
            {conflict && <Styled.ActionButton disabled={action !== null} onClick={() => setRequestVersion((previous) => previous + 1)}>Обновить карту</Styled.ActionButton>}
            {state.record && (
              <>
                <Styled.SectionTabs value={selectedTab} onChange={(_, value: MedicalRecordTab) => setSelectedTab(value)}
                  variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Разделы ЭМК">
                  <Styled.SectionTab id="record-tab-diagnoses" aria-controls="record-panel-diagnoses" value="diagnoses" label="Диагнозы" disabled={action !== null} />
                  <Styled.SectionTab id="record-tab-prescriptions" aria-controls="record-panel-prescriptions" value="prescriptions" label="Назначения" disabled={action !== null} />
                  <Styled.SectionTab id="record-tab-history" aria-controls="record-panel-history" value="history" label="История изменений" disabled={action !== null} />
                </Styled.SectionTabs>
                <MedicalRecordForm key={`${state.record.version}-${formReset}`} record={state.record} registry={state.diagnoses}
                  selectedTab={selectedTab} onInvalidPrescriptions={() => setSelectedTab('prescriptions')}
                  editing={editing} busy={action !== null} onSubmit={handleSave} onCancel={cancelEditing} />
                <Styled.TabPanel id="record-panel-history" role="tabpanel" aria-labelledby="record-tab-history" hidden={selectedTab !== 'history'}>
                  <MedicalRecordHistory key={`${state.patient.id}-${state.record.version}`} patientId={state.patient.id}
                    version={state.record.version} active={selectedTab === 'history'} />
                </Styled.TabPanel>
              </>
            )}
          </>
        )}
      </DetailsCard>
    </Styled.Page>
  )
}

export default MedicalRecord
