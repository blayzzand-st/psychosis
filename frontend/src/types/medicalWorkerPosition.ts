export const medicalWorkerPositions = [
  'Заведующий диагностикой',
  'Врач-диагност',
  'Заведующий терапией',
  'Врач-терапевт',
] as const

export type MedicalWorkerPosition = typeof medicalWorkerPositions[number]
