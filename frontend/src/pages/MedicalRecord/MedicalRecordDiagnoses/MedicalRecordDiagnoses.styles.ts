import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { alpha, styled } from '@mui/material/styles'

export const Overview = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '24px' }))
export const List = styled('ul')(({ theme }) => theme.unstable_sx({ margin: '0px', padding: '0px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }))
export const Row = styled('li')(({ theme }) => theme.unstable_sx({
  padding: '16px', border: '1px solid', borderColor: 'divider', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
  '&[data-removed="true"]': { backgroundColor: 'background.default', color: 'text.secondary' },
}))
export const RowHeader = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%' }))
export const Name = styled('h2')(({ theme }) => theme.unstable_sx({ margin: '0px', fontSize: '16px', fontWeight: 600, overflowWrap: 'anywhere', flex: '1 1 180px' }))
export const Code = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', fontSize: '14px', color: 'text.secondary' }))
export const Dates = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', fontSize: '13px', color: 'text.secondary', lineHeight: 1.6 }))
export const Status = styled('span')(({ theme }) => theme.unstable_sx({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, lineHeight: 1.4,
  '&::before': { content: '""', width: '6px', height: '6px', flexShrink: 0, borderRadius: '50%', backgroundColor: 'currentColor' },
  '&[data-status="active"]': { backgroundColor: alpha(theme.palette.success.main, 0.12), color: 'success.dark' },
  '&[data-status="removed"]': { backgroundColor: alpha(theme.palette.error.main, 0.1), color: 'error.dark' },
  '&[data-status="pending"]': { backgroundColor: alpha(theme.palette.warning.main, 0.12), color: 'warning.dark' },
}))
export const Field = styled(TextField)(({ theme }) => theme.unstable_sx({ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', fontSize: '14px', color: 'text.secondary', lineHeight: 1.6 }))
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ borderRadius: '8px' }))
export const ActionButton = styled(Button)(({ theme }) => theme.unstable_sx({ minHeight: '40px', padding: '8px 12px', borderRadius: '8px', textTransform: 'none' }))
