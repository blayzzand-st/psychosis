import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { styled } from '@mui/material/styles'

export const Form = styled('form')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '24px' }),
)
export const Field = styled(TextField)(({ theme }) =>
  theme.unstable_sx({ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }),
)
export const Error = styled(Alert)(({ theme }) => theme.unstable_sx({ borderRadius: '8px' }))
export const Actions = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexWrap: 'wrap', gap: '12px' }))
export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 20px', borderRadius: '8px', textTransform: 'none' }),
)
