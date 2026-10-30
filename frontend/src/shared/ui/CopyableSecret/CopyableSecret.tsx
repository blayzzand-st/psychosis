import { useState } from 'react'
import SvgIcon from '@mui/material/SvgIcon'
import * as Styled from './CopyableSecret.styles'

const CopyableSecret = ({ value }: { value: string }) => {
  const [result, setResult] = useState<{ value: string; status: 'copied' | 'error' } | null>(null)
  const status = result?.value === value ? result.status : 'idle'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setResult({ value, status: 'copied' })
    } catch {
      setResult({ value, status: 'error' })
    }
  }

  return (
    <>
      <Styled.Secret type="button" aria-label="Скопировать пароль" title="Нажмите, чтобы скопировать пароль" disabled={!value} onClick={() => void copy()}>
        <Styled.Password>{value}</Styled.Password>
        <Styled.CopyAction>
          <SvgIcon aria-hidden="true" viewBox="0 0 24 24">
            <path d={status === 'copied' ? 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' : 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z'} />
          </SvgIcon>
          <span>{status === 'copied' ? 'Скопировано' : 'Копировать'}</span>
        </Styled.CopyAction>
      </Styled.Secret>
      <Styled.Feedback role="status" data-error={status === 'error'}>
        {status === 'copied' ? 'Пароль скопирован' : status === 'error' ? 'Не удалось скопировать. Выделите пароль и скопируйте вручную.' : 'Нажмите на пароль, чтобы скопировать'}
      </Styled.Feedback>
    </>
  )
}

export default CopyableSecret
