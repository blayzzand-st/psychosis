import UserCard from '../../shared/ui/UserAccess/UserCard'
import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { useNavigate, useParams } from 'react-router'
import {
  createPatient, deletePatient, getPatient, updatePatient, PatientApiError,
  type Patient as PatientData, type PatientWrite,
} from '../../api/patients'
import BackButton from '../../shared/ui/BackButton/BackButton'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import { medicalRecordPath } from '../../shared/config/routes'
import PatientForm from './PatientForm/PatientForm'
import * as Styled from './Patient.styles'
import { useUserAuth } from '../../shared/ui/UserAccess/useUserAuth'

type PageState =
  | { status: 'new' }
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'loaded'; patient: PatientData }

const listPath = '/personal'

const Patient = () => {
  const { status } = useUserAuth()
  const { patientId } = useParams()
  const canManage = Boolean(patientId || status?.user?.can_create)
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>({ status: patientId ? 'loading' : 'new' })
  const [requestVersion, setRequestVersion] = useState(0)
  const [action, setAction] = useState<'saving' | 'deleting' | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!patientId) return
    const controller = new AbortController()
    const load = async () => {
      setState({ status: 'loading' })
      setSaved(false)
      setDeleteOpen(false)
      const id = Number(patientId)
      if (!/^\d+$/.test(patientId) || !Number.isSafeInteger(id) || id < 1) {
        setState({ status: 'error', notFound: true })
        return
      }
      try {
        const patient = await getPatient(id, controller.signal)
        if (!controller.signal.aborted) setState({ status: 'loaded', patient })
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: 'error', notFound: error instanceof PatientApiError && error.status === 404 })
      }
    }
    void load()
    return () => controller.abort()
  }, [patientId, requestVersion])

  const handleSave = async (values: PatientWrite) => {
    setAction('saving')
    setSaved(false)
    try {
      if (state.status === 'new') {
        const patient = await createPatient(values)
        navigate(`/personal/patients/${patient.id}`, { replace: true })
      } else if (state.status === 'loaded') {
        const patient = await updatePatient(state.patient.id, values)
        setState({ status: 'loaded', patient })
        setSaved(true)
      }
    } finally {
      setAction(null)
    }
  }

  const handleDelete = async () => {
    if (state.status !== 'loaded' || state.patient.has_medical_record || action) return
    setAction('deleting')
    setDeleteError('')
    try {
      await deletePatient(state.patient.id)
      navigate(listPath, { replace: true })
    } catch (error) {
      setDeleteError(error instanceof PatientApiError ? error.message : 'Не удалось удалить пациента. Повторите попытку.')
    } finally {
      setAction(null)
    }
  }

  const patient = state.status === 'loaded' ? state.patient : null
  const title = patient ? [patient.last_name, patient.first_name, patient.patronymic].filter(Boolean).join(' ')
    : state.status === 'error' ? (state.notFound ? 'Пациент не найден' : 'Не удалось открыть пациента')
      : state.status === 'new' ? 'Новый пациент' : undefined

  return (
    <Styled.Page>
      <Styled.BackNav><BackButton fallbackTo={listPath} /><UserCard compact /></Styled.BackNav>
      <DetailsCard title={title} busy={state.status === 'loading' || action !== null} action={patient && canManage && (
        <Styled.ActionButton color="error" disabled={action !== null || patient.has_medical_record}
          onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Удалить</Styled.ActionButton>
      )}>
        {state.status === 'loading' && <Styled.Message role="status">Загрузка пациента…</Styled.Message>}
        {state.status === 'error' && (
          <>
            <Styled.Message role="alert">{state.notFound ? 'Запись не существует или была удалена.' : 'Проверьте соединение и повторите попытку.'}</Styled.Message>
            {!state.notFound && <Styled.ActionButton onClick={() => setRequestVersion((previous) => previous + 1)}>Повторить</Styled.ActionButton>}
            <Styled.ActionButton onClick={() => navigate(listPath)}>К списку пациентов</Styled.ActionButton>
          </>
        )}
        {(state.status === 'new' || patient) && (
          <>
            {patient && (
              <Styled.RecordNav aria-label="Медицинская карта пациента">
                {patient.has_medical_record || status?.user?.can_create
                  ? <Styled.RecordLink to={medicalRecordPath(patient.id)}>{patient.has_medical_record ? 'Открыть ЭМК' : 'Создать ЭМК'}</Styled.RecordLink>
                  : <Styled.ActionButton variant="outlined" disabled>Создать ЭМК</Styled.ActionButton>}
              </Styled.RecordNav>
            )}
            {patient?.has_medical_record && <Styled.Feedback severity="info">У пациента есть ЭМК. Удаление недоступно.</Styled.Feedback>}
            {saved && <Styled.Feedback severity="success" role="status">Изменения сохранены</Styled.Feedback>}
            {!patient && !canManage ? <Styled.Feedback severity="info">Создание пациентов доступно только врачу или медсестре.</Styled.Feedback> : <PatientForm key={patient?.id ?? 'new'} initialValues={patient ?? undefined} busy={action !== null}
              submitLabel={patient ? 'Сохранить изменения' : 'Создать'} onSubmit={handleSave}
              onCancel={() => navigate(listPath)} onEdit={() => setSaved(false)} />}
          </>
        )}
      </DetailsCard>
      <Dialog open={deleteOpen} onClose={() => { if (!action) setDeleteOpen(false) }} fullWidth maxWidth="xs"
        aria-labelledby="delete-patient-title" aria-describedby="delete-patient-description">
        <DialogTitle id="delete-patient-title">Удалить пациента?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-patient-description">«{title}» будет полностью удалён из базы без возможности восстановления.</DialogContentText>
          {deleteError && <Styled.Feedback severity="error">{deleteError}</Styled.Feedback>}
        </DialogContent>
        <DialogActions>
          <Styled.ActionButton disabled={action !== null} onClick={() => setDeleteOpen(false)}>Отмена</Styled.ActionButton>
          <Styled.ActionButton color="error" variant="contained" disabled={action !== null} onClick={() => void handleDelete()}>
            {action === 'deleting' ? 'Удаление…' : 'Удалить'}
          </Styled.ActionButton>
        </DialogActions>
      </Dialog>
    </Styled.Page>
  )
}

export default Patient
