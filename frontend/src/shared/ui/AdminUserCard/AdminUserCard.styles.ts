import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'

export const Card = styled('section')(({ theme }) => theme.unstable_sx({
  display: 'flex', flexDirection: 'column', flexShrink: 0, gap: '16px', padding: '12px',
  border: '1px solid', borderColor: 'divider', borderRadius: '12px', backgroundColor: 'background.paper',
}))
export const Identity = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0px',
}))
export const Avatar = styled('span')(({ theme }) => theme.unstable_sx({
  display: 'grid', placeItems: 'center', width: '32px', height: '32px', flexShrink: 0,
  borderRadius: '50%', backgroundColor: 'primary.main', color: 'primary.contrastText',
  fontSize: '18px', fontWeight: 700,
}))
export const Name = styled('span')(({ theme }) => theme.unstable_sx({
  fontSize: '14px', fontWeight: 600, overflowWrap: 'anywhere',
}))
export const SignOut = styled(Button)(({ theme }) => theme.unstable_sx({
  minHeight: '40px', textTransform: 'none', borderRadius: '8px',
}))

export const DeleteButton = styled(IconButton)(({ theme }) => theme.unstable_sx({
  width: '40px', height: '40px', flexShrink: 0, color: 'error.main',
  borderRadius: '8px', '&:hover': { backgroundColor: 'action.hover' },
  '&:active': { backgroundColor: 'action.selected' },
}))

export const Actions = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0px',
}))
