import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import { styled } from '@mui/material/styles'

export const Page = styled('section')(({ theme }) => theme.unstable_sx({ paddingTop: '32px' }))
export const BackNav = styled('nav')(({ theme }) => theme.unstable_sx({ display: 'flex', marginBottom: '24px' }))
export const Message = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.secondary', lineHeight: 1.6 }))
export const PatientName = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', color: 'text.primary', fontSize: '18px', fontWeight: 600 }))
export const PatientInfo = styled('p')(({ theme }) => theme.unstable_sx({ marginTop: '4px', marginBottom: '0px' }))
export const Feedback = styled(Alert)(({ theme }) => theme.unstable_sx({ marginBottom: '24px', borderRadius: '8px' }))
export const EditorControls = styled('div')(({ theme }) =>
  theme.unstable_sx({ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }),
)
export const Status = styled('p')(({ theme }) => theme.unstable_sx({ margin: '0px', fontWeight: 600 }))
export const Field = styled(TextField)(({ theme }) => theme.unstable_sx({
  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
  '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: theme.palette.text.primary },
}))
export const Metadata = styled('p')(({ theme }) =>
  theme.unstable_sx({ marginTop: '0px', marginBottom: '24px', color: 'text.secondary', fontSize: '14px', lineHeight: 1.6 }),
)
export const ActionButton = styled(Button)(({ theme }) =>
  theme.unstable_sx({ minHeight: '44px', padding: '10px 16px', borderRadius: '8px', textTransform: 'none' }),
)
export const SectionTabs = styled(Tabs)(({ theme }) =>
  theme.unstable_sx({ borderBottom: '1px solid', borderColor: 'divider', marginBottom: '24px' }),
)
export const SectionTab = styled(Tab)(({ theme }) =>
  theme.unstable_sx({ minWidth: '0px', minHeight: '48px', padding: '12px 16px', textTransform: 'none', fontSize: '15px', fontWeight: 600 }),
)
export const TabPanel = styled('div')(({ theme }) =>
  theme.unstable_sx({ '&[hidden]': { display: 'none' } }),
)
