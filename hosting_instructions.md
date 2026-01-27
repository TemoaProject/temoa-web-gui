# Temoa Web GUI: Client-Side Setup

This guide will help you set up your local machine to run Temoa models while using the hosted web interface.

## 1. Install `uv`
`uv` is an extremely fast Python package manager that handles all dependencies for you.

**Windows (PowerShell):**
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -sSfL https://astral.sh/uv/install.sh | sh
```

## 2. Install Solvers
Temoa requires at least one solver installed on your system. We recommend **HiGHS** or **GLPK**.

- **Windows:** Download HiGHS/GLPK and add to your PATH.
- **macOS:** `brew install highs glpk`
- **Linux:** `sudo apt install highs glpk-utils`

## 3. Run the Backend
Run this command in your terminal. It will automatically download the necessary Python environment and start the Temoa runner.

```bash
uv run https://raw.githubusercontent.com/your-username/temoa-web-gui/main/temoa_runner.py
```

> [!NOTE]
> Keep this terminal window open while using the GUI.

## 4. Access the Web Interface
Once the backend is running, open your browser and navigate to:
**[https://your-hosted-gui.com](https://your-hosted-gui.com)**

The status indicator in the sidebar should turn green (**● Local Compute Ready**), and you'll see your local solvers in the dropdown.
