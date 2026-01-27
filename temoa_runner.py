# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "temoa>=4.0.0a1",
#     "fastapi",
#     "uvicorn[standard]",
#     "tomlkit",
#     "websockets",
# ]
# ///

import asyncio
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    HTTPException,
    BackgroundTasks,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# --- Temoa Imports ---
# We assume temoa is installed in the same environment
try:
    from temoa._internal.temoa_sequencer import TemoaSequencer
    from temoa.core.config import TemoaConfig
except ImportError:
    # For development if temoa is not in path
    TemoaSequencer = None
    TemoaConfig = None
    logging.error("Temoa not found in environment.")

app = FastAPI(title="Temoa Web GUI API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve output files
output_path = Path("output")
output_path.mkdir(parents=True, exist_ok=True)
app.mount("/results", StaticFiles(directory="output"), name="results")


class RunConfig(BaseModel):
    input_database: str
    scenario_mode: str = "perfect_foresight"
    solver_name: str = "appsi_highs"
    time_sequencing: str = "seasonal_timeslices"
    output_dir: Optional[str] = None


# --- Log Management ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        # Filter out empty or whitespace-only messages
        if not message.strip():
            return
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                pass


manager = ConnectionManager()


class WebSocketLogHandler(logging.Handler):
    def __init__(self, loop):
        super().__init__()
        self.loop = loop

    def emit(self, record):
        msg = self.format(record)
        if manager.active_connections:
            asyncio.run_coroutine_threadsafe(manager.broadcast(msg), self.loop)


# --- Routes ---


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/files")
def list_files(path: str = "."):
    """Helper to browse files for input database selection."""
    try:
        p = Path(path).resolve()
        # Security: restrict to some root if needed, but for local use it's fine
        items = []
        if p.is_dir():
            for item in p.iterdir():
                # Filter for useful files or show all
                items.append(
                    {
                        "name": item.name,
                        "is_dir": item.is_dir(),
                        "path": str(item.absolute()),
                        "extension": item.suffix,
                    }
                )
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/solvers")
def list_solvers():
    """Detect available solvers on the local system."""
    try:
        import pyomo.environ as pyo

        # List of solvers we want to check for
        common_solvers = [
            "appsi_highs",
            "highs",
            "cbc",
            "glpk",
            "ipopt",
            "gurobi",
            "cplex",
        ]
        available = []
        for s in common_solvers:
            try:
                # Some solvers might throw errors even on check if not installed correctly
                factory = pyo.SolverFactory(s)
                if factory.available():
                    available.append(s)
            except Exception:
                continue

        # Ensure we return at least a sensible default if detection fails but temoa is present
        if not available:
            return ["appsi_highs", "cbc"]

        return available
    except ImportError:
        # Fallback if pyomo is somehow missing
        return ["appsi_highs", "cbc"]


@app.get("/api/results/{run_id}")
async def get_results(run_id: str):
    run_dir = output_path / run_id
    if not run_dir.exists():
        raise HTTPException(status_code=404, detail="Run not found")

    files = []
    # Sort files to keep consistency
    for f in sorted(run_dir.iterdir()):
        if f.suffix in [".html", ".svg", ".sqlite", ".xlsx"]:
            # Create a nice label
            label = f.name
            if f.suffix == ".html" and "Network_Graph" in f.name:
                # Extract year or scenario name
                parts = f.stem.split("_")
                if parts[-1].isdigit():
                    label = f"Network Map {parts[-1]}"
                else:
                    label = "Network Map"
            elif f.suffix == ".xlsx":
                label = f"Export: {f.name}"
            elif f.suffix == ".sqlite":
                label = f"Database: {f.name}"

            files.append(
                {
                    "name": f.name,
                    "label": label,
                    "type": f.suffix[1:],
                    "url": f"/results/{run_id}/{f.name}",
                }
            )
    return files


async def run_temoa_task(config: RunConfig, output_dir: Path, loop):
    """Background task to run Temoa and stream logs."""
    run_id = output_dir.name

    # Set up logging to broadcast to WS
    root_logger = logging.getLogger()
    ws_handler = WebSocketLogHandler(loop)
    ws_handler.setFormatter(
        logging.Formatter("%(asctime)s | %(levelname)s | %(message)s", "%H:%M:%S")
    )
    root_logger.addHandler(ws_handler)

    # Also capture stdout/stderr
    class StreamToWS:
        def write(self, buf):
            # Split and clean lines before broadcasting
            if not buf.strip():
                return
            if isinstance(buf, bytes):
                buf = buf.decode("utf-8", errors="replace")
            for line in buf.splitlines():
                if line.strip():
                    asyncio.run_coroutine_threadsafe(manager.broadcast(line), loop)

        def flush(self):
            pass

    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = StreamToWS()
    sys.stderr = StreamToWS()

    try:
        await manager.broadcast(f"--- Starting Run ID: {run_id} ---")
        await manager.broadcast(f"Time: {datetime.now()}")
        await asyncio.sleep(1.0)  # Give WS a bit more time to settle

        if not TemoaSequencer:
            await manager.broadcast("❌ ERROR: Temoa not found. Is it installed?")
            return

        import tomlkit

        input_path = Path(config.input_database)
        run_toml = tomlkit.document()

        # --- Case A: SQLite Input ---
        if input_path.suffix in [".sqlite", ".db"]:
            await manager.broadcast(f"Input is SQLite: {input_path.name}")
            # Use tutorial_config.toml as base if it exists
            template_path = Path("assets/tutorial_config.toml")
            if not template_path.exists():
                template_path = Path(
                    "/media/Secondary/Projects/TemoaProject/temoa-web-gui/assets/tutorial_config.toml"
                )
            if template_path.exists():
                run_toml = tomlkit.parse(template_path.read_text(encoding="utf-8"))

            run_toml["input_database"] = str(input_path.absolute())
            run_toml["output_database"] = str(input_path.absolute())
            await manager.broadcast("Output will be saved back to the input database.")

        # --- Case B: TOML Input ---
        elif input_path.suffix == ".toml":
            await manager.broadcast(f"Input is TOML: {input_path.name}")
            run_toml = tomlkit.parse(input_path.read_text(encoding="utf-8"))

            # If output_database not absolute, make it relative to the toml site
            if "output_database" not in run_toml:
                run_toml["output_database"] = run_toml.get("input_database")
        else:
            await manager.broadcast(
                f"⚠️ Unknown input file type: {input_path.suffix}. Attempting to proceed."
            )
            run_toml["input_database"] = str(input_path.absolute())
            run_toml["output_database"] = str(input_path.absolute())

        # Update with GUI selections
        run_toml["scenario_mode"] = config.scenario_mode
        run_toml["solver_name"] = config.solver_name
        run_toml["time_sequencing"] = config.time_sequencing

        await manager.broadcast(
            f"Output Database target: {run_toml['output_database']}"
        )

        config_path = output_dir / "run_config.toml"
        with open(config_path, "w", encoding="utf-8") as f:
            f.write(tomlkit.dumps(run_toml))

        await manager.broadcast("Building Temoa Configuration...")
        temoa_config = TemoaConfig.build_config(
            config_file=config_path, output_path=output_dir, silent=False
        )

        await manager.broadcast("Starting Sequencer...")
        sequencer = TemoaSequencer(config=temoa_config)

        await asyncio.to_thread(sequencer.start)
        await manager.broadcast(f"✅ Run {run_id} completed successfully.")
        await manager.broadcast(f"RESULTS_READY:{run_id}")

    except Exception as e:
        await manager.broadcast(f"❌ Error during run: {str(e)}")
        import traceback

        for line in traceback.format_exc().splitlines():
            await manager.broadcast(line)
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        root_logger.removeHandler(ws_handler)


@app.post("/api/run")
async def start_run(config: RunConfig, background_tasks: BackgroundTasks):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("output") / timestamp
    output_dir.mkdir(parents=True, exist_ok=True)

    loop = asyncio.get_event_loop()
    background_tasks.add_task(run_temoa_task, config, output_dir, loop)

    return {
        "message": "Run started",
        "output_dir": str(output_dir.absolute()),
        "status_url": "/ws/logs",
    }


@app.websocket("/ws/logs")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
