type SearchableAccount = {
  username: string
  medical_worker: { first_name: string; last_name: string } | null
}

const normalize = (value: string) => value.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').trim()

export const filterAccounts = <T extends SearchableAccount>(accounts: T[], query: string): T[] => {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return accounts.filter((account) => {
    const worker = account.medical_worker
    const text = normalize(`${account.username} ${worker?.first_name ?? ''} ${worker?.last_name ?? ''}`)
    return words.every((word) => text.includes(word))
  })
}
