import axios from 'axios'
import { create } from 'zustand'

export type User = { id: string; name: string; email: string }
export type Office = { id: number; name: string; room: string; building: string; hours: string; contact: string | null; updatedAt: string }
export type FAQ = { id: number; question: string; answer: string; category: string; officeId: number | null; status: boolean; updatedAt: string; audioUrl: string | null }
export const api = axios.create({ baseURL: '/api', withCredentials: true, timeout: 15000 })
export const useSession = create<{user: User | null; ready: boolean; expired: boolean; set: (user: User | null) => void}>((set) => ({
  user: null, ready: false, expired: false, set: (user) => set({ user, ready: true, expired: false }),
}))
api.interceptors.response.use(response => response, error => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
    useSession.setState({ user: null, ready: true, expired: true })
  }
  return Promise.reject(error)
})
export function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return 'Something went wrong. Please try again.'
  if (!error.response) return 'Cannot reach the backend. Check that it is running on port 3000, then retry.'
  const status = error.response.status
  if (status === 401 && error.config?.url === '/auth/sign-in/email') return 'Incorrect email or password. Please try again.'
  if (status === 401) return 'Your session has expired. Sign in again.'
  if (status === 404) return 'This record no longer exists. Refresh the list.'
  if (status >= 500) return 'The server could not complete this request. Please try again.'
  return error.response.data?.message || error.response.data?.error || 'The request could not be completed.'
}
