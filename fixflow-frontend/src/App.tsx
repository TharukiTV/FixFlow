import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createIncident, listIncidents, statuses, updateStatus, listTechnicians } from './api'
import type { Incident, Status, Technician } from './api'
import Auth from './Auth'
import AssignmentForm from './AssignmentForm'
import AnalysisPreview from './AnalysisPreview'
import TicketAnalysis from './TicketAnalysis'
import SimilarFixes from './SimilarFixes'
import type { Profile } from './Auth'

function ReportIssueForm({ onCreated }: { onCreated: (ticket: Incident) => void }) {
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!description.trim() || !location.trim()) { setMessage('Enter a description and location.'); return }
    setSaving(true); setMessage('')
    try { const ticket = await createIncident(description.trim(), location.trim()); onCreated(ticket); setDescription(''); setLocation(''); setMessage(`Ticket INC-${ticket.id} created successfully.${ticket.aiMode ? " Analysis saved for admin review." : " No AI suggestion was available; an admin can review it manually."}`) }
    catch (error) { setMessage((error as Error).message) }
    finally { setSaving(false) }
  }
  return <section className="panel report" id="report"><div className="eyebrow">LET’S GET IT FIXED</div><h2>Report an issue</h2><p className="muted">A little detail helps get the right fix.</p>
    <form onSubmit={submit}><label htmlFor="description">What’s the problem?</label><textarea id="description" placeholder="e.g. The projector in Lecture Hall 3 won’t turn on..." required maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} disabled={saving}/><div className="hint">Include what happened and when you noticed it.</div>
    <label htmlFor="location">Where is it?</label><input id="location" placeholder="Building, floor, or room" required maxLength={120} value={location} onChange={e => setLocation(e.target.value)} disabled={saving}/>
    <p className="hint">Submitting saves your successful preview when the text is unchanged and the preview is less than 10 minutes old. Otherwise it requests a new Gemini analysis, which may use API quota.</p>
    <AnalysisPreview description={description} location={location} disabled={saving}/>
    <button className="primary wide" disabled={saving}>{saving ? 'Analyzing and submitting...' : '+ Submit issue'}</button><p className="feedback" role="status">{message}</p></form>
    <div className="tip"><strong>What happens next?</strong><p>Your issue gets a ticket number. Track its progress here, from reported to resolved.</p></div></section>
}
function TicketCard({ ticket, onUpdated, role, technicians }: { ticket: Incident; onUpdated: (ticket: Incident) => void; role: Profile["role"]; technicians: Technician[] }) {
  const [status, setStatus] = useState(ticket.status)
  const [cause, setCause] = useState(ticket.cause || '')
  const [resolution, setResolution] = useState(ticket.resolution || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try { onUpdated(await updateStatus(ticket.id, status, status === 'RESOLVED' ? cause.trim() : undefined, status === 'RESOLVED' ? resolution.trim() : undefined)) }
    catch (error) { setError((error as Error).message) }
    finally { setSaving(false) }
  }
  return <article className="ticket"><div className="ticket-top"><span className="ticket-id">INC-{String(ticket.id).padStart(4, '0')}</span><span className={`badge ${ticket.status}`}>{statuses[ticket.status]}</span></div>
    <h3>{ticket.description}</h3><div className="metadata"><span>Location: {ticket.location}</span><time dateTime={ticket.createdAt}>{new Date(ticket.createdAt).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})}</time></div>
    <TicketAnalysis ticket={ticket} admin={role === "ADMIN"} onUpdated={onUpdated}/>
    {ticket.resolution && <section className="saved-analysis" aria-label="Resolution notes"><strong>{ticket.status === 'RESOLVED' ? 'Resolution notes' : 'Previous resolution (ticket reopened)'}</strong><p><b>Cause:</b> {ticket.cause}</p><p><b>Fix:</b> {ticket.resolution}</p>{ticket.resolvedAt && <small>Resolved: {new Date(ticket.resolvedAt).toLocaleString()}</small>}</section>}
    {role === "TECHNICIAN" && <SimilarFixes ticketId={ticket.id}/>}
    <p className="assignment-label">Assigned to: {ticket.assignedTechnician || "Awaiting assignment"}</p>
    {role === "TECHNICIAN" && <form className="status-form resolution-form" onSubmit={save}><label className="sr-only" htmlFor={`status-${ticket.id}`}>Status for INC-{ticket.id}</label><select id={`status-${ticket.id}`} value={status} disabled={saving} onChange={e => setStatus(e.target.value as Status)}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{status === 'RESOLVED' && <div className="resolution-inputs"><label htmlFor={`cause-${ticket.id}`}>Cause</label><textarea id={`cause-${ticket.id}`} required maxLength={1000} value={cause} disabled={saving} onChange={e=>setCause(e.target.value)} placeholder="What caused the issue? Use Unknown if not established."/><label htmlFor={`resolution-${ticket.id}`}>Resolution</label><textarea id={`resolution-${ticket.id}`} required maxLength={2000} value={resolution} disabled={saving} onChange={e=>setResolution(e.target.value)} placeholder="What was done, and how was the fix checked?"/></div>}<button className="secondary" disabled={saving || (status === ticket.status && (status !== 'RESOLVED' || (cause.trim() === (ticket.cause || '') && resolution.trim() === (ticket.resolution || ''))))}>{saving ? 'Saving...' : 'Save status'}</button></form>}{role === "ADMIN" && <AssignmentForm ticket={ticket} technicians={technicians} onUpdated={onUpdated}/>}<p className="feedback error" role="alert">{error}</p></article>
}
export default function App() {
  return <Auth>{(user, logout) => <Dashboard key={user.email} user={user} logout={logout}/>}</Auth>
}
function Dashboard({ user, logout }: { user: Profile; logout: () => Promise<void> }) {
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  async function signOut() {
    setLoggingOut(true); setLogoutError('')
    try { await logout() } catch(error) { setLogoutError((error as Error).message) }
    finally { setLoggingOut(false) }
  }
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [technicianError, setTechnicianError] = useState('')
  useEffect(() => {
    if (user.role !== 'ADMIN') return
    let active = true
    listTechnicians().then(result => {if(active) setTechnicians(result)}).catch(error => {if(active) setTechnicianError(error.message)})
    return () => {active=false}
  }, [user.role])
  const [tickets, setTickets] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const generation = useRef(0)
  async function load() {
    const current = ++generation.current
    setLoading(true); setError('')
    try { const result = await listIncidents(); if (current === generation.current) setTickets(result) }
    catch (error) { if (current === generation.current) setError((error as Error).message) }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => {
    let active = true
    const current = generation.current
    listIncidents().then(result => { if (active && current === generation.current) setTickets(result) })
      .catch(error => { if (active && current === generation.current) setError(error.message) })
      .finally(() => { if (active && current === generation.current) setLoading(false) })
    return () => { active = false }
  }, [])
  function created(ticket: Incident) { generation.current++; setLoading(false); setTickets(old => [ticket, ...old]); setFilter('ALL'); setSearch(''); void load() }
  function updated(ticket: Incident) { generation.current++; setLoading(false); setTickets(old => old.map(item => item.id === ticket.id ? ticket : item)); setNotice(`INC-${ticket.id} saved successfully.`) }
  const visible = tickets.filter(ticket => (filter === 'ALL' || ticket.status === filter) && `${ticket.description} ${ticket.location} INC-${ticket.id} INC-${String(ticket.id).padStart(4,'0')}`.toLowerCase().includes(search.toLowerCase().trim()))
  return <><header className="topbar"><a className="brand" href="#"><span className="brand-icon">F</span>FixFlow<span className="brand-tag">WORKSPACE</span></a><div className="account"><span>{user.name}</span><span className="role-label">{user.role}</span><button className="secondary" disabled={loggingOut} onClick={() => void signOut()}>{loggingOut ? "Signing out..." : "Sign out"}</button></div></header>
    <main>{logoutError && <p role="alert" className="error-box">{logoutError}</p>}<div className="page-heading"><div><div className="eyebrow">{user.role} WORKSPACE</div><h1>{user.role === "ADMIN" ? "Keep the work moving." : user.role === "TECHNICIAN" ? "Your next fix starts here." : "Small issues. Better spaces."}</h1><p className="muted">{user.role === "ADMIN" ? "Review all reports and assign the right technician." : user.role === "TECHNICIAN" ? "Track and resolve the tickets assigned to you." : "Report issues and follow their progress."}</p></div>{user.role === "USER" && <a className="primary" href="#description">+ Report an issue</a>}</div>
    <section className="stats" aria-label="Ticket overview">{[['ALL','Total issues'],['OPEN','Open'],['IN_PROGRESS','In progress'],['RESOLVED','Resolved']].map(([value,label]) => <button key={value} className={`stat ${filter === value ? 'selected' : ''}`} aria-pressed={filter===value} onClick={() => setFilter(value)}><span>{label}</span><strong>{loading || error ? '-' : value === 'ALL' ? tickets.length : tickets.filter(t => t.status === value).length}</strong><span className={`stat-dot ${value}`}/></button>)}</section>
    <div className={user.role === "USER" ? "workspace" : "workspace team-workspace"}><section className="panel issues"><div className="section-heading"><div><h2>Issue tracker</h2><p className="muted">{user.role === "ADMIN" ? "All reports, including unassigned tickets." : user.role === "TECHNICIAN" ? "Your assigned tickets." : "Your reports, all in one place."}</p></div><button className="text-button" onClick={() => void load()} disabled={loading}>{loading ? 'Loading...' : 'Refresh'}</button></div>
    {user.role === "ADMIN" && (technicianError ? <p className="error-box" role="alert">{technicianError} Refresh the page to retry.</p> : !technicians.length && <p className="tip">No technicians yet. Promote a registered account with the local setup command, then refresh this page.</p>)}<label className="sr-only" htmlFor="search">Search issues</label><input className="search" id="search" type="search" placeholder="Search by issue, location, or ticket number..." value={search} onChange={e => setSearch(e.target.value)}/>
    <div className="filters" aria-label="Filter by status">{[['ALL','All issues'], ...Object.entries(statuses)].map(([value,label]) => <button key={value} aria-pressed={filter===value} className={filter===value?'active':''} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <p className="sr-only" role="status">{notice}</p>{error && <div className="error-box" role="alert">{error} <button className="text-button" onClick={() => void load()}>Retry</button></div>}
    {loading ? <div className="empty" role="status">Loading your issues...</div> : visible.length ? <div className="ticket-list">{visible.map(ticket => <TicketCard key={`${ticket.id}-${ticket.status}-${ticket.assignedTechnician}-${ticket.reviewedAt}`} ticket={ticket} onUpdated={updated} role={user.role} technicians={technicians}/>)}</div> : !error && <div className="empty"><span className="empty-icon">✓</span><h3>{tickets.length ? 'No matching issues' : user.role === 'USER' ? 'A fresh start for your space' : 'No tickets to show'}</h3><p>{tickets.length ? 'Try another search or status filter.' : user.role === 'USER' ? 'Report your first issue using the form.' : 'Refresh later to check for new assignments or reports.'}</p></div>}
    </section>{user.role === "USER" && <ReportIssueForm onCreated={created}/>}</div><footer>FixFlow · A better space starts with a report.</footer></main></>
}
