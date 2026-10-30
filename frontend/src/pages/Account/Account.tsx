import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getMedicalWorker, type MedicalWorker } from '../../api/medicalWorkers'
import BackButton from '../../shared/ui/BackButton/BackButton'
import DetailsCard from '../../shared/ui/DetailsCard/DetailsCard'
import WorkerAccount from './WorkerAccount/WorkerAccount'
import * as Styled from './Account.styles'

const Account = () => {
  const { workerId = '' } = useParams()
  const [state, setState] = useState<{ workerId: string; worker: MedicalWorker | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        if (!/^\d+$/.test(workerId) || !Number.isSafeInteger(Number(workerId)) || Number(workerId) < 1) throw new Error('Invalid id')
        const worker = await getMedicalWorker(Number(workerId), controller.signal, true)
        if (!controller.signal.aborted) setState({ workerId, worker })
      } catch {
        if (!controller.signal.aborted) setState({ workerId, worker: null })
      }
    }
    void load()
    return () => controller.abort()
  }, [workerId, version])
  const loading = !state || state.workerId !== workerId
  const worker = !loading ? state.worker : null
  return (
    <Styled.Page>
      <Styled.BackNav><BackButton fallbackTo="/administrator/accounts" /></Styled.BackNav>
      <DetailsCard title="Аккаунт пользователя" busy={loading || busy}>
        {loading ? <Styled.Message role="status">Загрузка аккаунта…</Styled.Message> : worker ? <>
          <Styled.WorkerDetails><dt>Медработник</dt><dd>{worker.first_name} {worker.last_name}</dd></Styled.WorkerDetails>
          <WorkerAccount key={worker.id} workerId={worker.id} deleted={worker.is_deleted} busy={busy} onBusyChange={setBusy} standalone />
          <Styled.WorkerLink to={`/administrator/medical-workers/${worker.id}${worker.is_deleted ? '?include_deleted=true' : ''}`}>Карточка медработника</Styled.WorkerLink>
        </> : <>
          <Styled.Message role="alert">Не удалось загрузить медработника. Проверьте адрес и соединение.</Styled.Message>
          <Styled.RetryButton onClick={() => setVersion((value) => value + 1)}>Повторить</Styled.RetryButton>
        </>}
      </DetailsCard>
    </Styled.Page>
  )
}

export default Account
