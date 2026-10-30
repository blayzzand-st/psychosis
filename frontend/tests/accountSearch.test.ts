import assert from 'node:assert/strict'
import test from 'node:test'
import { filterAccounts } from '../src/pages/Admin/AccountList/accountSearch.ts'

const account = (username: string, first: string | null, last = '') => ({
  id: username, username, created_at: '', updated_at: '', is_active: true, medical_worker_id: first ? 1 : null,
  medical_worker: first ? { id: 1, first_name: first, last_name: last, is_deleted: false } : null,
})
const accounts = [account('gregoryH', 'Грегори', 'Хаус'), account('doctor02', 'Семён', 'Лобанов'), account('independent', null)]

test('Finds accounts by partial login or name regardless of case and word order', () => {
  assert.deepEqual(filterAccounts(accounts, 'GREGORY'), [accounts[0]])
  assert.deepEqual(filterAccounts(accounts, '  ХАУС   грегори '), [accounts[0]])
  assert.deepEqual(filterAccounts(accounts, 'семен лоб'), [accounts[1]])
})

test('Keeps standalone accounts searchable and handles empty or unmatched searches', () => {
  assert.deepEqual(filterAccounts(accounts, 'independ'), [accounts[2]])
  assert.deepEqual(filterAccounts(accounts, '   '), accounts)
  assert.deepEqual(filterAccounts(accounts, 'nobody'), [])
})
