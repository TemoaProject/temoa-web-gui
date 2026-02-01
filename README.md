# Temoa Web GUI

A modern web-based interface for the Temoa (Tools for Energy Model Optimization and Analysis) Energy System Model.

## Philosophy

The Temoa Web GUI is designed with a hybrid architecture:
- **Local Backend**: Computational heavy lifting and model execution occur on your local machine via a Python backend. This ensures you maintain full control over your data and compute resources.
- **Shared Interface**: A high-performance web-hosted frontend provides a consistent, rich user experience across different platforms while communicating with your local backend.

## Key Features

- **Intuitive Model Configuration**: Easily set up Temoa runs with a user-friendly interface.
- **Real-time Progress Monitoring**: Track model execution through streaming logs and status updates.
- **Interactive Results Visualization**: Explore model outputs with integrated network maps and data tables.
- **Database Exploration**: Built-in integration with Datasette for inspection of SQLite results.

## Prerequisites

- **Python 3.12+**
- **uv** (high-performance Python package manager, recommended)
- **Node.js & npm** (only required for the development path)

## Getting Started

There are two primary ways to set up and run the Temoa Web GUI.

### Option 1: Standalone Runner (Simplest)

Use this method if you simply want to run the GUI for your own modeling work.

1.  **Run directly from GitHub**:
    ```bash
    uv run https://raw.githubusercontent.com/TemoaProject/temoa-web-gui/main/temoa_runner.py
    ```
2.  **Alternatively, run locally**:
    Download [temoa_runner.py](temoa_runner.py) and run:
    ```bash
    uv run temoa_runner.py
    ```
    The script automatically manages its own dependencies, downloads necessary assets, and launches both the API backend and the Datasette results explorer.
3.  **Access the GUI**: Open [https://interface.temoaproject.org/](https://interface.temoaproject.org/) in your web browser to interact with your local backend.


### Option 2: Development Path

Use this method if you intend to contribute to the project or customize the frontend.

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/TemoaProject/temoa-web-gui.git
    cd temoa-web-gui
    ```
2.  **Setup Backend**:
    ```bash
    uv sync
    ```
3.  **Setup Frontend**:
    ```bash
    cd frontend
    npm install
    ```
4.  **Run Everything**:
    Use the provided convenience script from the project root:
    ```bash
    ./run.sh
    ```

## Project Structure

- `backend/`: FastAPI application handling model execution and data management.
- `frontend/`: Vite-powered React application (interface).
- `temoa_runner.py`: A single-file entry point that acts as a standalone backend + API launcher.
- `assets/`: Default databases and configuration templates.
- `output/`: Default directory for model run results and log files.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
