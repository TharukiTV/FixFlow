export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'
export interface Incident { id: number; description: string; location: string; status: Status; createdAt: string; assignedTechnician: string | null;
  aiMode: string | null; aiCategory: string | null; aiPriority: string | null; aiSummary: string | null;
  reviewedCategory: string | null; reviewedPriority: string | null; reviewedSummary: string | null;
  reviewedBy: string | null; reviewedAt: string | null; cause: string | null; resolution: string | null; resolvedAt: string | null }
export const statuses: Record<Status, string> = { OPEN: 'Open', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved' }
export async function csrfHeaders(): Promise<Record<string, string>> {
  const response = await fetch('/api/auth/csrf', { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error('Cannot connect to the backend. Please retry.')
  const csrf = await response.json()
  return { [csrf.headerName]: csrf.token }
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(`/api/incidents${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.method ? await csrfHeaders() : {}) }, signal: AbortSignal.timeout(options?.method === 'POST' && path === '' ? 40000 : 15000) }) }
  catch { throw new Error('Cannot reach the server. Check your connection and try again.') }
  if (response.status === 401) { window.dispatchEvent(new Event('session-expired')); throw new Error('Your session expired. Please sign in again.') }
  if (!response.ok) throw new Error(response.status === 403 ? 'Your role does not allow this action, or your session changed. Refresh and try again.' : response.status === 404 ? 'This ticket no longer exists. Refresh the list.' : response.status === 400 ? 'Please check the description, location, and status.' : 'Tickets are unavailable. Make sure the backend is running, then retry.')
  return response.json() as Promise<T>
}
export const listIncidents = () => request<Incident[]>('')
export const createIncident = (description: string, location: string) => request<Incident>('', { method: 'POST', body: JSON.stringify({description, location}) })
export const updateStatus = (id: number, status: Status, cause?: string, resolution?: string) => request<Incident>(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({status, cause, resolution}) })

export interface Technician { email: string; name: string; role: 'TECHNICIAN' }
export const listTechnicians = () => request<Technician[]>('/technicians')
export const assignIncident = (id: number, technicianEmail: string) => request<Incident>(`/${id}/assignment`, {method:'PATCH',body:JSON.stringify({technicianEmail})})

export interface Analysis { mode: 'DEMO' | 'GEMINI'; category: string; priority: string; summary: string; notice: string }
export async function analyzeIncident(description: string, location: string): Promise<Analysis> {
  const response = await fetch('/api/analysis', {method:'POST', headers:{'Content-Type':'application/json', ...await csrfHeaders()}, body:JSON.stringify({description,location}), signal:AbortSignal.timeout(30000)})
  if(response.status === 401) {window.dispatchEvent(new Event('session-expired')); throw new Error('Sign in again to continue.')}
  if(!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : 'AI analysis is unavailable. You can still submit your ticket.')
  }
  return response.json() as Promise<Analysis>
}

export interface Review { category: string; priority: string; summary: string }
export const reviewIncident = (id:number, review:Review) => request<Incident>(`/${id}/review`, {method:'PATCH',body:JSON.stringify(review)})

export interface PastFix { id: number; description: string; cause: string; resolution: string }
export const findSimilarFixes = (id: number) => request<PastFix[]>(`/${id}/similar-fixes`)
