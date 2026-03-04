import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Database, Plus, Trash2, Zap, BarChart2,
  ChevronRight, Clock, CheckCircle, AlertCircle, Loader2,
  X, RefreshCw, Table, History, Info
} from 'lucide-react'
import { useStore } from '../store'
import { formatDistanceToNow } from 'date-fns'

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

function StatusBadge({ status }) {
  const map = {
    ready:    { color: 'var(--green)',   label: 'Ready',    dot: true },
    indexing: { color: 'var(--yellow)',  label: 'Indexing', pulse: true },
    pending:  { color: 'var(--text3)',   label: 'Pending',  pulse: true },
    error:    { color: 'var(--red)',     label: 'Error' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11,
      color: s.color, fontFamily:'var(--mono)', letterSpacing:'0.05em' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background: s.color, flexShrink:0,
        animation: s.pulse ? 'pulse 1.2s infinite' : 'none' }}/>
      {s.label}
    </span>
  )
}

function ScoreBar({ score }) {
  const pct = Math.round(score * 100)
  const color = score > 0.7 ? 'var(--green)' : score > 0.4 ? 'var(--yellow)' : 'var(--text3)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div className="score-bar" style={{ flex:1 }}>
        <div className="score-fill" style={{ width:`${pct}%`, background: color }}/>
      </div>
      <span style={{ fontSize:11, fontFamily:'var(--mono)', color, minWidth:32, textAlign:'right' }}>
        {pct}%
      </span>
    </div>
  )
}

function ResultCard({ result, index }) {
  const [expanded, setExpanded] = useState(false)
  const data = result.data || {}

  // Pick best display fields
  const titleFields = ['subject', 'title', 'name', 'employee_id', 'ticket_id', 'sku']
  const bodyFields = ['body', 'content', 'description', 'bio']
  const metaFields = ['status', 'priority', 'category', 'department', 'price', 'rating', 'views']

  const title = titleFields.map(f => data[f]).find(Boolean) || `Record #${result.id}`
  const body = bodyFields.map(f => data[f]).find(Boolean)
  const metas = metaFields.filter(f => data[f] != null).slice(0, 4)

  return (
    <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ delay: index * 0.04 }}
      style={{ border:'1px solid var(--border)', borderRadius:9, overflow:'hidden', marginBottom:8,
        background: expanded ? 'var(--bg3)' : 'var(--bg2)', transition:'background 0.15s' }}>
      <div onClick={() => setExpanded(o=>!o)}
        style={{ padding:'12px 14px', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
          <span style={{ width:22, height:22, borderRadius:6, background:'var(--green-soft)',
            color:'var(--green)', fontSize:11, fontWeight:700, display:'flex', alignItems:'center',
            justifyContent:'center', flexShrink:0, fontFamily:'var(--mono)' }}>{index+1}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontWeight:600, fontSize:13, marginBottom:3,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>
              {title}
            </p>
            {body && (
              <p style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5,
                overflow: expanded ? 'visible' : 'hidden',
                display: expanded ? 'block' : '-webkit-box',
                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {body}
              </p>
            )}
          </div>
        </div>
        <ScoreBar score={result.score}/>
        {metas.length > 0 && (
          <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
            {metas.map(f => (
              <span key={f} style={{ fontSize:10, padding:'2px 8px', borderRadius:12,
                background:'var(--bg4)', color:'var(--text3)', fontFamily:'var(--mono)',
                border:'1px solid var(--border)' }}>
                {f}: {String(data[f])}
              </span>
            ))}
          </div>
        )}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            style={{ overflow:'hidden', borderTop:'1px solid var(--border)' }}>
            <div style={{ padding:'12px 14px' }}>
              <p style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', marginBottom:8,
                textTransform:'uppercase', letterSpacing:'0.08em' }}>All fields</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                {Object.entries(data).filter(([,v]) => v != null).map(([k, v]) => (
                  <div key={k} style={{ fontSize:11, padding:'4px 8px', borderRadius:5,
                    background:'var(--bg4)', border:'1px solid var(--border)' }}>
                    <span style={{ color:'var(--text3)', fontFamily:'var(--mono)' }}>{k}: </span>
                    <span style={{ color:'var(--text2)', wordBreak:'break-word' }}>{String(v).slice(0, 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function NewConnectionModal({ onClose, onCreate }) {
  const [mode, setMode] = useState('demo')
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) return setError('Name is required')
    setLoading(true); setError('')
    try {
      await onCreate({ name, db_type: mode, connection_string: mode === 'sqlite' ? path : undefined })
      onClose()
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)',
        zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <motion.div initial={{ scale:0.95, opacity:0 }} animate={{ scale:1, opacity:1 }}
        className="card" style={{ width:'100%', maxWidth:480, padding:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ fontWeight:700, fontSize:16 }}>New Connection</h3>
          <button onClick={onClose} style={{ color:'var(--text3)', padding:4 }}><X size={16}/></button>
        </div>

        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:11, color:'var(--text3)', marginBottom:8, textTransform:'uppercase',
            letterSpacing:'0.07em', fontFamily:'var(--mono)' }}>Connection Name</p>
          <input className="input" value={name} onChange={e=>setName(e.target.value)}
            placeholder="My database" autoFocus/>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          {[
            { id:'demo', label:'🗄️ Demo Database', desc:'37,000 pre-loaded rows — instant start' },
            { id:'sqlite', label:'📁 SQLite File', desc:'Path to your .db file' },
          ].map(({ id, label, desc }) => (
            <button key={id} onClick={() => setMode(id)}
              style={{ flex:1, padding:'10px 12px', borderRadius:9, textAlign:'left',
                border:`1.5px solid ${mode===id ? 'var(--green)' : 'var(--border)'}`,
                background: mode===id ? 'var(--green-soft)' : 'var(--bg3)',
                transition:'all 0.15s' }}>
              <p style={{ fontSize:12, fontWeight:600, marginBottom:3 }}>{label}</p>
              <p style={{ fontSize:11, color:'var(--text3)' }}>{desc}</p>
            </button>
          ))}
        </div>

        {mode === 'sqlite' && (
          <div style={{ marginBottom:16 }}>
            <p style={{ fontSize:11, color:'var(--text3)', marginBottom:6, fontFamily:'var(--mono)' }}>Database Path</p>
            <input className="input" value={path} onChange={e=>setPath(e.target.value)}
              placeholder="/path/to/database.db" style={{ fontFamily:'var(--mono)', fontSize:12 }}/>
          </div>
        )}

        {mode === 'demo' && (
          <div style={{ padding:'10px 12px', borderRadius:8, background:'var(--green-soft)',
            border:'1px solid rgba(34,197,94,0.15)', marginBottom:16 }}>
            <p style={{ fontSize:12, color:'var(--green)', lineHeight:1.6 }}>
              Includes: 20,000 support tickets · 5,000 products · 2,000 employees · 10,000 news articles
            </p>
          </div>
        )}

        {error && (
          <div style={{ padding:'8px 12px', borderRadius:7, background:'rgba(239,68,68,0.08)',
            border:'1px solid rgba(239,68,68,0.2)', marginBottom:12,
            display:'flex', gap:6, alignItems:'center' }}>
            <AlertCircle size={12} style={{ color:'var(--red)', flexShrink:0 }}/>
            <p style={{ fontSize:12, color:'var(--red)' }}>{error}</p>
          </div>
        )}

        <button onClick={submit} disabled={loading} className="btn-primary"
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          {loading
            ? <><Loader2 size={13} style={{ animation:'spin 0.7s linear infinite' }}/> Connecting…</>
            : <><Database size={13}/> Create & Index</>
          }
        </button>
      </motion.div>
    </motion.div>
  )
}

export default function App() {
  const {
    connections, activeConn, activeTable, results, searching, error,
    benchmark, searchHistory,
    fetchConnections, createConnection, deleteConnection,
    setActiveConn, setActiveTable, search, runBenchmark, fetchHistory,
  } = useStore()

  const [query, setQuery] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState('search') // search | benchmark | history

  useEffect(() => { fetchConnections() }, [])
  useEffect(() => { if (activeConn) fetchHistory() }, [activeConn?.id])

  const handleSearch = async (q) => {
    if (!q.trim() || !activeConn || activeConn.index_status !== 'ready') return
    await search(q)
  }

  const ready = activeConn?.index_status === 'ready'

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:260, flexShrink:0, background:'var(--bg2)',
        borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>

        {/* Logo */}
        <div style={{ padding:'18px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:32, height:32, borderRadius:8, display:'flex', alignItems:'center',
              justifyContent:'center', background:'var(--green-soft)',
              border:'1px solid rgba(34,197,94,0.2)', boxShadow:'0 0 16px var(--green-glow)' }}>
              <Search size={15} style={{ color:'var(--green)' }}/>
            </div>
            <div>
              <p style={{ fontWeight:800, fontSize:14, color:'var(--green)', fontFamily:'var(--mono)' }}>
                SemanticSearch
              </p>
              <p style={{ fontSize:10, color:'var(--text3)' }}>FAISS · MiniLM · ANN</p>
            </div>
          </div>
        </div>

        {/* Add connection */}
        <div style={{ padding:'12px' }}>
          <button onClick={() => setShowNew(true)} className="btn-primary"
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
              gap:6, fontSize:12, padding:'8px' }}>
            <Plus size={13}/> New Connection
          </button>
        </div>

        {/* Connections list */}
        <div style={{ flex:1, overflow:'auto', padding:'4px 8px' }}>
          {connections.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 12px', color:'var(--text3)' }}>
              <Database size={20} style={{ margin:'0 auto 8px', opacity:0.3 }}/>
              <p style={{ fontSize:12 }}>No connections yet</p>
              <p style={{ fontSize:11, marginTop:4 }}>Create one to get started</p>
            </div>
          )}
          {connections.map(c => (
            <div key={c.id}
              onClick={() => setActiveConn(c)}
              style={{ padding:'10px 10px', borderRadius:8, marginBottom:4, cursor:'pointer',
                transition:'all 0.12s',
                background: activeConn?.id === c.id ? 'var(--bg4)' : 'transparent',
                border: `1px solid ${activeConn?.id === c.id ? 'var(--border2)' : 'transparent'}` }}
              onMouseEnter={e => { if (activeConn?.id !== c.id) e.currentTarget.style.background='var(--bg3)' }}
              onMouseLeave={e => { if (activeConn?.id !== c.id) e.currentTarget.style.background='transparent' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:4 }}>{c.name}</p>
                  <StatusBadge status={c.index_status}/>
                  {c.index_status === 'ready' && (
                    <p style={{ fontSize:10, color:'var(--text3)', marginTop:3, fontFamily:'var(--mono)' }}>
                      {c.total_rows?.toLocaleString()} rows · {c.tables?.length} tables
                    </p>
                  )}
                </div>
                <button onClick={e => { e.stopPropagation(); deleteConnection(c.id) }}
                  style={{ color:'var(--text4)', padding:3, transition:'color 0.1s', flexShrink:0 }}
                  onMouseEnter={e => e.currentTarget.style.color='var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color='var(--text4)'}>
                  <Trash2 size={11}/>
                </button>
              </div>
              {/* Table pills */}
              {c.index_status === 'ready' && activeConn?.id === c.id && (
                <div style={{ display:'flex', gap:4, marginTop:8, flexWrap:'wrap' }}>
                  {(c.tables||[]).map(t => (
                    <button key={t} onClick={e => { e.stopPropagation(); setActiveTable(t) }}
                      style={{ fontSize:10, padding:'2px 8px', borderRadius:12, fontFamily:'var(--mono)',
                        transition:'all 0.1s',
                        background: activeTable === t ? 'var(--green)' : 'var(--bg5)',
                        color: activeTable === t ? '#000' : 'var(--text3)',
                        border: `1px solid ${activeTable === t ? 'var(--green)' : 'var(--border2)'}` }}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer stats */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
          <p style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)', lineHeight:1.7 }}>
            Model: all-MiniLM-L6-v2<br/>
            Index: FAISS IVFFlat<br/>
            Dim: 384
          </p>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {!activeConn ? (
          /* Empty state */
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', padding:40, textAlign:'center' }}>
            <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
              <div style={{ width:64, height:64, borderRadius:16, margin:'0 auto 20px',
                background:'var(--green-soft)', border:'1px solid rgba(34,197,94,0.2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 0 40px var(--green-glow)' }}>
                <Search size={28} style={{ color:'var(--green)' }}/>
              </div>
              <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8, fontFamily:'var(--mono)',
                color:'var(--green)' }}>SemanticSearch</h1>
              <p style={{ color:'var(--text2)', fontSize:15, maxWidth:420, lineHeight:1.7, marginBottom:28 }}>
                Search millions of database records by <em>meaning</em>, not keywords.<br/>
                Powered by FAISS vector indexing and Sentence Transformers.
              </p>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:500, margin:'0 auto 28px' }}>
                {[
                  { icon:'⚡', label:'Sub-10ms search', desc:'FAISS ANN index' },
                  { icon:'🧠', label:'Semantic matching', desc:'384-dim embeddings' },
                  { icon:'📊', label:'37K demo rows', desc:'Ready immediately' },
                ].map(({ icon, label, desc }) => (
                  <div key={label} style={{ padding:'14px', borderRadius:10, background:'var(--bg2)',
                    border:'1px solid var(--border)', textAlign:'center' }}>
                    <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                    <p style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{label}</p>
                    <p style={{ fontSize:11, color:'var(--text3)' }}>{desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowNew(true)} className="btn-primary"
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 28px', fontSize:14 }}>
                <Plus size={15}/> Create your first connection
              </button>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)',
              background:'var(--bg2)', display:'flex', alignItems:'center', gap:14, flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <p style={{ fontWeight:700, fontSize:15, fontFamily:'var(--mono)' }}>{activeConn.name}</p>
                  <StatusBadge status={activeConn.index_status}/>
                  {activeTable && ready && (
                    <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                      / {activeTable}
                    </span>
                  )}
                </div>
                {ready && (
                  <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                    {activeConn.total_rows?.toLocaleString()} rows indexed · {activeConn.tables?.length} tables
                  </p>
                )}
                {activeConn.index_status === 'indexing' && (
                  <p style={{ fontSize:11, color:'var(--yellow)', marginTop:2, display:'flex', alignItems:'center', gap:5 }}>
                    <Loader2 size={11} style={{ animation:'spin 0.7s linear infinite' }}/>
                    Building FAISS index… this takes 1-3 minutes for large datasets
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display:'flex', gap:3, background:'var(--bg3)', padding:3,
                borderRadius:9, border:'1px solid var(--border)' }}>
                {[
                  { id:'search', icon:Search, label:'Search' },
                  { id:'benchmark', icon:BarChart2, label:'Benchmark' },
                  { id:'history', icon:History, label:'History' },
                ].map(({ id, icon:Icon, label }) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                      borderRadius:7, fontSize:12, fontWeight:600, transition:'all 0.15s',
                      background: tab===id ? 'var(--bg5)' : 'transparent',
                      color: tab===id ? 'var(--green)' : 'var(--text3)',
                      border: `1px solid ${tab===id ? 'var(--border2)' : 'transparent'}` }}>
                    <Icon size={12}/> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search bar */}
            {tab === 'search' && (
              <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)',
                background:'var(--bg3)', flexShrink:0 }}>
                <div style={{ display:'flex', gap:10, maxWidth:800 }}>
                  <div style={{ flex:1, position:'relative' }}>
                    <Search size={15} style={{ position:'absolute', left:12, top:'50%',
                      transform:'translateY(-50%)', color:'var(--text3)', pointerEvents:'none' }}/>
                    <input className="input" value={query} onChange={e=>setQuery(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleSearch(query)}
                      placeholder={ready ? `Search ${activeTable} by meaning…` : 'Waiting for index to be ready…'}
                      disabled={!ready}
                      style={{ paddingLeft:38, fontFamily:'var(--mono)', fontSize:13 }} />
                  </div>
                  <button onClick={() => handleSearch(query)}
                    disabled={!ready || searching || !query.trim()}
                    className="btn-primary"
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', flexShrink:0 }}>
                    {searching
                      ? <><Loader2 size={13} style={{ animation:'spin 0.7s linear infinite' }}/> Searching…</>
                      : <><Zap size={13}/> Search</>
                    }
                  </button>
                </div>
                {/* Example queries */}
                {ready && !results && (
                  <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                    {[
                      'angry customer about damaged product',
                      'account login authentication issue',
                      'engineer working on machine learning',
                      'climate technology investment news',
                    ].map(q => (
                      <button key={q} onClick={() => { setQuery(q); handleSearch(q) }}
                        style={{ fontSize:11, padding:'4px 10px', borderRadius:12,
                          background:'var(--bg4)', border:'1px solid var(--border)',
                          color:'var(--text3)', transition:'all 0.1s', fontFamily:'var(--mono)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor='var(--green)'; e.currentTarget.style.color='var(--green)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text3)' }}>
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <div style={{ flex:1, overflow:'auto', padding:'16px 20px' }}>
              <AnimatePresence mode="wait">
                {tab === 'search' && (
                  <motion.div key="search" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                    {error && (
                      <div style={{ padding:'10px 14px', borderRadius:9, marginBottom:14,
                        background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)',
                        display:'flex', gap:8, alignItems:'center' }}>
                        <AlertCircle size={13} style={{ color:'var(--red)', flexShrink:0 }}/>
                        <p style={{ fontSize:13, color:'var(--red)' }}>{error}</p>
                      </div>
                    )}

                    {results && (
                      <>
                        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                          <p style={{ fontSize:13, fontWeight:600 }}>
                            {results.results.length} results
                          </p>
                          <span style={{ fontSize:12, color:'var(--green)', fontFamily:'var(--mono)',
                            background:'var(--green-soft)', padding:'2px 8px', borderRadius:12,
                            border:'1px solid rgba(34,197,94,0.2)' }}>
                            ⚡ {results.search_ms}ms
                          </span>
                          <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                            searched {results.total_rows?.toLocaleString()} rows
                          </span>
                        </div>
                        {results.results.map((r, i) => <ResultCard key={i} result={r} index={i}/>)}
                      </>
                    )}

                    {!results && ready && (
                      <div style={{ textAlign:'center', padding:'48px 20px', color:'var(--text3)' }}>
                        <Search size={32} style={{ margin:'0 auto 12px', opacity:0.2 }}/>
                        <p style={{ fontSize:13 }}>Type a query above to search semantically</p>
                        <p style={{ fontSize:12, marginTop:4 }}>Try the example queries to see it in action</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {tab === 'benchmark' && (
                  <motion.div key="bench" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                    <div style={{ maxWidth:600 }}>
                      <div className="card" style={{ padding:24, marginBottom:16 }}>
                        <p style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>Speed Benchmark</p>
                        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20, lineHeight:1.6 }}>
                          Runs 5 different queries against the current table and measures average search time across {activeConn.total_rows?.toLocaleString()} rows.
                        </p>
                        <button onClick={runBenchmark} className="btn-primary"
                          disabled={!ready}
                          style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <BarChart2 size={13}/> Run Benchmark
                        </button>
                      </div>

                      {benchmark && (
                        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                          className="card" style={{ padding:24 }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:20 }}>
                            {[
                              { label:'AVG', value:`${benchmark.avg_ms}ms`, color:'var(--green)' },
                              { label:'MIN', value:`${benchmark.min_ms}ms`, color:'var(--emerald)' },
                              { label:'MAX', value:`${benchmark.max_ms}ms`, color:'var(--yellow)' },
                            ].map(({ label, value, color }) => (
                              <div key={label} style={{ textAlign:'center', padding:'16px',
                                background:'var(--bg3)', borderRadius:9, border:'1px solid var(--border)' }}>
                                <p style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)',
                                  letterSpacing:'0.08em', marginBottom:6 }}>{label}</p>
                                <p style={{ fontSize:26, fontWeight:800, color, fontFamily:'var(--mono)' }}>{value}</p>
                              </div>
                            ))}
                          </div>
                          <p style={{ fontSize:12, color:'var(--text3)', marginBottom:10,
                            fontFamily:'var(--mono)', letterSpacing:'0.06em' }}>
                            PER-QUERY BREAKDOWN
                          </p>
                          {benchmark.times_ms.map((t, i) => (
                            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                              <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)',
                                minWidth:14 }}>{i+1}</span>
                              <div style={{ flex:1, height:4, borderRadius:4, background:'var(--border)', overflow:'hidden' }}>
                                <motion.div initial={{ width:0 }} animate={{ width:`${(t/benchmark.max_ms)*100}%` }}
                                  transition={{ delay: i*0.1, duration:0.6 }}
                                  style={{ height:'100%', borderRadius:4, background:'var(--green)' }}/>
                              </div>
                              <span style={{ fontSize:12, fontFamily:'var(--mono)', color:'var(--green)',
                                minWidth:55, textAlign:'right' }}>{t}ms</span>
                            </div>
                          ))}
                          <div style={{ marginTop:16, padding:'10px 12px', borderRadius:8,
                            background:'var(--green-soft)', border:'1px solid rgba(34,197,94,0.15)' }}>
                            <p style={{ fontSize:12, color:'var(--green)' }}>
                              ⚡ Searched {benchmark.total_rows?.toLocaleString()} rows in an average of {benchmark.avg_ms}ms — 
                              that's {Math.round(benchmark.total_rows / (benchmark.avg_ms/1000)).toLocaleString()} rows/second.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {tab === 'history' && (
                  <motion.div key="hist" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                    <div style={{ maxWidth:600 }}>
                      {searchHistory.length === 0 ? (
                        <div style={{ textAlign:'center', padding:'48px', color:'var(--text3)' }}>
                          <History size={28} style={{ margin:'0 auto 10px', opacity:0.2 }}/>
                          <p>No searches yet</p>
                        </div>
                      ) : searchHistory.map((h, i) => (
                        <div key={h.id} style={{ padding:'12px 14px', borderRadius:9, marginBottom:6,
                          background:'var(--bg2)', border:'1px solid var(--border)',
                          display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                          onClick={() => { setQuery(h.query); setTab('search'); handleSearch(h.query) }}>
                          <Search size={13} style={{ color:'var(--text3)', flexShrink:0 }}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {h.query}
                            </p>
                            <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                              {h.results_count} results · {h.search_ms}ms · {formatDistanceToNow(new Date(h.created_at), { addSuffix:true })}
                            </p>
                          </div>
                          <ChevronRight size={13} style={{ color:'var(--text4)', flexShrink:0 }}/>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showNew && (
          <NewConnectionModal
            onClose={() => setShowNew(false)}
            onCreate={createConnection}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
