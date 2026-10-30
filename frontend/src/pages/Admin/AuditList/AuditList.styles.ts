import Button from '@mui/material/Button'
import TableCell from '@mui/material/TableCell'
import { styled } from '@mui/material/styles'

export const Container = styled('div')(({ theme }) => theme.unstable_sx({
  marginTop: '24px', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '0px',
  '& > :not([role="region"])': { flexShrink: 0 },
}))
export const Toolbar = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.secondary', fontSize: '14px', lineHeight: 1.6 }))
export const Hint = styled(Message)(({ theme }) => theme.unstable_sx({ marginBottom: '20px' }))
export const Live = styled('span')(({ theme }) => theme.unstable_sx({ fontSize: '13px', color: 'success.dark', '&[data-error="true"]': { color: 'warning.dark' } }))
export const Retry = styled(Button)(({ theme }) => theme.unstable_sx({ textTransform: 'none' }))
export const TableContainer = styled('div')(({ theme }) => theme.unstable_sx({
  overflow: 'auto', maxWidth: '100%', flex: '1 1 auto', minHeight: '0px',
  maxHeight: { xs: '60dvh', sm: 'none' }, scrollbarGutter: 'stable',
  '& table': { minWidth: '560px' },
  '& th, & td': { padding: '14px 8px', verticalAlign: 'top' },
  '& thead th': { color: 'text.secondary', fontWeight: 600, position: 'sticky', top: '0px', backgroundColor: 'background.paper', zIndex: 1 },
  '& tbody tr:hover': { backgroundColor: 'action.hover' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
}))
export const DateCell = styled(TableCell)(({ theme }) => theme.unstable_sx({ minWidth: '100px', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }))
export const ActorName = styled('div')(({ theme }) => theme.unstable_sx({ fontSize: '13px' }))
export const Identifier = styled('code')(({ theme }) => theme.unstable_sx({ display: 'block', marginTop: '4px', fontSize: '11px', color: 'text.secondary', overflowWrap: 'anywhere', maxWidth: '180px' }))
export const EventCell = styled(TableCell)(({ theme }) => theme.unstable_sx({ minWidth: '220px', overflowWrap: 'anywhere', lineHeight: 1.6 }))
