import { useState, useEffect, useCallback } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

type StepType = 'agent' | 'service' | 'approval' | 'condition' | 'notify'
type TriggerType = 'schedule' | 'webhook' | 'file_change'

interface WorkflowStep {
  id: string
  name: string
  step_type: StepType
  agent?: string
  service?: string
  task?: string
  approval_description?: string
  notify_channel?: string
  notify_message?: string
  order: number
}

interface WorkflowTrigger {
  id: string
  trigger_type: TriggerType
  cron?: string
  webhook_secret?: string
  watch_paths?: string[]
  enabled: boolean
}

interface WorkflowDefinition {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  triggers: WorkflowTrigger[]
  enabled: boolean
  created_at: string
  updated_at: string
}

interface WorkflowRun {
  id: string
  workflow_id: string
  workflow_name: string
  status: string
  trigger_type: string
  started_at: string
  completed_at?: string
  duration_seconds: number
  step_runs: Array<{
    step_name: string
    status: string
    output?: string
    error?: string
  }>
}

const stepTypeLabels: Record<StepType, string> = {
  agent: '🤖 Agent',
  service: '⚡ Service',
  approval: '✅ Approval',
  condition: '🔀 Condition',
  notify: '📢 Notify',
}

const triggerTypeLabels: Record<TriggerType, string> = {
  schedule: '📅 Schedule',
  webhook: '🔗 Webhook',
  file_change: '📁 File Watch',
}

const services = ['trapper', 'slinker', 'poltergeist', 'shrewd']

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

function WorkflowBuilder() {
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDefinition | null>(null)
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowDefinition | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ total_workflows: number; total_runs: number; active_runs: number; pending_approvals: number }>({
    total_workflows: 0,
    total_runs: 0,
    active_runs: 0,
    pending_approvals: 0,
  })

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([])

  const fetchWorkflows = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows?limit=50`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setWorkflows(data.workflows || [])
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  const fetchRuns = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows/runs?limit=20`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setRuns(data.runs || [])
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows/stats`, { signal: AbortSignal.timeout(3000) })
      if (resp.ok) {
        const data = await resp.json()
        setStats(data)
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  useEffect(() => {
    fetchWorkflows()
    fetchRuns()
    fetchStats()
  }, [fetchWorkflows, fetchRuns, fetchStats])

  const resetForm = () => {
    setName('')
    setDescription('')
    setSteps([])
    setTriggers([])
    setEditingWorkflow(null)
    setShowForm(false)
  }

  const startCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const startEdit = (wf: WorkflowDefinition) => {
    setName(wf.name)
    setDescription(wf.description)
    setSteps(wf.steps || [])
    setTriggers(wf.triggers || [])
    setEditingWorkflow(wf)
    setShowForm(true)
  }

  const addStep = (type: StepType) => {
    const newStep: WorkflowStep = {
      id: `step-${generateId()}`,
      name: `${type}-${steps.length + 1}`,
      step_type: type,
      order: steps.length,
    }
    setSteps([...steps, newStep])
  }

  const updateStep = (index: number, field: string, value: string) => {
    const updated = [...steps]
    updated[index] = { ...updated[index], [field]: value }
    setSteps(updated)
  }

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index))
  }

  const addTrigger = (type: TriggerType) => {
    const newTrigger: WorkflowTrigger = {
      id: `trig-${generateId()}`,
      trigger_type: type,
      enabled: true,
    }
    setTriggers([...triggers, newTrigger])
  }

  const updateTrigger = (index: number, field: string, value: string | boolean | string[]) => {
    const updated = [...triggers]
    updated[index] = { ...updated[index], [field]: value }
    setTriggers(updated)
  }

  const removeTrigger = (index: number) => {
    setTriggers(triggers.filter((_, i) => i !== index))
  }

  const saveWorkflow = async () => {
    if (!name.trim()) return
    setLoading(true)

    const body = {
      name,
      description,
      steps,
      triggers,
      enabled: true,
    }

    try {
      if (editingWorkflow) {
        const resp = await fetch(`${GREENIE_URL}/api/workflows/${editingWorkflow.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!resp.ok) throw new Error('Failed to update')
      } else {
        const resp = await fetch(`${GREENIE_URL}/api/workflows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!resp.ok) throw new Error('Failed to create')
      }
      resetForm()
      fetchWorkflows()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows/${id}`, { method: 'DELETE' })
      if (resp.ok) fetchWorkflows()
    } catch (e) {
      console.error(e)
    }
  }

  const runWorkflow = async (id: string) => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows/${id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (resp.ok) {
        fetchRuns()
        fetchStats()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const toggleEnabled = async (wf: WorkflowDefinition) => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/workflows/${wf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !wf.enabled }),
      })
      if (resp.ok) fetchWorkflows()
    } catch (e) {
      console.error(e)
    }
  }

  const runStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400'
      case 'running': return 'bg-blue-500/20 text-blue-400'
      case 'waiting_approval': return 'bg-yellow-500/20 text-yellow-400'
      case 'failed': return 'bg-red-500/20 text-red-400'
      case 'cancelled': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const stepStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'running': return 'text-blue-400'
      case 'waiting_approval': return 'text-yellow-400'
      case 'failed': return 'text-red-400'
      case 'skipped': return 'text-gray-500'
      default: return 'text-gray-400'
    }
  }

  // ─── Form View ───
  if (showForm) {
    return (
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">
            {editingWorkflow ? 'Edit Workflow' : 'Create Workflow'}
          </h2>
          <div className="flex gap-2">
            <button onClick={resetForm} className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
              Cancel
            </button>
            <button onClick={saveWorkflow} disabled={loading || !name.trim()}
              className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <h3 className="font-semibold">Basic Info</h3>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Daily research digest" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
                rows={2} placeholder="What this workflow does..." />
            </div>
          </div>

          {/* Steps */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Steps ({steps.length})</h3>
              <div className="flex gap-1">
                {(['agent', 'service', 'approval', 'condition', 'notify'] as StepType[]).map(type => (
                  <button key={type} onClick={() => addStep(type)}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
                    + {stepTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {steps.length === 0 && <p className="text-sm text-gray-500">Add steps to build your workflow.</p>}

            {steps.map((step, i) => (
              <div key={step.id} className="bg-gray-900 rounded p-3 border border-gray-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{stepTypeLabels[step.step_type]} — Step {i + 1}</span>
                  <button onClick={() => removeStep(i)} className="text-red-400 text-sm hover:text-red-300">✕</button>
                </div>
                <input value={step.name} onChange={e => updateStep(i, 'name', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                  placeholder="Step name" />

                {step.step_type === 'agent' && (
                  <>
                    <input value={step.agent || ''} onChange={e => updateStep(i, 'agent', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      placeholder="Agent name" />
                    <textarea value={step.task || ''} onChange={e => updateStep(i, 'task', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      rows={2} placeholder="Task description" />
                  </>
                )}

                {step.step_type === 'service' && (
                  <>
                    <select value={step.service || ''} onChange={e => updateStep(i, 'service', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white">
                      <option value="">Select service...</option>
                      {services.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <textarea value={step.task || ''} onChange={e => updateStep(i, 'task', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      rows={2} placeholder="Task (e.g., SEARCH: latest news)" />
                  </>
                )}

                {step.step_type === 'approval' && (
                  <textarea value={step.approval_description || ''}
                    onChange={e => updateStep(i, 'approval_description', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    rows={2} placeholder="What needs approval?" />
                )}

                {step.step_type === 'notify' && (
                  <>
                    <input value={step.notify_channel || ''} onChange={e => updateStep(i, 'notify_channel', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      placeholder="Channel (slack, discord, email)" />
                    <textarea value={step.notify_message || ''} onChange={e => updateStep(i, 'notify_message', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                      rows={2} placeholder="Message (use {step_0} for context)" />
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Triggers */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Triggers ({triggers.length})</h3>
              <div className="flex gap-1">
                {(['schedule', 'webhook', 'file_change'] as TriggerType[]).map(type => (
                  <button key={type} onClick={() => addTrigger(type)}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
                    + {triggerTypeLabels[type]}
                  </button>
                ))}
              </div>
            </div>

            {triggers.length === 0 && <p className="text-sm text-gray-500">Add triggers to automate workflow execution.</p>}

            {triggers.map((trigger, i) => (
              <div key={trigger.id} className="bg-gray-900 rounded p-3 border border-gray-700 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{triggerTypeLabels[trigger.trigger_type]}</span>
                  <button onClick={() => removeTrigger(i)} className="text-red-400 text-sm hover:text-red-300">✕</button>
                </div>

                {trigger.trigger_type === 'schedule' && (
                  <input value={trigger.cron || ''} onChange={e => updateTrigger(i, 'cron', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    placeholder="Cron expression (e.g., 0 9 * * *)" />
                )}

                {trigger.trigger_type === 'webhook' && (
                  <input value={trigger.webhook_secret || ''} onChange={e => updateTrigger(i, 'webhook_secret', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    placeholder="Secret (optional)" />
                )}

                {trigger.trigger_type === 'file_change' && (
                  <input value={(trigger.watch_paths || []).join(', ')}
                    onChange={e => updateTrigger(i, 'watch_paths', e.target.value.split(',').map(s => s.trim()))}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                    placeholder="Paths to watch (comma-separated)" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main View ───
  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Workflows', value: stats.total_workflows },
          { label: 'Total Runs', value: stats.total_runs },
          { label: 'Active Runs', value: stats.active_runs },
          { label: 'Pending Approvals', value: stats.pending_approvals },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Workflow List */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Workflows</h2>
        <div className="flex gap-2">
          <button onClick={fetchWorkflows} className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
            Refresh
          </button>
          <button onClick={startCreate} className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
            + New Workflow
          </button>
        </div>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
          <p className="text-gray-400 mb-4">No workflows yet. Create your first workflow to automate multi-step tasks.</p>
          <button onClick={startCreate} className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
            Create Workflow
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {workflows.map(wf => (
            <div key={wf.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{wf.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      wf.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {wf.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {wf.description && <p className="text-sm text-gray-400 mt-1">{wf.description}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    <span>{wf.steps?.length || 0} steps</span>
                    <span>{wf.triggers?.length || 0} triggers</span>
                    <span>Created: {new Date(wf.created_at).toLocaleDateString()}</span>
                  </div>
                  {wf.steps && wf.steps.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {wf.steps.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-gray-700 rounded">
                          {stepTypeLabels[s.step_type as StepType] || s.step_type}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 ml-4">
                  <button onClick={() => runWorkflow(wf.id)}
                    className="px-2 py-1 text-xs bg-green-600 rounded hover:bg-green-700">
                    ▶ Run
                  </button>
                  <button onClick={() => toggleEnabled(wf)}
                    className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">
                    {wf.enabled ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => startEdit(wf)}
                    className="px-2 py-1 text-xs bg-blue-700 rounded hover:bg-blue-600">
                    ✎ Edit
                  </button>
                  <button onClick={() => deleteWorkflow(wf.id)}
                    className="px-2 py-1 text-xs bg-red-700 rounded hover:bg-red-600">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Runs */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Recent Runs</h2>
        <button onClick={fetchRuns} className="px-3 py-1 text-sm bg-gray-700 rounded hover:bg-gray-600">
          Refresh
        </button>
      </div>

      {runs.length === 0 ? (
        <p className="text-gray-500">No runs yet.</p>
      ) : (
        <div className="space-y-3">
          {runs.map(run => (
            <div key={run.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{run.workflow_name}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    ID: {run.id.slice(0, 12)} • Trigger: {run.trigger_type}
                  </p>
                  {run.step_runs && run.step_runs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {run.step_runs.map((sr, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className={stepStatusColor(sr.status)}>
                            {sr.status === 'completed' ? '✓' : sr.status === 'failed' ? '✗' : sr.status === 'skipped' ? '—' : '⟳'}
                          </span>
                          <span className="text-gray-300">{sr.step_name}</span>
                          <span className="text-gray-500 text-xs">({sr.status})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${runStatusColor(run.status)}`}>
                    {run.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : '-'}
                  </p>
                  {run.duration_seconds > 0 && (
                    <p className="text-xs text-gray-500">{run.duration_seconds.toFixed(1)}s</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default WorkflowBuilder
