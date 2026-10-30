export const medicalWorkerRoles = [
  { value: 'other', label: 'Другая (other)' },
  { value: 'doctor', label: 'Врач (doctor)' },
  { value: 'laboratory-technician', label: 'Лаборант (laboratory-technician)' },
  { value: 'nurse', label: 'Медсестра / медбрат (nurse)' },
] as const

export type MedicalWorkerRole = typeof medicalWorkerRoles[number]['value']
