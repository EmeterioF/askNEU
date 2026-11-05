import { normalizeSearch, searchQuestions } from './questionSearch'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, errorMessage } from './api'
import './kiosk.css'

type Question = { id: number; question: string; category: string }
type Answer = { id: number; question: string; answer: string; category: string; updatedAt: string; office: { id: number; name: string; room: string; building: string; hours: string; contact: string | null } | null }
type Result = { outcome: 'answer'; faq: Answer } | { outcome: 'no_match'; message: string }

export default function Kiosk() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [updated, setUpdated] = useState('')
  const [searchHint, setSearchHint] = useState('')
  const matches = searchQuestions(questions, question)
  const controller = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLElement>(null)
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
  function stopAudio() { if (canSpeak) window.speechSynthesis.cancel(); setSpeaking(false) }
  async function refresh() {
    controller.current?.abort(); stopAudio(); setResult(null); setBusy(false); setLoading(true); setError('')
    const request = new AbortController(); controller.current = request
    try { const {data} = await api.get<{questions: Question[]}>('/kiosk/questions', {signal: request.signal}); setQuestions(data.questions); setUpdated(new Date().toLocaleTimeString()) }
    catch (err) { if (!request.signal.aborted) { setQuestions([]); setError(errorMessage(err)) } }
    finally { if (!request.signal.aborted) setLoading(false) }
  }
  useEffect(() => { void refresh(); return () => { controller.current?.abort(); if ('speechSynthesis' in window) window.speechSynthesis.cancel() } }, [])
  async function ask(selected?: Question) {
    if (busy || loading) return
    if (!selected && !question.trim()) { setError('Please enter a question or choose one below.'); return }
    stopAudio(); setAudioError(''); setResult(null); setError(''); setBusy(true)
    if (selected) setQuestion(selected.question)
    setSearchHint('')
    const request = new AbortController(); controller.current = request
    try { const {data} = await api.post<Result>('/kiosk/ask', selected ? {faqId: selected.id} : {question: question.trim()}, {signal: request.signal}); setResult(data); requestAnimationFrame(() => resultRef.current?.focus()) }
    catch (err) { if (!request.signal.aborted) setError(errorMessage(err)) }
    finally { if (!request.signal.aborted) setBusy(false) }
  }
  function reset() { controller.current?.abort(); stopAudio(); setBusy(false); setResult(null); setQuestion(''); setSearchHint(''); setAudioError(''); setError('') }
  function readAnswer() {
    if (!canSpeak || result?.outcome !== 'answer') return
    stopAudio(); setAudioError('')
    const voice = new SpeechSynthesisUtterance(result.faq.answer)
    voice.lang = 'en-US'; voice.onend = () => setSpeaking(false)
    voice.onerror = () => { setSpeaking(false); setAudioError('Audio could not be played. Please read the answer on screen.') }
    setSpeaking(true); window.speechSynthesis.speak(voice)
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || loading) return
    if (!question.trim()) { setSearchHint('Type a few words or choose an available question.'); return }
    const exact = questions.filter(q => normalizeSearch(q.question) === normalizeSearch(question))
    if (exact.length === 1) { setSearchHint(''); void ask(exact[0]); return }
    stopAudio(); setResult(null)
    setSearchHint(matches.length ? 'Choose the question that best matches what you need below.' : 'No related questions found. Try fewer words or a different spelling.')
    document.getElementById('question-suggestions')?.focus()
  }
  return <div className="kiosk"><header className="kiosk-header"><Link className="brand" to="/kiosk">AskNEU<span>YOUR CAMPUS GUIDE</span></Link><div><span className="badge">Student kiosk simulator</span><Link to="/login">Staff sign in →</Link></div></header>
    <main className="kiosk-main"><div className="kiosk-intro"><p className="eyebrow">WELCOME TO NEW ERA UNIVERSITY</p><h1>How can we help you?</h1><p>Find an approved answer or the right campus office.</p></div>
    <section className="kiosk-question"><form onSubmit={submit}><label htmlFor="student-question">Your question</label><div className="kiosk-input"><input id="student-question" maxLength={255} placeholder="Try library, libary, tuition…" value={question} disabled={busy || loading} onChange={e=>{setQuestion(e.target.value);setSearchHint('');setResult(null);stopAudio()}} aria-describedby="kiosk-search-help"/><button className="primary" disabled={busy || loading}>{busy ? 'Finding an answer…' : 'Ask AskNEU →'}</button></div></form><p className="caption" id="kiosk-search-help">Search by words, partial words, or small spelling mistakes. Choose a suggested question to get its approved answer. Meaning-based AI matching is not connected.</p></section>
    {error && <div className="alert" role="alert">{error} <button onClick={()=>void refresh()} disabled={busy || loading}>Reconnect / refresh</button></div>}
    {busy && <p role="status" className="kiosk-progress">Reading the latest published information from the backend…</p>}
    {result && <section className="kiosk-answer" tabIndex={-1} ref={resultRef} aria-label="Question result"><p className="eyebrow">{result.outcome === 'answer' ? 'APPROVED FAQ ANSWER' : 'NO PUBLISHED MATCH'}</p>{result.outcome === 'answer' ? <><h2>{result.faq.question}</h2><p className="answer-text">{result.faq.answer}</p>{result.faq.office && <div className="kiosk-office"><h3>{result.faq.office.name}</h3><dl><div><dt>Location</dt><dd>{result.faq.office.room} · {result.faq.office.building}</dd></div><div><dt>Office hours</dt><dd>{result.faq.office.hours}</dd></div>{result.faq.office.contact && <div><dt>Contact</dt><dd>{result.faq.office.contact}</dd></div>}</dl></div>}<p className="caption">FAQ updated {new Date(result.faq.updatedAt).toLocaleString()}</p><div className="kiosk-actions"><button disabled={!canSpeak} onClick={speaking ? stopAudio : readAnswer}>{speaking ? 'Stop audio' : 'Read answer aloud'}</button><button className="primary" onClick={reset}>Ask another question</button></div><p className="caption">Audio uses this browser’s text-to-speech, not the device or backend voice pipeline.</p>{audioError && <p role="alert">{audioError}</p>}</> : <><h2>Let’s try another question.</h2><p>{result.message}</p><button className="primary" onClick={reset}>Try again</button></>}</section>}
    <section className="kiosk-catalog" id="question-suggestions" tabIndex={-1} aria-label="Question suggestions"><div className="kiosk-section-heading"><div><p className="eyebrow">START HERE</p><h2>{question.trim() ? 'Suggested questions' : 'Available questions'}</h2></div><button disabled={loading || busy} onClick={()=>void refresh()}>{loading ? 'Loading…' : 'Refresh questions'}</button></div><p role="status" className="caption">{searchHint || (!loading && questions.length ? `${matches.length} ${question.trim() ? 'matching' : 'available'} questions` : '')}</p>{loading ? <p role="status">Loading published FAQs…</p> : error && !questions.length ? <p>Connect to the backend to load the question list.</p> : !questions.length ? <div className="kiosk-empty"><h3>No published questions yet.</h3><p>Staff can create and publish FAQs in the staff console, then refresh this list.</p></div> : !matches.length ? <div className="kiosk-empty"><h3>No matching questions.</h3><p>Try a shorter search, another keyword, or clear your search to browse all questions.</p><button onClick={reset}>Clear search</button></div> : <div className="kiosk-questions">{matches.map(q=><button key={q.id} disabled={busy} onClick={()=>void ask(q)}><span>{q.category}</span><strong>{q.question}</strong><b aria-hidden="true">↗</b></button>)}</div>}</section>
    <footer className="kiosk-footer"><span>Published FAQs only · {updated ? `Last refreshed ${updated}` : 'Waiting for backend'}</span><button onClick={reset}>Clear screen</button></footer></main></div>
}
