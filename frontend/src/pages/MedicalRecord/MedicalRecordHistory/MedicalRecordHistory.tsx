import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getMedicalRecordAt, getMedicalRecordHistory, MedicalRecordApiError,
  type MedicalRecord, type MedicalRecordChange, type MedicalRecordHistoryEntry,
} from '../../../api/medicalRecords'
import * as Styled from './MedicalRecordHistory.styles'

type MedicalRecordHistoryProps = { patientId: number; version: number; active: boolean }
const formatTime = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'medium',
}).format(new Date(value))

const describeChange = (change: MedicalRecordChange) => {
  switch (change.kind) {
    case 'record_created': return 'Создана ЭМК'
    case 'record_saved': return 'Сохранение без изменений'
    case 'diagnosis_added': return `Добавлен диагноз: ${change.data.code} — ${change.data.name}`
    case 'diagnosis_removed': return `Удалён диагноз: ${change.data.code} — ${change.data.name}`
    case 'prescription_added': return `Добавлено назначение: ${change.data.text}`
    case 'prescription_cancelled': return `Отменено назначение: ${change.data.text}`
  }
}

const MedicalRecordHistory = ({ patientId, version, active }: MedicalRecordHistoryProps) => {
  const [entries, setEntries] = useState<MedicalRecordHistoryEntry[]>([])
  const [snapshot, setSnapshot] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [at, setAt] = useState('')
  const [snapshotTitle, setSnapshotTitle] = useState('')
  const [retry, setRetry] = useState(0)
  const timeRequest = useRef<AbortController | null>(null)
  const snapshotView = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (snapshot) snapshotView.current?.scrollIntoView({ block: 'start' })
  }, [snapshot])

  useEffect(() => {
    const controller = new AbortController()
    timeRequest.current?.abort()
    const load = async () => {
      if (!active) return
      setLoading(true)
      setError('')
      try {
        const history = await getMedicalRecordHistory(patientId, controller.signal)
        if (!controller.signal.aborted) setEntries(history)
      } catch {
        if (!controller.signal.aborted) setError('Не удалось загрузить историю. Повторите попытку.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => { controller.abort(); timeRequest.current?.abort() }
  }, [patientId, version, active, retry])

  const showAt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!at || loading) return
    timeRequest.current?.abort()
    const controller = new AbortController()
    timeRequest.current = controller
    setLoading(true)
    setError('')
    setSnapshot(null)
    try {
      // The input is explicitly Moscow time, independent of the browser's local timezone.
      const record = await getMedicalRecordAt(patientId, new Date(`${at}+03:00`).toISOString(), controller.signal)
      if (!controller.signal.aborted) {
        setSnapshot(record)
        setSnapshotTitle(`Состояние на ${formatTime(new Date(`${at}+03:00`).toISOString())} (Москва)`)
      }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof MedicalRecordApiError ? failure.message : 'Не удалось получить состояние ЭМК.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <Styled.Section aria-label="История изменений ЭМК">
      <Styled.Content aria-busy={loading}>
          <Styled.TimeForm onSubmit={showAt}>
            <Styled.Field type="datetime-local" label="Состояние на момент (Москва)" value={at}
              disabled={loading} required slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: '1' } }}
              onChange={(event) => setAt(event.target.value)} />
            <Styled.ActionButton type="submit" variant="outlined" disabled={!at || loading}>Показать состояние</Styled.ActionButton>
          </Styled.TimeForm>
          {error && <Styled.Feedback severity="error">{error}</Styled.Feedback>}
          {error && <Styled.ActionButton disabled={loading} onClick={() => setRetry((previous) => previous + 1)}>Обновить историю</Styled.ActionButton>}
          {loading && <Styled.Message role="status">Загрузка истории…</Styled.Message>}
          {snapshot && (
            <Styled.Snapshot ref={snapshotView} aria-label="Сохранённое состояние ЭМК">
              <Styled.Subtitle>{snapshotTitle}</Styled.Subtitle>
              <Styled.Message>Версия {snapshot.version}. Просмотр истории не изменяет текущую карту.</Styled.Message>
              {snapshot.edited_by && snapshot.updated_at && <Styled.Message>
                Сохранено: {formatTime(snapshot.updated_at)} · {snapshot.edited_by.first_name} {snapshot.edited_by.last_name}
              </Styled.Message>}
              <Styled.Subtitle>Диагнозы на этот момент</Styled.Subtitle>
              {snapshot.diagnoses.length ? <Styled.DataList>{snapshot.diagnoses.map((item) => <li key={item.diagnosis_id}>{item.code} — {item.name}</li>)}</Styled.DataList> : <Styled.Message>Диагнозов нет.</Styled.Message>}
              <Styled.Subtitle>Назначения на этот момент</Styled.Subtitle>
              {snapshot.prescriptions.length ? <Styled.DataList>{snapshot.prescriptions.map((text, index) => <li key={index}>{text}</li>)}</Styled.DataList> : <Styled.Message>Назначений нет.</Styled.Message>}
            </Styled.Snapshot>
          )}
          {!loading && entries.length === 0 && !error && <Styled.Message>История пока пуста.</Styled.Message>}
          <Styled.Journal aria-label="Сохранения ЭМК">
            {[...entries].reverse().map((entry) => (
              <Styled.Entry key={entry.version}>
                <Styled.Subtitle>Версия {entry.version} · {entry.updated_at && formatTime(entry.updated_at)} (Москва)</Styled.Subtitle>
                {entry.edited_by && <Styled.Message>{entry.edited_by.first_name} {entry.edited_by.last_name} · {entry.edited_by.position}</Styled.Message>}
                <Styled.DataList>{entry.changes.map((change, index) => <li key={index}>{describeChange(change)}</li>)}</Styled.DataList>
                <Styled.ActionButton disabled={loading} onClick={() => {
                  setSnapshot(entry); setSnapshotTitle(`Состояние после сохранения версии ${entry.version}`); setError('')
                }}>Посмотреть версию {entry.version}</Styled.ActionButton>
              </Styled.Entry>
            ))}
          </Styled.Journal>
      </Styled.Content>
    </Styled.Section>
  )
}

export default MedicalRecordHistory
