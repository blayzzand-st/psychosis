import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import { styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Page = styled('section')(({ theme }) => theme.unstable_sx({ paddingTop: '32px' }))
export const BackNav = styled('nav')(({ theme }) => theme.unstable_sx({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }))
export const Message = styled('p')(({ theme }) =>
  theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', color: 'text.secondary', lineHeight: 1.6 }),
)
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ marginBottom: '24px', borderRadius: '8px' }))
export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 20px', borderRadius: '8px', textTransform: 'none' }),
)

export const RecordNav = styled('nav')(({ theme }) => theme.unstable_sx({ marginBottom: '24px' }))
export const RecordLink = styled(Link)(({ theme }) =>
  theme.unstable_sx({
    display: 'inline-flex', alignItems: 'center', minHeight: '44px', padding: '10px 16px', borderRadius: '8px',
    border: '1px solid', borderColor: 'primary.main', color: 'primary.main', textDecoration: 'none', fontWeight: 600,
    '&:hover': { backgroundColor: 'action.hover' },
    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
  }),
)
