import { useState, useEffect, useCallback } from 'react'
import WorkflowBuilder from './components/WorkflowBuilder'
import Workstations from './components/Workstations'
import MetricsDashboard from './components/MetricsDashboard'
import LogsView from './components/LogsView'
import Plugins from './components/Plugins'

// Service URLs from environment or relative (for Docker/proxy deployments)
const getServiceUrl = (name: string, port: number): string => {
  const envKey = `VITE_${name.toUpperCase()}_URL`
  const envUrl = import.meta.env[envKey]
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/${name.toLowerCase()}` : `http://localhost:${port}`
}

const GREENIE_URL = getServiceUrl('Greenie', 8080)

const SERVICES = [
  { name: 'Greenie', port: 8080 },
  { name: 'Slinker', port: 8000 },
  { name: 'Trapper', port: 3000 },
  { name: 'Gobber', port: 8085 },
  { name: 'Sneaker', port: 8086 },
  { name: 'Hider', port: 8087 },
  { name: 'Poltergeist', port: 8088 },
  { name: 'Shrewd', port: 8089 },
]

type ServiceStatus = {
  name: string
  url: string
  status: 'online' | 'offline' | 'checking'
  version?: string
}

type Agent = {
  name: string
  status: string
  runner: string
}

type Run = {
  id: string
  agent: string
  status: string
  prompt: string
  startedAt: string
}

type Page = 'services' | 'agents' | 'runs' | 'workflows' | 'workstations' | 'metrics' | 'logs' | 'plugins'

function App() {
  const [page, setPage] = useState<Page>('services')
  const [services, setServices] = useState<ServiceStatus[]>(
    SERVICES.map(s => ({ name: s.name, url: getServiceUrl(s.name, s.port), status: 'checking' }))
  )
  const [agents, setAgents] = useState<Agent[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)

  // Poll service health every 10 seconds
  const checkHealth = useCallback(async () => {
    setServices(prev => prev.map(s => ({ ...s, status: 'checking' })))
    const results = await Promise.all(
      SERVICES.map(async (s) => {
        const url = getServiceUrl(s.name, s.port)
        try {
          const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) })
          if (resp.ok) {
            const data = await resp.json().catch(() => ({}))
            return { name: s.name, url, status: 'online' as const, version: data.version }
          }
        } catch { /* offline */ }
        return { name: s.name, url, status: 'offline' as const }
      })
    )
    setServices(results)
  }, [])

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 10000)
    return () => clearInterval(interval)
  }, [checkHealth])

  // Fetch agents from Greenie
  const fetchAgents = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${GREENIE_URL}/api/agents`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setAgents(Array.isArray(data) ? data : [])
      }
    } catch { /* Greenie unavailable */ }
    setLoading(false)
  }, [])

  // Fetch runs from Greenie
  const fetchRuns = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${GREENIE_URL}/api/runs?limit=20`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setRuns(Array.isArray(data) ? data : [])
      }
    } catch { /* Greenie unavailable */ }
    setLoading(false)
  }, [])

  const statusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500/20 text-green-400'
      case 'offline': return 'bg-red-500/20 text-red-400'
      default: return 'bg-yellow-500/20 text-yellow-400'
    }
  }

  const runStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400'
      case 'running': return 'bg-blue-500/20 text-blue-400'
      case 'failed': return 'bg-red-500/20 text-red-400'
      case 'pending': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">👻 Slammer ~ Evershade Dashboard</h1>
          <p className="text-gray-400 mt-2">
            "Now that all the ghosts of Evershade Valley are under my control..." ~ King Boo
          </p>
        </div>
        <nav className="max-w-7xl mx-auto px-4 flex flex-wrap gap-2">
          {(['services', 'agents', 'runs', 'workflows', 'workstations', 'metrics', 'logs', 'plugins'] as Page[]).map(p => (
            <button
              key={p}
              onClick={() => { setPage(p); if (p === 'agents') fetchAgents(); if (p === 'runs') fetchRuns() }}
              className={`px-3 py-1.5 text-sm rounded capitalize ${
                page === p ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Services Page */}
        {page === 'services' && (
          <>
            <h2 className="text-xl font-semibold mb-4">Service Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service) => (
                <div key={service.name} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="font-semibold text-lg">{service.name}</h3>
                  <p className="text-sm text-gray-400">{service.url}</p>
                  {service.version && <p className="text-xs text-gray-500 mt-1">v{service.version}</p>}
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${statusColor(service.status)}`}>
                    {service.status === 'online' ? '✓ Online' : service.status === 'offline' ? '✗ Offline' : '⟳ Checking'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Agents Page */}
        {page === 'agents' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Agents</h2>
              <button onClick={fetchAgents} className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="text-gray-400">Loading agents...</p>
            ) : agents.length === 0 ? (
              <p className="text-gray-500">No agents found. Configure agents in Greenie.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agents.map((agent, i) => (
                  <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="font-semibold text-lg">{agent.name}</h3>
                    <p className="text-sm text-gray-400">Runner: {agent.runner || 'unknown'}</p>
                    <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${runStatusColor(agent.status)}`}>
                      {agent.status || 'unknown'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Runs Page */}
        {page === 'runs' && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Runs</h2>
              <button onClick={fetchRuns} className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="text-gray-400">Loading runs...</p>
            ) : runs.length === 0 ? (
              <p className="text-gray-500">No runs found.</p>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <div key={run.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold">{run.agent || 'Unknown'}</h3>
                        <p className="text-sm text-gray-400 mt-1">{run.prompt?.slice(0, 120)}{run.prompt?.length > 120 ? '...' : ''}</p>
                        <p className="text-xs text-gray-500 mt-1">ID: {run.id?.slice(0, 8)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 text-xs rounded-full ${runStatusColor(run.status)}`}>
                          {run.status}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Workflows Page */}
        {page === 'workflows' && <WorkflowBuilder />}

        {/* Workstations Page */}
        {page === 'workstations' && <Workstations />}

        {/* Metrics Page */}
        {page === 'metrics' && <MetricsDashboard />}

        {/* Logs Page */}
        {page === 'logs' && <LogsView />}

        {/* Plugins Page */}
        {page === 'plugins' && <Plugins />}
      </main>
    </div>
  )
}

export default App
