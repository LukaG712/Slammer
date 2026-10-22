import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Missions from '../Missions'

// Mock fetch globally
const mockFetch = vi.fn()
Object.assign(globalThis, { fetch: mockFetch })

// Helper to mock a JSON response
const mockJson = (data: any, ok = true) => {
  mockFetch.mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(data),
  })
}

describe('Missions component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('mission list view', () => {
    it('renders empty state when no missions', async () => {
      mockJson({ missions: [] }) // list missions
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // stats

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('No missions yet')).toBeTruthy()
      })
    })

    it('renders mission cards with status and description', async () => {
      const missions = [
        {
          id: 'mission-abc123',
          description: 'Add authentication',
          target_repository: '/path/to/repo',
          status: 'planning',
          autonomy_level: 'restricted_autonomous',
          parallel_workers: false,
          milestones: [],
          artifacts: [],
          created_at: '2024-01-01T00:00:00Z',
          tags: ['feature'],
        },
        {
          id: 'mission-def456',
          description: 'Fix login bug',
          target_repository: '/path/to/repo',
          status: 'executing',
          autonomy_level: 'supervised',
          parallel_workers: true,
          milestones: [
            { id: 'ms-1', name: 'Planning', status: 'completed', features: [], success_criteria: [], order: 0 },
            { id: 'ms-2', name: 'Implementation', status: 'executing', features: [], success_criteria: [], order: 1 },
          ],
          artifacts: [],
          created_at: '2024-01-02T00:00:00Z',
          tags: ['bugfix'],
        },
      ]

      mockJson({ missions }) // list missions
      mockJson({ total_missions: 2, planning: 1, executing: 1, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // stats

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('Add authentication')).toBeTruthy()
        expect(screen.getByText('Fix login bug')).toBeTruthy()
      })
    })

    it('shows status filter dropdown', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        const select = screen.getByDisplayValue('All statuses')
        expect(select).toBeTruthy()
      })
    })

    it('shows new mission button', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('+ New Mission')).toBeTruthy()
      })
    })
  })

  describe('create mission form', () => {
    it('opens create form when clicking New Mission', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('+ New Mission')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('+ New Mission'))

      expect(screen.getByLabelText('Description *')).toBeTruthy()
      expect(screen.getByLabelText('Target Repository *')).toBeTruthy()
    })

    it('submits mission with required fields', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('+ New Mission')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('+ New Mission'))

      const descInput = screen.getByLabelText('Description *')
      const repoInput = screen.getByLabelText('Target Repository *')

      fireEvent.change(descInput, { target: { value: 'Test mission' } })
      fireEvent.change(repoInput, { target: { value: '/test/repo' } })

      // Mock the POST response
      mockJson({ id: 'mission-new' }) // create
      mockJson({ missions: [] }) // refresh list
      mockJson({ total_missions: 1, planning: 1, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // refresh stats

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Mission' }))
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/missions'),
          expect.objectContaining({ method: 'POST' })
        )
      })
    })

    it('disables submit button when fields are empty', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('+ New Mission'))
      })

      const submitBtn = screen.getByRole('button', { name: 'Create Mission' })
      expect(submitBtn).toHaveAttribute('disabled')
    })
  })

  describe('mission detail view', () => {
    it('shows mission details when clicking Details', async () => {
      const mission = {
        id: 'mission-abc123',
        description: 'Add authentication',
        target_repository: '/path/to/repo',
        status: 'planning',
        autonomy_level: 'restricted_autonomous',
        parallel_workers: false,
        milestones: [],
        artifacts: [],
        created_at: '2024-01-01T00:00:00Z',
        tags: ['feature'],
      }

      mockJson({ missions: [mission] }) // list
      mockJson({ total_missions: 1, planning: 1, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // stats
      mockJson(mission) // detail

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Details'))
      })

      await waitFor(() => {
        expect(screen.getByText('Add authentication')).toBeTruthy()
        expect(screen.getByText('/path/to/repo')).toBeTruthy()
      })
    })

    it('shows milestone progress', async () => {
      const mission = {
        id: 'mission-abc123',
        description: 'Add authentication',
        target_repository: '/path/to/repo',
        status: 'executing',
        autonomy_level: 'restricted_autonomous',
        parallel_workers: false,
        milestones: [
          {
            id: 'ms-1',
            name: 'Planning',
            status: 'completed',
            features: [
              { id: 'f1', name: 'Analyze', status: 'completed', role: 'worker', order: 0 },
            ],
            success_criteria: ['Plan documented'],
            order: 0,
          },
          {
            id: 'ms-2',
            name: 'Implementation',
            status: 'executing',
            features: [
              { id: 'f2', name: 'Code auth', status: 'running', role: 'worker', order: 0 },
              { id: 'f3', name: 'Write tests', status: 'pending', role: 'worker', order: 1 },
            ],
            success_criteria: ['Tests pass'],
            order: 1,
          },
        ],
        artifacts: [],
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
      }

      mockJson({ missions: [mission] }) // list
      mockJson({ total_missions: 1, planning: 0, executing: 1, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // stats
      mockJson(mission) // detail

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('Details')).toBeTruthy()
      })

      fireEvent.click(screen.getByText('Details'))

      await waitFor(() => {
        expect(screen.queryByText('1. Planning')).toBeTruthy()
      })
      expect(screen.queryByText('2. Implementation')).toBeTruthy()
    })

    it('shows validation results', async () => {
      const mission = {
        id: 'mission-abc123',
        description: 'Add authentication',
        target_repository: '/path/to/repo',
        status: 'validating',
        autonomy_level: 'restricted_autonomous',
        parallel_workers: false,
        milestones: [],
        artifacts: [],
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
        validation_results: [
          {
            id: 'vr-1',
            severity: 'major',
            explanation: 'Missing input validation',
            file_path: 'src/auth.py',
            line_number: 42,
            suggested_correction: 'Add input sanitization',
            verified: false,
          },
        ],
      }

      mockJson({ missions: [mission] }) // list
      mockJson({ total_missions: 1, planning: 0, executing: 0, validating: 1, completed: 0, failed: 0, cancelled: 0, paused: 0 }) // stats
      mockJson(mission) // detail

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Details'))
      })

      await waitFor(() => {
        expect(screen.getByText('Missing input validation')).toBeTruthy()
      })
    })

    it('shows action buttons based on mission status', async () => {
      const executingMission = {
        id: 'mission-exec',
        description: 'Executing mission',
        target_repository: '/repo',
        status: 'executing',
        autonomy_level: 'restricted_autonomous',
        parallel_workers: false,
        milestones: [],
        artifacts: [],
        created_at: '2024-01-01T00:00:00Z',
        tags: [],
      }

      mockJson({ missions: [executingMission] })
      mockJson({ total_missions: 1, planning: 0, executing: 1, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })
      mockJson(executingMission)

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        fireEvent.click(screen.getByText('Details'))
      })

      await waitFor(() => {
        expect(screen.getByText('Pause')).toBeTruthy()
        expect(screen.getByText('Cancel')).toBeTruthy()
      })
    })
  })

  describe('stats display', () => {
    it('renders stats cards', async () => {
      mockJson({ missions: [] })
      mockJson({
        total_missions: 10,
        planning: 2,
        executing: 3,
        validating: 1,
        completed: 3,
        failed: 1,
        cancelled: 0,
        paused: 0,
      })

      await act(async () => {
        render(<Missions />)
      })

      await waitFor(() => {
        expect(screen.getByText('10')).toBeTruthy()
      })
    })
  })

  describe('component rendering', () => {
    it('component renders without crashing', async () => {
      mockJson({ missions: [] })
      mockJson({ total_missions: 0, planning: 0, executing: 0, validating: 0, completed: 0, failed: 0, cancelled: 0, paused: 0 })

      const { container } = render(<Missions />)
      expect(container).toBeTruthy()
    })
  })
})
