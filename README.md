# Slammer

> *"Now that all the ghosts of Evershade Valley are under my control..."*
> ~ **King Boo**, Luigi's Mansion: Dark Moon

**Slammer** is the standalone web dashboard for the Evershade ecosystem. It provides a React-based frontend for managing agents, runs, pipelines, and analytics across all services.

**Luigi's Mansion origin:** *Slammer* ~ blue ghosts from Luigi's Mansion: Dark Moon that slam the ground with force, perfect for a dashboard that slams you with the big picture.

## Features

- **Unified Dashboard** ~ Single view of all Evershade services
- **Agent Management** ~ Create, configure, and monitor AI agents
- **Pipeline Builder** ~ Visual pipeline editor for cross-service workflows
- **Analytics** ~ Charts and metrics from Sneaker

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

---

> **Disclaimer:** This project is a fan-made, independent software project. It is not affiliated with, endorsed by, or in any way connected to Nintendo, Next Level Games, or any of their subsidiaries. All Luigi's Mansion trademarks and character names are property of their respective owners. Service names are used purely for thematic inspiration.
