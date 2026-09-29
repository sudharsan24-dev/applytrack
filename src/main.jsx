import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, ArrowRight, BriefcaseBusiness, LayoutDashboard, ListFilter, Search, Plus, LogOut, X, MapPin, ChevronRight, Pencil, Trash2, ExternalLink, Check, CalendarDays, CircleCheck, Send, MessagesSquare, LoaderCircle, AlertCircle, BarChart3 } from 'lucide-react';
import './styles.css';

const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected'];
const today = () => new Date().toISOString().slice(0, 10);
const shortDate = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
const initials = value => value.split(' ').filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase();
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Could not complete the request.'), { status: response.status });
  return data;
}
function Brand({ light = false }) { return <div className={`brand ${light ? 'light' : ''}`}><span className="brand-mark"><ArrowUpRight size={23} strokeWidth={2.5} /></span><span>applytrack<span className="brand-dot">.</span></span></div>; }
function Spinner() { return <LoaderCircle size={18} className="spin" aria-hidden="true" />; }
function Status({ status }) { return <span className={`status ${status.toLowerCase()}`}><span />{status}</span>; }
function ErrorMessage({ children }) { return children ? <div className="error" role="alert"><AlertCircle size={17} /><span>{children}</span></div> : null; }

function Auth({ onSignIn }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setBusy('submit'); setError('');
    try { onSignIn((await api(`/auth/${mode}`, { method: 'POST', body: form })).user); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  async function demo() {
    setBusy('demo'); setError('');
    try { onSignIn((await api('/auth/demo', { method: 'POST', body: {} })).user); }
    catch (e) { setError(e.message); } finally { setBusy(''); }
  }
  return <main className="auth-page">
    <section className="auth-story"><Brand light /><div className="auth-story-content"><span className="eyebrow">YOUR NEXT CHAPTER</span><h1>A little more clarity.<br />A lot more possibility.</h1><p>Give your job search a place to come together.</p><div className="journey-preview" aria-label="Track progress from applied to offer"><div><span className="journey-icon"><Send size={20} /></span><span>Application sent<small>Your next move starts here</small></span><Check size={18} /></div><div><span className="journey-icon"><MessagesSquare size={20} /></span><span>Conversation started<small>Turn preparation into progress</small></span><Check size={18} /></div><div><span className="journey-icon final"><CircleCheck size={20} /></span><span>Opportunity ahead<small>Keep the bigger picture in sight</small></span><ArrowUpRight size={20} /></div></div></div><div className="auth-foot">One workspace. Every opportunity.</div></section>
    <section className="auth-form-side"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="section-kicker">LET’S GET YOU THERE</span><h2>{mode === 'login' ? 'Welcome back.' : 'Your search starts here.'}</h2><p className="muted">{mode === 'login' ? 'Sign in to pick up where you left off.' : 'Create an account and make your next move.'}</p><form onSubmit={submit}>
      {mode === 'register' && <label>Your name<input name="name" autoComplete="name" maxLength={80} required placeholder="e.g. Sudharsan" /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" /></label>
      <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 10 : undefined} maxLength={128} required placeholder={mode === 'register' ? 'At least 10 characters' : 'Enter your password'} /></label>
      <ErrorMessage>{error}</ErrorMessage><button className="button primary wide" disabled={Boolean(busy)}>{busy === 'submit' ? <Spinner /> : null}{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={18} /></button>
    </form><p className="switch-auth">{mode === 'login' ? 'New to ApplyTrack?' : 'Already have an account?'} <button disabled={Boolean(busy)} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p><div className="divider"><span>JUST LOOKING AROUND?</span></div><button className="button secondary wide" disabled={Boolean(busy)} onClick={demo}>{busy === 'demo' ? <Spinner /> : <LayoutDashboard size={18} />}Explore the demo<ArrowUpRight size={17} /></button><p className="demo-explainer">A private sample workspace. No signup needed.</p></div><p className="auth-bottom">A little progress, every day.</p></section>
  </main>;
}

function Modal({ title, subtitle, onClose, children, busy = false }) {
  const dialog = useRef(null);
  useEffect(() => { const el = dialog.current; el.showModal(); return () => { if (el.open) el.close(); }; }, []);
  return <dialog ref={dialog} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} onClick={e => { if (e.target === dialog.current && !busy) onClose(); }}><div className="modal-inner"><header className="modal-header"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><X size={21} /></button></header>{children}</div></dialog>;
}

function ApplicationForm({ application, onClose, onSave }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try { await onSave(application?.id, body); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <Modal title={application ? 'Edit application' : 'Add an application'} subtitle="Keep the details together, from first click to offer." onClose={onClose} busy={busy}><form className="application-form" onSubmit={submit}><div className="form-grid">
    <label>Company <span>*</span><input name="company" required autoFocus maxLength={100} placeholder="e.g. Orbit Labs" defaultValue={application?.company || ''} /></label>
    <label>Job role <span>*</span><input name="role" required maxLength={150} placeholder="e.g. Frontend Developer Intern" defaultValue={application?.role || ''} /></label>
    <label>Location<input name="location" maxLength={120} placeholder="e.g. Chennai · Hybrid" defaultValue={application?.location || ''} /></label>
    <label>Status <span>*</span><select name="status" defaultValue={application?.status || 'Applied'}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></label>
    <label>Applied on <span>*</span><input name="applied_on" type="date" required min="2000-01-01" max={today()} defaultValue={application?.applied_on || today()} /></label>
    <label>Job link<input name="job_url" type="url" maxLength={1000} placeholder="https://company.com/careers/…" defaultValue={application?.job_url || ''} /></label>
    <label className="full">Notes<textarea name="notes" rows={4} maxLength={4000} placeholder="Interview details, next steps, or anything to remember…" defaultValue={application?.notes || ''} /></label>
  </div><ErrorMessage>{error}</ErrorMessage><footer className="modal-footer"><span>* Required fields</span><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? <Spinner /> : <Check size={17} />}{application ? 'Save changes' : 'Add application'}</button></footer></form></Modal>;
}

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [sort, setSort] = useState('newest');
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { api('/auth/me').then(({ user }) => setUser(user)).catch(e => { if (e.status !== 401) setBootError('Could not connect to ApplyTrack. Check the server and try again.'); }).finally(() => setBooting(false)); }, []);
  useEffect(() => { if (user) loadItems(); }, [user?.id]);
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 4000); return () => clearTimeout(timer); } }, [toast]);
  async function loadItems() {
    setLoading(true); setError('');
    try { setItems((await api('/applications')).applications); }
    catch (e) { if (e.status === 401) setUser(null); else setError(e.message); }
    finally { setLoading(false); }
  }
  function signedIn(nextUser) { setItems([]); setUser(nextUser); setView('overview'); setStatus('All'); setSearch(''); }
  async function signOut() {
    setBusy(true);
    try { await api('/auth/logout', { method: 'POST', body: {} }); setUser(null); setItems([]); setEditor(null); setDeleting(null); setToast(''); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function save(id, body) {
    const { application } = await api(id ? `/applications/${id}` : '/applications', { method: id ? 'PUT' : 'POST', body });
    setItems(old => id ? old.map(x => x.id === id ? application : x) : [application, ...old]);
    setEditor(null); setToast(id ? 'Application updated.' : 'Application added. One step closer.');
  }
  async function remove() {
    setBusy(true); setDeleteError('');
    try { await api(`/applications/${deleting.id}`, { method: 'DELETE', body: {} }); setItems(old => old.filter(x => x.id !== deleting.id)); setDeleting(null); setToast('Application deleted.'); }
    catch (e) { setDeleteError(e.message); } finally { setBusy(false); }
  }
  function changeView(next) { setView(next); setSearch(''); setStatus('All'); }
  function filterStatus(next) { setStatus(next); setView('applications'); setSearch(''); }
  if (booting) return <main className="loading-page"><Brand /><Spinner /><p>Opening your workspace…</p></main>;
  if (bootError) return <main className="loading-page"><Brand /><ErrorMessage>{bootError}</ErrorMessage><button className="button primary" onClick={() => window.location.reload()}>Try again</button></main>;
  if (!user) return <Auth onSignIn={signedIn} />;

  const counts = Object.fromEntries(STATUSES.map(s => [s, items.filter(x => x.status === s).length]));
  const query = search.trim().toLowerCase();
  const filtered = items.filter(x => (status === 'All' || x.status === status) && `${x.company} ${x.role} ${x.location}`.toLowerCase().includes(query)).sort((a, b) => sort === 'company' ? a.company.localeCompare(b.company) : sort === 'oldest' ? a.applied_on.localeCompare(b.applied_on) || a.created_at - b.created_at : b.applied_on.localeCompare(a.applied_on) || b.created_at - a.created_at);
  const visible = view === 'overview' ? filtered.slice(0, 5) : filtered;
  const progress = items.length ? Math.round((counts.Interview + counts.Offer) / items.length * 100) : 0;
  const cards = [
    { title: 'Total applications', number: items.length, description: 'Every opportunity, in one place', icon: BriefcaseBusiness, className: 'total', filter: 'All' },
    { title: 'Awaiting a response', number: counts.Applied, description: 'Applications in motion', icon: Send, className: 'applied', filter: 'Applied' },
    { title: 'Interviews', number: counts.Interview, description: 'Conversations moving forward', icon: MessagesSquare, className: 'interview', filter: 'Interview' },
    { title: 'Offers received', number: counts.Offer, description: 'Your hard work, paying off', icon: CircleCheck, className: 'offer', filter: 'Offer' }
  ];
  return <div className="app-shell">
    <aside className="sidebar"><Brand light /><span className="nav-label">WORKSPACE</span><nav aria-label="Main navigation"><button className={view === 'overview' ? 'active' : ''} onClick={() => changeView('overview')} aria-current={view === 'overview' ? 'page' : undefined}><LayoutDashboard size={19} />Overview</button><button className={view === 'applications' ? 'active' : ''} onClick={() => changeView('applications')} aria-current={view === 'applications' ? 'page' : undefined}><BriefcaseBusiness size={19} />Applications<span className="nav-count">{items.length}</span></button></nav><div className="sidebar-note"><span className="little-arrow"><ArrowUpRight size={26} /></span><h3>Your next chapter<br />is taking shape.</h3><p>Small steps today.<br />New possibilities tomorrow.</p></div><div className="sidebar-user"><span className="avatar">{initials(user.name)}</span><div><strong>{user.name}</strong><small>{user.isDemo ? 'Demo workspace' : 'Personal workspace'}</small></div><button className="icon-button" onClick={signOut} disabled={busy} aria-label="Sign out"><LogOut size={18} /></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb">Workspace<ChevronRight size={15} /><strong>{view === 'overview' ? 'Overview' : 'Applications'}</strong></div><span className="top-date"><CalendarDays size={16} />{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</span></header>
    <main className="workspace">{user.isDemo && <div className="demo-banner"><span><span className="demo-tag">DEMO</span>You’re exploring a private workspace with fictional sample applications.</span><button onClick={signOut} disabled={busy}>Create your own<ArrowUpRight size={15} /></button></div>}
      <section className="page-heading"><div><p className="section-kicker">{view === 'overview' ? `WELCOME BACK, ${user.name.split(' ')[0].toUpperCase()}` : 'YOUR OPPORTUNITIES'}</p><h1>{view === 'overview' ? 'Make your next move.' : 'All applications.'}</h1><p className="muted">{view === 'overview' ? 'A clear view of where you are. And where you’re headed.' : 'Keep every opportunity and next step in sight.'}</p></div><button className="button primary" onClick={() => setEditor({})}><Plus size={19} />Add application</button></section>
      <ErrorMessage>{error}</ErrorMessage>{error && <button className="button secondary" onClick={loadItems}>Try again</button>}
      {loading ? <div className="data-loading" role="status"><Spinner />Loading applications…</div> : <>
      <section className="stats-grid" aria-label="Application summary">{cards.map(({ title, number, description, icon: Icon, className, filter }) => <button className={`stat-card ${className}`} key={title} onClick={() => filterStatus(filter)}><div className="stat-top"><span>{title}</span><span className="stat-icon"><Icon size={19} /></span></div><strong className="stat-number">{String(number).padStart(2, '0')}</strong><div className="stat-bottom"><span>{description}</span><ArrowUpRight size={17} /></div></button>)}</section>
      {view === 'overview' && <section className="pipeline-panel"><div className="pipeline-info"><span className="section-kicker">THE BIG PICTURE</span><h2>Your application pipeline</h2><p>{items.length ? <><strong>{counts.Applied + counts.Interview} active applications</strong> with possibilities ahead.</> : 'Your first application is the start of something.'}</p></div><div className="pipeline-visual"><div className="pipeline-meta"><span>Application progress</span><span><strong>{progress}%</strong> at interview or offer</span></div><div className="pipeline-bar" aria-label={`${items.length} applications: ${STATUSES.map(s => `${counts[s]} ${s}`).join(', ')}`}>{items.length ? STATUSES.map(s => counts[s] > 0 && <button key={s} className={`segment ${s.toLowerCase()}`} style={{ flexGrow: counts[s] }} title={`${s}: ${counts[s]}`} aria-label={`Show ${counts[s]} ${s} applications`} onClick={() => filterStatus(s)} />) : <span className="segment empty-segment" />}</div><div className="pipeline-legend">{STATUSES.map(s => <button key={s} onClick={() => filterStatus(s)}><span className={`legend-dot ${s.toLowerCase()}`} />{s}<strong>{counts[s]}</strong></button>)}</div></div></section>}
      <section className="applications-panel"><div className="panel-heading"><div><h2>{view === 'overview' ? 'Recent applications' : 'Application list'}<span className="count-badge">{view === 'overview' ? items.length : filtered.length}</span></h2><p>{view === 'overview' ? 'Your latest steps toward what’s next.' : 'Update a status or open an application to see the details.'}</p></div>{view === 'overview' && <button className="text-button" onClick={() => changeView('applications')}>View all applications<ArrowRight size={16} /></button>}</div>
      {view === 'applications' && <><div className="filter-row"><label className="search-field"><Search size={18} /><input aria-label="Search applications" placeholder="Search company, role or location…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button aria-label="Clear search" onClick={() => setSearch('')}><X size={16} /></button>}</label><label className="sort-field"><ListFilter size={17} /><select aria-label="Sort applications" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="company">Company A–Z</option></select></label></div><div className="status-tabs" aria-label="Filter by status">{['All', ...STATUSES].map(s => <button key={s} className={status === s ? 'selected' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>{s === 'All' ? 'All applications' : s}<span>{s === 'All' ? items.length : counts[s]}</span></button>)}</div></>}
      {visible.length > 0 ? <div className="table-wrap"><table><thead><tr><th>COMPANY</th><th>ROLE & LOCATION</th><th>STATUS</th><th>APPLIED ON</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td><button className="company-button" onClick={() => setEditor(item)}><span className={`company-avatar tone-${item.company.length % 5}`}>{initials(item.company)}</span><span>{item.company}</span></button></td><td><span className="role-text">{item.role}</span><span className="location-text"><MapPin size={12} />{item.location || 'Location not added'}</span></td><td><Status status={item.status} /></td><td className="date-cell">{shortDate(item.applied_on)}</td><td><div className="row-actions">{item.job_url && <a className="icon-button" href={item.job_url} target="_blank" rel="noopener noreferrer" aria-label={`Open job link for ${item.company}`}><ExternalLink size={16} /></a>}<button className="icon-button" onClick={() => setEditor(item)} aria-label={`Edit ${item.company} application`}><Pencil size={16} /></button><button className="icon-button delete" onClick={() => { setDeleting(item); setDeleteError(''); }} aria-label={`Delete ${item.company} application`}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-icon">{items.length ? <Search size={26} /> : <BriefcaseBusiness size={28} />}</span><h3>{items.length ? 'No matching applications' : 'Your next chapter starts with one application.'}</h3><p>{items.length ? 'Try a different search or clear your filters.' : 'Add a role you’ve applied for and keep your progress together.'}</p><button className="button secondary" onClick={() => items.length ? (setSearch(''), setStatus('All')) : setEditor({})}>{items.length ? 'Clear filters' : 'Add your first application'}<ArrowRight size={16} /></button></div>}
      <footer className="table-footer"><span>Showing {visible.length} of {view === 'overview' ? items.length : filtered.length} applications</span><span><span className="saved-indicator" />Saved to your workspace</span></footer></section>
      </>}<footer className="workspace-footer"><span>Keep going. Every application is a step forward.</span><span>ApplyTrack <ArrowUpRight size={14} /></span></footer>
    </main></div>
    {editor && <ApplicationForm application={editor.id ? editor : null} onClose={() => setEditor(null)} onSave={save} />}
    {deleting && <Modal title="Delete this application?" subtitle={`${deleting.role} at ${deleting.company}`} onClose={() => setDeleting(null)} busy={busy}><div className="delete-body"><p>This will permanently remove the application and its notes.</p><ErrorMessage>{deleteError}</ErrorMessage></div><footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Keep application</button><button className="button danger" disabled={busy} onClick={remove}>{busy ? <Spinner /> : <Trash2 size={16} />}Delete application</button></footer></Modal>}
    {toast && <div className="toast" role="status"><CircleCheck size={18} />{toast}<button className="icon-button" onClick={() => setToast('')} aria-label="Dismiss notification"><X size={16} /></button></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App />);
