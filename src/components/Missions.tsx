import { useState, useEffect, useCallback } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

// ─── Types ───────────────────────────────────────────────────────────────────

interface MissionFeature {
  id: string
  name: string
  description: string
  role: string
  status: string
  output?: string
  error?: string
  order: number
}

interface MissionMilestone {
  id: string
  name: string
  description: string
  status: string
  success_criteria: string[]
  features: MissionFeature[]
  order: number
  started_at?: string
  completed_at?: string
}

interface ValidationResult {
  id: string
  severity: string
  file_path?: string
  line_number?: number
  explanation: string
  suggested_correction: string
  verified: boolean
}

interface Mission {
  id: string
  description: string
  target_repository: string
  status: string
  orchestrator_model?: string
  worker_model?: string
  validator_model?: string
  autonomy_level: string
  milestones: MissionMilestone[]
  validation_contract?: any
  artifacts: any[]
  error?: string
  parallel_workers: boolean
  started_at?: string
  completed_at?: string
  created_at: string
  updated_at: string
  created_by: string
  tags: string[]
  validation_results?: ValidationResult[]
}

interface MissionStats {
  total_missions: number
  planning: number
  executing: number
  validating: number
  completed: number
  failed: number
  cancelled: number
  paused: number
}

type MissionView = 'list' | 'detail' | 'create'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  planning: 'bg-yellow-500/20 text-yellow-400',
  executing: 'bg-blue-500/20 text-blue-400',
  validating: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
  paused: 'bg-orange-500/20 text-orange-400',
  waiting_approval: 'bg-yellow-500/20 text-yellow-400',
}

const milestoneStatusColors: Record<string, string> = {
  planning: 'bg-yellow-500/20 text-yellow-400',
  executing: 'bg-blue-500/20 text-blue-400',
  validating: 'bg-purple-500/20 text-purple-400',
  completed: 'bg-green-500/20 text-green-400',
  failed: 'bg-red-500/20 text-red-400',
}

const featureStatusIcons: Record<string, string> = {
  pending: '⬜',
  running: '🔄',
  completed: '✅',
  failed: '❌',
  skipped: '⏭️',
}

const severityColors: Record<string, string> = {
  blocker: 'bg-red-500/20 text-red-400',
  critical: 'bg-orange-500/20 text-orange-400',
  major: 'bg-yellow-500/20 text-yellow-400',
  minor: 'bg-blue-500/20 text-blue-400',
  info: 'bg-gray-500/20 text-gray-400',
}

const autonomyLabels: Record<string, string> = {
  supervised: 'Supervised',
  restricted_autonomous: 'Restricted',
  full_autonomous: 'Full',
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

function missionDuration(mission: Mission): string {
  if (!mission.created_at) return '-'
  const start = new Date(mission.created_at).getTime()
  const end = mission.completed_at
    ? new Date(mission.completed_at).getTime()
    : mission.started_at
      ? new Date(mission.started_at).getTime()
      : Date.now()
  const seconds = Math.round((end - start) / 1000)
  if (seconds <= 0) return '-'
  return formatDuration(seconds)
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '-'
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return date.toLocaleDateString()
}

function getMilestoneProgress(milestone: MissionMilestone): number {
  const features = milestone.features
  if (features.length === 0) return milestone.status === 'completed' ? 100 : 0
  const completed = features.filter(f => f.status === 'completed').length
  return Math.round((completed / features.length) * 100)
}

// ─── Component ───────────────────────────────────────────────────────────────

function Missions() {
  const [view, setView] = useState<MissionView>('list')
  const [missions, setMissions] = useState<Mission[]>([])
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null)
  const [stats, setStats] = useState<MissionStats>({
    total_missions: 0, planning: 0, executing: 0, validating: 0,
    completed: 0, failed: 0, cancelled: 0, paused: 0,
  })
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [logs, setLogs] = useState<string[]>([])
  const [polling, setPolling] = useState(false)

  // Create mission form state
  const [newDesc, setNewDesc] = useState('')
  const [newRepo, setNewRepo] = useState('')
  const [newAutonomy, setNewAutonomy] = useState('restricted_autonomous')
  const [newOrchestrator, setNewOrchestrator] = useState('')
  const [newWorker, setNewWorker] = useState('')
  const [newValidator, setNewValidator] = useState('')
  const [newParallel, setNewParallel] = useState(false)
  const [newTags, setNewTags] = useState('')

  // Fetch missions
  const fetchMissions = useCallback(async () => {
    try {
      const params = filter ? `?status=${filter}` : ''
      const resp = await fetch(`${GREENIE_URL}/api/missions${params}`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setMissions(data.missions || [])
      }
    } catch { /* Greenie unavailable */ }
  }, [filter])

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/missions/stats`, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) {
        const data = await resp.json()
        setStats(data)
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  // Fetch mission detail
  const fetchMissionDetail = useCallback(async (id: string) => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/missions/${id}`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setSelectedMission(data)
        setView('detail')
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  useEffect(() => {
    fetchMissions()
    fetchStats()
  }, [fetchMissions, fetchStats])

  // Poll for updates when viewing a mission
  useEffect(() => {
    if (view !== 'detail' || !selectedMission) return
    if (['completed', 'failed', 'cancelled'].includes(selectedMission.status)) return

    setPolling(true)
    const interval = setInterval(() => {
      fetchMissionDetail(selectedMission.id)
    }, 3000)
    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [view, selectedMission?.id, selectedMission?.status, fetchMissionDetail])

  // ─── Actions ──────────────────────────────────────────────────────────────

  const createMission = async () => {
    if (!newDesc.trim() || !newRepo.trim()) return
    setLoading(true)
    try {
      const body: Record<string, any> = {
        description: newDesc.trim(),
        target_repository: newRepo.trim(),
        autonomy_level: newAutonomy,
        parallel_workers: newParallel,
        created_by: 'ui',
      }
      if (newOrchestrator.trim()) body.orchestrator_model = newOrchestrator.trim()
      if (newWorker.trim()) body.worker_model = newWorker.trim()
      if (newValidator.trim()) body.validator_model = newValidator.trim()
      if (newTags.trim()) body.tags = newTags.split(',').map(t => t.trim()).filter(Boolean)

      const resp = await fetch(`${GREENIE_URL}/api/missions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (resp.ok) {
        setNewDesc('')
        setNewRepo('')
        setNewAutonomy('restricted_autonomous')
        setNewOrchestrator('')
        setNewWorker('')
        setNewValidator('')
        setNewParallel(false)
        setNewTags('')
        setView('list')
        fetchMissions()
        fetchStats()
      }
    } catch (e) {
      console.error('Failed to create mission', e)
    } finally {
      setLoading(false)
    }
  }

  const cancelMission = async (id: string) => {
    if (!confirm('Cancel this mission?')) return
    try {
      await fetch(`${GREENIE_URL}/api/missions/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled from dashboard' }),
      })
      fetchMissions()
      fetchStats()
      if (selectedMission?.id === id) {
        fetchMissionDetail(id)
      }
    } catch (e) {
      console.error('Failed to cancel mission', e)
    }
  }

  const resumeMission = async (id: string) => {
    try {
      await fetch(`${GREENIE_URL}/api/missions/${id}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      fetchMissions()
      fetchStats()
      if (selectedMission?.id === id) {
        fetchMissionDetail(id)
      }
    } catch (e) {
      console.error('Failed to resume mission', e)
    }
  }

  const pauseMission = async (id: string) => {
    try {
      await fetch(`${GREENIE_URL}/api/missions/${id}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      fetchMissions()
      fetchStats()
      if (selectedMission?.id === id) {
        fetchMissionDetail(id)
      }
    } catch (e) {
      console.error('Failed to pause mission', e)
    }
  }

  const startExecution = async (id: string) => {
    try {
      await fetch(`${GREENIE_URL}/api/missions/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      fetchMissions()
      fetchStats()
      if (selectedMission?.id === id) {
        fetchMissionDetail(id)
      }
    } catch (e) {
      console.error('Failed to start execution', e)
    }
  }

  const startPlanning = async (id: string) => {
    setLoading(true)
    try {
      const resp = await fetch(`${GREENIE_URL}/api/missions/${id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (resp.ok) {
        const data = await resp.json()
        if (selectedMission?.id === id) setSelectedMission(data)
        fetchMissions()
        fetchStats()
      }
    } catch (e) {
      console.error('Failed to start planning', e)
    } finally {
      setLoading(false)
    }
  }

  const completeMilestone = async (missionId: string, milestoneId: string) => {
    try {
      await fetch(`${GREENIE_URL}/api/missions/${missionId}/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (selectedMission?.id === missionId) fetchMissionDetail(missionId)
      fetchMissions()
      fetchStats()
    } catch (e) {
      console.error('Failed to complete milestone', e)
    }
  }

  const failMilestone = async (missionId: string, milestoneId: string) => {
    const error = prompt('Reason for failure:')
    if (!error) return
    try {
      await fetch(`${GREENIE_URL}/api/missions/${missionId}/milestones/${milestoneId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error }),
      })
      if (selectedMission?.id === missionId) fetchMissionDetail(missionId)
      fetchMissions()
      fetchStats()
    } catch (e) {
      console.error('Failed to fail milestone', e)
    }
  }

  const completeValidation = async (id: string, passed: boolean) => {
    try {
      await fetch(`${GREENIE_URL}/api/missions/${id}/validation/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passed }),
      })
      fetchMissions()
      fetchStats()
      if (selectedMission?.id === id) fetchMissionDetail(id)
    } catch (e) {
      console.error('Failed to complete validation', e)
    }
  }

  const addValidationResult = async (missionId: string) => {
    const explanation = prompt('Finding explanation:')
    if (!explanation) return
    const severity = prompt('Severity (blocker, critical, major, minor, info):', 'major') || 'major'
    const file = prompt('File path (optional):') || undefined
    const line = prompt('Line number (optional):')
    const lineNumber = line ? parseInt(line, 10) : undefined
    const correction = prompt('Suggested correction (optional):') || ''

    try {
      await fetch(`${GREENIE_URL}/api/missions/${missionId}/validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ severity, explanation, file_path: file, line_number: lineNumber, suggested_correction: correction }),
      })
      if (selectedMission?.id === missionId) fetchMissionDetail(missionId)
    } catch (e) {
      console.error('Failed to add validation result', e)
    }
  }

  const fetchLogs = async (id: string) => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/missions/${id}/logs`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setLogs(Array.isArray(data) ? data : [])
      }
    } catch { /* Logs endpoint may not be available */ }
  }

  // ─── Render: Stats Cards ──────────────────────────────────────────────────

  const renderStatsCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
      {[
        { label: 'Total', value: stats.total_missions, color: 'text-white' },
        { label: 'Planning', value: stats.planning, color: 'text-yellow-400' },
        { label: 'Executing', value: stats.executing, color: 'text-blue-400' },
        { label: 'Validating', value: stats.validating, color: 'text-purple-400' },
        { label: 'Completed', value: stats.completed, color: 'text-green-400' },
        { label: 'Failed', value: stats.failed, color: 'text-red-400' },
        { label: 'Cancelled', value: stats.cancelled, color: 'text-gray-400' },
        { label: 'Paused', value: stats.paused, color: 'text-orange-400' },
      ].map(s => (
        <div key={s.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
          <p className="text-xs text-gray-400">{s.label}</p>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  )

  // ─── Render: Mission List ─────────────────────────────────────────────────

  const renderMissionList = () => (
    <>
      {renderStatsCards()}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
        <h2 className="text-xl font-semibold">Missions</h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
          >
            <option value="">All statuses</option>
            <option value="planning">Planning</option>
            <option value="executing">Executing</option>
            <option value="validating">Validating</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="paused">Paused</option>
          </select>
          <button onClick={fetchMissions} className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
            Refresh
          </button>
          <button onClick={() => setView('create')} className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
            + New Mission
          </button>
        </div>
      </div>

      {missions.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
          <p className="text-gray-400 text-lg mb-2">No missions yet</p>
          <p className="text-gray-500 text-sm mb-4">Create a mission to start an autonomous development task.</p>
          <button onClick={() => setView('create')} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            Create your first mission
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {missions.map(mission => {
            const milestoneCount = mission.milestones?.length || 0
            const completedMilestones = mission.milestones?.filter(m => m.status === 'completed').length || 0
            const overallProgress = milestoneCount > 0
              ? Math.round((completedMilestones / milestoneCount) * 100)
              : 0

            return (
              <div key={mission.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[mission.status] || 'bg-gray-500/20 text-gray-400'}`}>
                        {mission.status}
                      </span>
                      {mission.autonomy_level && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-700 text-gray-300">
                          {autonomyLabels[mission.autonomy_level] || mission.autonomy_level}
                        </span>
                      )}
                      {mission.parallel_workers && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-400">
                          parallel
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg truncate">{mission.description}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {mission.target_repository}
                    </p>
                    {milestoneCount > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>{completedMilestones}/{milestoneCount} milestones</span>
                          <span>{overallProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${overallProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 mt-2 text-xs text-gray-500">
                      <span>Created {timeAgo(mission.created_at)}</span>
                      {mission.started_at && <span>Started {timeAgo(mission.started_at)}</span>}
                      {mission.completed_at && <span>Completed {timeAgo(mission.completed_at)}</span>}
                      {mission.tags?.length > 0 && (
                        <span className="flex gap-1">
                          {mission.tags.map(tag => (
                            <span key={tag} className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">#{tag}</span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => fetchMissionDetail(mission.id)}
                      className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                    >
                      Details
                    </button>
                    {mission.status === 'planning' && (
                      <button
                        onClick={() => startPlanning(mission.id)}
                        className="px-3 py-1 text-xs bg-yellow-600 rounded hover:bg-yellow-700"
                      >
                        Plan
                      </button>
                    )}
                    {mission.status === 'planning' && mission.milestones?.length > 0 && (
                      <button
                        onClick={() => startExecution(mission.id)}
                        className="px-3 py-1 text-xs bg-green-600 rounded hover:bg-green-700"
                      >
                        Start
                      </button>
                    )}
                    {(mission.status === 'executing' || mission.status === 'validating') && (
                      <button
                        onClick={() => pauseMission(mission.id)}
                        className="px-3 py-1 text-xs bg-orange-600 rounded hover:bg-orange-700"
                      >
                        Pause
                      </button>
                    )}
                    {(mission.status === 'executing' || mission.status === 'validating' || mission.status === 'planning') && (
                      <button
                        onClick={() => cancelMission(mission.id)}
                        className="px-3 py-1 text-xs bg-red-600 rounded hover:bg-red-700"
                      >
                        Cancel
                      </button>
                    )}
                    {(mission.status === 'cancelled' || mission.status === 'paused') && (
                      <button
                        onClick={() => resumeMission(mission.id)}
                        className="px-3 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )

  // ─── Render: Create Mission Form ──────────────────────────────────────────

  const renderCreateForm = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Create Mission</h2>
        <button onClick={() => setView('list')} className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
          Back to list
        </button>
      </div>

      <div className="max-w-2xl space-y-6">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
          <h3 className="font-semibold">Mission Details</h3>

          <div>
            <label htmlFor="mission-desc" className="block text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              id="mission-desc"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              rows={3}
              placeholder="Add user authentication to the dashboard API..."
            />
          </div>

          <div>
            <label htmlFor="mission-repo" className="block text-sm text-gray-400 mb-1">Target Repository *</label>
            <input
              id="mission-repo"
              value={newRepo}
              onChange={e => setNewRepo(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="/path/to/repo or git@github.com:user/repo.git"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Autonomy Level</label>
            <select
              value={newAutonomy}
              onChange={e => setNewAutonomy(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            >
              <option value="supervised">Supervised — All operations require approval</option>
              <option value="restricted_autonomous">Restricted — Only sensitive operations require approval</option>
              <option value="full_autonomous">Full — No approval gates</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="parallel"
              checked={newParallel}
              onChange={e => setNewParallel(e.target.checked)}
              className="rounded bg-gray-900 border-gray-600"
            />
            <label htmlFor="parallel" className="text-sm text-gray-300">
              Parallel workers (execute independent tasks concurrently)
            </label>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
          <h3 className="font-semibold">Model Selection (optional)</h3>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Orchestrator Model</label>
            <input
              value={newOrchestrator}
              onChange={e => setNewOrchestrator(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="gpt-4o (for planning and judgment)"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Worker Model</label>
            <input
              value={newWorker}
              onChange={e => setNewWorker(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="gpt-4o-mini (for implementation)"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Validator Model</label>
            <input
              value={newValidator}
              onChange={e => setNewValidator(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              placeholder="claude-3-sonnet (for review)"
            />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
          <h3 className="font-semibold">Tags (optional)</h3>
          <input
            value={newTags}
            onChange={e => setNewTags(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
            placeholder="feature, auth, frontend (comma-separated)"
          />
        </div>

        <button
          onClick={createMission}
          disabled={loading || !newDesc.trim() || !newRepo.trim()}
          className="w-full px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-semibold"
        >
          {loading ? 'Creating...' : 'Create Mission'}
        </button>
      </div>
    </div>
  )

  // ─── Render: Mission Detail ───────────────────────────────────────────────

  const renderDetail = () => {
    if (!selectedMission) return null
    const m = selectedMission

    return (
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-6 gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => { setView('list'); setSelectedMission(null) }}
                className="text-sm text-gray-400 hover:text-white">
                ← Back
              </button>
              <span className="text-xs text-gray-500">ID: {m.id?.slice(0, 16)}</span>
              {polling && <span className="text-xs text-blue-400 animate-pulse">● Live</span>}
            </div>
            <h2 className="text-2xl font-bold">{m.description}</h2>
            <p className="text-gray-400 mt-1">{m.target_repository}</p>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className={`px-3 py-1 text-sm rounded-full text-center ${statusColors[m.status] || 'bg-gray-500/20 text-gray-400'}`}>
              {m.status}
            </span>
            {(m.status === 'executing' || m.status === 'validating') && (
              <button onClick={() => pauseMission(m.id)}
                className="px-3 py-1 text-xs bg-orange-600 rounded hover:bg-orange-700">
                Pause
              </button>
            )}
            {(m.status === 'executing' || m.status === 'validating' || m.status === 'planning') && (
              <button onClick={() => cancelMission(m.id)}
                className="px-3 py-1 text-xs bg-red-600 rounded hover:bg-red-700">
                Cancel
              </button>
            )}
            {(m.status === 'cancelled' || m.status === 'paused') && (
              <button onClick={() => resumeMission(m.id)}
                className="px-3 py-1 text-xs bg-blue-600 rounded hover:bg-blue-700">
                Resume
              </button>
            )}
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400">Autonomy</p>
            <p className="font-semibold">{autonomyLabels[m.autonomy_level] || m.autonomy_level}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400">Workers</p>
            <p className="font-semibold">{m.parallel_workers ? 'Parallel' : 'Sequential'}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400">Created</p>
            <p className="font-semibold">{timeAgo(m.created_at)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400">Duration</p>
            <p className="font-semibold">{missionDuration(m)}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-400">Models</p>
            <p className="text-xs text-gray-300 mt-1">
              {m.orchestrator_model ? `O: ${m.orchestrator_model}` : 'O: default'}
              {' / '}
              {m.worker_model ? `W: ${m.worker_model}` : 'W: default'}
              {' / '}
              {m.validator_model ? `V: ${m.validator_model}` : 'V: default'}
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-lg">Milestones ({m.milestones?.length || 0})</h3>
            {m.status === 'planning' && m.milestones?.length === 0 && (
              <button onClick={() => startPlanning(m.id)} disabled={loading}
                className="px-3 py-1 text-sm bg-yellow-600 rounded hover:bg-yellow-700 disabled:opacity-50">
                {loading ? 'Planning...' : 'Start Planning'}
              </button>
            )}
            {m.status === 'planning' && m.milestones?.length > 0 && (
              <button onClick={() => startExecution(m.id)}
                className="px-3 py-1 text-sm bg-green-600 rounded hover:bg-green-700">
                Start Execution
              </button>
            )}
          </div>

          {(!m.milestones || m.milestones.length === 0) ? (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
              <p className="text-gray-400">No milestones yet. Start planning to generate milestones.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {m.milestones.map((ms, idx) => {
                const progress = getMilestoneProgress(ms)
                return (
                  <div key={ms.id} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                    {/* Milestone header */}
                    <div className="p-4 border-b border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">
                            {idx + 1}. {ms.name}
                          </h4>
                          {ms.description && (
                            <p className="text-sm text-gray-400 mt-1">{ms.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${milestoneStatusColors[ms.status] || 'bg-gray-500/20 text-gray-400'}`}>
                            {ms.status}
                          </span>
                          {ms.status === 'executing' && (
                            <>
                              <button onClick={() => completeMilestone(m.id, ms.id)}
                                className="px-2 py-0.5 text-xs bg-green-600 rounded hover:bg-green-700">
                                Complete
                              </button>
                              <button onClick={() => failMilestone(m.id, ms.id)}
                                className="px-2 py-0.5 text-xs bg-red-600 rounded hover:bg-red-700">
                                Fail
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{ms.features?.length || 0} features</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            ms.status === 'completed' ? 'bg-green-500' :
                            ms.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Features */}
                    {ms.features && ms.features.length > 0 && (
                      <div className="p-4 space-y-2">
                        {ms.features.map(feature => (
                          <div key={feature.id} className="flex items-start gap-2 text-sm">
                            <span className="shrink-0 mt-0.5">{featureStatusIcons[feature.status] || '⬜'}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{feature.name}</span>
                              {feature.description && (
                                <p className="text-xs text-gray-400 mt-0.5">{feature.description}</p>
                              )}
                              {feature.role === 'validator' && (
                                <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                                  validator
                                </span>
                              )}
                              {feature.error && (
                                <p className="text-xs text-red-400 mt-1">Error: {feature.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Success criteria */}
                    {ms.success_criteria && ms.success_criteria.length > 0 && (
                      <div className="px-4 pb-4">
                        <p className="text-xs text-gray-500 mb-1">Success criteria:</p>
                        <ul className="text-xs text-gray-400 list-disc list-inside space-y-0.5">
                          {ms.success_criteria.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Validation Contract */}
        {m.validation_contract && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold text-lg mb-2">Validation Contract</h3>
            <p className="text-sm text-gray-300">{m.validation_contract.description}</p>
            {m.validation_contract.test_commands?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Test commands:</p>
                <code className="block mt-1 bg-gray-900 rounded p-2 text-xs text-green-400">
                  {m.validation_contract.test_commands.join('\n')}
                </code>
              </div>
            )}
            {m.validation_contract.check_paths?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Check paths:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.validation_contract.check_paths.map((p: string, i: number) => (
                    <span key={i} className="bg-gray-900 px-2 py-0.5 rounded text-xs text-blue-300">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Validation Results */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-lg">
              Validation Results
              {m.validation_results && m.validation_results.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-400">
                  ({m.validation_results.length})
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button onClick={() => addValidationResult(m.id)}
                className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
                + Add Finding
              </button>
              {m.status === 'validating' && (
                <>
                  <button onClick={() => completeValidation(m.id, true)}
                    className="px-3 py-1 text-sm bg-green-600 rounded hover:bg-green-700">
                    Pass
                  </button>
                  <button onClick={() => completeValidation(m.id, false)}
                    className="px-3 py-1 text-sm bg-red-600 rounded hover:bg-red-700">
                    Fail
                  </button>
                </>
              )}
            </div>
          </div>

          {(!m.validation_results || m.validation_results.length === 0) ? (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center">
              <p className="text-gray-400">No validation results yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {m.validation_results.map((vr: ValidationResult) => (
                <div key={vr.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-start gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full shrink-0 ${severityColors[vr.severity] || 'bg-gray-500/20 text-gray-400'}`}>
                      {vr.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{vr.explanation}</p>
                      {vr.file_path && (
                        <p className="text-xs text-gray-400 mt-1">
                          📄 {vr.file_path}
                          {vr.line_number != null && `:${vr.line_number}`}
                        </p>
                      )}
                      {vr.suggested_correction && (
                        <p className="text-xs text-green-400 mt-1">
                          Fix: {vr.suggested_correction}
                        </p>
                      )}
                      {vr.verified && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {m.error && (
          <div className="mb-6 bg-red-500/10 rounded-lg p-4 border border-red-500/30">
            <h3 className="font-semibold text-red-400 mb-1">Error</h3>
            <p className="text-sm text-red-300">{m.error}</p>
          </div>
        )}

        {/* Artifacts */}
        {m.artifacts && m.artifacts.length > 0 && (
          <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="font-semibold text-lg mb-2">Artifacts</h3>
            <div className="space-y-1">
              {m.artifacts.map((a: any, i: number) => (
                <div key={i} className="text-sm text-gray-300">
                  {typeof a === 'string' ? a : JSON.stringify(a)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-lg">Execution Logs</h3>
            <button onClick={() => fetchLogs(m.id)}
              className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
              Refresh Logs
            </button>
          </div>
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 font-mono text-xs max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs available yet.</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-gray-300 whitespace-pre-wrap">{log}</div>
              ))
            )}
          </div>
        </div>

        {/* Tags */}
        {m.tags && m.tags.length > 0 && (
          <div className="flex gap-2">
            {m.tags.map((tag: string) => (
              <span key={tag} className="bg-gray-700 px-2 py-1 rounded text-sm text-gray-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Main Render ──────────────────────────────────────────────────────────

  return (
    <div>
      {view === 'list' && renderMissionList()}
      {view === 'create' && renderCreateForm()}
      {view === 'detail' && renderDetail()}
    </div>
  )
}

export default Missions
