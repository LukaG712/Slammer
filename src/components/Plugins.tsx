import { useState, useEffect, useCallback } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

type Plugin = {
  id: string
  name: string
  description: string
  version: string
  type: string
  enabled: boolean
  source: string
  installedAt: string
  config: Record<string, any>
}

type MCPTool = {
  name: string
  description: string
  inputSchema: any
}

type MCPServer = {
  name: string
  transport: string
  url: string
  tools: MCPTool[]
  connected: boolean
}

function Plugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newPlugin, setNewPlugin] = useState({ name: '', source: '', type: 'tool' })

  const fetchPlugins = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${GREENIE_URL}/api/plugins`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setPlugins(data.plugins || [])
      }
    } catch { /* Greenie unavailable */ }
    setLoading(false)
  }, [])

  const fetchMCPServers = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/mcp/servers`, { signal: AbortSignal.timeout(5000) })
      if (resp.ok) {
        const data = await resp.json()
        setMcpServers(data.servers || [])
      }
    } catch { /* Greenie unavailable */ }
  }, [])

  useEffect(() => {
    fetchPlugins()
    fetchMCPServers()
  }, [fetchPlugins, fetchMCPServers])

  const handleInstall = useCallback(async () => {
    try {
      const resp = await fetch(`${GREENIE_URL}/api/plugins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlugin),
        signal: AbortSignal.timeout(15000),
      })
      if (resp.ok) {
        setShowForm(false)
        setNewPlugin({ name: '', source: '', type: 'tool' })
        await fetchPlugins()
      }
    } catch { /* failed */ }
  }, [newPlugin, fetchPlugins])

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`${GREENIE_URL}/api/plugins/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
        signal: AbortSignal.timeout(5000),
      })
      await fetchPlugins()
    } catch { /* failed */ }
  }, [fetchPlugins])

  const handleUninstall = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return
    try {
      await fetch(`${GREENIE_URL}/api/plugins/${id}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      })
      await fetchPlugins()
    } catch { /* failed */ }
  }, [fetchPlugins])

  const handleAddMCPServer = useCallback(async () => {
    const name = prompt('Server name:')
    if (!name) return
    const url = prompt('Server URL (stdio, sse://, or http://):')
    if (!url) return
    try {
      await fetch(`${GREENIE_URL}/api/mcp/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url }),
        signal: AbortSignal.timeout(10000),
      })
      await fetchMCPServers()
    } catch { /* failed */ }
  }, [fetchMCPServers])

  const handleRemoveMCPServer = useCallback(async (name: string) => {
    if (!confirm(`Remove MCP server "${name}"?`)) return
    try {
      await fetch(`${GREENIE_URL}/api/mcp/servers/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000),
      })
      await fetchMCPServers()
    } catch { /* failed */ }
  }, [fetchMCPServers])

  const typeColor = (type: string) => {
    switch (type) {
      case 'tool': return 'bg-blue-500/20 text-blue-400'
      case 'resource': return 'bg-green-500/20 text-green-400'
      case 'prompt': return 'bg-purple-500/20 text-purple-400'
      case 'integration': return 'bg-yellow-500/20 text-yellow-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Plugins & MCP</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)}
            className="px-3 py-1 text-sm bg-blue-600 rounded hover:bg-blue-700">
            Install Plugin
          </button>
          <button onClick={handleAddMCPServer}
            className="px-3 py-1 text-sm bg-purple-600 rounded hover:bg-purple-700">
            Add MCP Server
          </button>
          <button onClick={() => { fetchPlugins(); fetchMCPServers() }}
            className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-700">
            Refresh
          </button>
        </div>
      </div>

      {/* Install Form */}
      {showForm && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
          <h3 className="font-semibold mb-3">Install Plugin</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Plugin name"
              value={newPlugin.name}
              onChange={(e) => setNewPlugin({ ...newPlugin, name: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
            <input
              type="text"
              placeholder="Source (URL, path, or registry name)"
              value={newPlugin.source}
              onChange={(e) => setNewPlugin({ ...newPlugin, source: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
            <select
              value={newPlugin.type}
              onChange={(e) => setNewPlugin({ ...newPlugin, type: e.target.value })}
              className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            >
              <option value="tool">Tool</option>
              <option value="resource">Resource</option>
              <option value="prompt">Prompt</option>
              <option value="integration">Integration</option>
            </select>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleInstall}
              className="px-3 py-1 text-sm bg-green-600 rounded hover:bg-green-700">
              Install
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 py-1 text-sm bg-gray-600 rounded hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plugins */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3">Installed Plugins</h3>
        {loading ? (
          <p className="text-gray-400">Loading plugins...</p>
        ) : plugins.length === 0 ? (
          <p className="text-gray-500">No plugins installed. Install a plugin to extend Evershade capabilities.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{plugin.name}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${typeColor(plugin.type)}`}>
                        {plugin.type}
                      </span>
                      <span className="text-xs text-gray-500">v{plugin.version}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{plugin.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Source: {plugin.source}
                      {plugin.installedAt && ` · Installed: ${new Date(plugin.installedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(plugin.id, !plugin.enabled)}
                      className={`px-2 py-1 text-xs rounded ${
                        plugin.enabled
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {plugin.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button onClick={() => handleUninstall(plugin.id)}
                      className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-700">
                      Uninstall
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MCP Servers */}
      <div>
        <h3 className="text-lg font-semibold mb-3">MCP Servers</h3>
        {mcpServers.length === 0 ? (
          <p className="text-gray-500">
            No MCP servers configured. Add an MCP server to connect external tools and resources.
          </p>
        ) : (
          <div className="space-y-3">
            {mcpServers.map((server) => (
              <div key={server.name} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{server.name}</h4>
                      <span className={`w-2 h-2 rounded-full ${
                        server.connected ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-gray-500">{server.transport}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{server.url}</p>
                    {server.tools.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Tools ({server.tools.length}):</p>
                        <div className="flex flex-wrap gap-1">
                          {server.tools.map((tool, i) => (
                            <span key={i} className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded">
                              {tool.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleRemoveMCPServer(server.name)}
                    className="px-2 py-1 text-xs bg-red-600 rounded hover:bg-red-700">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Plugins
