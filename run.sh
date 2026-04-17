#!/bin/bash

# Sync dependencies
uv sync
uv add "uvicorn[standard]" websockets

# Cleanup existing processes if running
echo "Cleaning up stale processes..."
fuser -k 8000/tcp 2>/dev/null
fuser -k 8001/tcp 2>/dev/null
sleep 1

# Start Temoa Web GUI Backend (includes Datasette)
echo "Starting backend and explorer..."
uv run python temoa_runner.py &
BACKEND_PID=$!

# Start Vite frontend
echo "Starting frontend..."
cd frontend
npm run dev

# Cleanup
trap "kill $BACKEND_PID" EXIT
