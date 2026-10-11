# Ripple — Static Code Impact Analyzer

> **"Understand the impact before you change the code."**

Ripple is a full-stack static code dependency and change-impact analysis application for **Java (`.java`)**, **TypeScript (`.ts`, `.tsx`)**, and **JavaScript (`.js`, `.jsx`)** projects. Developers upload a project `.zip` archive (or load the built-in multi-file sample project), inspect an interactive directed dependency graph, and select any source file to see which upstream files are **directly** and **transitively** affected, why they are coupled, what risk level the change carries, and which test suites should be executed.

---

## 1. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Flow (`reactflow`), Lucide Icons (`lucide-react`)
- **Backend**: Python 3, FastAPI, Uvicorn, Pydantic v2, `python-multipart`
- **Testing**: `pytest` + FastAPI `TestClient` (`httpx`)

---

## 2. Project Structure

```text
ripple/
├── .gitignore
├── README.md
├── start_ripple.bat               # Primary Windows launcher (starts Backend & Frontend in separate windows)
├── stop_ripple.bat                # Stops any running Ripple servers on ports 8000 and 5173
├── start-backend.bat              # Starts FastAPI backend on port 8000 (auto-installs missing pip deps)
├── start-frontend.bat             # Starts Vite frontend on port 5173 (auto-installs missing npm deps)
├── start-ripple.bat               # Alias script calling start_ripple.bat
├── sample-project/                # Extracted copy of the example Java + TS project
├── sample-project.zip             # Ready-to-upload ZIP archive for drag-and-drop testing
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI application, CORS, and REST endpoints
│   │   ├── models.py              # Pydantic request & response schemas
│   │   ├── analyzer.py            # Static import extraction, graph builder, BFS impact & risk engine
│   │   ├── sample_project.py      # Built-in sample project archive builder
│   │   └── storage.py             # In-memory session store for analyzed projects
│   └── tests/
│       └── test_analyzer.py       # Automated pytest suite (resolution, cycles, traversal, security)
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── types.ts
        ├── index.css
        ├── utils/
        │   └── exportReport.ts    # Markdown (.md) and JSON (.json) report generators
        └── components/
            ├── Navbar.tsx         # Custom SVG Ripple logo & navigation bar
            ├── DashboardView.tsx  # Overview metrics, high-coupling files, session history
            ├── AnalyzeView.tsx    # Drag-and-drop ZIP uploader & sample project trigger
            ├── WorkspaceView.tsx  # Searchable file explorer, React Flow canvas, impact inspector
            ├── DependencyGraph.tsx# Interactive React Flow graph with layered auto-layout
            ├── ReportView.tsx     # Full printable/exportable impact report
            └── AboutView.tsx      # Methodology, edge semantics, and static analysis scope
```

---

## 3. Windows Setup, Startup, Stop & Restart Instructions

### Prerequisites
- **Python 3.10+** (installed at `%LOCALAPPDATA%\Programs\Python\Python314` and added to User `PATH`)
- **Node.js 18+ & npm** (installed at `%LOCALAPPDATA%\Programs\nodejs` and added to User `PATH`)

---

### Option A: One-Click Startup After Reboot (`start_ripple.bat`)

From **File Explorer**, double-click **`D:\Projects\ripple\start_ripple.bat`**, or run from PowerShell / Command Prompt:

```powershell
cd D:\Projects\ripple
.\start_ripple.bat
```

**What `start_ripple.bat` does automatically:**
1. Uses relative paths (`%~dp0backend` and `%~dp0frontend`) so it works from the project root regardless of your current shell directory.
2. Opens **Window 1 — `Ripple Backend (Port 8000)`**:
   - Checks if `fastapi`, `uvicorn`, `pydantic`, and `python-multipart` are already installed.
   - **Skips `pip install`** if dependencies are present, or installs from `backend\requirements.txt` if any are missing.
   - Starts FastAPI at **`http://127.0.0.1:8000`** (`--http h11`).
3. Opens **Window 2 — `Ripple Frontend (Port 5173)`**:
   - Checks if `frontend\node_modules\.bin\vite.cmd` exists.
   - **Skips `npm install`** if `node_modules` is already present, or runs `npm install` if missing.
   - Starts the Vite dev server at **`http://localhost:5173`**.

Once both windows are running, open **`http://localhost:5173`** in your browser.

---

### Option B: Manual Terminal Startup (Step-by-Step)

#### 1. Start Backend Server (Port `8000`)
```powershell
cd D:\Projects\ripple\backend
# Only needed if dependencies are not yet installed:
python -m pip install -r requirements.txt

python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --http h11
```
- Backend Health Check: `http://127.0.0.1:8000/api/health`
- Interactive Swagger API Docs: `http://127.0.0.1:8000/docs`

#### 2. Start Frontend Server (Port `5173`)
```powershell
cd D:\Projects\ripple\frontend
# Only needed if node_modules is missing:
npm install

npm run dev
```
- Open **`http://localhost:5173`** in your browser.

#### 3. Run Automated Backend Tests
```powershell
cd D:\Projects\ripple\backend
$env:PYTHONPATH = "."
python -m pytest tests/test_analyzer.py -v
```

---

### How to Stop Both Servers & Start Ripple Again

1. **Stopping via Terminal Windows**:
   - Click inside the **`Ripple Backend (Port 8000)`** window and press **`Ctrl + C`**, then close the window (or simply close the window directly).
   - Click inside the **`Ripple Frontend (Port 5173)`** window and press **`Ctrl + C`**, then close the window.
2. **Stopping via One-Click Script (`stop_ripple.bat`)**:
   - Run `.\stop_ripple.bat` from `D:\Projects\ripple` (or double-click `stop_ripple.bat`). It finds any process listening on ports `8000` and `5173` and terminates them cleanly.
3. **Starting Ripple Again**:
   - Run `.\start_ripple.bat` from `D:\Projects\ripple` (or double-click `start_ripple.bat` in File Explorer).

---

## 4. Static Analysis Engine & Graph Semantics

### Graph Direction (`A -> B`)
- **Dependency Edge**: A directed edge `A -> B` (`source = A`, `target = B`) means **File A imports or references File B** (`A` depends on `B`).
- **Impact Propagation (`B -> A -> C`)**: When **File B** is modified, impact propagates in the **reverse edge direction** to every file that directly or transitively depends on `B`:
  - **Direct Dependent (Distance = 1 hop)**: `A` directly imports `B`.
  - **Indirect / Transitive Dependent (Distance ≥ 2 hops)**: `C` imports `A`, which imports `B`.
- **Cycle Safety**: Traversal uses Breadth-First Search (BFS) with an explicit visited path map. Circular dependencies (`A -> B -> C -> A`) are detected, reported in `cycles_involving_file`, and never cause infinite loops.

### Language Resolution Details
1. **Java (`.java`)**:
   - Strips `//` and `/* ... */` comments so commented-out imports are ignored.
   - Extracts `package` declarations and `import` statements (including wildcard `import pkg.*;` and static imports).
   - Resolves intra-package class references (classes in the same Java package that reference each other without explicit `import` lines).
2. **TypeScript & JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)**:
   - Strips comments and extracts ES module `import ... from`, side-effect `import '...'`, `export ... from`, dynamic `import()`, and CommonJS `require()`.
   - Resolves relative paths (`./`, `../`), directory index files (`/index.ts`, `/index.tsx`, `/index.js`, `/index.jsx`), extensionless imports, and `@/` or `src/` aliases.
3. **Unresolved Imports**:
   - Missing local/relative imports are surfaced as explicit `UnresolvedImportWarning` items rather than inventing fake targets.

---

## 5. REST API Documentation

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns backend health status, service version, and count of active projects in memory. |
| `GET` | `/api/projects` | Lists summaries of all projects analyzed in the current session. |
| `POST` | `/api/analyze` | Accepts `multipart/form-data` with a `file` field (`.zip`), runs static analysis, and returns `ProjectAnalysisResponse`. |
| `POST` | `/api/analyze/sample` | Runs the built-in multi-file Java + TypeScript sample project through the exact same ZIP analysis pipeline. |
| `GET` | `/api/sample-zip` | Downloads the built-in sample project as `acme-identity-service.zip` for testing file upload. |
| `GET` | `/api/project/{project_id}` | Returns full `ProjectAnalysisResponse` for a previously analyzed project. |
| `GET` | `/api/project/{project_id}/files` | Returns the list of analyzed source files (`AnalyzedFile[]`) with imports and dependents. |
| `GET` | `/api/project/{project_id}/graph` | Returns `GraphResponse` containing `nodes`, `edges`, and edge direction documentation. |
| `POST` | `/api/project/{project_id}/impact` | Accepts `{ "file_path": "..." }` and returns `ImpactReportResponse` (direct & indirect dependents, dependency paths, risk assessment, suggested tests, and limitations). |

---

## 6. Security & Analysis Limitations

- **No Code Execution**: Uploaded archives are inspected strictly as static text in memory; no uploaded code or shell scripts are ever executed.
- **Archive Guardrails**: Enforces `.zip` format check, rejects path traversal (`..`) and absolute paths, limits archive size to 25 MB, max 500 source files, and 1 MB per source file. Automatically skips `.git`, `node_modules`, `dist`, `build`, `target`, and binary artifacts.
- **Static Analysis Scope**: Static import resolution captures compile-time and module-level coupling. It does not trace runtime reflection, string-concatenated dynamic imports, or cross-language HTTP calls, and does not claim guaranteed bug detection.
