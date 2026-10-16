import { useEffect, useState } from 'react'
import Autocomplete from '@mui/material/Autocomplete'
import type { Diagnosis } from '../../../api/diagnoses'
import { getMedicalRecordHistory, type DiagnosisSnapshot, type MedicalRecord } from '../../../api/medicalRecords'
import { buildDiagnosisTimeline, type DiagnosisEpisode } from './diagnosisTimeline'
import * as Styled from './MedicalRecordDiagnoses.styles'

type MedicalRecordDiagnosesProps = {
  record: MedicalRecord
  registry: Diagnosis[]
  diagnoses: DiagnosisSnapshot[]
  editing: boolean
  busy: boolean
  onChange: (diagnoses: DiagnosisSnapshot[]) => void
}
type HistoryState = { status: 'loading' | 'error' } | { status: 'loaded'; episodes: DiagnosisEpisode[] }
const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value)) : 'дата неизвестна'

const MedicalRecordDiagnoses = ({ record, registry, diagnoses, editing, busy, onChange }: MedicalRecordDiagnosesProps) => {
  const [history, setHistory] = useState<HistoryState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setHistory({ status: 'loading' })
      try {
        const entries = await getMedicalRecordHistory(record.patient_id, controller.signal)
        if (!controller.signal.aborted) setHistory({ status: 'loaded', episodes: buildDiagnosisTimeline(entries, record.version) })
      } catch {
        if (!controller.signal.aborted) setHistory({ status: 'error' })
      }
    }
    void load()
    return () => controller.abort()
  }, [record.patient_id, record.version, retry])

  const episodes: DiagnosisEpisode[] = history.status === 'loaded' ? history.episodes : record.diagnoses.map((diagnosis) => ({
    key: `saved-${diagnosis.diagnosis_id}`, diagnosis, addedAt: null, removedAt: null, addedVersion: 0, removedVersion: null, active: true,
  }))
  const saved = episodes.filter((episode) => episode.active).sort((a, b) => b.addedVersion - a.addedVersion)
  const removed = episodes.filter((episode) => !episode.active).sort((a, b) => (b.removedVersion ?? 0) - (a.removedVersion ?? 0))
  const added = diagnoses.filter((diagnosis) => !record.diagnoses.some((item) => item.diagnosis_id === diagnosis.diagnosis_id))
  const options = registry.filter((diagnosis) => !diagnoses.some((item) => item.diagnosis_id === diagnosis.id))

  return (
    <Styled.Overview>
      {history.status === 'loading' && <Styled.Message role="status">Загрузка дат постановки и удаления…</Styled.Message>}
      {history.status === 'error' && <Styled.Feedback severity="error">
        Не удалось загрузить даты и удалённые диагнозы.
        <Styled.ActionButton type="button" onClick={() => setRetry((previous) => previous + 1)}>Повторить</Styled.ActionButton>
      </Styled.Feedback>}
      {editing && <Autocomplete
        options={options} value={null} inputValue={inputValue} disabled={busy}
        onInputChange={(_, value, reason) => {
          if (reason === 'input' || reason === 'clear') setInputValue(value)
        }}
        getOptionLabel={(option) => `${option.code} — ${option.name}`}
        noOptionsText="Нет доступных диагнозов"
        onChange={(_, value) => {
          if (value) {
            onChange([...diagnoses, record.diagnoses.find((item) => item.diagnosis_id === value.id)
              ?? { diagnosis_id: value.id, code: value.code, name: value.name }])
            setInputValue('')
          }
        }}
        renderInput={(params) => <Styled.Field {...params} label="Добавить диагноз" placeholder="Название или код" />}
      />}
      {history.status === 'loaded' && !saved.length && !added.length && !removed.length && <Styled.Message>Диагнозов нет.</Styled.Message>}
      <Styled.List aria-label="Диагнозы пациента">
          {added.map((diagnosis) => <Styled.Row key={`draft-${diagnosis.diagnosis_id}`}>
            <Styled.RowHeader>
              <Styled.Name>{diagnosis.name}</Styled.Name>
              <Styled.Status data-status="pending">Будет добавлен</Styled.Status>
            </Styled.RowHeader>
            <Styled.Code>Код: {diagnosis.code}</Styled.Code>
            <Styled.Dates>Дата постановки появится после сохранения.</Styled.Dates>
            <Styled.ActionButton type="button" color="error" disabled={busy} aria-label={`Отменить добавление диагноза ${diagnosis.name}`}
              onClick={() => onChange(diagnoses.filter((item) => item.diagnosis_id !== diagnosis.diagnosis_id))}>Отменить добавление</Styled.ActionButton>
          </Styled.Row>)}
          {saved.map((episode) => {
            const pendingRemoval = !diagnoses.some((item) => item.diagnosis_id === episode.diagnosis.diagnosis_id)
            return <Styled.Row key={episode.key}>
              <Styled.RowHeader>
                <Styled.Name>{episode.diagnosis.name}</Styled.Name>
                <Styled.Status data-status={pendingRemoval ? 'pending' : 'active'}>{pendingRemoval ? 'Будет удалён' : 'Актуален'}</Styled.Status>
              </Styled.RowHeader>
              <Styled.Code>Код: {episode.diagnosis.code}</Styled.Code>
              <Styled.Dates>Поставлен: {formatTime(episode.addedAt)}</Styled.Dates>
              {editing && <Styled.ActionButton type="button" color={pendingRemoval ? 'primary' : 'error'} disabled={busy}
                aria-label={`${pendingRemoval ? 'Вернуть' : 'Удалить'} диагноз ${episode.diagnosis.name}`}
                onClick={() => onChange(pendingRemoval ? [...diagnoses, episode.diagnosis]
                  : diagnoses.filter((item) => item.diagnosis_id !== episode.diagnosis.diagnosis_id))}>
                {pendingRemoval ? 'Вернуть' : 'Удалить'}
              </Styled.ActionButton>}
            </Styled.Row>
          })}
          {removed.map((episode) => <Styled.Row key={episode.key} data-removed="true">
            <Styled.RowHeader>
              <Styled.Name>{episode.diagnosis.name}</Styled.Name>
              <Styled.Status data-status="removed">Не актуален</Styled.Status>
            </Styled.RowHeader>
            <Styled.Code>Код: {episode.diagnosis.code}</Styled.Code>
            <Styled.Dates>Поставлен: {formatTime(episode.addedAt)}{' · '}Удалён: {formatTime(episode.removedAt)}</Styled.Dates>
          </Styled.Row>)}
      </Styled.List>
    </Styled.Overview>
  )
}

export default MedicalRecordDiagnoses
