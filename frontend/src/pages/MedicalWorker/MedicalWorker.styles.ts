import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const AccountLink = styled(Link)(({ theme }) => theme.unstable_sx({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  width: '40px', height: '40px', borderRadius: '8px', border: '1px solid', borderColor: 'divider', color: 'primary.main', textDecoration: 'none',
  '&:hover': { backgroundColor: 'action.hover', borderColor: 'primary.main' },
  '&:active': { backgroundColor: 'action.selected' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
}))

export const Page = styled('section')(({ theme }) =>
  theme.unstable_sx({ paddingTop: '32px' }),
)

export const BackNav = styled('nav')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', marginBottom: '24px' }),
)

export const Message = styled('p')(({ theme }) =>
  theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', color: 'text.secondary', lineHeight: 1.6 }),
)

export const Details = styled('dl')(({ theme }) =>
  theme.unstable_sx({
    marginTop: '0px',
    marginBottom: '24px',
    '& dt': { color: 'text.secondary', fontSize: '14px' },
    '& dd': {
      marginLeft: '0px',
      marginTop: '6px',
      marginBottom: '24px',
      fontSize: '18px',
      overflowWrap: 'anywhere',
    },
  }),
)

export const Feedback = styled(Alert)(({ theme }) =>
  theme.unstable_sx({ marginBottom: '24px', borderRadius: '8px' }),
)

export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 20px', borderRadius: '8px', textTransform: 'none' }),
)
