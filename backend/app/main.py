import os
from typing import List
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .analyzer import AnalysisError, analyze_zip_bytes, compute_file_impact
from .models import (
    AnalyzedFile,
    GraphResponse,
    HealthResponse,
    ImpactReportResponse,
    ImpactRequest,
    ProjectAnalysisResponse,
    ProjectSummary,
)
from .sample_project import SAMPLE_PROJECT_NAME, build_sample_zip_bytes
from .storage import project_store

DEFAULT_LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]


def get_allowed_cors_origins() -> List[str]:
    """
    Build the explicit list of allowed CORS origins from environment variables
    (CORS_ORIGINS and/or FRONTEND_URL) plus local Vite development/preview origins.
    Never returns wildcard '*' in production.
    """
    origins: List[str] = list(DEFAULT_LOCAL_ORIGINS)
    raw_env = ",".join(
        filter(
            None,
            [
                os.environ.get("CORS_ORIGINS", ""),
                os.environ.get("FRONTEND_URL", ""),
            ],
        )
    )
    for item in raw_env.split(","):
        cleaned = item.strip().rstrip("/")
        if cleaned and cleaned != "*" and cleaned not in origins:
            origins.append(cleaned)
    return origins


app = FastAPI(
    title="Ripple API — Static Code Impact Analyzer",
    description=(
        "Deterministic static dependency & impact analysis engine for Java, JavaScript, and TypeScript projects. "
        "Extracts source imports, builds a directed dependency graph, and computes direct & transitive blast radius."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(AnalysisError)
async def analysis_error_handler(request, exc: AnalysisError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
    )


@app.get("/", response_model=HealthResponse, tags=["System"])
async def root_status() -> HealthResponse:
    """Root status endpoint for platform health probes."""
    return HealthResponse(
        status="healthy",
        service="Ripple Static Code Impact Analyzer",
        version="1.0.0",
        active_projects=project_store.count(),
    )


@app.get("/api/health", response_model=HealthResponse, tags=["System"])
async def health_check() -> HealthResponse:
    """Verify backend health and return active in-memory project count."""
    return HealthResponse(
        status="healthy",
        service="Ripple Static Code Impact Analyzer",
        version="1.0.0",
        active_projects=project_store.count(),
    )


@app.get("/api/projects", response_model=List[ProjectSummary], tags=["Projects"])
async def list_recent_projects() -> List[ProjectSummary]:
    """Return summaries of projects analyzed in the current session."""
    return project_store.list_recent()


@app.post("/api/analyze", response_model=ProjectAnalysisResponse, tags=["Analysis"])
async def analyze_uploaded_zip(file: UploadFile = File(...)) -> ProjectAnalysisResponse:
    """
    Accept a ZIP archive upload, validate safety limits, extract supported source files,
    build a directed dependency graph, and store the analysis session in memory.
    """
    filename = (file.filename or "project.zip").strip()
    if not filename.lower().endswith(".zip"):
        raise AnalysisError(
            f"Unsupported file format '{filename}'. Please upload a .zip archive containing .java, .js, .jsx, .ts, or .tsx files.",
            status_code=400,
        )

    zip_bytes = await file.read()
    analysis = analyze_zip_bytes(zip_bytes=zip_bytes, project_name=filename, is_sample=False)
    project_store.save(analysis)
    return analysis


@app.post("/api/analyze/sample", response_model=ProjectAnalysisResponse, tags=["Analysis"])
async def analyze_sample_project() -> ProjectAnalysisResponse:
    """
    Build the built-in multi-file example project ZIP and run it through the exact same
    static analysis pipeline as uploaded ZIP files.
    """
    sample_zip = build_sample_zip_bytes()
    analysis = analyze_zip_bytes(
        zip_bytes=sample_zip,
        project_name=SAMPLE_PROJECT_NAME,
        is_sample=True,
    )
    project_store.save(analysis)
    return analysis


@app.get("/api/sample-zip", tags=["Analysis"])
async def download_sample_zip() -> Response:
    """Download the built-in sample project as a real .zip archive for testing file upload."""
    sample_zip = build_sample_zip_bytes()
    return Response(
        content=sample_zip,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{SAMPLE_PROJECT_NAME}"'},
    )


@app.get("/api/project/{project_id}", response_model=ProjectAnalysisResponse, tags=["Projects"])
async def get_project_analysis(project_id: str) -> ProjectAnalysisResponse:
    """Retrieve the complete analysis payload for a project by ID."""
    analysis = project_store.get(project_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' was not found in the active session.",
        )
    return analysis


@app.get("/api/project/{project_id}/files", response_model=List[AnalyzedFile], tags=["Projects"])
async def get_project_files(project_id: str) -> List[AnalyzedFile]:
    """Return the analyzed project file list and import/dependent metadata."""
    analysis = project_store.get(project_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' was not found in the active session.",
        )
    return analysis.files


@app.get("/api/project/{project_id}/graph", response_model=GraphResponse, tags=["Projects"])
async def get_project_graph(project_id: str) -> GraphResponse:
    """Return the directed dependency graph nodes and edges for a project."""
    analysis = project_store.get(project_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' was not found in the active session.",
        )
    return analysis.graph


@app.post("/api/project/{project_id}/impact", response_model=ImpactReportResponse, tags=["Analysis"])
async def calculate_impact(project_id: str, request: ImpactRequest) -> ImpactReportResponse:
    """
    Given a selected changed file, traverse reverse dependency edges to compute directly
    and indirectly affected files, dependency paths, risk assessment, and suggested tests.
    """
    analysis = project_store.get(project_id)
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail=f"Project '{project_id}' was not found in the active session.",
        )
    return compute_file_impact(analysis=analysis, changed_file_path=request.file_path)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)

