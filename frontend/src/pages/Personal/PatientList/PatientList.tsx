import { useEffect, useState } from 'react'
import { getPatients, type Patient } from '../../../api/patients'
import { administrativeSexOptions } from '../../../types/patient'
import * as Styled from './PatientList.styles'
import { useUserAuth } from '../../../shared/ui/UserAccess/useUserAuth'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; patients: Patient[] }
  | { status: 'error' }

const PatientList = () => {
  const { status } = useUserAuth()
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getPatients(controller.signal)
      .then((patients) => {
        if (!controller.signal.aborted) setState({ status: 'loaded', patients })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [requestVersion])

  return (
    <div aria-busy={state.status === 'loading'}>
      <Styled.Toolbar>
        <Styled.Count role="status">Всего: {state.status === 'loaded' ? state.patients.length : '—'}</Styled.Count>
        {status?.user?.can_create && <Styled.CreateLink to="/personal/patients/new">Добавить пациента</Styled.CreateLink>}
      </Styled.Toolbar>
      {state.status === 'loading' && <Styled.Message role="status">Загрузка пациентов…</Styled.Message>}
      {state.status === 'error' && (
        <>
          <Styled.ErrorMessage role="alert">Не удалось загрузить список пациентов.</Styled.ErrorMessage>
          <Styled.RetryButton variant="outlined" onClick={() => {
            setState({ status: 'loading' })
            setRequestVersion((previous) => previous + 1)
          }}>Повторить</Styled.RetryButton>
        </>
      )}
      {state.status === 'loaded' && (
        state.patients.length === 0 ? <Styled.Message role="status">Пациенты пока не добавлены.</Styled.Message> : (
          <Styled.List aria-label="Пациенты">
            {state.patients.map((patient) => (
              <Styled.Row key={patient.id}>
                <Styled.RecordLink to={`/personal/patients/${patient.id}`}>
                  <Styled.Name>{[patient.last_name, patient.first_name, patient.patronymic].filter(Boolean).join(' ')}</Styled.Name>
                  <Styled.Metadata>
                    <Styled.Summary>
                      {patient.date_of_birth.split('-').reverse().join('.')} · {administrativeSexOptions.find((option) => option.value === patient.administrative_sex)?.label}
                    </Styled.Summary>
                    <Styled.RecordStatus data-present={patient.has_medical_record}>
                      {patient.has_medical_record ? 'Есть ЭМК' : 'Нет ЭМК'}
                    </Styled.RecordStatus>
                  </Styled.Metadata>
                </Styled.RecordLink>
              </Styled.Row>
            ))}
          </Styled.List>
        )
      )}
    </div>
  )
}

export default PatientList
