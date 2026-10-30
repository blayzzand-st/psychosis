import { useEffect, useState } from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import SvgIcon from '@mui/material/SvgIcon'
import Tooltip from '@mui/material/Tooltip'
import Switch from '@mui/material/Switch'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import CreateAccountDialog from './CreateAccountDialog'
import { changeAccountActive, deleteAccount, getAccounts, type UserAccount } from '../../../api/accounts'
import { filterAccounts } from './accountSearch'
import * as Styled from './AccountList.styles'

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; accounts: UserAccount[] }

const dateFormatter = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })
const CompactDate = ({ value }: { value: string }) => (
  <Styled.DateTime dateTime={value} title={new Date(value).toLocaleString('ru-RU')}>
    <span>{dateFormatter.format(new Date(value))}</span><Styled.Time>{timeFormatter.format(new Date(value))}</Styled.Time>
  </Styled.DateTime>
)

const AccountList = () => {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<UserAccount | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    getAccounts(controller.signal)
      .then((accounts) => {
        if (!controller.signal.aborted) setState({ status: 'loaded', accounts })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [requestVersion])

  const refresh = () => {
    setState({ status: 'loading' })
    setRequestVersion((value) => value + 1)
  }

  const finish = (id: string) => setPending((current) => {
    const next = new Set(current)
    next.delete(id)
    return next
  })

  const toggleActive = async (account: UserAccount) => {
    if (pending.has(account.id)) return
    setPending((current) => new Set(current).add(account.id))
    setActionError('')
    try {
      const updated = await changeAccountActive(account.id, !account.is_active)
      setState((current) => current.status === 'loaded' ? {
        status: 'loaded', accounts: current.accounts.map((item) => item.id === account.id ? { ...item, ...updated } : item),
      } : current)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Не удалось изменить активность аккаунта.')
    } finally { finish(account.id) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget || pending.has(deleteTarget.id)) return
    const id = deleteTarget.id
    setPending((current) => new Set(current).add(id))
    setDeleteError('')
    try {
      await deleteAccount(id)
      setState((current) => current.status === 'loaded' ? {
        status: 'loaded', accounts: current.accounts.filter((account) => account.id !== id),
      } : current)
      setDeleteTarget(null)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить аккаунт.')
    } finally { finish(id) }
  }

  const visibleAccounts = state.status === 'loaded' ? filterAccounts(state.accounts, query) : []
  const deleting = Boolean(deleteTarget && pending.has(deleteTarget.id))

  return (
    <Styled.Container aria-busy={state.status === 'loading'}>
      <Styled.Toolbar>
        <Styled.Count role="status">{query.trim() && state.status === 'loaded'
          ? `Найдено: ${visibleAccounts.length} из ${state.accounts.length}`
          : `Всего: ${state.status === 'loaded' ? state.accounts.length : '—'}`}</Styled.Count>
        <Styled.ToolbarActions>
          <Styled.CreateButton variant="contained" disabled={pending.size > 0} onClick={() => setCreateOpen(true)}>Создать аккаунт</Styled.CreateButton>
          <Tooltip title={state.status === 'error' ? 'Повторить загрузку' : 'Обновить список'}>
            <span><Styled.RefreshButton aria-label="Обновить список аккаунтов" onClick={refresh} disabled={state.status === 'loading' || pending.size > 0}>
              <SvgIcon aria-hidden="true" viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.93 9h-2.02A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3z" /></SvgIcon>
            </Styled.RefreshButton></span>
          </Tooltip>
        </Styled.ToolbarActions>
      </Styled.Toolbar>
      <Styled.SearchField type="search" fullWidth label="Поиск аккаунта" placeholder="Логин или имя медработника"
        value={query} onChange={(event) => setQuery(event.target.value)} />
      {actionError && <Alert severity="error" onClose={() => setActionError('')}>{actionError}</Alert>}
      {state.status === 'loading' && <Styled.Message role="status">Загрузка аккаунтов…</Styled.Message>}
      {state.status === 'error' && <Styled.ErrorMessage role="alert">Не удалось загрузить список аккаунтов.</Styled.ErrorMessage>}
      {state.status === 'loaded' && (state.accounts.length === 0 ? (
        <Styled.Message role="status">Аккаунты пока не созданы.</Styled.Message>
      ) : visibleAccounts.length === 0 ? <Styled.Message role="status">По вашему запросу ничего не найдено.</Styled.Message> : (
        <Styled.TableContainer tabIndex={0} role="region" aria-label="Список аккаунтов">
          <Table aria-label="Аккаунты пользователей">
            <TableHead>
              <TableRow>
                <TableCell scope="col">Логин</TableCell>
                <TableCell scope="col">Медработник</TableCell>
                <TableCell scope="col">Статус</TableCell>
                <TableCell scope="col">Создан</TableCell>
                <TableCell scope="col">Обновлён</TableCell>
                <TableCell scope="col" align="right">Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleAccounts.map((account) => (
                <TableRow key={account.id} aria-busy={pending.has(account.id)}>
                  <Styled.UsernameCell component="th" scope="row">{account.medical_worker_id
                    ? <Styled.WorkerLink to={`/administrator/medical-workers/${account.medical_worker_id}/account`}>{account.username}</Styled.WorkerLink>
                    : account.username}</Styled.UsernameCell>
                  <TableCell>
                    {account.medical_worker ? (
                      <>
                        <Styled.WorkerLink to={`/administrator/medical-workers/${account.medical_worker.id}${account.medical_worker.is_deleted ? '?include_deleted=true' : ''}`}>
                          {account.medical_worker.first_name} {account.medical_worker.last_name}
                        </Styled.WorkerLink>
                        {account.medical_worker.is_deleted && <Styled.WorkerNote>Медработник не активен</Styled.WorkerNote>}
                      </>
                    ) : 'Не привязан'}
                  </TableCell>
                  <TableCell>
                    <Styled.Status data-active={account.is_active}>{account.is_active ? 'Активен' : 'Неактивен'}</Styled.Status>
                  </TableCell>
                  <TableCell><CompactDate value={account.created_at} /></TableCell>
                  <TableCell><CompactDate value={account.updated_at} /></TableCell>
                  <TableCell align="right">
                    <Styled.RowActions>
                    <Tooltip title={account.medical_worker?.is_deleted && !account.is_active ? 'Сначала восстановите медработника' : account.is_active ? 'Деактивировать' : 'Активировать'}>
                      <span><Switch size="small" checked={account.is_active}
                        disabled={pending.has(account.id) || deleteTarget?.id === account.id || Boolean(account.medical_worker?.is_deleted && !account.is_active)}
                        onChange={() => void toggleActive(account)}
                        slotProps={{ input: { 'aria-label': `${account.is_active ? 'Деактивировать' : 'Активировать'} аккаунт ${account.username}` } }} />
                      </span>
                    </Tooltip>
                    <Tooltip title="Удалить аккаунт"><span><Styled.DeleteButton aria-label={`Удалить аккаунт ${account.username}`}
                      disabled={pending.has(account.id)} onClick={() => { setDeleteError(''); setDeleteTarget(account) }}>
                      <SvgIcon aria-hidden="true" viewBox="0 0 24 24"><path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zm3-9h2v8H9zm4 0h2v8h-2zm2.5-6-1-1h-5l-1 1H5v2h14V4z" /></SvgIcon>
                    </Styled.DeleteButton></span></Tooltip>
                    </Styled.RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Styled.TableContainer>
      ))}
      {createOpen && <CreateAccountDialog onClose={() => setCreateOpen(false)} onCreated={refresh} />}
      <Dialog open={deleteTarget !== null} onClose={() => { if (!deleting) setDeleteTarget(null) }} fullWidth maxWidth="xs" aria-labelledby="delete-account-title">
        <DialogTitle id="delete-account-title">Удалить аккаунт?</DialogTitle>
        <DialogContent>
          <DialogContentText>Аккаунт «{deleteTarget?.username}» будет удалён без возможности восстановления. Медработник и его медицинская история сохранятся.</DialogContentText>
          {deleteError && <Alert severity="error">{deleteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Styled.CreateButton disabled={deleting} onClick={() => setDeleteTarget(null)}>Отмена</Styled.CreateButton>
          <Styled.CreateButton variant="contained" color="error" disabled={deleting} onClick={() => void confirmDelete()}>{deleting ? 'Удаление…' : 'Удалить'}</Styled.CreateButton>
        </DialogActions>
      </Dialog>
    </Styled.Container>
  )
}

export default AccountList
