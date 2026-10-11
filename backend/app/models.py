from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "Ripple Static Code Impact Analyzer"
    version: str = "1.0.0"
    active_projects: int = 0


class UnresolvedImportWarning(BaseModel):
    source_file: str = Field(..., description="File containing the unresolved import statement")
    raw_import: str = Field(..., description="The raw import specifier or class reference")
    reason: str = Field(..., description="Explanation of why this import was not resolved to a project file")
    is_external: bool = Field(
        default=False,
        description="True if it appears to be a standard library or third-party package rather than a missing local file",
    )


class SymbolImportRef(BaseModel):
    imported_symbol: str = Field(
        ...,
        description="Symbol name requested from the target module ('default' for default imports, '*' for namespace imports, or the exported symbol name)",
    )
    local_alias: str = Field(
        ...,
        description="Local identifier bound in the importing file",
    )
    import_kind: Literal["named", "default", "namespace"] = Field(
        default="named",
        description="Whether this is a named import ({ x }), default import (import x from), or namespace import (* as x)",
    )
    raw_module: str = Field(
        ...,
        description="Raw module specifier string written in the import statement (e.g. './pricing.js')",
    )
    resolved_module: Optional[str] = Field(
        default=None,
        description="Resolved project file path if the module exists in the archive, else None",
    )
    is_valid: bool = Field(
        default=True,
        description="False if the target module is missing or does not export the requested symbol",
    )


class SymbolDiagnostic(BaseModel):
    importing_file: str = Field(..., description="File path containing the broken import")
    imported_symbol: str = Field(..., description="Symbol name that failed validation (e.g. 'calculateTotal')")
    local_alias: Optional[str] = Field(default=None, description="Local alias if imported using 'as'")
    source_module: str = Field(
        ...,
        description="Resolved source module file path (e.g. 'pricing.js') or raw module specifier if unresolved",
    )
    raw_module_specifier: str = Field(
        ...,
        description="Original module specifier in the import statement (e.g. './pricing.js')",
    )
    issue_type: Literal["missing_named_export", "missing_default_export", "unresolved_module"] = Field(
        ...,
        description="Type of symbol-level failure",
    )
    available_exports: List[str] = Field(
        default_factory=list,
        description="Named exports actually provided by the resolved source module",
    )
    reason: str = Field(
        ...,
        description="Clear diagnostic message explaining the importing file, imported symbol, source module, and failure cause",
    )


class AnalyzedFile(BaseModel):
    path: str = Field(..., description="Normalized relative path within the project")
    name: str = Field(..., description="Filename")
    extension: str = Field(..., description="File extension (.java, .ts, .tsx, .js, .jsx)")
    language: Literal["java", "typescript", "javascript"]
    size_bytes: int
    line_count: int
    is_test: bool = Field(..., description="Whether the file is classified as a test file")
    package_name: Optional[str] = Field(default=None, description="Java package name if applicable")
    imports: List[str] = Field(default_factory=list, description="Resolved project file paths that this file imports")
    dependents: List[str] = Field(default_factory=list, description="Resolved project file paths that import this file")
    raw_imports: List[str] = Field(default_factory=list, description="All raw import strings detected in the file")
    exported_symbols: List[str] = Field(
        default_factory=list,
        description="Named symbols exported by this file (functions, classes, variables, types, re-exports)",
    )
    has_default_export: bool = Field(
        default=False,
        description="True if this file declares a default export (or CommonJS module.exports)",
    )
    symbol_imports: List[SymbolImportRef] = Field(
        default_factory=list,
        description="Parsed symbol-level imports in this file",
    )
    preview_snippet: str = Field(default="", description="First 35 lines of code for quick inspection")


class GraphNode(BaseModel):
    id: str = Field(..., description="Unique file path identifier")
    label: str = Field(..., description="Display name of the file")
    language: Literal["java", "typescript", "javascript"]
    is_test: bool
    directory: str
    in_degree: int = Field(..., description="Number of project files that depend on (import) this file")
    out_degree: int = Field(..., description="Number of project files that this file depends on (imports)")


class DependencyEdge(BaseModel):
    id: str
    source: str = Field(..., description="The dependent file (A) that contains the import statement")
    target: str = Field(..., description="The dependency file (B) being imported by A")
    relationship: str = Field(
        default="imports",
        description="Edge semantics: source imports target (changing target may impact source)",
    )


class GraphResponse(BaseModel):
    project_id: str
    project_name: str
    edge_direction_semantics: str = (
        "Directed edge A -> B means file A imports (depends on) file B. "
        "When file B changes, impact propagates in reverse (from B to A and A's dependents)."
    )
    nodes: List[GraphNode]
    edges: List[DependencyEdge]


class ProjectSummary(BaseModel):
    project_id: str
    project_name: str
    is_sample: bool = False
    created_at: str
    total_files: int
    total_dependencies: int
    test_files_count: int
    languages: List[str]
    unresolved_warnings_count: int
    symbol_diagnostics_count: int = 0
    ignored_files_count: int
    most_depended_on_file: Optional[str] = None


class ProjectAnalysisResponse(BaseModel):
    summary: ProjectSummary
    files: List[AnalyzedFile]
    graph: GraphResponse
    unresolved_warnings: List[UnresolvedImportWarning]
    symbol_diagnostics: List[SymbolDiagnostic] = Field(
        default_factory=list,
        description="Symbol-level diagnostics for missing named/default exports or unresolved symbol imports",
    )
    ignored_entries: List[str] = Field(
        default_factory=list,
        description="Sample of skipped non-source or ignored paths (.git, node_modules, etc.)",
    )


class ImpactRequest(BaseModel):
    file_path: str = Field(..., min_length=1, description="Relative path of the changed file in the project")


class AffectedFileDetail(BaseModel):
    file_path: str
    file_name: str
    language: Literal["java", "typescript", "javascript"]
    impact_type: Literal["direct", "indirect"]
    distance: int = Field(..., description="Hop distance from changed file (1 = direct, >=2 = indirect)")
    is_test: bool
    dependency_path: List[str] = Field(
        ...,
        description="Ordered chain from changed file to this affected file: [ChangedFile, ..., AffectedFile]",
    )
    imported_symbols: List[str] = Field(
        default_factory=list,
        description="Symbols imported by this dependent from the target module",
    )
    missing_symbols: List[str] = Field(
        default_factory=list,
        description="Symbols imported by this dependent that are missing from the target module",
    )
    symbol_diagnostics: List[SymbolDiagnostic] = Field(
        default_factory=list,
        description="Detailed symbol-level diagnostics affecting this dependent file",
    )
    explanation: str = Field(..., description="Human-readable reason why this file may be impacted")


class SuggestedTest(BaseModel):
    test_file: Optional[str] = Field(
        default=None,
        description="Existing project test file path if found, or None if recommending a new test to create",
    )
    recommended_name: str = Field(..., description="Test file or suite name")
    priority: Literal["High", "Medium", "Low"]
    reason: str = Field(..., description="Why this test is recommended based on dependency path or naming convention")
    exists_in_project: bool = Field(..., description="True if this test file already exists in the analyzed ZIP")


class RiskFactor(BaseModel):
    label: str
    value: str
    severity: Literal["low", "medium", "high"]
    detail: str


class RiskAssessment(BaseModel):
    level: Literal["Low", "Medium", "High"]
    score: int = Field(..., ge=0, le=100, description="Deterministic heuristic score from 0 to 100")
    summary: str
    factors: List[RiskFactor]
    methodology_note: str = (
        "Computed deterministically from static dependency topology and symbol-level export validation: "
        "direct dependent count, transitive blast radius, broken symbol references, architectural layer heuristics, and linked test suites."
    )


class ImpactReportResponse(BaseModel):
    project_id: str
    project_name: str
    selected_file: AnalyzedFile
    generated_at: str
    total_project_files: int = Field(..., description="Total number of analyzed source files in the project")
    other_project_files_count: int = Field(
        ...,
        description="Total analyzed project files excluding the 1 selected file (denominator for blast radius)",
    )
    direct_dependents: List[AffectedFileDetail]
    indirect_dependents: List[AffectedFileDetail]
    direct_affected_count: int = Field(..., description="Total directly affected files (production + test)")
    direct_production_count: int = Field(..., description="Directly affected production (non-test) files")
    direct_test_count: int = Field(..., description="Directly affected test files")
    indirect_affected_count: int = Field(..., description="Total indirectly affected files (production + test)")
    indirect_production_count: int = Field(..., description="Indirectly affected production (non-test) files")
    indirect_test_count: int = Field(..., description="Indirectly affected test files")
    total_affected_count: int = Field(..., description="Total unique affected files (direct + indirect)")
    affected_production_count: int = Field(..., description="Total unique affected production files")
    affected_test_count: int = Field(..., description="Total unique affected test files")
    blast_radius_percent: float = Field(
        ...,
        description="Percentage of other project files affected: (total_affected_count / other_project_files_count) * 100",
    )
    broken_symbol_references_count: int = Field(
        default=0,
        description="Number of broken symbol imports (missing named/default exports or unresolved modules) involving the selected file",
    )
    symbol_diagnostics: List[SymbolDiagnostic] = Field(
        default_factory=list,
        description="Detailed symbol-level diagnostics involving the selected file or its impact chain",
    )
    risk: RiskAssessment
    suggested_tests: List[SuggestedTest]
    cycle_detected: bool = Field(
        default=False,
        description="True if a circular dependency was encountered and safely bounded during traversal",
    )
    cycles_involving_file: List[List[str]] = Field(
        default_factory=list,
        description="Any circular dependency chains discovered involving the selected file or its dependents",
    )
    limitations: List[str]

