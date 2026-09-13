import {useState} from 'react'
import type {FormEvent} from 'react'
import {reviewIncident} from './api'
import type {Incident} from './api'
export default function TicketAnalysis({ticket, admin, onUpdated}:{ticket:Incident;admin:boolean;onUpdated:(ticket:Incident)=>void}) {
  const [category,setCategory]=useState(ticket.reviewedCategory || ticket.aiCategory || 'GENERAL')
  const [priority,setPriority]=useState(ticket.reviewedPriority || ticket.aiPriority || 'UNASSESSED')
  const [summary,setSummary]=useState(ticket.reviewedSummary || ticket.aiSummary || '')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  async function save(event:FormEvent) {
    event.preventDefault(); if(!summary.trim()) {setError('Enter a summary.');return}
    setBusy(true);setError('')
    try {onUpdated(await reviewIncident(ticket.id,{category,priority,summary:summary.trim()}))}
    catch(error) {setError((error as Error).message)} finally {setBusy(false)}
  }
  return <section className="saved-analysis" aria-label={`Analysis for INC-${ticket.id}`}>
    {ticket.reviewedAt ? <><strong>Reviewed by admin</strong><p>{ticket.reviewedCategory} / {ticket.reviewedPriority}</p><p>{ticket.reviewedSummary}</p><small>{new Date(ticket.reviewedAt).toLocaleString()}</small></> : <strong>Awaiting admin review</strong>}
    {ticket.aiMode ? <details open={!ticket.reviewedAt}><summary>{ticket.aiMode==='GEMINI'?'Original Gemini suggestion':'Original demo sample (not AI)'}</summary><p>{ticket.aiCategory} / {ticket.aiPriority}</p><p>{ticket.aiSummary}</p><small>Suggestion only; requires staff review.</small></details> : <p>No AI suggestion was saved. An admin can classify this ticket manually.</p>}
    {admin && <details><summary>{ticket.reviewedAt?'Edit admin review':'Confirm or correct classification'}</summary><form onSubmit={save}><fieldset disabled={busy}>
    <label htmlFor={`category-${ticket.id}`}>Category</label><select id={`category-${ticket.id}`} value={category} onChange={e=>setCategory(e.target.value)}>{['IT','PLUMBING','ELECTRICAL','FURNITURE','SAFETY','GENERAL'].map(value=><option key={value}>{value}</option>)}</select>
    <label htmlFor={`priority-${ticket.id}`}>Priority</label><select id={`priority-${ticket.id}`} value={priority} onChange={e=>setPriority(e.target.value)}>{['LOW','MEDIUM','HIGH','CRITICAL','UNASSESSED'].map(value=><option key={value}>{value}</option>)}</select>
    <label htmlFor={`summary-${ticket.id}`}>Review summary</label><textarea id={`summary-${ticket.id}`} required maxLength={1000} value={summary} onChange={e=>setSummary(e.target.value)}/><button className="secondary" disabled={busy}>{busy?'Saving...':'Save review'}</button></fieldset><p className="feedback error" role="alert">{error}</p></form></details>}
  </section>
}
