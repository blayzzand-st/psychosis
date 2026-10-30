import IconButton from '@mui/material/IconButton'
import { styled } from '@mui/material/styles'
import { Card as BaseCard } from '../AdminUserCard/AdminUserCard.styles'

export { Identity, Avatar, Name, SignOut } from '../AdminUserCard/AdminUserCard.styles'

export const Card = styled(BaseCard)(({ theme }) => theme.unstable_sx({
  '&[data-compact="true"]': {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px',
    padding: '10px 12px', maxWidth: '100%',
  },
}))

export const UserInfo = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '0px',
}))

export const Details = styled('span')(({ theme }) => theme.unstable_sx({
  color: 'text.secondary', fontSize: '14px', overflowWrap: 'anywhere',
}))

export const ExitButton = styled(IconButton)(({ theme }) => theme.unstable_sx({
  width: '40px', height: '40px', flexShrink: 0, borderRadius: '8px',
  border: '1px solid', borderColor: 'divider', color: 'primary.main',
  transition: 'background-color 150ms ease, transform 100ms ease',
  '&:hover': { backgroundColor: 'action.hover' },
  '&:active': { backgroundColor: 'action.selected', transform: 'scale(0.94)' },
  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
}))
