import { employeeFetch } from './userAuth'
import { adminFetch } from './adminAuth'
export const authenticatedFetch = async (input: RequestInfo | URL, options?: RequestInit) => {
  let response = await adminFetch(input, options)
  if (response.status === 401) response = await employeeFetch(input, options)
  if (response.status === 401) window.dispatchEvent(new Event('administrator-session-expired'))
  return response
}
