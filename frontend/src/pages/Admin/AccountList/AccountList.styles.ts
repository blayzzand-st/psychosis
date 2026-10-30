import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TableCell from '@mui/material/TableCell'
import TextField from '@mui/material/TextField'
import { alpha, styled } from '@mui/material/styles'
import { Link } from 'react-router'

export const Container = styled('div')(({ theme }) => theme.unstable_sx({
  marginTop: '24px', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: '0px',
  '& > :not([role="region"])': { flexShrink: 0 },
}))
export const Toolbar = styled('div')(({ theme }) => theme.unstable_sx({
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px',
}))
export const Count = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.secondary', fontSize: '14px' }))
export const ToolbarActions = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }))
export const CreateButton = styled(Button)(({ theme }) => theme.unstable_sx({ minHeight: '44px', padding: '8px 16px', borderRadius: '8px', textTransform: 'none' }))
export const RefreshButton = styled(IconButton)(({ theme }) => theme.unstable_sx({ width: '44px', height: '44px', borderRadius: '8px', color: 'primary.main', border: '1px solid', borderColor: 'divider' }))
export const CreateForm = styled('form')(({ theme }) => theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }))
export const CredentialsLabel = styled('p')(({ theme }) => theme.unstable_sx({ marginTop: '20px', marginBottom: '12px', fontWeight: 600, overflowWrap: 'anywhere' }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.secondary', lineHeight: 1.6 }))
export const ErrorMessage = styled(Message)(({ theme }) => theme.unstable_sx({ color: 'error.main' }))
export const SearchField = styled(TextField)(({ theme }) => theme.unstable_sx({ marginBottom: '20px', '& .MuiOutlinedInput-root': { borderRadius: '8px' } }))
export const DeleteButton = styled(IconButton)(({ theme }) => theme.unstable_sx({ width: '40px', height: '40px', borderRadius: '8px', color: 'error.main' }))
export const DateTime = styled('time')(({ theme }) => theme.unstable_sx({ display: 'flex', flexDirection: 'column', whiteSpace: 'nowrap', fontSize: '13px', lineHeight: 1.5 }))
export const Time = styled('span')(({ theme }) => theme.unstable_sx({ color: 'text.secondary', fontSize: '12px' }))
export const TableContainer = styled('div')(({ theme }) => theme.unstable_sx({
  overflow: 'auto', maxWidth: '100%', flex: '1 1 auto', minHeight: '0px',
  maxHeight: { xs: '60dvh', sm: 'none' }, scrollbarGutter: 'stable',
  '& table': { minWidth: '600px' },
  '& th, & td': { padding: '12px 8px', verticalAlign: 'middle' },
  '& thead th': { color: 'text.secondary', fontWeight: 600, position: 'sticky', top: '0px', backgroundColor: 'background.paper', zIndex: 1 },
  '& tbody tr:hover, & tbody tr:focus-within': { backgroundColor: 'action.hover' },
  '& tbody tr:last-child td, & tbody tr:last-child th': { borderBottom: 'none' },
  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
}))
export const UsernameCell = styled(TableCell)(({ theme }) => theme.unstable_sx({ fontWeight: 600, overflowWrap: 'anywhere' }))
export const WorkerLink = styled(Link)(({ theme }) => theme.unstable_sx({
  color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' },
}))
export const WorkerNote = styled('p')(({ theme }) => theme.unstable_sx({ marginTop: '6px', marginBottom: '0px', fontSize: '12px', color: 'text.secondary' }))
export const RowActions = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }))
export const Status = styled('span')(({ theme }) => theme.unstable_sx({
  display: 'inline-block', padding: '4px 8px', borderRadius: '6px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600,
  color: 'text.secondary', backgroundColor: 'action.hover',
  '&[data-active="true"]': { color: 'success.dark', backgroundColor: alpha(theme.palette.success.main, 0.12) },
}))
