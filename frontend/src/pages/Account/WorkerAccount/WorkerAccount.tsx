import { useEffect, useState, type FormEvent } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CopyableSecret from '../../../shared/ui/CopyableSecret/CopyableSecret'
import { createWorkerAccount, getWorkerAccount, resetWorkerPassword, setWorkerAccountActive, type AccountCredentials, type WorkerAccount as WorkerAccountData } from '../../../api/accounts'
import * as Styled from './WorkerAccount.styles'

type Props = { workerId: number; deleted: boolean; busy: boolean; onBusyChange: (busy: boolean) => void; standalone?: boolean }
type State = { status: 'loading' | 'error' } | { status: 'loaded'; account: WorkerAccountData | null }

const WorkerAccount = ({ workerId, deleted, busy, onBusyChange, standalone = false }: Props) => {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [credentials, setCredentials] = useState<AccountCredentials | null>(null)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    getWorkerAccount(workerId, controller.signal)
      .then((account) => { if (!controller.signal.aborted) setState({ status: 'loaded', account }) })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }) })
    return () => controller.abort()
  }, [workerId, deleted, version])

  const account = state.status === 'loaded' ? state.account : null
  const disabled = busy || deleted

  const mutate = async (operation: () => Promise<void>) => {
    if (disabled) return
    onBusyChange(true)
    setError('')
    setSuccess('')
    try {
      await operation()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось изменить аккаунт.')
    } finally {
      onBusyChange(false)
    }
  }

  const showCredentials = (result: AccountCredentials) => {
    setState({ status: 'loaded', account: result.account })
    setCredentials(result)
    setResetOpen(false)
  }

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const login = username.trim()
    if ([...login].length < 3 || [...login].length > 16) {
      setUsernameError('Введите от 3 до 16 символов.')
      return
    }
    setUsernameError('')
    await mutate(async () => showCredentials(await createWorkerAccount(workerId, login)))
  }

  return (
    <Styled.Section data-standalone={standalone} aria-labelledby={standalone ? undefined : 'worker-account-title'} aria-label={standalone ? 'Управление аккаунтом' : undefined} aria-busy={busy || state.status === 'loading'}>
      {!standalone && <Styled.Title id="worker-account-title">Аккаунт пользователя</Styled.Title>}
      {error && <Styled.Feedback severity="error">{error}</Styled.Feedback>}
      {success && <Styled.Feedback severity="success" role="status">{success}</Styled.Feedback>}
      {state.status === 'loading' && <Styled.Text role="status">Загрузка аккаунта…</Styled.Text>}
      {state.status === 'error' && <>
        <Styled.Feedback severity="error">Не удалось загрузить аккаунт.</Styled.Feedback>
        <Styled.ActionButton onClick={() => { setState({ status: 'loading' }); setVersion((value) => value + 1) }}>Повторить</Styled.ActionButton>
      </>}
      {state.status === 'loaded' && (account ? <>
        <Styled.Details>
          <dt>Логин</dt><dd>{account.username}</dd>
          <dt>Статус</dt><dd>{account.is_active ? 'Активен' : 'Неактивен'}</dd>
          <dt>ID аккаунта</dt><dd>{account.id}</dd>
        </Styled.Details>
        <Styled.Actions>
          <Styled.ActionButton variant="outlined" disabled={disabled} onClick={() => setResetOpen(true)}>Сгенерировать новый пароль</Styled.ActionButton>
          <Styled.ActionButton variant="outlined" color={account.is_active ? 'error' : 'primary'} disabled={disabled} onClick={() => void mutate(async () => {
            const updated = await setWorkerAccountActive(workerId, !account.is_active)
            setState({ status: 'loaded', account: updated })
            setSuccess(updated.is_active ? 'Аккаунт активирован.' : 'Аккаунт деактивирован.')
          })}>{account.is_active ? 'Деактивировать' : 'Активировать'}</Styled.ActionButton>
        </Styled.Actions>
      </> : <>
        <Styled.Text>Аккаунт ещё не создан. Укажите логин — пароль будет сгенерирован автоматически.</Styled.Text>
        {!deleted && <Styled.Form onSubmit={(event) => void create(event)} noValidate>
          <Styled.Field label="Логин" name="username" autoComplete="off" value={username} disabled={disabled}
            error={Boolean(usernameError)} helperText={usernameError || 'От 3 до 16 символов'} fullWidth
            onChange={(event) => { setUsername(event.target.value); setUsernameError(''); setError('') }} />
          <Styled.ActionButton type="submit" variant="contained" disabled={disabled}>Создать аккаунт</Styled.ActionButton>
        </Styled.Form>}
      </>)}
      {deleted && <Styled.Text>Для управления аккаунтом сначала восстановите медработника.</Styled.Text>}
      <Dialog open={resetOpen} onClose={() => { if (!busy) setResetOpen(false) }} fullWidth maxWidth="xs" aria-labelledby="reset-password-title">
        <DialogTitle id="reset-password-title">Сгенерировать новый пароль?</DialogTitle>
        <DialogContent><DialogContentText>Прежний пароль перестанет действовать. Новый пароль нужно передать медработнику.</DialogContentText>
          {error && <Styled.Feedback severity="error">{error}</Styled.Feedback>}
        </DialogContent>
        <DialogActions>
          <Styled.ActionButton disabled={busy} onClick={() => setResetOpen(false)}>Отмена</Styled.ActionButton>
          <Styled.ActionButton variant="contained" disabled={busy} onClick={() => void mutate(async () => showCredentials(await resetWorkerPassword(workerId)))}>Сгенерировать</Styled.ActionButton>
        </DialogActions>
      </Dialog>
      <Dialog open={credentials !== null} onClose={() => setCredentials(null)} fullWidth maxWidth="xs" aria-labelledby="account-credentials-title">
        <DialogTitle id="account-credentials-title">Данные для входа</DialogTitle>
        <DialogContent>
          <DialogContentText>Сохраните пароль и передайте его медработнику. После закрытия этого окна посмотреть пароль повторно нельзя.</DialogContentText>
          <Styled.Details><dt>Логин</dt><dd>{credentials?.account.username}</dd></Styled.Details>
          <Styled.Text>Пароль · 12 символов</Styled.Text>
          <CopyableSecret value={credentials?.password ?? ''} />
        </DialogContent>
        <DialogActions><Styled.ActionButton variant="contained" onClick={() => setCredentials(null)}>Я сохранил пароль</Styled.ActionButton></DialogActions>
      </Dialog>
    </Styled.Section>
  )
}

export default WorkerAccount
