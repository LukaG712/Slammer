import { useState, useEffect, useCallback, useRef } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

type LogEntry = {
  timestamp: string
  level: string
  service: string
  message: string
}

function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('all')
  const [levelFilter, setLevelFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const logsContainerRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (serviceFilter !== 'all') params.set('service', serviceFilter)
      if (levelFilter !== 'all') params.set('level', levelFilter)
      if (searchQuery) params.set('q', searchQuery)

      const resp = await fetch(
        `${GREENIE_URL}/api/logs?${params}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (resp.ok) {
        const data = await resp.json()
        setLogs(data.logs || [])
      }
    } catch { /* Greenie unavailable */ }
    setLoading(false)
  }, [serviceFilter, levelFilter, searchQuery])

  useEffect(() => {
    fetchLogs()
    const interval = setInterval(fetchLogs, 10000)
    return () => clearInterval(interval)
  }, [fetchLogs])

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const levelColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'text-red-400'
      case 'warn': case 'warning': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-gray-500'
      default: return 'text-gray-300'
    }
  }

  const levelBadge = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'bg-red-500/20 text-red-400'
      case 'warn': case 'warning': return 'bg-yellow-500/20 text-yellow-400'
      case 'info': return 'bg-blue-500/20 text-blue-400'
      case 'debug': return 'bg-gray-600/20 text-gray-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const services = [...new Set(logs.map(l => l.service).filter(Boolean))]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Logs</h2>
        <div className="flex gap-2">
          <button onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 text-sm rounded ${
              autoScroll ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
          <button onClick={fetchLogs}
            className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
        >
          <option value="all">All Services</option>
          {services.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
        >
          <option value="all">All Levels</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <input
          type="text"
          placeholder="Search logs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white flex-1 min-w-48"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {['error', 'warning', 'info', 'debug'].map(level => {
          const count = logs.filter(l => l.level?.toLowerCase() === level).length
          return (
            <div key={level} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-xs rounded-full ${levelBadge(level)}`}>
                  {level.toUpperCase()}
                </span>
                <span className="text-lg font-bold">{count}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Log entries */}
      <div
        ref={logsContainerRef}
        className="bg-gray-950 rounded-lg border border-gray-800 p-4 h-96 overflow-auto font-mono text-xs"
      >
        {loading && logs.length === 0 ? (
          <p className="text-gray-500">Loading logs...</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-500">No logs found matching the current filters.</p>
        ) : (
          <div className="space-y-0.5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 hover:bg-gray-900 px-1 -mx-1 rounded">
                <span className="text-gray-600 shrink-0">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '-'}
                </span>
                <span className={`shrink-0 uppercase w-12 text-center ${levelColor(log.level)}`}>
                  {log.level?.slice(0, 5) || 'info'}
                </span>
                {log.service && (
                  <span className="text-purple-400 shrink-0 w-24 truncate">
                    [{log.service}]
                  </span>
                )}
                <span className="text-gray-300 break-all">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}

export default LogsView
