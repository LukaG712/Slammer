import { useState, useEffect, useRef, useCallback } from 'react'

const GREENIE_URL = (() => {
  const envUrl = import.meta.env.VITE_GREENIE_URL
  if (envUrl) return envUrl
  const baseUrl = import.meta.env.VITE_BASE_URL || ''
  return baseUrl ? `${baseUrl}/greenie` : 'http://localhost:8080'
})()

function Terminal({ workstationId, onClose }: { workstationId: string; onClose: () => void }) {
  const [connected, setConnected] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [inputValue, setInputValue] = useState('')
  const wsRef = useRef<WebSocket | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/api/workstations/${workstationId}/terminal`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setOutput(prev => [...prev, '\x1b[32m✓ Connected to terminal\x1b[0m'])
    }

    ws.onmessage = (event) => {
      setOutput(prev => [...prev, String(event.data)])
    }

    ws.onclose = () => {
      setConnected(false)
      setOutput(prev => [...prev, '\x1b[31m✗ Connection closed\x1b[0m'])
    }

    ws.onerror = () => {
      setOutput(prev => [...prev, '\x1b[31m✗ Connection error — make sure the workstation is running\x1b[0m'])
    }

    return () => {
      ws.close()
    }
  }, [workstationId])

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  const handleCommand = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && wsRef.current?.readyState === WebSocket.OPEN) {
      const cmd = inputValue.trim()
      if (cmd) {
        setOutput(prev => [...prev, `$ ${cmd}`])
        wsRef.current.send(cmd + '\n')
        setInputValue('')
      }
    }
  }, [inputValue])

  const handleCopy = useCallback(() => {
    const text = output.join('\n')
    navigator.clipboard.writeText(text)
  }, [output])

  const handleClear = useCallback(() => {
    setOutput([])
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-2 px-2 py-1 bg-gray-800 rounded-t-lg border border-gray-700">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm text-gray-300">
            Terminal — {workstationId.slice(0, 12)}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy}
            className="px-2 py-0.5 text-xs bg-gray-700 rounded hover:bg-gray-600">
            Copy
          </button>
          <button onClick={handleClear}
            className="px-2 py-0.5 text-xs bg-gray-700 rounded hover:bg-gray-600">
            Clear
          </button>
          <button onClick={onClose}
            className="px-2 py-0.5 text-xs bg-red-600 rounded hover:bg-red-700">
            Close
          </button>
        </div>
      </div>

      {/* Output */}
      <div
        ref={outputRef}
        className="flex-1 bg-gray-950 rounded-b-lg border border-gray-700 p-3 overflow-auto font-mono text-xs text-green-400"
        onClick={() => inputRef.current?.focus()}
      >
        {output.length === 0 ? (
          <p className="text-gray-500">Connecting to terminal...</p>
        ) : (
          output.map((line, i) => (
            <div key={i} dangerouslySetInnerHTML={{ __html: line.replace(/\n/g, '<br/>') }} />
          ))
        )}
      </div>

      {/* Input */}
      {connected && (
        <div className="flex gap-2 mt-2">
          <span className="text-green-400 font-mono text-sm py-2">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleCommand}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
            placeholder="Type a command..."
            autoFocus
          />
        </div>
      )}
    </div>
  )
}

export default Terminal
