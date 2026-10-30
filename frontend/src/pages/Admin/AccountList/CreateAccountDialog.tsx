import { useEffect, useState, type FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CopyableSecret from '../../../shared/ui/CopyableSecret/CopyableSecret'
import { createWorkerAccount, getAccounts, type AccountCredentials } from '../../../api/accounts'
import { getMedicalWorkers, type MedicalWorker } from '../../../api/medicalWorkers'
import * as Styled from './AccountList.styles'

type Props = { onClose: () => void; onCreated: () => void }

const CreateAccountDialog = ({ onClose, onCreated }: Props) => {
  const [workers, setWorkers] = useState<MedicalWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [workerId, setWorkerId] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [credentials, setCredentials] = useState<AccountCredentials | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([getMedicalWorkers(controller.signal), getAccounts(controller.signal)])
      .then(([staff, accounts]) => {
        if (controller.signal.aborted) return
        const assigned = new Set(accounts.map((account) => account.medical_worker_id))
        setWorkers(staff.filter((worker) => !worker.is_deleted && !assigned.has(worker.id)))
        setLoading(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) { setError('Не удалось загрузить медработников.'); setLoading(false) }
      })
    return () => controller.abort()
  }, [version])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!workerId || [...username.trim()].length < 3 || [...username.trim()].length > 16) {
      setError('Выберите медработника и укажите логин от 3 до 16 символов.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setCredentials(await createWorkerAccount(Number(workerId), username.trim()))
      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось создать аккаунт.')
    } finally { setBusy(false) }
  }

  return (
    <Dialog open onClose={() => { if (!busy) onClose() }} fullWidth maxWidth="sm" aria-labelledby="create-account-title">
      <DialogTitle id="create-account-title">{credentials ? 'Данные для входа' : 'Создать аккаунт'}</DialogTitle>
      <DialogContent>
        {credentials ? <>
          <DialogContentText>Сохраните пароль и передайте медработнику. После закрытия окна посмотреть его повторно нельзя.</DialogContentText>
          <Styled.CredentialsLabel>Логин: {credentials.account.username}</Styled.CredentialsLabel>
          <CopyableSecret value={credentials.password} />
        </> : <>
          <DialogContentText>Выберите медработника без аккаунта. Пароль из 12 символов будет сгенерирован автоматически.</DialogContentText>
          {error && <Alert severity="error">{error}</Alert>}
          {loading ? <Styled.Message role="status">Загрузка медработников…</Styled.Message> : workers.length === 0 ? <>
            <Styled.Message>Нет доступных медработников без аккаунта.</Styled.Message>
            {error && <Styled.CreateButton onClick={() => { setError(''); setLoading(true); setVersion((value) => value + 1) }}>Повторить</Styled.CreateButton>}
          </> : <Styled.CreateForm id="create-account-form" onSubmit={(event) => void submit(event)} noValidate>
            <TextField select fullWidth label="Медработник" value={workerId} disabled={busy} onChange={(event) => setWorkerId(event.target.value)}>
              {workers.map((worker) => <MenuItem key={worker.id} value={String(worker.id)}>{worker.first_name} {worker.last_name} • {worker.position}</MenuItem>)}
            </TextField>
            <TextField fullWidth label="Логин" autoComplete="off" value={username} helperText="От 3 до 16 символов" disabled={busy} onChange={(event) => setUsername(event.target.value)} />
          </Styled.CreateForm>}
        </>}
      </DialogContent>
      <DialogActions>
        {credentials ? <Styled.CreateButton variant="contained" onClick={onClose}>Я сохранил пароль</Styled.CreateButton> : <>
          <Styled.CreateButton disabled={busy} onClick={onClose}>Отмена</Styled.CreateButton>
          <Styled.CreateButton variant="contained" type="submit" form="create-account-form" disabled={busy || loading || workers.length === 0 || !workerId}>
            {busy ? 'Создание…' : 'Создать аккаунт'}
          </Styled.CreateButton>
        </>}
      </DialogActions>
    </Dialog>
  )
}

export default CreateAccountDialog
