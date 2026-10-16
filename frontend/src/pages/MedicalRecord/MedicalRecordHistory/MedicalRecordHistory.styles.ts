import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import { styled } from '@mui/material/styles'

export const Section = styled('section')(({ theme }) => theme.unstable_sx({ minWidth: '0px' }))
export const Subtitle = styled('h3')(({ theme }) => theme.unstable_sx({ margin: '0px', fontSize: '16px', fontWeight: 600, lineHeight: 1.5 }))
export const Content = styled('div')(({ theme }) => theme.unstable_sx({ display: 'flex', flexDirection: 'column', gap: '20px' }))
export const TimeForm = styled('form')(({ theme }) => theme.unstable_sx({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }))
export const Field = styled(TextField)(({ theme }) => theme.unstable_sx({ minWidth: '0px', flexGrow: 1, flexBasis: '260px' }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.secondary', fontSize: '14px', lineHeight: 1.6 }))
export const Journal = styled('ol')(({ theme }) => theme.unstable_sx({ listStyle: 'none', padding: '0px', margin: '0px', display: 'flex', flexDirection: 'column', gap: '16px' }))
export const Entry = styled('li')(({ theme }) => theme.unstable_sx({
  padding: '16px', border: '1px solid', borderColor: 'divider', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', overflowWrap: 'anywhere',
}))
export const Snapshot = styled('div')(({ theme }) => theme.unstable_sx({
  padding: '16px', borderRadius: '12px', backgroundColor: 'background.default', border: '1px solid', borderColor: 'primary.main', display: 'flex', flexDirection: 'column', gap: '12px', overflowWrap: 'anywhere', scrollMarginTop: '24px',
}))
export const DataList = styled('ul')(({ theme }) => theme.unstable_sx({ margin: '0px', paddingLeft: '20px', lineHeight: 1.7, width: '100%', overflowWrap: 'anywhere' }))
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ borderRadius: '8px' }))
export const ActionButton = styled(Button)(({ theme }) => theme.unstable_sx({ minHeight: '44px', padding: '10px 16px', borderRadius: '8px', textTransform: 'none' }))
