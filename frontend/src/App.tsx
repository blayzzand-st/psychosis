import { Navigate, Route, Routes } from 'react-router'
import Admin from './pages/Admin/Admin'
import Home from './pages/Home/Home'
import Diagnosis from './pages/Diagnosis/Diagnosis'
import MedicalWorker from './pages/MedicalWorker/MedicalWorker'
import Personal from './pages/Personal/Personal'
import Patient from './pages/Patient/Patient'
import MedicalRecord from './pages/MedicalRecord/MedicalRecord'
import PageLayout from './shared/ui/PageLayout/PageLayout'

const App = () => (
  <PageLayout>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/administrator" element={<Admin />} />
      <Route path="/administrator/medical-workers/new" element={<MedicalWorker key="new" />} />
      <Route path="/administrator/medical-workers/:workerId" element={<MedicalWorker key="existing" />} />
      <Route path="/administrator/diagnoses/new" element={<Diagnosis key="new" />} />
      <Route path="/administrator/diagnoses/:diagnosisId" element={<Diagnosis key="existing" />} />
      <Route path="/personal" element={<Personal />} />
      <Route path="/personal/patients/new" element={<Patient key="new" />} />
      <Route path="/personal/patients/:patientId" element={<Patient key="existing" />} />
      <Route path="/personal/patients/:patientId/medical-record" element={<MedicalRecord />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </PageLayout>
)

export default App
