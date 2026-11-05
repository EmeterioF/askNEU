import Kiosk from './Kiosk'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { api, errorMessage, useSession, type FAQ, type Office, type User } from './api'

function Modal({ title, children, close, busy = false }: { title: string; children: ReactNode; close: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current!; const previous = document.activeElement as HTMLElement | null; dialog.showModal(); return () => { dialog.close(); previous?.focus() } }, [])
  return <dialog ref={ref} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); if (!busy) close() }}>
    <header className="modal-head"><h2 id="dialog-title">{title}</h2><button type="button" className="icon" aria-label="Close dialog" disabled={busy} onClick={close}>×</button></header>{children}
  </dialog>
}
function Alert({ children, success = false }: { children: ReactNode; success?: boolean }) { return <div role={success ? 'status' : 'alert'} className={`alert ${success ? 'success' : ''}`}>{children}</div> }
function Login() {
  const { user, set } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ email: false, password: false })
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const emailError = !email.trim() ? 'Email is required.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a valid email address.' : ''
  const passwordError = !password.trim() ? 'Password is required.' : ''
  if (user) return <Navigate to="/faqs" replace />
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    setTouched({ email: true, password: true })
    setError('')
    if (emailError || passwordError) {
      if (emailError) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const { data } = await api.post<{ user: User }>('/auth/sign-in/email', { email: email.trim(), password })
      if (!data.user) throw new Error('Missing session')
      set(data.user)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }
  return <main className="login">
    <section className="login-story"><div className="brand">AskNEU<span>STAFF CONSOLE</span></div><div><p className="eyebrow">CAMPUS INFORMATION, KEPT CURRENT</p><h1>A clear answer<br/>starts with you.</h1><p>Manage the approved information that helps students find their next step.</p></div><small>New Era University · Integration prototype</small></section>
    <section className="login-form"><div className="login-inner">
      <p className="eyebrow">AUTHORIZED STAFF</p><h2>Welcome back.</h2><p className="muted">Sign in to manage FAQs and office information.</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="login-email">Email
          <input id="login-email" ref={emailRef} name="email" type="email" autoComplete="username" placeholder="Your staff email" required disabled={busy}
            value={email} onChange={e => { setEmail(e.target.value); setError('') }} onBlur={() => setTouched(old => ({ ...old, email: true }))}
            aria-invalid={touched.email && !!emailError} aria-describedby={touched.email && emailError ? 'email-error' : undefined}/>
          {touched.email && emailError && <span id="email-error" className="field-error" aria-live="polite">{emailError}</span>}
        </label>
        <label htmlFor="login-password">Password</label>
        <div className="password login-password"><input id="login-password" ref={passwordRef} name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required disabled={busy}
            value={password} onChange={e => { setPassword(e.target.value); setError('') }} onBlur={() => setTouched(old => ({ ...old, password: true }))}
            aria-invalid={touched.password && !!passwordError} aria-describedby={touched.password && passwordError ? 'password-error' : undefined}/>
          <button type="button" disabled={busy} onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>{visible ? 'Hide' : 'Show'}</button>
        </div>
        {touched.password && passwordError && <span id="password-error" className="field-error" aria-live="polite">{passwordError}</span>}
        {error && <Alert>{error}</Alert>}
        <button className="primary full login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in →'}</button>
      </form><p className="caption">Use a staff account provided by your backend developer.</p>
    </div></section>
  </main>
}
function Shell() {
  const {user, set} = useSession(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  if (!user) return <Navigate to="/login" replace />
  async function logout() { setBusy(true); try { await api.post('/auth/sign-out', {}); set(null) } catch (err) { setError(errorMessage(err)) } finally { setBusy(false) } }
  return <div className="shell"><aside><div className="brand">AskNEU<span>STAFF CONSOLE</span></div><p className="nav-label">WORKSPACE</p><nav><NavLink to="/faqs"><span>≡</span>FAQ Management</NavLink><NavLink to="/offices"><span>⌂</span>Office Management</NavLink><NavLink to="/test"><span>◇</span>Test</NavLink></nav><div className="sidebar-bottom"><div className="avatar">{(user.name || user.email).slice(0,1).toUpperCase()}</div><div><strong>{user.name || 'Staff'}</strong><small>{user.email}</small></div><button onClick={logout} disabled={busy}>{busy ? 'Signing out…' : 'Sign out'}</button></div></aside><div className="workspace"><header className="topbar"><span>Staff workspace</span><span className="prototype">Integration prototype</span></header><main className="content">{error && <Alert>{error}</Alert>}<Routes><Route path="/faqs" element={<Management kind="faqs" key="faqs"/>}/><Route path="/offices" element={<Management kind="offices" key="offices"/>}/><Route path="/test" element={<TestPage/>}/><Route path="*" element={<Navigate to="/faqs" replace/>}/></Routes></main></div></div>
}
type RecordItem = FAQ | Office
const isFaq = (item: RecordItem): item is FAQ => 'question' in item
function Management({kind}: {kind: 'faqs' | 'offices'}) {
  const faqMode = kind === 'faqs'; const [rows, setRows] = useState<RecordItem[]>([]); const [offices, setOffices] = useState<Office[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [category, setCategory] = useState('all'); const [edit, setEdit] = useState<RecordItem | 'new' | null>(null); const [remove, setRemove] = useState<RecordItem | null>(null); const [busy, setBusy] = useState(false); const [dialogError, setDialogError] = useState('')
  async function load() { setLoading(true); setError(''); try { if (faqMode) { const [f,o] = await Promise.all([api.get<{faqs: FAQ[]}>('/admin/faqs'), api.get<{offices: Office[]}>('/admin/offices')]); setRows(f.data.faqs); setOffices(o.data.offices) } else { const {data} = await api.get<{offices: Office[]}>('/admin/offices'); setRows(data.offices) } } catch (err) { setError(errorMessage(err)) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [kind])
  const filtered = rows.filter(row => { const text = isFaq(row) ? `${row.question} ${row.answer} ${row.category}` : `${row.name} ${row.room} ${row.building}`; return text.toLowerCase().includes(search.toLowerCase()) && (!isFaq(row) || ((status === 'all' || row.status === (status === 'published')) && (category === 'all' || category === row.category))) })
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const val = (key: string) => String(form.get(key) || '').trim()
    const payload = faqMode ? { question: val('question'), answer: val('answer'), category: val('category'), officeId: val('officeId') ? Number(val('officeId')) : null, status: form.get('status') === 'on' } : { name: val('name'), room: val('room'), building: val('building'), hours: val('hours'), contact: val('contact') || null }
    if (Object.entries(payload).some(([key,value]) => !['officeId','status','contact'].includes(key) && typeof value === 'string' && !value)) { setDialogError('Please fill in all required fields.'); return }
    setBusy(true); setDialogError(''); try { const response = edit === 'new' ? await api.post(`/admin/${kind}`,payload) : await api.patch(`/admin/${kind}/${(edit as RecordItem).id}`,payload); const record: RecordItem = faqMode ? response.data.faq : response.data.office; setRows(old => edit === 'new' ? [...old,record] : old.map(r => r.id === record.id ? record : r)); setEdit(null); setNotice(`${faqMode ? 'FAQ' : 'Office'} saved.`) } catch (err) { setDialogError(errorMessage(err)) } finally { setBusy(false) }
  }
  async function toggle(row: FAQ) { setBusy(true); setError(''); setNotice(''); try { const {data} = await api.patch<{faq: FAQ}>(`/admin/faqs/${row.id}`,{status: !row.status}); setRows(old => old.map(r => r.id === row.id ? data.faq : r)); setNotice(data.faq.status ? 'FAQ published.' : 'FAQ unpublished.') } catch(err) { setError(errorMessage(err)) } finally { setBusy(false) } }
  async function deleteRecord() { if (!remove) return; setBusy(true); setDialogError(''); try { await api.delete(`/admin/${kind}/${remove.id}`); setRows(old => old.filter(r => r.id !== remove.id)); setRemove(null); setNotice(`${faqMode ? 'FAQ' : 'Office'} deleted.`) } catch(err) { setDialogError(errorMessage(err) + (!faqMode ? ' If FAQs use this office, reassign those links before deleting it.' : '')) } finally { setBusy(false) } }
  const item = edit && edit !== 'new' ? edit : null
  return <><div className="page-heading"><div><p className="eyebrow">CONTENT MANAGEMENT</p><h1>{faqMode ? 'FAQ Management' : 'Office Management'}</h1><p className="muted">{faqMode ? 'Keep approved answers accurate and ready for students.' : 'Help students find the right people and places.'}</p></div><button className="primary" disabled={loading || !!error} onClick={() => {setEdit('new');setDialogError('')}}>+ Add {faqMode ? 'FAQ' : 'office'}</button></div>
    {notice && <Alert success>{notice}</Alert>}{error && <Alert>{error} <button onClick={() => void load()} disabled={loading}>Refresh</button></Alert>}
    <section className="panel"><div className="toolbar"><label className="search"><span className="sr-only">Search {kind}</span><input placeholder={faqMode ? 'Search questions, answers, categories…' : 'Search offices, rooms, buildings…'} value={search} onChange={e=>setSearch(e.target.value)}/></label>{faqMode && <><select aria-label="Filter category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(rows.filter(isFaq).map(r=>r.category))].map(c=><option key={c}>{c}</option>)}</select><select aria-label="Filter status" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="unpublished">Unpublished</option></select></>}<button onClick={()=>void load()} disabled={loading}>Refresh</button></div>
    {loading ? <div className="empty" role="status">Loading {kind}…</div> : error ? <div className="empty">Records could not be loaded.</div> : !filtered.length ? <div className="empty"><div className="empty-symbol">{faqMode ? '≡' : '⌂'}</div><h2>{rows.length ? 'No matching results' : `No ${kind === 'faqs' ? 'FAQs' : 'offices'} yet`}</h2><p>{rows.length ? 'Try another search or filter.' : 'Add your first record to get started.'}</p></div> : <div className="table-scroll"><table><thead><tr>{(faqMode ? ['Question','Category','Office','Status','Updated','Actions'] : ['Office','Room / building','Hours','Contact','Updated','Actions']).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.id}>{isFaq(row) ? <><td className="record-title">{row.question}</td><td>{row.category}</td><td>{offices.find(o=>o.id===row.officeId)?.name || '—'}</td><td><span className={`badge ${row.status ? 'published' : ''}`}>{row.status ? 'Published' : 'Unpublished'}</span></td></> : <><td className="record-title">{row.name}</td><td>{row.room}<small>{row.building}</small></td><td>{row.hours}</td><td>{row.contact || '—'}</td></>}<td className="date">{new Date(row.updatedAt).toLocaleString()}</td><td><div className="actions"><button disabled={busy} onClick={()=>{setEdit(row);setDialogError('')}}>Edit</button>{isFaq(row) && <button disabled={busy} onClick={()=>void toggle(row)}>{row.status ? 'Unpublish' : 'Publish'}</button>}<button className="danger-text" disabled={busy} onClick={()=>{setRemove(row);setDialogError('')}}>Delete</button></div></td></tr>)}</tbody></table></div>}
    <footer className="table-footer">{loading ? 'Loading records' : `${filtered.length} ${faqMode ? 'FAQs' : 'offices'} shown`}<span>Live backend data</span></footer></section>
    {edit && <Modal title={`${edit === 'new' ? 'Add' : 'Edit'} ${faqMode ? 'FAQ' : 'office'}`} close={()=>setEdit(null)} busy={busy}><form onSubmit={save}><fieldset disabled={busy}>{faqMode ? <><label>Question *<input name="question" required maxLength={255} defaultValue={item && isFaq(item) ? item.question : ''}/></label><label>Answer *<textarea name="answer" required rows={5} defaultValue={item && isFaq(item) ? item.answer : ''}/></label><label>Category *<input name="category" required maxLength={100} defaultValue={item && isFaq(item) ? item.category : ''}/></label><label>Office (optional)<select name="officeId" defaultValue={item && isFaq(item) ? item.officeId ?? '' : ''}><option value="">No office</option>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label><label className="checkbox"><input type="checkbox" name="status" defaultChecked={!!(item && isFaq(item) && item.status)}/> Published</label><p className="caption">Leave unchecked to keep this FAQ unpublished.</p></> : <><label>Name *<input name="name" required maxLength={255} defaultValue={item && !isFaq(item) ? item.name : ''}/></label><div className="form-grid"><label>Room *<input name="room" required maxLength={100} defaultValue={item && !isFaq(item) ? item.room : ''}/></label><label>Building *<input name="building" required maxLength={100} defaultValue={item && !isFaq(item) ? item.building : ''}/></label></div><label>Hours *<input name="hours" required maxLength={255} placeholder="Mon–Fri, 8:00 AM–5:00 PM" defaultValue={item && !isFaq(item) ? item.hours : ''}/></label><label>Contact (optional)<input name="contact" maxLength={255} defaultValue={item && !isFaq(item) ? item.contact ?? '' : ''}/></label></>}</fieldset>{dialogError && <Alert>{dialogError}</Alert>}<footer className="modal-footer"><button type="button" disabled={busy} onClick={()=>setEdit(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : `Save ${faqMode ? 'FAQ' : 'office'}`}</button></footer></form></Modal>}
    {remove && <Modal title={`Delete this ${faqMode ? 'FAQ' : 'office'}?`} close={()=>setRemove(null)} busy={busy}><p className="delete-name">{isFaq(remove) ? remove.question : remove.name}</p><p>This permanently removes the record. This action cannot be undone.</p>{!faqMode && <p className="caption">Offices linked to FAQs must have those links reassigned first.</p>}{dialogError && <Alert>{dialogError}</Alert>}<footer className="modal-footer"><button disabled={busy} onClick={()=>setRemove(null)}>Cancel</button><button className="destructive" disabled={busy} onClick={()=>void deleteRecord()}>{busy ? 'Deleting…' : 'Delete permanently'}</button></footer></Modal>}
  </>
}
function TestPage() { return <><p className="eyebrow">INTEGRATION WORKSPACE</p><h1>Kiosk testing</h1><p className="muted">Preview the student experience with your published database content.</p><section className="test-panel"><span className="badge">Live backend content</span><h2>Try the student kiosk.</h2><p>Create an FAQ and publish it, then open the kiosk and refresh its questions. Answers and office details come from the backend.</p><p><a className="primary" style={{display:'inline-block',padding:'12px 20px',borderRadius:7}} href="/kiosk" target="_blank" rel="noreferrer">Open kiosk simulator ↗</a></p><p className="caption">Exact-question matching only. No AI matching or microphone input. Browser audio is optional.</p></section></> }
function StaffApp() {
  const { ready, set } = useSession(); const [error,setError] = useState(''); const [retry,setRetry] = useState(0); const navigate = useNavigate()
  useEffect(()=> { let active=true; api.get<{user: User} | null>('/auth/get-session').then(({data})=>{if(active) set(data?.user ?? null)}).catch(err=>{if(active) setError(errorMessage(err))}); return ()=>{active=false} },[retry,set])
  if (!ready) return <main className="boot"><div className="brand">AskNEU</div>{error ? <><Alert>{error}</Alert><button onClick={()=>{setError('');setRetry(r=>r+1)}}>Retry connection</button><button onClick={()=>{set(null);navigate('/login')}}>Go to sign in</button></> : <p role="status">Checking your session…</p>}</main>
  return <Routes><Route path="/login" element={<Login/>}/><Route path="*" element={<Shell/>}/></Routes>
}

export default function App() { return <Routes><Route path="/kiosk" element={<Kiosk/>}/><Route path="*" element={<StaffApp/>}/></Routes> }
