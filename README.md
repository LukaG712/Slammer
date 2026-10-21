# Ranger

> *"Now that all the ghosts of Evershade Valley are under my control..."*
> ~ **King Boo**, Luigi's Mansion: Dark Moon

**Ranger** is the standalone web dashboard for the Evershade ecosystem. It provides a React-based frontend for managing agents, runs, pipelines, and analytics across all services.

**Luigi's Mansion origin:** *Ranger* ~ a guardian who patrols and oversees, fitting for a dashboard that monitors the entire ecosystem.

## Features

- **Unified Dashboard** ~ Single view of all Evershade services
- **Agent Management** ~ Create, configure, and monitor AI agents
- **Pipeline Builder** ~ Visual pipeline editor for cross-service workflows
- **Analytics** ~ Charts and metrics from Creeper

## Tech Stack

- **React** with TypeScript
- **Vite** for building
- **Tailwind CSS** for styling

## Quick Start

```bash
npm install
npm run dev
```

The dashboard will be available at **http://localhost:5173**.

## Configuration

Set via environment variables or `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_GREENIE_URL` | `http://localhost:8080` | Greenie API URL |
| `VITE_SLINKER_URL` | `http://localhost:8000` | Slinker API URL |
| `VITE_TRAPPER_URL` | `http://localhost:3000` | Trapper API URL |

## License

MIT
