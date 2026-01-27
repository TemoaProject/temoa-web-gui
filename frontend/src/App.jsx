import React, { useState, useEffect, useRef } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

function App() {
  const [config, setConfig] = useState({
    input_database: "assets/tutorial_database.sqlite",
    scenario_mode: "perfect_foresight",
    solver_name: "appsi_highs",
    time_sequencing: "seasonal_timeslices",
  });

  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState("config");
  const [results, setResults] = useState([]);
  const [runId, setRunId] = useState(null);
  const [selectedHtml, setSelectedHtml] = useState(null);
  const terminalRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

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

    ws.current.onclose = () => {
      console.log("WS closed");
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

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo">
          TEMOA <span>GUI</span>
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
                <input
                  type="text"
                  name="input_database"
                  value={config.input_database}
                  onChange={handleChange}
                />
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
                  <option value="appsi_highs">HiGHS</option>
                  <option value="cbc">CBC</option>
                  <option value="gurobi">Gurobi</option>
                  <option value="cplex">CPLEX</option>
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
              <button onClick={handleRun} disabled={isRunning || !config.input_database}>
                {isRunning ? "Running Model..." : "Start Simulation"}
              </button>
            </div>
          </div>
        )}

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
              src="http://localhost:8001"
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
