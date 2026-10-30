import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import { connectAudit, type AuditEvent } from '../../../api/audit'
import { getAdminAuthStatus } from '../../../api/adminAuth'
import { mergeAuditEvents } from './auditEvents'
import * as Styled from './AuditList.styles'

const formatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
})

const actorLabel = (event: AuditEvent) => event.actor_label
  || (event.actor.startsWith('account:') ? 'Неизвестный аккаунт' : event.actor.startsWith('anonymous:') ? 'Неавторизованный запрос' : 'Система')

const AuditList = () => {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    const stream = connectAudit()
    const receive = (snapshot: boolean) => (message: MessageEvent<string>) => {
      try {
        if (snapshot) {
          const entries: AuditEvent[] = JSON.parse(message.data)
          setEvents(mergeAuditEvents([], entries))
        } else {
          const entry: AuditEvent = JSON.parse(message.data)
          setEvents((previous) => mergeAuditEvents(previous, [entry]))
        }
        setLoaded(true)
        setError(false)
      } catch { setError(true) }
    }
    stream.addEventListener('snapshot', receive(true))
    stream.addEventListener('audit', receive(false))
    stream.onerror = () => {
      setError(true)
      window.dispatchEvent(new Event('administrator-session-expired'))
      void getAdminAuthStatus().then(status => {
        if (!cancelled && status.authenticated && stream.readyState === EventSource.CLOSED) setVersion(value => value + 1)
      }).catch(() => {})
    }
    return () => { cancelled = true; stream.close() }
  }, [version])

  return (
    <Styled.Container>
      <Styled.Toolbar>
        <Styled.Message>Событий: {loaded ? events.length : '—'}</Styled.Message>
        <Styled.Live data-error={error}>{error ? 'Переподключение…' : loaded ? 'Обновление в реальном времени' : 'Подключение…'}</Styled.Live>
      </Styled.Toolbar>
      <Styled.Hint>Новые события показаны сверху. Записи доступны только для просмотра.</Styled.Hint>
      {error && <Alert severity="warning" action={<Styled.Retry onClick={() => setVersion((value) => value + 1)}>Повторить</Styled.Retry>}>
        Соединение с аудитом прервано. {loaded ? 'Последние загруженные записи сохранены.' : ''} Переподключаемся автоматически.
      </Alert>}
      {!loaded && !error && <Styled.Message role="status">Загрузка аудита…</Styled.Message>}
      {loaded && events.length === 0 && <Styled.Message role="status">Событий аудита пока нет.</Styled.Message>}
      {events.length > 0 && <Styled.TableContainer tabIndex={0} role="region" aria-label="Журнал аудита">
        <Table aria-label="События аудита">
          <TableHead><TableRow>
            <TableCell scope="col">Дата и время</TableCell>
            <TableCell scope="col">Инициатор</TableCell>
            <TableCell scope="col">Событие</TableCell>
          </TableRow></TableHead>
          <TableBody>{events.map((event) => <TableRow key={event.event_id}>
            <Styled.DateCell><time dateTime={event.event_time} title={`ID события: ${event.event_id}`}>{formatter.format(new Date(event.event_time))}</time></Styled.DateCell>
            <TableCell title={event.actor}><Styled.ActorName>{actorLabel(event)}</Styled.ActorName></TableCell>
            <Styled.EventCell>{event.display_message ?? event.message}</Styled.EventCell>
          </TableRow>)}</TableBody>
        </Table>
      </Styled.TableContainer>}
    </Styled.Container>
  )
}

export default AuditList
