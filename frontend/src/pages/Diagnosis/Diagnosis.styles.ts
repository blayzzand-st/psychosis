import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'

export const Page = styled('section')(({ theme }) => theme.unstable_sx({ paddingTop: '32px' }))
export const BackNav = styled('nav')(({ theme }) => theme.unstable_sx({ display: 'flex', marginBottom: '24px' }))
export const Message = styled('p')(({ theme }) =>
  theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', color: 'text.secondary', lineHeight: 1.6 }),
)
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ marginBottom: '24px', borderRadius: '8px' }))
export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 20px', borderRadius: '8px', textTransform: 'none' }),
)
