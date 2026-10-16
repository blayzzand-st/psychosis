import { useEffect, useState } from 'react'
import { getDiagnoses, type Diagnosis } from '../../../api/diagnoses'
import * as Styled from './DiagnosisList.styles'

type ListState =
  | { status: 'loading' }
  | { status: 'loaded'; diagnoses: Diagnosis[] }
  | { status: 'error' }

const DiagnosisList = () => {
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [requestVersion, setRequestVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getDiagnoses(controller.signal)
      .then((diagnoses) => {
        if (!controller.signal.aborted) setState({ status: 'loaded', diagnoses })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [requestVersion])

  return (
    <Styled.Container aria-busy={state.status === 'loading'}>
      <Styled.Toolbar>
        <Styled.Count role="status">Всего: {state.status === 'loaded' ? state.diagnoses.length : '—'}</Styled.Count>
        <Styled.CreateLink to="/administrator/diagnoses/new">Добавить диагноз</Styled.CreateLink>
      </Styled.Toolbar>
      {state.status === 'loading' && <Styled.Message role="status">Загрузка диагнозов…</Styled.Message>}
      {state.status === 'error' && (
        <>
          <Styled.ErrorMessage role="alert">Не удалось загрузить реестр диагнозов.</Styled.ErrorMessage>
          <Styled.RetryButton variant="outlined" onClick={() => {
            setState({ status: 'loading' })
            setRequestVersion((previous) => previous + 1)
          }}>Повторить</Styled.RetryButton>
        </>
      )}
      {state.status === 'loaded' && (
        state.diagnoses.length === 0 ? <Styled.Message role="status">Диагнозы пока не добавлены.</Styled.Message> : (
          <Styled.List aria-label="Диагнозы">
            {state.diagnoses.map((diagnosis) => (
              <Styled.Row key={diagnosis.id}>
                <Styled.RecordLink to={`/administrator/diagnoses/${diagnosis.id}`}>
                  <Styled.Name>{diagnosis.name}</Styled.Name>
                  <Styled.Code>Код: {diagnosis.code}</Styled.Code>
                </Styled.RecordLink>
              </Styled.Row>
            ))}
          </Styled.List>
        )
      )}
    </Styled.Container>
  )
}

export default DiagnosisList
