import { useLocation, useNavigate } from 'react-router'
import * as Styled from './BackButton.styles'

type BackButtonProps = {
  onBack?: () => void
  fallbackTo?: string
}

const BackButton = ({ onBack, fallbackTo = '/' }: BackButtonProps) => {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }

    if (location.key === 'default') {
      navigate(fallbackTo, { replace: true })
      return
    }

    navigate(-1)
  }

  return (
    <Styled.Button
      type="button"
      onClick={handleBack}
      startIcon={
        <Styled.Arrow viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 12H5m7-7-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Styled.Arrow>
      }
    >
      Назад
    </Styled.Button>
  )
}

export default BackButton
