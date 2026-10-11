import io
import zipfile
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path, content in files.items():
            zf.writestr(path, content)
    return buf.getvalue()


def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "active_projects" in data


def test_sample_project_analysis_and_transitive_impact():
    res = client.post("/api/analyze/sample")
    assert res.status_code == 200
    payload = res.json()

    project_id = payload["summary"]["project_id"]
    assert payload["summary"]["is_sample"] is True
    assert payload["summary"]["total_files"] >= 10
    assert payload["summary"]["total_dependencies"] >= 10

    # Verify files and graph endpoints
    files_res = client.get(f"/api/project/{project_id}/files")
    assert files_res.status_code == 200
    assert len(files_res.json()) == payload["summary"]["total_files"]

    graph_res = client.get(f"/api/project/{project_id}/graph")
    assert graph_res.status_code == 200
    assert len(graph_res.json()["nodes"]) == payload["summary"]["total_files"]

    # Test impact of changing UserRepository.java
    impact_res = client.post(
        f"/api/project/{project_id}/impact",
        json={"file_path": "src/main/java/com/acme/identity/repository/UserRepository.java"},
    )
    assert impact_res.status_code == 200
    impact = impact_res.json()

    direct_names = {d["file_name"] for d in impact["direct_dependents"]}
    indirect_names = {d["file_name"] for d in impact["indirect_dependents"]}

    # UserService, AuditService, and UserServiceTest directly import UserRepository
    assert "UserService.java" in direct_names
    assert "AuditService.java" in direct_names
    assert "UserServiceTest.java" in direct_names

    # UserController, BillingWebhookController, and UserControllerTest depend on UserService (indirectly affected, 2 hops)
    assert "UserController.java" in indirect_names
    assert "BillingWebhookController.java" in indirect_names
    assert "UserControllerTest.java" in indirect_names

    # Verify dependency path order: [UserRepository.java, UserService.java, UserController.java]
    controller_entry = next(d for d in impact["indirect_dependents"] if d["file_name"] == "UserController.java")
    assert controller_entry["distance"] == 2
    assert controller_entry["dependency_path"][0].endswith("UserRepository.java")
    assert controller_entry["dependency_path"][-1].endswith("UserController.java")

    # Verify audited count breakdown for UserRepository.java
    assert payload["summary"]["total_files"] == 14
    assert payload["summary"]["test_files_count"] == 3
    assert impact["total_project_files"] == 14
    assert impact["other_project_files_count"] == 13
    assert impact["direct_affected_count"] == 3
    assert impact["direct_production_count"] == 2
    assert impact["direct_test_count"] == 1
    assert impact["indirect_affected_count"] == 3
    assert impact["indirect_production_count"] == 2
    assert impact["indirect_test_count"] == 1
    assert impact["total_affected_count"] == 6
    assert impact["affected_production_count"] == 4
    assert impact["affected_test_count"] == 2
    assert impact["blast_radius_percent"] == 46.2
    assert impact["risk"]["score"] == 72
    assert impact["risk"]["level"] == "High"
    # Verify no duplicate files across direct and indirect lists
    assert len(direct_names & indirect_names) == 0



def test_typescript_resolution_and_unresolved_warnings():
    zip_bytes = make_zip(
        {
            "src/utils/math.ts": "export const add = (a: number, b: number) => a + b;",
            "src/components/index.tsx": "import { add } from '../utils/math';\nexport const Calc = () => add(1, 2);",
            "src/App.tsx": (
                "// import { fake } from './commentedOut';\n"
                "import { Calc } from './components';\n"
                "import { missingHelper } from './missingFile';\n"
                "import React from 'react';\n"
                "export const App = () => Calc();"
            ),
            "src/App.test.tsx": "import { App } from './App';",
            "node_modules/react/index.js": "module.exports = {};",
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("ts-app.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    data = res.json()
    project_id = data["summary"]["project_id"]

    # node_modules should be ignored, so 4 source files analyzed
    assert data["summary"]["total_files"] == 4
    # 1 local unresolved import (./missingFile); commentedOut is stripped; react is external
    assert data["summary"]["unresolved_warnings_count"] == 1

    impact_res = client.post(
        f"/api/project/{project_id}/impact",
        json={"file_path": "src/utils/math.ts"},
    )
    assert impact_res.status_code == 200
    impact = impact_res.json()

    assert len(impact["direct_dependents"]) == 1
    assert impact["direct_dependents"][0]["file_path"] == "src/components/index.tsx"

    indirect_paths = [d["file_path"] for d in impact["indirect_dependents"]]
    assert "src/App.tsx" in indirect_paths
    assert "src/App.test.tsx" in indirect_paths


def test_circular_dependency_handling():
    zip_bytes = make_zip(
        {
            "src/a.ts": "import { b } from './b'; export const a = 1;",
            "src/b.ts": "import { c } from './c'; export const b = 2;",
            "src/c.ts": "import { a } from './a'; export const c = 3;",
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("cycle.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    project_id = res.json()["summary"]["project_id"]

    # Traverse impact on a.ts — should terminate cleanly and report cycle_detected
    impact_res = client.post(
        f"/api/project/{project_id}/impact",
        json={"file_path": "src/a.ts"},
    )
    assert impact_res.status_code == 200
    impact = impact_res.json()
    assert impact["cycle_detected"] is True
    assert impact["total_affected_count"] == 2


def test_malformed_and_unsafe_uploads():
    # 1. Non-zip extension
    res_txt = client.post(
        "/api/analyze",
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert res_txt.status_code == 400

    # 2. Corrupted zip bytes
    res_bad = client.post(
        "/api/analyze",
        files={"file": ("broken.zip", b"not-a-valid-zip-stream", "application/zip")},
    )
    assert res_bad.status_code == 400

    # 3. Empty project (no supported source files)
    empty_zip = make_zip({"README.md": "# Only markdown"})
    res_empty = client.post(
        "/api/analyze",
        files={"file": ("empty.zip", empty_zip, "application/zip")},
    )
    assert res_empty.status_code == 400

    # 4. Path traversal attempt
    traversal_zip = make_zip({"../../etc/passwd.js": "console.log('bad');"})
    res_trav = client.post(
        "/api/analyze",
        files={"file": ("evil.zip", traversal_zip, "application/zip")},
    )
    assert res_trav.status_code == 400

    # 5. Windows drive letter or absolute path in archive
    drive_zip = make_zip({"C:/Windows/System32/evil.java": "public class Evil {}"})
    res_drive = client.post(
        "/api/analyze",
        files={"file": ("drive.zip", drive_zip, "application/zip")},
    )
    assert res_drive.status_code == 400

    # 6. Oversized single source file (> 1 MB)
    huge_source = "export const data = '" + ("a" * (1024 * 1024 + 100)) + "';"
    huge_zip = make_zip({"src/huge.ts": huge_source})
    res_huge = client.post(
        "/api/analyze",
        files={"file": ("huge.zip", huge_zip, "application/zip")},
    )
    assert res_huge.status_code == 400


def test_invalid_file_selection_and_missing_project_returns_404():
    sample_res = client.post("/api/analyze/sample")
    project_id = sample_res.json()["summary"]["project_id"]

    bad_impact = client.post(
        f"/api/project/{project_id}/impact",
        json={"file_path": "src/does/not/Exist.java"},
    )
    assert bad_impact.status_code == 404

    # Missing project ID across all project endpoints
    assert client.get("/api/project/proj-nonexistent").status_code == 404
    assert client.get("/api/project/proj-nonexistent/files").status_code == 404
    assert client.get("/api/project/proj-nonexistent/graph").status_code == 404
    assert (
        client.post(
            "/api/project/proj-nonexistent/impact",
            json={"file_path": "src/Any.java"},
        ).status_code
        == 404
    )


def test_single_file_project_and_sample_zip_roundtrip():
    # Single-file project should have 0 other_project_files_count and 0.0% blast radius
    single_zip = make_zip({"src/Standalone.java": "package app;\npublic class Standalone {}"})
    res_single = client.post(
        "/api/analyze",
        files={"file": ("single.zip", single_zip, "application/zip")},
    )
    assert res_single.status_code == 200
    single_pid = res_single.json()["summary"]["project_id"]

    imp_single = client.post(
        f"/api/project/{single_pid}/impact",
        json={"file_path": "src/Standalone.java"},
    )
    assert imp_single.status_code == 200
    imp_data = imp_single.json()
    assert imp_data["total_project_files"] == 1
    assert imp_data["other_project_files_count"] == 0
    assert imp_data["total_affected_count"] == 0
    assert imp_data["blast_radius_percent"] == 0.0

    # Sample ZIP download and re-upload roundtrip
    dl_res = client.get("/api/sample-zip")
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 1000

    reupload_res = client.post(
        "/api/analyze",
        files={"file": ("acme-identity-service.zip", dl_res.content, "application/zip")},
    )
    assert reupload_res.status_code == 200
    reupload_summary = reupload_res.json()["summary"]
    assert reupload_summary["total_files"] == 14
    assert reupload_summary["total_dependencies"] == 24
    assert reupload_summary["test_files_count"] == 3

    projects_res = client.get("/api/projects")
    assert projects_res.status_code == 200
    assert len(projects_res.json()) >= 1


def test_pricing_js_missing_named_export_acceptance_case():
    """
    Acceptance criteria test:
    pricing.js exports calculateAmount(price, quantity), while main.js and invoice.js
    both import { calculateTotal } from './pricing.js'.
    When analyzed with pricing.js selected, Ripple must:
    - Identify main.js and invoice.js as direct dependents (file-level dependency).
    - Flag both broken calculateTotal imports (symbol-level validation).
    - Provide diagnostics with importing_file, imported_symbol, source_module, and reason.
    - Include breaking references in the impact report and risk assessment, explaining why the risk score changes.
    """
    zip_bytes = make_zip(
        {
            "pricing.js": (
                "export function calculateAmount(price, quantity) {\n"
                "    return price * quantity;\n"
                "}\n"
            ),
            "main.js": (
                "import { calculateTotal } from './pricing.js';\n\n"
                "const total = calculateTotal(100, 2);\n"
                "console.log(total);\n"
            ),
            "invoice.js": (
                "import { calculateTotal } from './pricing.js';\n\n"
                "const invoiceTotal = calculateTotal(500, 3);\n"
                "console.log(invoiceTotal);\n"
            ),
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("pricing-demo.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    analysis = res.json()
    project_id = analysis["summary"]["project_id"]

    assert analysis["summary"]["total_files"] == 3
    assert analysis["summary"]["total_dependencies"] == 2
    assert analysis["summary"]["symbol_diagnostics_count"] == 2
    assert len(analysis["symbol_diagnostics"]) == 2

    files_by_path = {f["path"]: f for f in analysis["files"]}
    assert files_by_path["pricing.js"]["exported_symbols"] == ["calculateAmount"]
    assert files_by_path["pricing.js"]["has_default_export"] is False

    # Select pricing.js for impact report
    impact_res = client.post(
        f"/api/project/{project_id}/impact",
        json={"file_path": "pricing.js"},
    )
    assert impact_res.status_code == 200
    impact = impact_res.json()

    # File-level dependents preserved
    assert impact["direct_affected_count"] == 2
    assert impact["indirect_affected_count"] == 0
    assert impact["total_affected_count"] == 2
    assert impact["blast_radius_percent"] == 100.0

    direct_by_path = {d["file_path"]: d for d in impact["direct_dependents"]}
    assert set(direct_by_path.keys()) == {"invoice.js", "main.js"}

    # Symbol-level validation on each direct dependent
    for dep_path in ("main.js", "invoice.js"):
        dep = direct_by_path[dep_path]
        assert dep["imported_symbols"] == ["calculateTotal"]
        assert dep["missing_symbols"] == ["calculateTotal"]
        assert len(dep["symbol_diagnostics"]) == 1
        diag = dep["symbol_diagnostics"][0]
        assert diag["importing_file"] == dep_path
        assert diag["imported_symbol"] == "calculateTotal"
        assert diag["source_module"] == "pricing.js"
        assert diag["issue_type"] == "missing_named_export"
        assert diag["available_exports"] == ["calculateAmount"]
        assert "calculateTotal" in diag["reason"]
        assert "pricing.js" in diag["reason"]
        assert "calculateAmount" in diag["reason"]
        # Explanation must distinguish file-level dependency detection from symbol-level validation
        assert "File-level dependency" in dep["explanation"]
        assert "Symbol-level validation" in dep["explanation"]
        assert "BROKEN EXPORT REFERENCE" in dep["explanation"]

    # Impact report top-level symbol diagnostics and risk explanation
    assert impact["broken_symbol_references_count"] == 2
    assert len(impact["symbol_diagnostics"]) == 2
    assert impact["risk"]["level"] == "High"
    # Base score for 2 direct prod dependents (28) + 100% blast radius (20) + prod layer (5) + no tests (10) = 63
    # Plus 2 broken symbol references (+24) = 87
    assert impact["risk"]["score"] == 87
    assert "increasing the risk score from 63 to 87/100 (+24 pts)" in impact["risk"]["summary"]
    symbol_factor = next(
        f for f in impact["risk"]["factors"] if "Breaking Symbol References" in f["label"]
    )
    assert symbol_factor["severity"] == "high"
    assert "+24 risk pts" in symbol_factor["value"]
    assert "calculateTotal" in symbol_factor["detail"]


def test_valid_named_imports_aliases_and_multiple_exports():
    zip_bytes = make_zip(
        {
            "src/constants.ts": "export const TAX_RATE = 0.08, CURRENCY = 'USD';\n",
            "src/math.ts": (
                "export * from './constants';\n"
                "export function add(a: number, b: number) { return a + b; }\n"
                "const internalMultiply = (a: number, b: number) => a * b;\n"
                "export { internalMultiply as multiply };\n"
            ),
            "src/checkout.ts": (
                "import { add, multiply as mul, TAX_RATE, CURRENCY } from './math';\n"
                "export const total = mul(add(10, 20), 1 + TAX_RATE);\n"
            ),
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("valid-exports.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["summary"]["symbol_diagnostics_count"] == 0
    assert data["symbol_diagnostics"] == []

    files_by_path = {f["path"]: f for f in data["files"]}
    math_exports = set(files_by_path["src/math.ts"]["exported_symbols"])
    # Includes direct declarations, aliased export { internalMultiply as multiply }, and wildcard re-export from constants.ts
    assert {"add", "multiply", "TAX_RATE", "CURRENCY"}.issubset(math_exports)

    checkout_imports = files_by_path["src/checkout.ts"]["symbol_imports"]
    assert len(checkout_imports) == 4
    assert all(imp["is_valid"] is True for imp in checkout_imports)


def test_default_imports_valid_and_missing():
    zip_bytes = make_zip(
        {
            "src/logger.js": "export default class Logger { log(msg) {} }\nexport const LEVEL = 'info';\n",
            "src/config.js": "export const PORT = 8080;\n",
            "src/app.js": (
                "import Logger, { LEVEL } from './logger.js';\n"
                "import DefaultConfig from './config.js';\n"
            ),
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("default-imports.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    data = res.json()

    # Logger default + named LEVEL are valid; DefaultConfig from ./config.js is missing default export
    assert data["summary"]["symbol_diagnostics_count"] == 1
    diag = data["symbol_diagnostics"][0]
    assert diag["importing_file"] == "src/app.js"
    assert diag["imported_symbol"] == "default"
    assert diag["local_alias"] == "DefaultConfig"
    assert diag["source_module"] == "src/config.js"
    assert diag["issue_type"] == "missing_default_export"
    assert "PORT" in diag["available_exports"]


def test_unresolved_module_symbol_diagnostics():
    zip_bytes = make_zip(
        {
            "src/index.js": (
                "import { fetchUser, formatUser } from './missingService.js';\n"
                "import axios from 'axios';\n"
            ),
        }
    )

    res = client.post(
        "/api/analyze",
        files={"file": ("unresolved-mod.zip", zip_bytes, "application/zip")},
    )
    assert res.status_code == 200
    data = res.json()

    # File-level unresolved warning for './missingService.js' (axios is external and ignored)
    local_warnings = [w for w in data["unresolved_warnings"] if not w["is_external"]]
    assert len(local_warnings) == 1
    assert local_warnings[0]["raw_import"] == "./missingService.js"

    # Symbol-level diagnostics for both symbols imported from the missing local module
    assert data["summary"]["symbol_diagnostics_count"] == 2
    symbols = {d["imported_symbol"] for d in data["symbol_diagnostics"]}
    assert symbols == {"fetchUser", "formatUser"}
    assert all(d["issue_type"] == "unresolved_module" for d in data["symbol_diagnostics"])
    assert all(d["importing_file"] == "src/index.js" for d in data["symbol_diagnostics"])


def test_cors_origins_and_root_health(monkeypatch):
    from app.main import get_allowed_cors_origins

    # Root status probe works
    root_res = client.get("/")
    assert root_res.status_code == 200
    assert root_res.json()["status"] == "healthy"

    # Local dev origin is allowed by default, arbitrary origin is rejected
    ok_cors = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert ok_cors.headers.get("access-control-allow-origin") == "http://localhost:5173"

    bad_cors = client.get("/api/health", headers={"Origin": "https://untrusted-site.example.com"})
    assert bad_cors.headers.get("access-control-allow-origin") is None

    # Environment variable CORS_ORIGINS / FRONTEND_URL adds normalized origins and ignores '*'
    monkeypatch.setenv("CORS_ORIGINS", "https://my-frontend.onrender.com/, *")
    monkeypatch.setenv("FRONTEND_URL", "https://custom-domain.example.com/")
    origins = get_allowed_cors_origins()
    assert "https://my-frontend.onrender.com" in origins
    assert "https://custom-domain.example.com" in origins
    assert "http://localhost:5173" in origins
    assert "*" not in origins


