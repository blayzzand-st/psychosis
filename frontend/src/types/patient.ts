export const administrativeSexOptions = [
  { value: 'М', label: 'Мужской' },
  { value: 'Ж', label: 'Женский' },
  { value: 'НУ', label: 'Не установлен' },
] as const

export type AdministrativeSex = typeof administrativeSexOptions[number]['value']
