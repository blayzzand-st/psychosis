import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import { useNavigate, useParams } from 'react-router'
import {
  createDiagnosis,
  deleteDiagnosis,
  getDiagnosis,
  updateDiagnosis,
  DiagnosisApiError,
  type Diagnosis as DiagnosisData,
  type DiagnosisWrite,
} from '../../api/diagnoses'
import BackButton from '../../shared/ui/BackButton/BackButton'
import { diagnosisRegistryPath } from '../../shared/config/routes'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import DiagnosisForm from './DiagnosisForm/DiagnosisForm'
import * as Styled from './Diagnosis.styles'

type PageState =
  | { status: 'new' }
  | { status: 'loading' }
  | { status: 'error'; notFound: boolean }
  | { status: 'loaded'; diagnosis: DiagnosisData }

const listPath = diagnosisRegistryPath

const Diagnosis = () => {
  const { diagnosisId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<PageState>({ status: diagnosisId ? 'loading' : 'new' })
  const [requestVersion, setRequestVersion] = useState(0)
  const [action, setAction] = useState<'saving' | 'deleting' | null>(null)
  const [saved, setSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!diagnosisId) return
    const controller = new AbortController()
    const load = async () => {
      setState({ status: 'loading' })
      setSaved(false)
      setDeleteOpen(false)
      const id = Number(diagnosisId)
      if (!/^\d+$/.test(diagnosisId) || !Number.isSafeInteger(id) || id < 1) {
        setState({ status: 'error', notFound: true })
        return
      }
      try {
        const diagnosis = await getDiagnosis(id, controller.signal)
        if (!controller.signal.aborted) setState({ status: 'loaded', diagnosis })
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: 'error', notFound: error instanceof DiagnosisApiError && error.status === 404 })
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [diagnosisId, requestVersion])

  const handleSave = async (values: DiagnosisWrite) => {
    setAction('saving')
    setSaved(false)
    try {
      if (state.status === 'new') {
        const diagnosis = await createDiagnosis(values)
        navigate(`/administrator/diagnoses/${diagnosis.id}`, { replace: true })
      } else if (state.status === 'loaded') {
        const diagnosis = await updateDiagnosis(state.diagnosis.id, values)
        setState({ status: 'loaded', diagnosis })
        setSaved(true)
      }
    } finally {
      setAction(null)
    }
  }

  const handleDelete = async () => {
    if (state.status !== 'loaded' || action) return
    setAction('deleting')
    setDeleteError('')
    try {
      await deleteDiagnosis(state.diagnosis.id)
      navigate(listPath, { replace: true })
    } catch {
      setDeleteError('Не удалось удалить диагноз. Повторите попытку.')
    } finally {
      setAction(null)
    }
  }

  const diagnosis = state.status === 'loaded' ? state.diagnosis : null
  const title = diagnosis ? diagnosis.name
    : state.status === 'error' ? (state.notFound ? 'Диагноз не найден' : 'Не удалось открыть диагноз')
      : state.status === 'new' ? 'Новый диагноз' : undefined

  return (
    <Styled.Page>
      <Styled.BackNav><BackButton fallbackTo={listPath} /></Styled.BackNav>
      <DetailsCard title={title} busy={state.status === 'loading' || action !== null} action={diagnosis && (
        <Styled.ActionButton color="error" disabled={action !== null} onClick={() => { setDeleteError(''); setDeleteOpen(true) }}>Удалить</Styled.ActionButton>
      )}>
        {state.status === 'loading' && <Styled.Message role="status">Загрузка диагноза…</Styled.Message>}
        {state.status === 'error' && (
          <>
            <Styled.Message role="alert">
              {state.notFound ? 'Запись не существует или была удалена.' : 'Проверьте соединение и повторите попытку.'}
            </Styled.Message>
            {!state.notFound && <Styled.ActionButton onClick={() => setRequestVersion((previous) => previous + 1)}>Повторить</Styled.ActionButton>}
            <Styled.ActionButton onClick={() => navigate(listPath)}>К реестру диагнозов</Styled.ActionButton>
          </>
        )}
        {(state.status === 'new' || diagnosis) && (
          <>
            {saved && <Styled.Feedback severity="success" role="status">Изменения сохранены</Styled.Feedback>}
            <DiagnosisForm key={diagnosis?.id ?? 'new'} initialValues={diagnosis ?? undefined} busy={action !== null}
              submitLabel={diagnosis ? 'Сохранить изменения' : 'Создать'} onSubmit={handleSave}
              onCancel={() => navigate(listPath)} onEdit={() => setSaved(false)} />
          </>
        )}
      </DetailsCard>
      <Dialog open={deleteOpen} onClose={() => { if (!action) setDeleteOpen(false) }} fullWidth maxWidth="xs"
        aria-labelledby="delete-diagnosis-title" aria-describedby="delete-diagnosis-description">
        <DialogTitle id="delete-diagnosis-title">Удалить диагноз?</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-diagnosis-description">«{diagnosis?.name}» будет полностью удалён из реестра без возможности восстановления.</DialogContentText>
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

export default Diagnosis
