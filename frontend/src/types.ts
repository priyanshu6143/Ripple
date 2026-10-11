export type LanguageType = 'java' | 'typescript' | 'javascript';

export type NavTab = 'dashboard' | 'analyze' | 'graph' | 'reports' | 'about';

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  active_projects: number;
}

export interface UnresolvedImportWarning {
  source_file: string;
  raw_import: string;
  reason: string;
  is_external: boolean;
}

export interface SymbolImportRef {
  imported_symbol: string;
  local_alias: string;
  import_kind: 'named' | 'default' | 'namespace';
  raw_module: string;
  resolved_module?: string | null;
  is_valid: boolean;
}

export interface SymbolDiagnostic {
  importing_file: string;
  imported_symbol: string;
  local_alias?: string | null;
  source_module: string;
  raw_module_specifier: string;
  issue_type: 'missing_named_export' | 'missing_default_export' | 'unresolved_module';
  available_exports: string[];
  reason: string;
}

export interface AnalyzedFile {
  path: string;
  name: string;
  extension: string;
  language: LanguageType;
  size_bytes: number;
  line_count: number;
  is_test: boolean;
  package_name?: string | null;
  imports: string[];
  dependents: string[];
  raw_imports: string[];
  exported_symbols?: string[];
  has_default_export?: boolean;
  symbol_imports?: SymbolImportRef[];
  preview_snippet: string;
}

export interface GraphNode {
  id: string;
  label: string;
  language: LanguageType;
  is_test: boolean;
  directory: string;
  in_degree: number;
  out_degree: number;
}

export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface GraphResponse {
  project_id: string;
  project_name: string;
  edge_direction_semantics: string;
  nodes: GraphNode[];
  edges: DependencyEdge[];
}

export interface ProjectSummary {
  project_id: string;
  project_name: string;
  is_sample: boolean;
  created_at: string;
  total_files: number;
  total_dependencies: number;
  test_files_count: number;
  languages: string[];
  unresolved_warnings_count: number;
  symbol_diagnostics_count?: number;
  ignored_files_count: number;
  most_depended_on_file?: string | null;
}

export interface ProjectAnalysisResponse {
  summary: ProjectSummary;
  files: AnalyzedFile[];
  graph: GraphResponse;
  unresolved_warnings: UnresolvedImportWarning[];
  symbol_diagnostics?: SymbolDiagnostic[];
  ignored_entries: string[];
}

export interface AffectedFileDetail {
  file_path: string;
  file_name: string;
  language: LanguageType;
  impact_type: 'direct' | 'indirect';
  distance: number;
  is_test: boolean;
  dependency_path: string[];
  imported_symbols?: string[];
  missing_symbols?: string[];
  symbol_diagnostics?: SymbolDiagnostic[];
  explanation: string;
}

export interface SuggestedTest {
  test_file?: string | null;
  recommended_name: string;
  priority: 'High' | 'Medium' | 'Low';
  reason: string;
  exists_in_project: boolean;
}

export interface RiskFactor {
  label: string;
  value: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

export interface RiskAssessment {
  level: 'Low' | 'Medium' | 'High';
  score: number;
  summary: string;
  factors: RiskFactor[];
  methodology_note: string;
}

export interface ImpactReportResponse {
  project_id: string;
  project_name: string;
  selected_file: AnalyzedFile;
  generated_at: string;
  total_project_files: number;
  other_project_files_count: number;
  direct_dependents: AffectedFileDetail[];
  indirect_dependents: AffectedFileDetail[];
  direct_affected_count: number;
  direct_production_count: number;
  direct_test_count: number;
  indirect_affected_count: number;
  indirect_production_count: number;
  indirect_test_count: number;
  total_affected_count: number;
  affected_production_count: number;
  affected_test_count: number;
  blast_radius_percent: number;
  broken_symbol_references_count?: number;
  symbol_diagnostics?: SymbolDiagnostic[];
  risk: RiskAssessment;
  suggested_tests: SuggestedTest[];
  cycle_detected: boolean;
  cycles_involving_file: string[][];
  limitations: string[];
}
