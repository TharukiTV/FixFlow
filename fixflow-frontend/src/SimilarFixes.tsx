import { useState } from 'react'
import { findSimilarFixes, rankSimilarFixes } from './api'
import type { PastFix } from './api'

export default function SimilarFixes({ ticketId }: { ticketId: number }) {
  const [results, setResults] = useState<PastFix[] | null>(null)
  const [notice, setNotice] = useState('')
  const [explanations, setExplanations] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function search(ai = false) {
    setLoading(true); setError(''); setResults(null); setNotice(''); setExplanations({})
    try {
      if (ai) {
        const result = await rankSimilarFixes(ticketId)
        setResults(result.matches.map(item => item.fix)); setNotice(result.notice)
        setExplanations(Object.fromEntries(result.matches.map(item => [item.fix.id, item.explanation || ''])))
      } else { setResults(await findSimilarFixes(ticketId)); setNotice('Text matches (not AI).') }
    }
    catch (failure) { setError((failure as Error).message) }
    finally { setLoading(false) }
  }
  return <section className="saved-analysis" aria-label="Similar past fixes">
    <strong>Similar past fixes</strong>
    <p>Search resolved tickets assigned to you. Text search is free of AI calls. Gemini compares meaning and sends this description plus candidate descriptions and repair notes to Google; it may use API quota. Review each record before applying a fix.</p>
    <button className="secondary" type="button" disabled={loading} onClick={() => void search()}>
      {loading ? 'Searching...' : 'Find similar past fixes'}
    </button>
    <button className="secondary" type="button" disabled={loading} onClick={() => void search(true)}>Compare with Gemini</button>
    {error && <p className="error" role="alert">{error}</p>}
    <div aria-live="polite">
      {notice && <p>{notice}</p>}
      {results?.length === 0 && <p>No matching resolved tickets were found in the searched records.</p>}
      {results && results.length > 0 && <p>{results.length} match{results.length === 1 ? '' : 'es'} (up to 5).</p>}
    </div>
    {results?.map(fix => <details key={fix.id}>
      <summary>INC-{String(fix.id).padStart(4, '0')}: {fix.description}</summary>
      {explanations[fix.id] && <p><b>Gemini explanation:</b> {explanations[fix.id]}</p>}
      <p><b>Recorded cause:</b> {fix.cause}</p>
      <p><b>Recorded resolution:</b> {fix.resolution}</p>
    </details>)}
  </section>
}
