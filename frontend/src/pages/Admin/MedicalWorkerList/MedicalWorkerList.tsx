import { useEffect, useState } from 'react'
import Checkbox from '@mui/material/Checkbox'
import { useSearchParams } from 'react-router'
import { getMedicalWorkers, type MedicalWorker } from '../../../api/medicalWorkers'
import * as Styled from './MedicalWorkerList.styles'

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; workers: MedicalWorker[] }

const MedicalWorkerList = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const includeDeleted = searchParams.get('include_deleted') === 'true'
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    getMedicalWorkers(controller.signal, includeDeleted)
      .then((workers) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', workers: workers.filter((worker) => worker.is_deleted === includeDeleted) })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'error' })
        }
      })

    return () => controller.abort()
  }, [requestVersion, includeDeleted])

  const toggleDeleted = (checked: boolean) => {
    setState({ status: 'loading' })
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (checked) next.set('include_deleted', 'true')
      else next.delete('include_deleted')
      return next
    }, { replace: true })
  }

  const retry = () => {
    setState({ status: 'loading' })
    setRequestVersion((version) => version + 1)
  }

  return (
    <Styled.Container aria-busy={state.status === 'loading'}>
      <Styled.Toolbar>
        <Styled.Count role="status">Всего: {state.status === 'loaded' ? state.workers.length : '—'}</Styled.Count>
        <Styled.CreateLink to={`/administrator/medical-workers/new${includeDeleted ? '?include_deleted=true' : ''}`}>
          Добавить медработника
        </Styled.CreateLink>
      </Styled.Toolbar>
      <Styled.FilterLabel
        control={<Checkbox checked={includeDeleted} onChange={(_, checked) => toggleDeleted(checked)} />}
        label="Показать неактивные записи"
      />
      {state.status === 'loading' && (
        <Styled.Message role="status">Загрузка медработников…</Styled.Message>
      )}

      {state.status === 'error' && (
        <>
          <Styled.ErrorMessage role="alert">
            Не удалось загрузить список медработников.
          </Styled.ErrorMessage>
          <Styled.RetryButton type="button" onClick={retry} variant="outlined">
            Повторить
          </Styled.RetryButton>
        </>
      )}

      {state.status === 'loaded' && (
        state.workers.length === 0 ? (
          <Styled.Message role="status">
            {includeDeleted ? 'Неактивных записей нет.' : 'Медработники пока не добавлены.'}
          </Styled.Message>
        ) : (
          <>
            <Styled.WorkerList aria-label="Медработники">
              {state.workers.map((worker) => (
                <Styled.WorkerRow key={worker.id}>
                  <Styled.WorkerLink to={`/administrator/medical-workers/${worker.id}${includeDeleted ? '?include_deleted=true' : ''}`}>
                    <Styled.WorkerName>
                      {worker.first_name} {worker.last_name}
                    </Styled.WorkerName>
                    {worker.is_deleted && <Styled.DeletedBadge>Не активен</Styled.DeletedBadge>}
                    <Styled.WorkerPosition>{worker.position}</Styled.WorkerPosition>
                  </Styled.WorkerLink>
                </Styled.WorkerRow>
              ))}
            </Styled.WorkerList>
          </>
        )
      )}
    </Styled.Container>
  )
}

export default MedicalWorkerList
