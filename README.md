# Quantum Forge

Quantum Forge is a full-stack platform for creating, executing, and analyzing quantum computing experiments.

I built it during my quantum computing internship at NAWCAD to make running and comparing quantum experiments easier than working through separate scripts and manually tracking results.

## What it does

Quantum Forge provides a web interface for configuring quantum experiments, submitting them for execution, and viewing their results.

Experiments are processed asynchronously so longer-running jobs do not block the application. The frontend receives live status updates while experiments are running and displays metrics such as execution time, circuit depth, qubit count, and error.

The platform was primarily built around Qiskit and supports running experiments with quantum simulators and IBM Quantum backends.

## Tech Stack

**Frontend**
- React
- Tailwind CSS
- WebSockets

**Backend**
- FastAPI
- Celery
- Redis
- SQLite

**Quantum**
- Python
- Qiskit
- IBM Quantum

## Architecture

The React frontend communicates with a FastAPI backend responsible for experiment configuration and data management.

Quantum jobs are sent to Celery workers through Redis rather than being executed directly inside an HTTP request. This allows experiments to continue running independently of the client connection.

While an experiment is running, status updates and results are sent back to the frontend through WebSockets.

```text
React
  |
  | HTTP / WebSocket
  v
FastAPI
  |
  | queue experiment
  v
Celery + Redis
  |
  | execute
  v
Qiskit / IBM Quantum
  |
  v
Experiment Results
```

## Repository Structure

```text
QuantumForge/
├── frontend/       # React web application
└── backend/        # API, experiment execution, and data storage
```

## Running Locally

Clone the repository:

```bash
git clone https://github.com/Tanishk-Modi/QuantumForge.git
cd QuantumForge
```

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Start Redis and a Celery worker, then run the FastAPI server.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend and backend need to be running simultaneously for the full application to work.
