import { useState, useEffect, useCallback } from 'react'

const SNEAKER_URL = (() => {
  const envUrl = import.meta.env.VITE_SNEAKER_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/sneaker` : 'http://localhost:8003'
})()

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

type MetricPoint = {
  timestamp: string
  value: number
}

type MetricSeries = {
  name: string
  unit: string
  tags: Record<string, string>
  points: MetricPoint[]
}

type Alert = {
  id: string
  name: string
  severity: string
  message: string
  triggeredAt: string
  count: number
}

function MetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricSeries[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [systemStats, setSystemStats] = useState<{
    cpuPercent: number
    memoryPercent: number
    diskPercent: number
    uptime: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState('1h')

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(
        `${SNEAKER_URL}/api/metrics?range=${timeRange}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (resp.ok) {
        const data = await resp.json()
        setMetrics(data.metrics || [])
      }
    } catch { /* Sneaker unavailable */ }
    setLoading(false)
  }, [timeRange])

  const fetchAlerts = useCallback(async () => {
    try {
      const resp = await fetch(
        `${SNEAKER_URL}/api/alerts?limit=20`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (resp.ok) {
        const data = await resp.json()
        setAlerts(data.alerts || [])
      }
    } catch { /* Sneaker unavailable */ }
  }, [])

  const fetchSystemStats = useCallback(async () => {
    try {
      const resp = await fetch(
        `${GREENIE_URL}/api/system/stats`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (resp.ok) {
        const data = await resp.json()
        setSystemStats(data)
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  useEffect(() => {
    fetchMetrics()
    fetchAlerts()
    fetchSystemStats()
    const interval = setInterval(() => {
      fetchMetrics()
      fetchAlerts()
      fetchSystemStats()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchMetrics, fetchAlerts, fetchSystemStats])

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'warning': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'info': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percent') return `${value.toFixed(1)}%`
    if (unit === 'bytes') {
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
      if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`
      return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`
    }
    if (unit === 'milliseconds') return `${value.toFixed(0)} ms`
    return value.toFixed(2)
  }

  const renderSimpleChart = (series: MetricSeries) => {
    const { points } = series
    if (points.length < 2) return null

    const values = points.map(p => p.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const width = 300
    const height = 60
    const padding = 2

    const pathD = points.map((p, i) => {
      const x = padding + (i / (points.length - 1)) * (width - 2 * padding)
      const y = height - padding - ((p.value - min) / range) * (height - 2 * padding)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Metrics & Observability</h2>
        <div className="flex gap-2">
          {['1h', '6h', '24h', '7d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-sm rounded ${
                timeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {range}
            </button>
          ))}
          <button onClick={() => { fetchMetrics(); fetchAlerts(); fetchSystemStats() }}
            className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
            Refresh
          </button>
        </div>
      </div>

      {/* System Stats */}
      {systemStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">CPU</p>
            <p className="text-2xl font-bold">{systemStats.cpuPercent.toFixed(1)}%</p>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${systemStats.cpuPercent}%` }}
              />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Memory</p>
            <p className="text-2xl font-bold">{systemStats.memoryPercent.toFixed(1)}%</p>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${systemStats.memoryPercent}%` }}
              />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Disk</p>
            <p className="text-2xl font-bold">{systemStats.diskPercent.toFixed(1)}%</p>
            <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all"
                style={{ width: `${systemStats.diskPercent}%` }}
              />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">Uptime</p>
            <p className="text-2xl font-bold">
              {Math.floor(systemStats.uptime / 3600)}h {Math.floor((systemStats.uptime % 3600) / 60)}m
            </p>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Metrics</h3>
        {loading ? (
          <p className="text-gray-400">Loading metrics...</p>
        ) : metrics.length === 0 ? (
          <p className="text-gray-500">No metrics available. Configure Sneaker to collect metrics.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.slice(0, 8).map((series, i) => (
              <div key={i} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-semibold">{series.name}</h4>
                    <p className="text-xs text-gray-500">
                      {Object.entries(series.tags).map(([k, v]) => `${k}=${v}`).join(' · ')}
                    </p>
                  </div>
                  <span className="text-lg font-mono">
                    {series.points.length > 0
                      ? formatValue(series.points[series.points.length - 1].value, series.unit)
                      : '-'}
                  </span>
                </div>
                {renderSimpleChart(series)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Recent Alerts</h3>
        {alerts.length === 0 ? (
          <p className="text-gray-500">No active alerts. All systems nominal.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id}
                className={`bg-gray-800 rounded-lg p-4 border ${severityColor(alert.severity)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold">{alert.name}</h4>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : '-'}
                      {alert.count > 1 && ` · ${alert.count} occurrences`}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${severityColor(alert.severity)}`}>
                    {alert.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default MetricsDashboard
