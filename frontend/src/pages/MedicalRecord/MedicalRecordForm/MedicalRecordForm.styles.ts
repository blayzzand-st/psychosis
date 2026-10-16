import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'

export const Form = styled('form')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '24px', '&[hidden]': { display: 'none' } }),
)
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ borderRadius: '8px' }))
export const DiagnosisPicker = styled('div')(({ theme }) =>
  theme.unstable_sx({
    display: 'flex', flexDirection: 'column', gap: '16px',
    '&[hidden]': { display: 'none' },
  }),
)
export const Section = styled('section')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', '&[hidden]': { display: 'none' } }),
)
export const Actions = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexWrap: 'wrap', gap: '12px' }))
export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 16px', borderRadius: '8px', textTransform: 'none' }),
)
