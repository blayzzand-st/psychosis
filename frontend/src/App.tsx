import { useState } from 'react'
import * as Styled from './App.styles'

type ConnectionStatus = 'idle' | 'checking' | 'online' | 'error'

const messages: Record<ConnectionStatus, string> = {
  idle: 'Связь с сервером ещё не проверена.',
  checking: 'Проверяем связь…',
  online: 'Сервер доступен. Соединение установлено.',
  error: 'Сервер недоступен. Проверь, запущен ли бэкенд на порту 8000.',
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>('idle')

  async function checkConnection() {
    setStatus('checking')

    try {
      const response = await fetch('/api/health', {
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) throw new Error('Health request failed')

      const data = await response.json()
      if (data.status !== 'ok') throw new Error('Unexpected health response')

      setStatus('online')
    } catch {
      setStatus('error')
    }
  }

  return (
    <Styled.Page>
      <Styled.Header>
        <Styled.BrandMark aria-hidden="true">P</Styled.BrandMark>
        <Styled.Brand>PsychosIS</Styled.Brand>
      </Styled.Header>

      <Styled.Welcome aria-labelledby="page-title">
        <Styled.Eyebrow>Медицинская информационная система</Styled.Eyebrow>
        <Styled.PageTitle id="page-title">Начнём со связи.</Styled.PageTitle>
        <Styled.Intro>
          Здесь будут пациенты, медицинские карты и назначения.
          Первый шаг — убедиться, что приложение видит сервер.
        </Styled.Intro>

        <Styled.ConnectionPanel elevation={0}>
          <Styled.ConnectionHeading>
            <Styled.StatusDot data-status={status} aria-hidden="true" />
            <Styled.ConnectionTitle>Подключение к серверу</Styled.ConnectionTitle>
          </Styled.ConnectionHeading>
          <Styled.ConnectionMessage role="status">{messages[status]}</Styled.ConnectionMessage>
          <Styled.CheckButton
            type="button"
            variant="contained"
            disableElevation
            onClick={checkConnection}
            disabled={status === 'checking'}
          >
            {status === 'checking' ? 'Проверяем…' : 'Проверить соединение'}
          </Styled.CheckButton>
        </Styled.ConnectionPanel>
      </Styled.Welcome>
    </Styled.Page>
  )
}

export default App
