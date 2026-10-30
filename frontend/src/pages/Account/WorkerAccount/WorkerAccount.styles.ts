import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { styled } from '@mui/material/styles'

export const Section = styled('section')(({ theme }) => theme.unstable_sx({ marginTop: '32px', paddingTop: '28px', borderTop: '1px solid', borderColor: 'divider', '&[data-standalone="true"]': { marginTop: '0px', paddingTop: '0px', borderTop: 'none' } }))
export const Title = styled('h2')(({ theme }) => theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', fontSize: '22px', fontWeight: 600 }))
export const Text = styled('p')(({ theme }) => theme.unstable_sx({ marginTop: '0px', marginBottom: '16px', color: 'text.secondary', lineHeight: 1.6 }))
export const Form = styled('form')(({ theme }) => theme.unstable_sx({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px' }))
export const Field = styled(TextField)(({ theme }) => theme.unstable_sx({ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }))
export const Actions = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexWrap: 'wrap', gap: '12px' }))
export const ActionButton = styled(Button)(({ theme }) => theme.unstable_sx({ minHeight: '44px', padding: '10px 16px', borderRadius: '8px', textTransform: 'none' }))
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ marginBottom: '16px', borderRadius: '8px' }))
export const Details = styled('dl')(({ theme }) => theme.unstable_sx({ margin: '0px', marginBottom: '20px', '& dt': { fontSize: '14px', color: 'text.secondary' }, '& dd': { marginLeft: '0px', marginTop: '4px', marginBottom: '16px', overflowWrap: 'anywhere' } }))
