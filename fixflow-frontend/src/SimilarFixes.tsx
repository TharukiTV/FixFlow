import { useState } from 'react'
import { findSimilarFixes } from './api'
import type { PastFix } from './api'

export default function SimilarFixes({ ticketId }: { ticketId: number }) {
  const [results, setResults] = useState<PastFix[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function search() {
    setLoading(true); setError(''); setResults(null)
    try { setResults(await findSimilarFixes(ticketId)) }
    catch (failure) { setError((failure as Error).message) }
    finally { setLoading(false) }
  }
  return <section className="saved-analysis" aria-label="Similar past fixes">
    <strong>Similar past fixes</strong>
    <p>Search resolved tickets assigned to you. Matches use words in the problem description, not AI. Review each record before applying a fix.</p>
    <button className="secondary" type="button" disabled={loading} onClick={() => void search()}>
      {loading ? 'Searching...' : 'Find similar past fixes'}
    </button>
    {error && <p className="error" role="alert">{error}</p>}
    <div aria-live="polite">
      {results?.length === 0 && <p>No matching resolved tickets with cause and resolution notes were found among your assignments.</p>}
      {results && results.length > 0 && <p>{results.length} text match{results.length === 1 ? '' : 'es'} (up to 5).</p>}
    </div>
    {results?.map(fix => <details key={fix.id}>
      <summary>INC-{String(fix.id).padStart(4, '0')}: {fix.description}</summary>
      <p><b>Recorded cause:</b> {fix.cause}</p>
      <p><b>Recorded resolution:</b> {fix.resolution}</p>
    </details>)}
  </section>
}
