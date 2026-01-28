import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import logo from "./assets/logo_sidebar.svg";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

function App() {
  const [config, setConfig] = useState({
    input_database: "",
    scenario_mode: "perfect_foresight",
    solver_name: "appsi_highs",
    time_sequencing: "seasonal_timeslices",
    explorer_port: 8001,
  });

  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("config");
  const [selectedHtml, setSelectedHtml] = useState(null);
  const [results, setResults] = useState([]);
  const [runId, setRunId] = useState(null);
  const [solvers, setSolvers] = useState(["appsi_highs", "cbc"]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState(".");
  const terminalRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    checkBackend();
    const interval = setInterval(checkBackend, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkBackend = async () => {
    try {
      const resp = await fetch(`${API_BASE}/health`);
      if (resp.ok) {
        setBackendStatus("connected");
        fetchSolvers();
        fetchConfig();
      } else {
        setBackendStatus("error");
      }
    } catch (e) {
      setBackendStatus("disconnected");
    }
  };

  const fetchConfig = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/config`);
      if (resp.ok) {
        const data = await resp.json();
        // Update ports if needed, but DO NOT overwrite input_database automatically
        setConfig((prev) => ({
          ...prev,
          explorer_port: data.explorer_port || 8001,
        }));
      }
    } catch (e) {
      console.error("Failed to fetch config", e);
    }
  };

  const downloadTutorial = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/download_tutorial`, { method: "POST" });
      if (resp.ok) {
        const data = await resp.json();
        if (data.path) {
          setConfig((prev) => ({
            ...prev,
            input_database: data.path,
          }));
          // Also refresh files to show the assets folder if needed
          fetchFiles(currentPath);
        }
      } else {
        alert("Failed to download tutorial data.");
      }
    } catch (e) {
      console.error("Error downloading tutorial:", e);
    }
  };

  const fetchSolvers = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/solvers`);
      if (resp.ok) {
        const data = await resp.json();
        setSolvers(data);
      }
    } catch (e) {
      console.error("Failed to fetch solvers", e);
    }
  };

  const fetchFiles = async (path = ".") => {
    try {
      const resp = await fetch(`${API_BASE}/api/files?path=${encodeURIComponent(path)}`);
      if (resp.ok) {
        const data = await resp.json();
        setFiles(data);
        setCurrentPath(path);
      }
    } catch (e) {
      console.error("Failed to fetch files", e);
    }
  };

  const navigateTo = (item) => {
    if (item.is_dir) {
      fetchFiles(item.path);
    } else {
      setConfig((prev) => ({ ...prev, input_database: item.path }));
      setShowFileBrowser(false);
    }
  };

  const fetchResults = async (id) => {
    try {
      const resp = await fetch(`${API_BASE}/api/results/${id}`);
      if (resp.ok) {
        const data = await resp.json();
        setResults(data);
        // Default to first HTML file
        const firstHtml = data.find((f) => f.type === "html");
        if (firstHtml) setSelectedHtml(firstHtml.url);
      }
    } catch (e) {
      console.error("Failed to fetch results", e);
    }
  };

  const connectWS = () => {
    if (ws.current) ws.current.close();
    ws.current = new WebSocket(`${WS_BASE}/ws/logs`);

    ws.current.onmessage = (event) => {
      const msg = event.data;

      // Special signal for result readiness
      if (msg.startsWith("RESULTS_READY:")) {
        const id = msg.split(":")[1];
        setRunId(id);
        fetchResults(id);
        setIsRunning(false);
        setActiveTab("results");
        return;
      }

      setLogs((prev) => [...prev, msg]);

      if (msg.includes("✅") || msg.includes("❌")) {
        setIsRunning(false);
      }
    };

    ws.current.onerror = (err) => {
      console.error("WS connection error", err);
      setLogs((prev) => [...prev, "❌ WebSocket Connection Error. Check if backend is running."]);
      setIsRunning(false);
    };

    ws.current.onclose = () => {
      console.log("WS closed");
      setIsRunning(false);
    };
  };

  const handleRun = async () => {
    setIsRunning(true);
    setLogs([]);
    setResults([]);
    setActiveTab("logs");
    connectWS();

    try {
      const response = await fetch(`${API_BASE}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to start run");
    } catch (error) {
      setLogs((prev) => [...prev, `❌ ERROR: ${error.message}`]);
      setIsRunning(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({ ...prev, [name]: value }));
  };

  const FileBrowser = () => (
    <div className="file-browser-modal">
      <div className="file-browser-content">
        <div className="file-browser-header">
          <h3>Select Input File</h3>
          <button onClick={() => setShowFileBrowser(false)} className="close-btn">
            &times;
          </button>
        </div>
        <div className="file-browser-path">
          <code>{currentPath}</code>
          <button onClick={() => fetchFiles(currentPath + "/..")} className="back-btn">
            Up
          </button>
        </div>
        <div className="file-browser-list">
          {files.map((file, i) => (
            <div
              key={i}
              className={`file-item ${file.is_dir ? "dir" : "file"}`}
              onClick={() => navigateTo(file)}
            >
              <span className="icon">{file.is_dir ? "📁" : "📄"}</span>
              <span className="name">{file.name}</span>
            </div>
          ))}
          {files.length === 0 && <div className="no-files">No files found</div>}
        </div>
      </div>
    </div>
  );

  const SetupInstructions = () => (
    <div className="setup-instructions">
      <h3>Client Setup Instructions</h3>
      <div className="instruction-steps">
        <div className="step">
          <div className="step-number">1</div>
          <div className="step-content">
            <strong>Install uv:</strong>
            <code>curl -sSfL https://astral.sh/uv/install.sh | sh</code>
          </div>
        </div>
        <div className="step">
          <div className="step-number">2</div>
          <div className="step-content">
            <strong>Install Solvers(optional, HiGHs is Temoa default)</strong>
          </div>
        </div>
        <div className="step">
          <div className="step-number">3</div>
          <div className="step-content">
            <strong>Run Backend:</strong>
            <code>
              uv run
              https://raw.githubusercontent.com/TemoaProject/temoa-web-gui/refs/heads/main/temoa_runner.py
            </code>
          </div>
        </div>
      </div>
      <div className="setup-note">
        <p>Ensure the local backend is running before starting a simulation.</p>
      </div>
    </div>
  );

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo">
          <img src={logo} alt="Temoa Logo" />
        </div>
        <div className={`status-badge ${backendStatus}`}>
          {backendStatus === "connected"
            ? "● Local Compute Ready"
            : backendStatus === "checking"
              ? "○ Checking Local..."
              : "● Local Compute Offline"}
        </div>
        <nav>
          <div
            className={`nav-item ${activeTab === "config" ? "active" : ""}`}
            onClick={() => setActiveTab("config")}
          >
            <span>Dashboard</span>
          </div>
          <div
            className={`nav-item ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            <span>Live Logs</span>
          </div>
          <div
            className={`nav-item ${activeTab === "results" ? "active" : ""}`}
            onClick={() => setActiveTab("results")}
          >
            <span>Network Visualizer</span>
          </div>
          <div
            className={`nav-item ${activeTab === "explorer" ? "active" : ""}`}
            onClick={() => setActiveTab("explorer")}
          >
            <span>Data Explorer</span>
          </div>
        </nav>
      </div>

      <main className="main-content">
        {activeTab === "config" && (
          <div className="card">
            <h2>Configuration</h2>
            <div className="config-grid">
              <div>
                <label>Input Source (.sqlite or .toml)</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    name="input_database"
                    value={config.input_database}
                    onChange={handleChange}
                    style={{ flex: 1 }}
                    placeholder="/path/to/database.sqlite"
                  />
                  <button
                    onClick={() => {
                      fetchFiles();
                      setShowFileBrowser(true);
                    }}
                    className="action-btn"
                  >
                    Browse
                  </button>
                  <button
                    onClick={downloadTutorial}
                    className="action-btn secondary"
                    title="Download and use sample data"
                  >
                    Use Tutorial
                  </button>
                </div>
              </div>
              <div>
                <label>Scenario Mode</label>
                <select name="scenario_mode" value={config.scenario_mode} onChange={handleChange}>
                  <option value="perfect_foresight">Perfect Foresight</option>
                  <option value="MGA">MGA</option>
                  <option value="myopic">Myopic</option>
                  <option value="monte_carlo">Monte Carlo</option>
                  <option value="build_only">Build Only</option>
                </select>
              </div>
              <div>
                <label>Solver</label>
                <select name="solver_name" value={config.solver_name} onChange={handleChange}>
                  {solvers.map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Time Sequencing</label>
                <select
                  name="time_sequencing"
                  value={config.time_sequencing}
                  onChange={handleChange}
                >
                  <option value="seasonal_timeslices">Seasonal Timeslices</option>
                  <option value="consecutive_days">Consecutive Days</option>
                  <option value="representative_periods">Representative Periods</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: "30px" }}>
              <button
                onClick={handleRun}
                disabled={isRunning || !config.input_database || backendStatus !== "connected"}
              >
                {backendStatus !== "connected"
                  ? "Backend Offline"
                  : isRunning
                    ? "Running Model..."
                    : "Start Simulation"}
              </button>
            </div>

            <hr style={{ margin: "40px 0", border: "none", borderTop: "1px solid #e2e8f0" }} />

            <SetupInstructions />
          </div>
        )}

        {showFileBrowser && <FileBrowser />}

        {activeTab === "logs" && (
          <div className="card">
            <h2>Execution Logs</h2>
            <div className="terminal" ref={terminalRef}>
              {logs.map((log, i) => (
                <div key={i} className="log-line">
                  {log}
                </div>
              ))}
              {logs.length === 0 && <div style={{ color: "#64748b" }}>Waiting for logs...</div>}
            </div>
          </div>
        )}

        {activeTab === "results" && (
          <div className="card">
            <div className="results-container">
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <h2 style={{ margin: 0 }}>Network Visualizer: {runId || "No run selected"}</h2>
                <div className="action-bar">
                  {results
                    .filter((f) => f.type === "xlsx" || f.type === "sqlite")
                    .map((file, i) => (
                      <a key={i} href={`${API_BASE}${file.url}`} download className="action-btn">
                        Download {file.label}
                      </a>
                    ))}
                </div>
              </div>

              {results.filter((f) => f.type === "html" || f.type === "svg").length > 0 ? (
                <>
                  <div className="action-bar">
                    {results
                      .filter((f) => f.type === "html" || f.type === "svg")
                      .map((file, i) => (
                        <button
                          key={i}
                          className={`action-btn ${selectedHtml === file.url ? "active" : ""}`}
                          onClick={() => setSelectedHtml(file.url)}
                        >
                          {file.label}
                        </button>
                      ))}
                  </div>
                  <div className="iframe-wrapper">
                    <iframe
                      src={`${API_BASE}${selectedHtml}`}
                      width="100%"
                      height="100%"
                      title="Network Graph"
                      style={{ border: "none" }}
                    />
                  </div>
                </>
              ) : (
                <p style={{ color: "#64748b" }}>No visualization files found for this run.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === "explorer" && (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <iframe
              src={`http://${new URL(API_BASE).hostname}:${config.explorer_port || 8001}`}
              width="100%"
              height="100%"
              title="Datasette Explorer"
              style={{ border: "none" }}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
