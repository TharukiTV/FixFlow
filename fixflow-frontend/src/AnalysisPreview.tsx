import {useEffect, useRef, useState} from 'react'
import {analyzeIncident} from './api'
import type {Analysis} from './api'
export default function AnalysisPreview({description, location, disabled}: {description:string; location:string; disabled:boolean}) {
  const [analysis, setAnalysis] = useState<Analysis|null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [analyzedInput, setAnalyzedInput] = useState('')
  const input = JSON.stringify([description,location])
  const latest = useRef(input)
  useEffect(() => { latest.current = input }, [input])
  async function analyze() {
    const submittedInput = input
    setBusy(true); setError(''); setAnalysis(null)
    try {
      const result = await analyzeIncident(description.trim(),location.trim())
      if(latest.current === submittedInput) {setAnalysis(result); setAnalyzedInput(submittedInput)}
    } catch (error) {if(latest.current === submittedInput) setError(error instanceof Error ? error.message : 'AI analysis is unavailable. You can still submit your ticket.')}
    finally {setBusy(false)}
  }
  return <div className="analysis-preview"><button type="button" className="secondary wide" disabled={disabled || busy || !description.trim() || !location.trim()} onClick={() => void analyze()}>{busy?'Analyzing...':'Analyze with Gemini'}</button><p className="hint">Sends this description and location to Google Gemini. A successful preview can be saved with your ticket for 10 minutes if the text stays unchanged.</p><div role="status">{busy && <p className="hint">Requesting analysis...</p>}{error && <p className="feedback error">{error}</p>}{analysis && analyzedInput===input && <div className="tip"><strong>{analysis.mode === "GEMINI" ? "Gemini AI suggestion" : "Demo sample (not AI)"}</strong><dl><dt>Category</dt><dd>{analysis.category}</dd><dt>Suggested priority</dt><dd>{analysis.priority === 'UNASSESSED' ? 'Needs review' : analysis.priority}</dd></dl><p>{analysis.summary}</p><p>{analysis.notice}</p></div>}</div></div>
}
