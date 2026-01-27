#!/bin/bash

# Sync dependencies
uv sync
uv add "uvicorn[standard]" websockets

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
