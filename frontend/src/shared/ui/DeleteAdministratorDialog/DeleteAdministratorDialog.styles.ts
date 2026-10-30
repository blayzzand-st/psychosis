import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'

export const Fields = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '16px',
}))

export const Action = styled(Button)(({ theme }) => theme.unstable_sx({
  minHeight: '40px', padding: '8px 16px', textTransform: 'none',
}))
