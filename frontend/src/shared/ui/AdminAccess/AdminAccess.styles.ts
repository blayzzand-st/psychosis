import { styled } from '@mui/material/styles'

export const UserPanel = styled('div')(({ theme }) => theme.unstable_sx({
  width: { xs: '100%', sm: '220px' }, marginLeft: 'auto', paddingTop: '24px',
}))
