import { Navigate, Route, Routes } from 'react-router'
import Admin from './pages/Admin/Admin'
import Account from './pages/Account/Account'
import Home from './pages/Home/Home'
import Diagnosis from './pages/Diagnosis/Diagnosis'
import MedicalWorker from './pages/MedicalWorker/MedicalWorker'
import Personal from './pages/Personal/Personal'
import Patient from './pages/Patient/Patient'
import MedicalRecord from './pages/MedicalRecord/MedicalRecord'
import PageLayout from './shared/ui/PageLayout/PageLayout'
import AdminAccess from './shared/ui/AdminAccess/AdminAccess'
import { AdminAuthProvider } from './shared/ui/AdminAccess/AdminAuthContext'
import AdminLogin from './pages/AdminLogin/AdminLogin'
import UserLogin from './pages/UserLogin/UserLogin'
import UserAccess from './shared/ui/UserAccess/UserAccess'
import { UserAuthProvider } from './shared/ui/UserAccess/UserAuthProvider'

const App = () => (
  <AdminAuthProvider><UserAuthProvider><PageLayout>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/administrator/access" element={<AdminLogin />} />
      <Route element={<AdminAccess />}>
      <Route path="/administrator" element={<Admin />} />
      <Route path="/administrator/accounts" element={<Admin />} />
      <Route path="/administrator/audit" element={<Admin />} />
      <Route path="/administrator/medical-workers/new" element={<MedicalWorker key="new" />} />
      <Route path="/administrator/medical-workers/:workerId" element={<MedicalWorker key="existing" />} />
      <Route path="/administrator/medical-workers/:workerId/account" element={<Account />} />
      <Route path="/administrator/diagnoses/new" element={<Diagnosis key="new" />} />
      <Route path="/administrator/diagnoses/:diagnosisId" element={<Diagnosis key="existing" />} />
      </Route>
      <Route path="/personal/access" element={<UserLogin />} />
      <Route element={<UserAccess />}>
      <Route path="/personal" element={<Personal />} />
      <Route path="/personal/patients/new" element={<Patient key="new" />} />
      <Route path="/personal/patients/:patientId" element={<Patient key="existing" />} />
      <Route path="/personal/patients/:patientId/medical-record" element={<MedicalRecord />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </PageLayout></UserAuthProvider></AdminAuthProvider>
)

export default App
