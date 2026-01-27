#!/bin/bash

# Sync dependencies
uv sync
uv add "uvicorn[standard]" websockets

# Cleanup existing processes if running
echo "Cleaning up stale processes..."
fuser -k 8000/tcp 2>/dev/null
fuser -k 8001/tcp 2>/dev/null
sleep 1

# Start FastAPI backend in background
echo "Starting backend..."
uv run python backend/main.py &
BACKEND_PID=$!

# Start Datasette in background to view results
echo "Starting Datasette..."
uv run datasette . --port 8001 --setting sql_time_limit_ms 5000 &
DATASETTE_PID=$!

# Start Vite frontend
echo "Starting frontend..."
cd frontend
npm run dev

# Cleanup
trap "kill $BACKEND_PID $DATASETTE_PID" EXIT
