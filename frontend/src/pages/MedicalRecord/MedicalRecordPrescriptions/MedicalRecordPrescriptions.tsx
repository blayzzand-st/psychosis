import { useEffect, useState } from 'react'
import { getMedicalRecordHistory, type MedicalRecord } from '../../../api/medicalRecords'
import type { PrescriptionDraft } from '../../../types/medicalRecord'
import { buildPrescriptionTimeline, type PrescriptionEpisode } from './prescriptionTimeline'
import * as Styled from './MedicalRecordPrescriptions.styles'

type MedicalRecordPrescriptionsProps = {
  record: MedicalRecord
  prescriptions: PrescriptionDraft[]
  errors: string[]
  editing: boolean
  busy: boolean
  onChange: (values: PrescriptionDraft[]) => void
}
type HistoryState = { status: 'loading' | 'error' } | { status: 'loaded'; episodes: PrescriptionEpisode[] }
const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value)) : 'дата неизвестна'

const MedicalRecordPrescriptions = ({ record, prescriptions, errors, editing, busy, onChange }: MedicalRecordPrescriptionsProps) => {
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setHistory({ status: 'loading' })
      try {
        const entries = await getMedicalRecordHistory(record.patient_id, controller.signal)
        if (!controller.signal.aborted) setHistory({ status: 'loaded', episodes: buildPrescriptionTimeline(entries, record.version) })
      } catch {
        if (!controller.signal.aborted) setHistory({ status: 'error' })
      }
    }
    void load()
    return () => controller.abort()
  }, [record.patient_id, record.version, retry])

  const episodes: PrescriptionEpisode[] = history.status === 'loaded' ? history.episodes : record.prescriptions.map((text, source) => ({
    key: `saved-${source}`, text, addedAt: null, endedAt: null, addedVersion: 0, endedVersion: null, active: true, source,
  }))
  const active = episodes.filter((episode) => episode.active).sort((a, b) => b.addedVersion - a.addedVersion)
  const ended = episodes.filter((episode) => !episode.active).sort((a, b) => (b.endedVersion ?? 0) - (a.endedVersion ?? 0))
  const added = prescriptions.map((draft, index) => ({ draft, index })).filter(({ draft }) => draft.source === null)

  const field = (draft: PrescriptionDraft, index: number, label: string) => <Styled.Field
    label={label} value={draft.text} disabled={busy} fullWidth error={Boolean(errors[index])}
    helperText={errors[index] || 'От 3 до 128 символов'}
    onChange={(event) => onChange(prescriptions.map((item, position) => position === index ? { ...item, text: event.target.value } : item))}
  />

  return (
    <Styled.Overview>
      {history.status === 'loading' && <Styled.Message role="status">Загрузка дат назначений и отмен…</Styled.Message>}
      {history.status === 'error' && <Styled.Feedback severity="error">
        Не удалось загрузить даты и отменённые назначения.
        <Styled.ActionButton type="button" onClick={() => setRetry((previous) => previous + 1)}>Повторить</Styled.ActionButton>
      </Styled.Feedback>}
      {history.status === 'loaded' && !active.length && !ended.length && !added.length && <Styled.Message>Назначений нет.</Styled.Message>}
      <Styled.List aria-label="Назначения пациента">
        {added.map(({ draft, index }) => <Styled.Row key={`draft-${index}`}>
          <Styled.RowHeader>
            <Styled.Status data-status="pending">Будет добавлено</Styled.Status>
          </Styled.RowHeader>
          {field(draft, index, 'Новое назначение')}
          <Styled.Dates>Дата назначения появится после сохранения.</Styled.Dates>
          <Styled.ActionButton type="button" color="error" disabled={busy} aria-label={`Отменить добавление назначения ${index + 1}`}
            onClick={() => onChange(prescriptions.filter((_, position) => position !== index))}>Отменить добавление</Styled.ActionButton>
        </Styled.Row>)}
        {active.map((episode) => {
          const index = prescriptions.findIndex((item) => item.source === episode.source)
          const draft = prescriptions[index]
          const cancelled = !draft
          const changed = draft && draft.text.trim() !== episode.text
          return <Styled.Row key={episode.key}>
            <Styled.RowHeader>
              {editing && draft ? <Styled.Label>Назначение</Styled.Label> : <Styled.Text>{episode.text}</Styled.Text>}
              <Styled.Status data-status={cancelled || changed ? 'pending' : 'active'}>
                {cancelled ? 'Будет отменено' : changed ? 'Будет изменено' : 'Актуально'}
              </Styled.Status>
            </Styled.RowHeader>
            {editing && draft && field(draft, index, `Назначение ${index + 1}`)}
            <Styled.Dates>Назначено: {formatTime(episode.addedAt)}</Styled.Dates>
            {editing && <Styled.ActionButton type="button" color={cancelled ? 'primary' : 'error'} disabled={busy}
              aria-label={`${cancelled ? 'Вернуть' : 'Отменить'} назначение ${episode.source === null ? '' : episode.source + 1}`}
              onClick={() => onChange(cancelled ? [...prescriptions, { text: episode.text, source: episode.source }]
                : prescriptions.filter((_, position) => position !== index))}>{cancelled ? 'Вернуть' : 'Отменить'}</Styled.ActionButton>}
          </Styled.Row>
        })}
        {ended.map((episode) => <Styled.Row key={episode.key} data-removed="true">
          <Styled.RowHeader>
            <Styled.Text>{episode.text}</Styled.Text>
            <Styled.Status data-status="removed">Не актуально</Styled.Status>
          </Styled.RowHeader>
          <Styled.Dates>Назначено: {formatTime(episode.addedAt)}{' · '}Отменено: {formatTime(episode.endedAt)}</Styled.Dates>
        </Styled.Row>)}
      </Styled.List>
      {editing && <Styled.ActionButton type="button" variant="outlined" disabled={busy}
        onClick={() => onChange([...prescriptions, { text: '', source: null }])}>Добавить назначение</Styled.ActionButton>}
    </Styled.Overview>
  )
}

export default MedicalRecordPrescriptions
