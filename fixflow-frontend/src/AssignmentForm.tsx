import { useState } from 'react'
import type { FormEvent } from 'react'
import { assignIncident } from './api'
import type { Incident, Technician } from './api'
export default function AssignmentForm({ticket, technicians, onUpdated}: {ticket:Incident; technicians:Technician[]; onUpdated:(ticket:Incident)=>void}) {
  const [email, setEmail] = useState(ticket.assignedTechnician || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function submit(event:FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {onUpdated(await assignIncident(ticket.id,email))}
    catch(error) {setError((error as Error).message)}
    finally {setSaving(false)}
  }
  return <><form className="status-form" onSubmit={submit}><label className="sr-only" htmlFor={`assign-${ticket.id}`}>Technician for INC-{ticket.id}</label><select id={`assign-${ticket.id}`} required value={email} disabled={saving || !technicians.length} onChange={e=>setEmail(e.target.value)}><option value="">Select technician</option>{technicians.map(tech=><option key={tech.email} value={tech.email}>{tech.name} ({tech.email})</option>)}</select><button className="secondary" disabled={saving || !email || email===ticket.assignedTechnician}>{saving?'Assigning...':'Assign ticket'}</button></form><p role="alert" className="feedback error">{error}</p></>
}
