import { create } from 'zustand'

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export const useStore = create((set, get) => ({
  connections: [],
  activeConn: null,
  activeTable: null,
  results: null,
  searching: false,
  indexing: false,
  error: null,
  benchmark: null,
  searchHistory: [],

  setActiveConn: (c) => set({ activeConn: c, activeTable: c?.tables?.[0] || null, results: null }),
  setActiveTable: (t) => set({ activeTable: t, results: null }),

  fetchConnections: async () => {
    try {
      const r = await fetch(`${API}/connections`)
      const data = await r.json()
      set({ connections: data })
      // Poll indexing ones
      data.filter(c => c.index_status === 'indexing' || c.index_status === 'pending')
          .forEach(c => get().pollConnection(c.id))
    } catch (e) { console.error(e) }
  },

  createConnection: async ({ name, db_type, connection_string }) => {
    set({ indexing: true, error: null })
    try {
      const r = await fetch(`${API}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, db_type, connection_string }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Failed to create connection')
      set(s => ({ connections: [data, ...s.connections], activeConn: data, activeTable: data.tables?.[0] }))
      get().pollConnection(data.id)
      return data
    } catch (e) {
      set({ error: e.message }); throw e
    } finally {
      set({ indexing: false })
    }
  },

  pollConnection: (id) => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/connections/${id}`)
        const data = await r.json()
        set(s => ({
          connections: s.connections.map(c => c.id === id ? data : c),
          activeConn: s.activeConn?.id === id ? data : s.activeConn,
        }))
        if (data.index_status === 'ready' || data.index_status === 'error') {
          clearInterval(interval)
        }
      } catch (e) { clearInterval(interval) }
    }, 2000)
  },

  deleteConnection: async (id) => {
    await fetch(`${API}/connections/${id}`, { method: 'DELETE' })
    set(s => ({
      connections: s.connections.filter(c => c.id !== id),
      activeConn: s.activeConn?.id === id ? null : s.activeConn,
    }))
  },

  search: async (query) => {
    const { activeConn, activeTable } = get()
    if (!activeConn || !activeTable) return
    set({ searching: true, error: null })
    try {
      const r = await fetch(`${API}/connections/${activeConn.id}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, table: activeTable, top_k: 10 }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Search failed')
      set({ results: data })
      return data
    } catch (e) {
      set({ error: e.message }); throw e
    } finally {
      set({ searching: false })
    }
  },

  runBenchmark: async () => {
    const { activeConn, activeTable } = get()
    if (!activeConn || !activeTable) return
    try {
      const r = await fetch(`${API}/connections/${activeConn.id}/benchmark?table=${activeTable}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail)
      set({ benchmark: data })
      return data
    } catch (e) { set({ error: e.message }) }
  },

  fetchHistory: async () => {
    const { activeConn } = get()
    if (!activeConn) return
    try {
      const r = await fetch(`${API}/connections/${activeConn.id}/history`)
      const data = await r.json()
      set({ searchHistory: data })
    } catch (e) { console.error(e) }
  },
}))
