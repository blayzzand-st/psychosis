import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import {
  createMedicalWorker,
  deleteMedicalWorker,
  getMedicalWorker,
  MedicalWorkerApiError,
  restoreMedicalWorker,
  updateMedicalWorker,
  type MedicalWorker as MedicalWorkerData,
  type MedicalWorkerWrite,
} from '../../api/medicalWorkers'
import BackButton from '../../shared/ui/BackButton/BackButton'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import MedicalWorkerForm from './MedicalWorkerForm/MedicalWorkerForm'
import * as Styled from './MedicalWorker.styles'

type PageState =
  | { status: 'new' }
  | { status: 'loading' }
  | { status: 'loaded'; worker: MedicalWorkerData }
  | { status: 'error'; notFound: boolean }

const MedicalWorker = () => {
  const { workerId } = useParams()
  const [searchParams] = useSearchParams()
  const includeDeleted = searchParams.get('include_deleted') === 'true'
  const listPath = includeDeleted ? '/administrator?include_deleted=true' : '/administrator'
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>({ status: workerId ? 'loading' : 'new' })
  const [requestVersion, setRequestVersion] = useState(0)
  const [action, setAction] = useState<'saving' | 'deleting' | 'restoring' | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [restoreError, setRestoreError] = useState('')
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    if (!workerId) return
    const controller = new AbortController()
    const id = Number(workerId)
    const load = async () => {
      setState({ status: 'loading' })
      setSaved(false)
      setRestored(false)
      setRestoreError('')
      setDeleteOpen(false)
      if (!/^\d+$/.test(workerId) || !Number.isSafeInteger(id) || id < 1) {
        setState({ status: 'error', notFound: true })
        return
      }
      try {
        const worker = await getMedicalWorker(id, controller.signal, includeDeleted)
        if (!controller.signal.aborted) setState({ status: 'loaded', worker })
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: 'error', notFound: error instanceof MedicalWorkerApiError && error.status === 404 })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [workerId, requestVersion, includeDeleted])

  const handleSave = async (values: MedicalWorkerWrite) => {
    setAction('saving')
    setSaved(false)
    setRestored(false)
    try {
      if (state.status === 'new') {
        const worker = await createMedicalWorker(values)
        navigate(`/administrator/medical-workers/${worker.id}${includeDeleted ? '?include_deleted=true' : ''}`, { replace: true })
      } else if (state.status === 'loaded' && !state.worker.is_deleted) {
        const worker = await updateMedicalWorker(state.worker.id, values)
        setState({ status: 'loaded', worker })
        setSaved(true)
      }
    } finally {
      setAction(null)
    }
  }

  const handleDelete = async () => {
    if (state.status !== 'loaded' || state.worker.is_deleted || action) return
    setAction('deleting')
    setDeleteError('')
    try {
      await deleteMedicalWorker(state.worker.id)
      navigate(listPath, { replace: true })
    } catch {
      setDeleteError('Не удалось удалить медработника. Повторите попытку.')
    } finally {
      setAction(null)
    }
  }

  const worker = state.status === 'loaded' ? state.worker : null

  const handleRestore = async () => {
    if (!worker?.is_deleted || action) return
    setAction('restoring')
    setRestoreError('')
    try {
      const activeWorker = await restoreMedicalWorker(worker.id)
      setState({ status: 'loaded', worker: activeWorker })
      setRestored(true)
    } catch {
      setRestoreError('Не удалось восстановить сотрудника. Повторите попытку.')
    } finally {
      setAction(null)
    }
  }

  const cardTitle = state.status === 'error'
    ? (state.notFound ? 'Медработник не найден' : 'Не удалось загрузить карточку')
    : state.status === 'new'
      ? 'Новый медработник'
      : worker ? `${worker.first_name} ${worker.last_name}` : undefined

  const cardAction = worker && (
    worker.is_deleted ? (
      <Styled.ActionButton disabled={action !== null} onClick={() => void handleRestore()}>
        {action === 'restoring' ? 'Восстановление…' : 'Восстановить'}
      </Styled.ActionButton>
    ) : (
      <Styled.ActionButton
        color="error"
        disabled={action !== null}
        onClick={() => { setDeleteError(''); setDeleteOpen(true) }}
      >Удалить</Styled.ActionButton>
    )
  )

  return (
    <Styled.Page>
      <Styled.BackNav><BackButton fallbackTo={listPath} /></Styled.BackNav>
      <DetailsCard title={cardTitle} action={cardAction} busy={state.status === 'loading' || action !== null}>
        {state.status === 'loading' && <Styled.Message role="status">Загрузка медработника…</Styled.Message>}
        {state.status === 'error' && (
          <>
            <Styled.Message role="alert">
              {state.notFound ? 'Запись не существует или была удалена.' : 'Проверьте соединение и повторите попытку.'}
            </Styled.Message>
            {!state.notFound && <Styled.ActionButton onClick={() => setRequestVersion((previous) => previous + 1)}>Повторить</Styled.ActionButton>}
            <Styled.ActionButton onClick={() => navigate(listPath)}>К списку медработников</Styled.ActionButton>
          </>
        )}
        {(state.status === 'new' || worker) && (
          <>
            {saved && <Styled.Feedback severity="success" role="status">Изменения сохранены</Styled.Feedback>}
            {restored && <Styled.Feedback severity="success" role="status">Сотрудник восстановлен и снова активен.</Styled.Feedback>}
            {worker?.is_deleted ? (
              <>
                <Styled.Feedback severity="info">Сотрудник не активен. Восстановите его, чтобы редактировать данные.</Styled.Feedback>
                <Styled.Details>
                  <dt>Имя</dt><dd>{worker.first_name}</dd>
                  <dt>Фамилия</dt><dd>{worker.last_name}</dd>
                  <dt>Должность</dt><dd>{worker.position}</dd>
                </Styled.Details>
                {restoreError && <Styled.Feedback severity="error">{restoreError}</Styled.Feedback>}
              </>
            ) : (
              <MedicalWorkerForm
                key={worker?.id ?? 'new'}
                initialValues={worker ?? undefined}
                busy={action !== null}
                submitLabel={worker ? 'Сохранить изменения' : 'Создать медработника'}
                onSubmit={handleSave}
                onCancel={() => navigate(listPath)}
                onEdit={() => { setSaved(false); setRestored(false) }}
              />
            )}
          </>
        )}
      </DetailsCard>
      <Dialog
        open={deleteOpen}
        onClose={() => { if (!action) setDeleteOpen(false) }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="delete-worker-title"
        aria-describedby="delete-worker-description"
      >
        <DialogTitle id="delete-worker-title">Удалить медработника?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-worker-description">
            {worker?.first_name} {worker?.last_name} исчезнет из списка. Данные медработника и его история сохранятся.
          </DialogContentText>
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

export default MedicalWorker
