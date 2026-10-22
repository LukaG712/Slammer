import { useState, useEffect, useCallback } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

type Workstation = {
  id: string
  name: string
  description: string
  status: string
  container_id: string
  container_name: string
  cpu_percent: number
  memory_usage_bytes: number
  created_at: string
  started_at: string | null
  agent_name: string
  tags: string[]
}

function Workstations() {
  const [workstations, setWorkstations] = useState<Workstation[]>([])
  const [stats, setStats] = useState<{ total: number; running: number; stopped: number; error: number; docker_available: boolean } | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedWs, setSelectedWs] = useState<Workstation | null>(null)
  const [logs, setLogs] = useState('')
  const [showLogs, setShowLogs] = useState(false)

  const fetchWorkstations = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workstations`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setWorkstations(data.workstations || [])
      }
    } catch { /* Greenie unavailable */ }
    setLoading(false)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workstations/stats`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setStats(data)
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  const fetchLogs = useCallback(async (wsId: string) => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workstations/${wsId}/logs?tail=200`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setLogs(data.logs || '')
        setShowLogs(true)
      }
    } catch { /* failed */ }
  }, [])

  const handleAction = useCallback(async (wsId: string, action: string) => {
    try {
      await fetch(`${GREENIE_URL}/api/workstations/${wsId}/${action}`, {
        method: 'POST',
        signal: AbortSignal.timeout(15000),
      })
      await fetchWorkstations()
      await fetchStats()
    } catch { /* failed */ }
  }, [fetchWorkstations, fetchStats])

  useEffect(() => {
    fetchWorkstations()
    fetchStats()
  }, [fetchWorkstations, fetchStats])

  const statusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/20 text-green-400'
      case 'stopped': return 'bg-gray-500/20 text-gray-400'
      case 'error': return 'bg-red-500/20 text-red-400'
      case 'destroyed': return 'bg-red-900/20 text-red-500'
      case 'creating': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-yellow-500/20 text-yellow-400'
    }
  }

  const formatMemory = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Workstations</h2>
        <button onClick={() => { fetchWorkstations(); fetchStats() }}
          className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Running</p>
            <p className="text-2xl font-bold text-green-400">{stats.running}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Stopped</p>
            <p className="text-2xl font-bold text-gray-400">{stats.stopped}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Errors</p>
            <p className="text-2xl font-bold text-red-400">{stats.error}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Docker</p>
            <p className="text-2xl font-bold">{stats.docker_available ? '✓' : '✗'}</p>
          </div>
        </div>
      )}

      {/* Workstation List */}
      {loading ? (
        <p className="text-gray-400">Loading workstations...</p>
      ) : workstations.length === 0 ? (
        <p className="text-gray-500">No workstations found. Create one via the API.</p>
      ) : (
        <div className="space-y-3">
          {workstations.map((ws) => (
            <div key={ws.id}
              className={`bg-gray-800 rounded-lg p-4 border cursor-pointer transition-colors ${
                selectedWs?.id === ws.id ? 'border-blue-500' : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => { setSelectedWs(ws); setShowLogs(false); setLogs('') }}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{ws.name}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusColor(ws.status)}`}>
                      {ws.status}
                    </span>
                  </div>
                  {ws.description && <p className="text-sm text-gray-400 mt-1">{ws.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span>ID: {ws.id.slice(0, 12)}</span>
                    {ws.agent_name && <span>Agent: {ws.agent_name}</span>}
                    {ws.container_id && <span>Container: {ws.container_id.slice(0, 12)}</span>}
                    <span>Created: {ws.created_at ? new Date(ws.created_at).toLocaleString() : '-'}</span>
                  </div>
                  {ws.status === 'running' && (
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>CPU: {ws.cpu_percent.toFixed(1)}%</span>
                      <span>Memory: {formatMemory(ws.memory_usage_bytes)}</span>
                    </div>
                  )}
                  {ws.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {ws.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {ws.status === 'running' && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); fetchLogs(ws.id) }}
                        className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
                        Logs
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleAction(ws.id, 'stop') }}
                        className="px-2 py-1 text-xs bg-yellow-600 rounded hover:bg-yellow-700">
                        Stop
                      </button>
                    </>
                  )}
                  {(ws.status === 'pending' || ws.status === 'stopped') && (
                    <button onClick={(e) => { e.stopPropagation(); handleAction(ws.id, 'start') }}
                      className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700">
                      Start
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleAction(ws.id, 'destroy') }}
                    className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-700">
                    Destroy
                  </button>
                </div>
              </div>

              {/* Logs panel */}
              {showLogs && selectedWs?.id === ws.id && (
                <div className="mt-3 bg-gray-950 rounded p-3 max-h-60 overflow-auto">
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                    {logs || 'No logs available'}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Workstations
