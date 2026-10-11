import io
import os
import posixpath
import re
import uuid
import zipfile
from collections import deque
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    AffectedFileDetail,
    AnalyzedFile,
    DependencyEdge,
    GraphNode,
    GraphResponse,
    ImpactReportResponse,
    ProjectAnalysisResponse,
    ProjectSummary,
    RiskAssessment,
    RiskFactor,
    SuggestedTest,
    SymbolDiagnostic,
    SymbolImportRef,
    UnresolvedImportWarning,
)

MAX_ZIP_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_EXTRACTED_FILES = 500
MAX_SINGLE_FILE_BYTES = 1 * 1024 * 1024  # 1 MB

SUPPORTED_EXTENSIONS = {
    ".java": "java",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
}

IGNORED_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    "target",
    "coverage",
    ".next",
    ".nuxt",
    ".venv",
    "venv",
    "__pycache__",
    ".idea",
    ".vscode",
    "vendor",
    ".gradle",
    ".mvn",
    "__MACOSX",
}

IGNORED_FILE_SUFFIXES = (
    ".min.js",
    ".bundle.js",
    ".d.ts",
    ".map",
)

JAVA_STD_PREFIXES = (
    "java.",
    "javax.",
    "jakarta.",
    "org.junit.",
    "org.springframework.",
    "org.slf4j.",
    "org.apache.",
    "com.google.",
    "com.fasterxml.",
    "lombok.",
    "org.mockito.",
)


class AnalysisError(Exception):
    """Raised when a ZIP upload fails validation or cannot be analyzed."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def strip_comments(source: str) -> str:
    """
    Remove // line comments and /* ... */ block comments while preserving
    string literals so import regexes do not match commented-out code.
    """
    pattern = re.compile(
        r'("(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|`(?:\\.|[^`\\])*`)|(/\*[\s\S]*?\*/|//[^\r\n]*)'
    )
    return pattern.sub(lambda m: m.group(1) if m.group(1) is not None else " ", source)


def is_test_file(norm_path: str) -> bool:
    """Heuristically classify whether a source file is a test file."""
    lower = norm_path.lower()
    parts = lower.split("/")
    filename = parts[-1]
    name_no_ext, _ = os.path.splitext(filename)

    if any(p in ("test", "tests", "__tests__", "spec", "specs") for p in parts[:-1]):
        return True
    if (
        name_no_ext.endswith("test")
        or name_no_ext.endswith("tests")
        or name_no_ext.endswith("spec")
        or name_no_ext.startswith("test_")
        or ".test." in filename
        or ".spec." in filename
    ):
        return True
    return False


def normalize_zip_entry_path(raw_path: str) -> Optional[str]:
    """
    Sanitize a ZIP entry path and prevent ZIP Slip / path traversal.
    Returns None if unsafe or empty.
    """
    cleaned = raw_path.replace("\\", "/").strip()
    if not cleaned or cleaned.endswith("/"):
        return None
    if cleaned.startswith("/") or ":" in cleaned:
        raise AnalysisError(f"Unsafe absolute or drive path detected in archive: '{raw_path}'", 400)

    parts = [p for p in cleaned.split("/") if p and p != "."]
    if any(p == ".." for p in parts):
        raise AnalysisError(f"Unsafe path traversal ('..') detected in archive: '{raw_path}'", 400)

    if not parts:
        return None
    return "/".join(parts)


def strip_common_top_level_dir(paths: List[str]) -> Dict[str, str]:
    """
    If all files in a ZIP share a single wrapper folder (e.g., 'repo-main/src/...'),
    strip that single top-level directory so file paths are clean and canonical.
    Returns mapping {original_norm_path: stripped_path}.
    """
    if not paths:
        return {}
    split_paths = [p.split("/") for p in paths]
    if all(len(sp) > 1 for sp in split_paths):
        first_seg = split_paths[0][0]
        # Only strip if it's not a standard source directory like 'src' or 'app'
        if first_seg.lower() not in {"src", "app", "lib", "backend", "frontend", "web", "server", "client", "test", "tests"}:
            if all(sp[0] == first_seg for sp in split_paths):
                return {p: "/".join(p.split("/")[1:]) for p in paths}
    return {p: p for p in paths}


def extract_js_ts_imports(clean_code: str) -> List[str]:
    """Extract module specifiers from ES module imports/exports and CommonJS require calls."""
    specifiers: List[str] = []

    # 1. import ... from 'spec' or export ... from 'spec'
    from_pattern = re.compile(
        r"""(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"\r\n]+)['"]"""
    )
    for match in from_pattern.finditer(clean_code):
        spec = match.group(1).strip()
        if spec and spec not in specifiers:
            specifiers.append(spec)

    # 2. require('spec') or import('spec')
    call_pattern = re.compile(r"""\b(?:require|import)\s*\(\s*['"]([^'"\r\n]+)['"]\s*\)""")
    for match in call_pattern.finditer(clean_code):
        spec = match.group(1).strip()
        if spec and spec not in specifiers:
            specifiers.append(spec)

    return specifiers


def _extract_exported_var_names(clean_code: str) -> List[str]:
    """
    Extract variable identifiers from `export const/let/var ...` statements,
    handling single declarations (`export const a = 1`), comma-separated lists
    (`export const a = 1, b = 2;`), and basic object destructuring (`export const { a, b: c } = obj`).
    """
    names: List[str] = []
    decl_pattern = re.compile(r"\bexport\s+(?:const|let|var)\s+(?!enum\b)")
    ident_re = re.compile(r"^[A-Za-z_$][\w$]*")

    for match in decl_pattern.finditer(clean_code):
        idx = match.end()
        n = len(clean_code)

        while idx < n:
            while idx < n and clean_code[idx].isspace():
                idx += 1
            if idx >= n or clean_code[idx] == ";":
                break

            # Destructured object export: export const { a, b: aliasB } = ...
            if clean_code[idx] == "{":
                close_brace = clean_code.find("}", idx + 1)
                if close_brace == -1:
                    break
                inner = clean_code[idx + 1 : close_brace]
                for part in inner.split(","):
                    part = part.strip()
                    if not part or part.startswith("..."):
                        continue
                    # Remove default value `= ...`
                    lhs = part.split("=", 1)[0].strip()
                    if ":" in lhs:
                        target_ident = lhs.split(":", 1)[1].strip()
                    else:
                        target_ident = lhs
                    if ident_re.match(target_ident) and target_ident not in names:
                        names.append(target_ident)
                idx = close_brace + 1
            else:
                m_ident = ident_re.match(clean_code[idx:])
                if not m_ident:
                    break
                var_name = m_ident.group(0)
                if var_name not in names:
                    names.append(var_name)
                idx += len(var_name)

            # Advance past type annotation and initializer up to top-level `,` or `;` or statement end
            depth = 0
            saw_equals = False
            saw_rhs_token = False
            stopped_at_comma = False

            while idx < n:
                ch = clean_code[idx]
                if ch in "([{":
                    depth += 1
                    if saw_equals:
                        saw_rhs_token = True
                elif ch in ")]}":
                    depth = max(0, depth - 1)
                elif depth == 0:
                    if ch == "=" and (idx + 1 >= n or clean_code[idx + 1] != ">"):
                        saw_equals = True
                    elif ch == ",":
                        stopped_at_comma = True
                        idx += 1
                        break
                    elif ch == ";":
                        idx += 1
                        break
                    elif ch == "\n" and saw_equals and saw_rhs_token:
                        # Check if statement ended without a semicolon
                        rest_stripped = clean_code[idx + 1 :].lstrip()
                        if not rest_stripped or not rest_stripped.startswith((",", "?", ":", ".", "+", "-", "*", "/", "&", "|")):
                            break
                    elif saw_equals and not ch.isspace():
                        saw_rhs_token = True
                idx += 1

            if not stopped_at_comma:
                break

    return names


def extract_js_ts_exports(clean_code: str) -> Tuple[List[str], bool, List[str], bool]:
    """
    Extract exported symbol names and default-export presence from JS/TS source code.
    Returns (exported_symbols, has_default_export, reexport_all_specifiers, has_dynamic_cjs).
    """
    exported: List[str] = []
    reexport_all: List[str] = []
    has_default = False
    ident_re = re.compile(r"^[A-Za-z_$][\w$]*$")

    def add_sym(sym: str) -> None:
        if sym == "default":
            nonlocal has_default
            has_default = True
        elif ident_re.match(sym) and sym not in exported:
            exported.append(sym)

    # 1. Default export declarations (`export default ...`)
    if re.search(r"\bexport\s+default\b", clean_code):
        has_default = True

    # 2. Named function, class, enum, interface, and type declarations
    decl_patterns = [
        r"\bexport\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)",
        r"\bexport\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)",
        r"\bexport\s+(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)",
        r"\bexport\s+interface\s+([A-Za-z_$][\w$]*)",
        r"\bexport\s+type\s+([A-Za-z_$][\w$]*)\s*[=<]",
    ]
    for pat in decl_patterns:
        for m in re.finditer(pat, clean_code):
            add_sym(m.group(1).strip())

    # 3. Named variable declarations (`export const/let/var ...`)
    for var_name in _extract_exported_var_names(clean_code):
        add_sym(var_name)

    # 4. Export lists (`export { a, b as c }` and `export { a, b as c } from './other'`)
    export_list_pattern = re.compile(
        r"\bexport\s+(?:type\s+)?\{([^}]*)\}(?:\s*from\s*['\"]([^'\"\r\n]+)['\"])?"
    )
    for m in export_list_pattern.finditer(clean_code):
        clause_body = m.group(1)
        for raw_item in clause_body.split(","):
            item = raw_item.strip()
            if not item:
                continue
            item = re.sub(r"^type\s+", "", item).strip()
            as_match = re.match(r"^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$", item)
            if as_match:
                add_sym(as_match.group(2).strip())
            else:
                add_sym(item)

    # 5. Namespace & wildcard re-exports (`export * as ns from './x'` and `export * from './x'`)
    for m in re.finditer(
        r"\bexport\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s*['\"]([^'\"\r\n]+)['\"]",
        clean_code,
    ):
        add_sym(m.group(1).strip())

    for m in re.finditer(
        r"\bexport\s+\*\s+from\s*['\"]([^'\"\r\n]+)['\"]",
        clean_code,
    ):
        spec = m.group(1).strip()
        if spec and spec not in reexport_all:
            reexport_all.append(spec)

    # 6. CommonJS exports (`exports.foo = ...`, `module.exports.foo = ...`, `module.exports = { ... }`)
    for m in re.finditer(r"\b(?:module\.exports|exports)\.([A-Za-z_$][\w$]*)\s*=", clean_code):
        add_sym(m.group(1).strip())

    cjs_obj_match = re.search(r"\bmodule\.exports\s*=\s*\{([^}]*)\}", clean_code)
    if cjs_obj_match:
        has_default = True
        for raw_prop in cjs_obj_match.group(1).split(","):
            prop = raw_prop.strip()
            if not prop or prop.startswith("..."):
                continue
            key = prop.split(":", 1)[0].split("(", 1)[0].strip()
            add_sym(key)

    has_es_export = bool(re.search(r"\bexport\b", clean_code))
    has_raw_cjs = bool(re.search(r"\bmodule\.exports\s*=", clean_code))
    if has_raw_cjs:
        has_default = True
    has_dynamic_cjs = has_raw_cjs and not cjs_obj_match and not has_es_export and len(exported) == 0

    return exported, has_default, reexport_all, has_dynamic_cjs


def extract_js_ts_symbol_imports(clean_code: str) -> List[SymbolImportRef]:
    """
    Parse ES module `import ... from '...'` and `export { ... } from '...'` statements
    into structured symbol-level import references (named, default, and namespace imports).
    """
    refs: List[SymbolImportRef] = []
    seen: Set[Tuple[str, str, str, str]] = set()
    ident_re = re.compile(r"^[A-Za-z_$][\w$]*$")

    def add_ref(
        imported_symbol: str,
        local_alias: str,
        import_kind: str,
        raw_module: str,
    ) -> None:
        key = (imported_symbol, local_alias, import_kind, raw_module)
        if key not in seen:
            seen.add(key)
            refs.append(
                SymbolImportRef(
                    imported_symbol=imported_symbol,
                    local_alias=local_alias,
                    import_kind=import_kind,  # type: ignore[arg-type]
                    raw_module=raw_module,
                )
            )

    # 1. Standard `import <clause> from '<spec>'`
    # Exclude quotes and semicolons inside <clause> so side-effect imports on preceding lines never bleed into <clause>
    import_from_pattern = re.compile(
        r"\bimport\s+([^;'\"`]+?)\s+from\s*['\"]([^'\"\r\n]+)['\"]"
    )
    for m in import_from_pattern.finditer(clean_code):
        clause = m.group(1).strip()
        spec = m.group(2).strip()
        if not clause or not spec:
            continue

        # Strip leading `type ` modifier (e.g., `import type { A } from './mod'` or `import type A from './mod'`)
        if re.match(r"^type\s+(?=[A-Za-z_${*])", clause):
            clause = re.sub(r"^type\s+", "", clause, count=1).strip()

        # Check for named imports block `{ ... }`
        brace_match = re.search(r"\{([^}]*)\}", clause)
        if brace_match:
            named_body = brace_match.group(1)
            for raw_item in named_body.split(","):
                item = raw_item.strip()
                if not item:
                    continue
                item = re.sub(r"^type\s+", "", item).strip()
                as_match = re.match(r"^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$", item)
                if as_match:
                    orig_sym = as_match.group(1).strip()
                    alias_sym = as_match.group(2).strip()
                else:
                    orig_sym = item
                    alias_sym = item

                if not ident_re.match(orig_sym) or not ident_re.match(alias_sym):
                    continue

                if orig_sym == "default":
                    add_ref("default", alias_sym, "default", spec)
                else:
                    add_ref(orig_sym, alias_sym, "named", spec)

            # Remove `{ ... }` from clause to inspect any remaining default/namespace binding
            clause = (clause[: brace_match.start()] + " " + clause[brace_match.end() :]).strip()

        # Check for namespace import `* as ns`
        ns_match = re.search(r"\*\s+as\s+([A-Za-z_$][\w$]*)", clause)
        if ns_match:
            ns_alias = ns_match.group(1).strip()
            add_ref("*", ns_alias, "namespace", spec)
            clause = (clause[: ns_match.start()] + " " + clause[ns_match.end() :]).strip()

        # Any remaining identifier is a default import (`import Foo from './x'` or `import Foo, { a } from './x'`)
        rem = clause.replace(",", " ").strip()
        if rem and ident_re.match(rem):
            add_ref("default", rem, "default", spec)

    # 2. Named re-exports (`export { a, b as c } from './other'`) also depend on symbols in `./other`
    reexport_named_pattern = re.compile(
        r"\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['\"]([^'\"\r\n]+)['\"]"
    )
    for m in reexport_named_pattern.finditer(clean_code):
        named_body = m.group(1)
        spec = m.group(2).strip()
        for raw_item in named_body.split(","):
            item = raw_item.strip()
            if not item:
                continue
            item = re.sub(r"^type\s+", "", item).strip()
            as_match = re.match(r"^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$", item)
            if as_match:
                orig_sym = as_match.group(1).strip()
                alias_sym = as_match.group(2).strip()
            else:
                orig_sym = item
                alias_sym = item

            if not ident_re.match(orig_sym) or not ident_re.match(alias_sym):
                continue

            if orig_sym == "default":
                add_ref("default", alias_sym, "default", spec)
            else:
                add_ref(orig_sym, alias_sym, "named", spec)

    return refs



def extract_java_metadata(clean_code: str) -> Tuple[Optional[str], List[str]]:
    """Extract Java package declaration and import statements."""
    pkg_match = re.search(r"\bpackage\s+([a-zA-Z_][\w.]*)\s*;", clean_code)
    package_name = pkg_match.group(1).strip() if pkg_match else None

    imports: List[str] = []
    import_pattern = re.compile(r"\bimport\s+(?:static\s+)?([a-zA-Z_][\w.*]*)\s*;")
    for match in import_pattern.finditer(clean_code):
        imp = match.group(1).strip()
        if imp and imp not in imports:
            imports.append(imp)

    return package_name, imports


def resolve_js_ts_import(
    source_file: str,
    specifier: str,
    available_files: Set[str],
) -> Tuple[Optional[str], Optional[UnresolvedImportWarning]]:
    """
    Resolve a JS/TS import specifier to a project file path.
    Returns (resolved_path, warning_if_unresolved).
    """
    source_dir = posixpath.dirname(source_file)
    candidate_bases: List[str] = []

    if specifier.startswith("./") or specifier.startswith("../"):
        joined = posixpath.normpath(posixpath.join(source_dir, specifier))
        if not joined.startswith(".."):
            candidate_bases.append(joined)
    elif specifier.startswith("@/") or specifier.startswith("~/"):
        rel = specifier[2:]
        candidate_bases.extend([rel, f"src/{rel}", f"frontend/src/{rel}", f"web-portal/src/{rel}"])
    elif specifier.startswith("/"):
        rel = specifier.lstrip("/")
        candidate_bases.extend([rel, f"src/{rel}"])
    else:
        # Check if bare specifier matches a project-local path (e.g. 'src/utils/math')
        for prefix in ("", "src/", "frontend/src/", "web-portal/src/"):
            candidate_bases.append(f"{prefix}{specifier}" if prefix else specifier)

    js_ts_exts = [".ts", ".tsx", ".js", ".jsx"]

    for base in candidate_bases:
        # Direct match
        if base in available_files:
            return base, None
        # Try stripping .js/.jsx extension if TypeScript uses ESM style `import './foo.js'`
        if base.endswith(".js") or base.endswith(".jsx"):
            stem = os.path.splitext(base)[0]
            for ext in js_ts_exts:
                if f"{stem}{ext}" in available_files:
                    return f"{stem}{ext}", None
        # Try appending extensions
        for ext in js_ts_exts:
            if f"{base}{ext}" in available_files:
                return f"{base}{ext}", None
        # Try directory index files
        for ext in js_ts_exts:
            idx_candidate = f"{base}/index{ext}"
            if idx_candidate in available_files:
                return idx_candidate, None

    # If unresolved, determine whether it is a relative/local import or external npm package
    is_relative_or_alias = specifier.startswith((".", "/", "@/", "~/"))
    if is_relative_or_alias:
        return None, UnresolvedImportWarning(
            source_file=source_file,
            raw_import=specifier,
            reason=f"Relative/project import '{specifier}' could not be matched to any file in the uploaded archive.",
            is_external=False,
        )
    else:
        return None, UnresolvedImportWarning(
            source_file=source_file,
            raw_import=specifier,
            reason=f"External or bare module '{specifier}' (third-party package or runtime built-in; skipped in local file graph).",
            is_external=True,
        )


def analyze_zip_bytes(
    zip_bytes: bytes,
    project_name: str = "uploaded-project.zip",
    is_sample: bool = False,
) -> ProjectAnalysisResponse:
    """
    Validate and analyze a ZIP archive containing Java, JavaScript, and/or TypeScript files.
    Builds a deterministic directed dependency graph and project metadata.
    """
    if not zip_bytes:
        raise AnalysisError("Uploaded file is empty.", 400)
    if len(zip_bytes) > MAX_ZIP_SIZE_BYTES:
        raise AnalysisError(
            f"Archive size ({len(zip_bytes) / (1024 * 1024):.1f} MB) exceeds the 25 MB limit.",
            413,
        )

    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes), mode="r")
    except zipfile.BadZipFile:
        raise AnalysisError("Invalid or corrupted ZIP archive. Please upload a valid .zip file.", 400)

    raw_entries: Dict[str, bytes] = {}
    ignored_entries: List[str] = []

    with zf:
        info_list = zf.infolist()
        if len(info_list) > 2500:
            raise AnalysisError(
                f"Archive contains too many entries ({len(info_list)}). Maximum supported is 2,500 entries.",
                400,
            )

        for info in info_list:
            if info.is_dir():
                continue
            norm = normalize_zip_entry_path(info.filename)
            if not norm:
                continue

            parts = norm.split("/")
            # Skip hidden files or ignored directories
            if any(part in IGNORED_DIRS or (part.startswith(".") and part != ".gitignore") for part in parts):
                if len(ignored_entries) < 50:
                    ignored_entries.append(norm)
                continue

            if any(norm.lower().endswith(sfx) for sfx in IGNORED_FILE_SUFFIXES):
                if len(ignored_entries) < 50:
                    ignored_entries.append(norm)
                continue

            _, ext = os.path.splitext(norm.lower())
            if ext not in SUPPORTED_EXTENSIONS:
                if len(ignored_entries) < 50:
                    ignored_entries.append(norm)
                continue

            if info.file_size > MAX_SINGLE_FILE_BYTES:
                raise AnalysisError(
                    f"Source file '{norm}' exceeds the 1 MB single-file limit.",
                    400,
                )

            if len(raw_entries) >= MAX_EXTRACTED_FILES:
                raise AnalysisError(
                    f"Project contains more than the maximum {MAX_EXTRACTED_FILES} supported source files.",
                    400,
                )

            try:
                with zf.open(info.filename, mode="r") as entry_stream:
                    data = entry_stream.read(MAX_SINGLE_FILE_BYTES + 1)
            except (zipfile.BadZipFile, RuntimeError, EOFError, OSError) as exc:
                raise AnalysisError(
                    f"Could not extract '{norm}' from archive (corrupted or password-protected entry): {exc}",
                    400,
                )

            if len(data) > MAX_SINGLE_FILE_BYTES:
                raise AnalysisError(
                    f"Source file '{norm}' exceeds the 1 MB single-file limit.",
                    400,
                )

            raw_entries[norm] = data

    if not raw_entries:
        raise AnalysisError(
            "No supported source files (.java, .ts, .tsx, .js, .jsx) were found in the ZIP archive.",
            400,
        )

    # Strip common single wrapper directory if present
    path_map = strip_common_top_level_dir(list(raw_entries.keys()))
    source_contents: Dict[str, str] = {}
    clean_contents: Dict[str, str] = {}
    file_models: Dict[str, AnalyzedFile] = {}

    # Java indexing tables
    java_fqcn_to_path: Dict[str, str] = {}
    java_package_to_classes: Dict[str, Dict[str, str]] = {}  # pkg -> {ClassName: path}
    java_simple_name_to_paths: Dict[str, List[str]] = {}

    # JS/TS symbol re-export and CommonJS tracking
    js_ts_reexport_all: Dict[str, List[str]] = {}
    js_ts_dynamic_cjs: Dict[str, bool] = {}

    for orig_path, content_bytes in sorted(raw_entries.items(), key=lambda x: path_map[x[0]]):
        norm_path = path_map[orig_path]
        text = content_bytes.decode("utf-8", errors="replace")
        cleaned = strip_comments(text)
        source_contents[norm_path] = text
        clean_contents[norm_path] = cleaned

        filename = posixpath.basename(norm_path)
        stem, ext = os.path.splitext(filename)
        ext_lower = ext.lower()
        language = SUPPORTED_EXTENSIONS[ext_lower]
        lines = text.splitlines()
        preview = "\n".join(lines[:35])

        pkg_name: Optional[str] = None
        raw_imps: List[str] = []
        exported_syms: List[str] = []
        has_default_exp = False
        sym_imports: List[SymbolImportRef] = []

        if language == "java":
            pkg_name, raw_imps = extract_java_metadata(cleaned)
            exported_syms = [stem]
            if pkg_name:
                fqcn = f"{pkg_name}.{stem}"
                java_fqcn_to_path[fqcn] = norm_path
                java_package_to_classes.setdefault(pkg_name, {})[stem] = norm_path
            java_simple_name_to_paths.setdefault(stem, []).append(norm_path)
        else:
            raw_imps = extract_js_ts_imports(cleaned)
            exported_syms, has_default_exp, reexport_all_specs, is_dyn_cjs = extract_js_ts_exports(
                cleaned
            )
            sym_imports = extract_js_ts_symbol_imports(cleaned)
            js_ts_reexport_all[norm_path] = reexport_all_specs
            js_ts_dynamic_cjs[norm_path] = is_dyn_cjs

        file_models[norm_path] = AnalyzedFile(
            path=norm_path,
            name=filename,
            extension=ext_lower,
            language=language,  # type: ignore[arg-type]
            size_bytes=len(content_bytes),
            line_count=max(1, len(lines)),
            is_test=is_test_file(norm_path),
            package_name=pkg_name,
            imports=[],
            dependents=[],
            raw_imports=raw_imps,
            exported_symbols=sorted(exported_syms),
            has_default_export=has_default_exp,
            symbol_imports=sym_imports,
            preview_snippet=preview,
        )

    available_files = set(file_models.keys())
    unresolved_warnings: List[UnresolvedImportWarning] = []
    edges_set: Set[Tuple[str, str]] = set()

    # Resolve imports for each file
    for file_path, fmodel in file_models.items():
        resolved_targets: List[str] = []

        if fmodel.language in ("javascript", "typescript"):
            for spec in fmodel.raw_imports:
                target, warning = resolve_js_ts_import(file_path, spec, available_files)
                if target and target != file_path and target not in resolved_targets:
                    resolved_targets.append(target)
                    edges_set.add((file_path, target))
                elif warning is not None:
                    unresolved_warnings.append(warning)

        elif fmodel.language == "java":
            for imp in fmodel.raw_imports:
                if imp.endswith(".*"):
                    pkg_prefix = imp[:-2]
                    pkg_classes = java_package_to_classes.get(pkg_prefix, {})
                    if pkg_classes:
                        for cls_name, target_path in pkg_classes.items():
                            if target_path != file_path:
                                if re.search(rf"\b{re.escape(cls_name)}\b", clean_contents[file_path]):
                                    if target_path not in resolved_targets:
                                        resolved_targets.append(target_path)
                                        edges_set.add((file_path, target_path))
                    elif not imp.startswith(JAVA_STD_PREFIXES):
                        unresolved_warnings.append(
                            UnresolvedImportWarning(
                                source_file=file_path,
                                raw_import=imp,
                                reason=f"Wildcard package import '{imp}' did not match any package in the analyzed project.",
                                is_external=False,
                            )
                        )
                    continue

                # Exact FQCN match
                target = java_fqcn_to_path.get(imp)
                if not target:
                    # Fallback: match by suffix path (e.g., com/acme/Foo.java) or unique simple class name
                    imp_rel_path = imp.replace(".", "/") + ".java"
                    suffix_matches = [p for p in available_files if p.endswith(imp_rel_path)]
                    if len(suffix_matches) == 1:
                        target = suffix_matches[0]
                    else:
                        # Static member import: com.pkg.ClassName.memberName
                        parts = imp.split(".")
                        if len(parts) >= 2:
                            parent_fqcn = ".".join(parts[:-1])
                            target = java_fqcn_to_path.get(parent_fqcn)

                if target:
                    if target != file_path and target not in resolved_targets:
                        resolved_targets.append(target)
                        edges_set.add((file_path, target))
                else:
                    is_ext = imp.startswith(JAVA_STD_PREFIXES)
                    unresolved_warnings.append(
                        UnresolvedImportWarning(
                            source_file=file_path,
                            raw_import=imp,
                            reason=(
                                f"Standard library or framework import '{imp}' (external to project)."
                                if is_ext
                                else f"Imported symbol '{imp}' could not be resolved to a .java source file in the archive."
                            ),
                            is_external=is_ext,
                        )
                    )

            # Same-package class reference resolution (Java classes in the same package do not require import statements)
            if fmodel.package_name and fmodel.package_name in java_package_to_classes:
                sibling_classes = java_package_to_classes[fmodel.package_name]
                for cls_name, sibling_path in sibling_classes.items():
                    if sibling_path != file_path and sibling_path not in resolved_targets:
                        if re.search(rf"\b{re.escape(cls_name)}\b", clean_contents[file_path]):
                            resolved_targets.append(sibling_path)
                            edges_set.add((file_path, sibling_path))

        fmodel.imports = sorted(resolved_targets)

    # Propagate `export * from './other'` wildcard re-exports across JS/TS files (cycle-safe fixed-point)
    resolved_reexport_targets: Dict[str, List[str]] = {}
    for file_path, specs in js_ts_reexport_all.items():
        targets: List[str] = []
        for spec in specs:
            target, _ = resolve_js_ts_import(file_path, spec, available_files)
            if target and target != file_path and target in file_models:
                targets.append(target)
        if targets:
            resolved_reexport_targets[file_path] = targets

    if resolved_reexport_targets:
        for _ in range(len(file_models)):
            changed = False
            for file_path, targets in resolved_reexport_targets.items():
                current_exports = set(file_models[file_path].exported_symbols)
                for target_path in targets:
                    for sym in file_models[target_path].exported_symbols:
                        if sym not in current_exports:
                            current_exports.add(sym)
                            changed = True
                if changed:
                    file_models[file_path].exported_symbols = sorted(current_exports)
            if not changed:
                break

    # Validate JS/TS symbol-level imports against resolved target module exports
    symbol_diagnostics: List[SymbolDiagnostic] = []
    for file_path, fmodel in sorted(file_models.items()):
        if fmodel.language not in ("javascript", "typescript"):
            continue

        for sym_ref in fmodel.symbol_imports:
            target_path, warning = resolve_js_ts_import(
                file_path, sym_ref.raw_module, available_files
            )
            if target_path and target_path in file_models:
                sym_ref.resolved_module = target_path
                target_model = file_models[target_path]

                if target_model.language in ("javascript", "typescript") and not js_ts_dynamic_cjs.get(
                    target_path, False
                ):
                    if sym_ref.import_kind == "named":
                        if sym_ref.imported_symbol not in target_model.exported_symbols:
                            sym_ref.is_valid = False
                            if target_model.exported_symbols:
                                avail_fmt = ", ".join(
                                    f"'{s}'" for s in target_model.exported_symbols
                                )
                                avail_clause = f"Available named exports in '{target_model.name}': {avail_fmt}."
                            else:
                                avail_clause = f"'{target_model.name}' does not export any named symbols."

                            symbol_diagnostics.append(
                                SymbolDiagnostic(
                                    importing_file=file_path,
                                    imported_symbol=sym_ref.imported_symbol,
                                    local_alias=(
                                        sym_ref.local_alias
                                        if sym_ref.local_alias != sym_ref.imported_symbol
                                        else None
                                    ),
                                    source_module=target_path,
                                    raw_module_specifier=sym_ref.raw_module,
                                    issue_type="missing_named_export",
                                    available_exports=list(target_model.exported_symbols),
                                    reason=(
                                        f"'{file_path}' imports named symbol '{sym_ref.imported_symbol}' "
                                        f"from '{target_path}' ('{sym_ref.raw_module}'), but '{target_model.name}' "
                                        f"does not export '{sym_ref.imported_symbol}'. {avail_clause}"
                                    ),
                                )
                            )
                    elif sym_ref.import_kind == "default":
                        if not target_model.has_default_export:
                            sym_ref.is_valid = False
                            if target_model.exported_symbols:
                                avail_fmt = ", ".join(
                                    f"'{s}'" for s in target_model.exported_symbols
                                )
                                avail_clause = f"Available named exports in '{target_model.name}': {avail_fmt}."
                            else:
                                avail_clause = f"'{target_model.name}' does not declare any exports."

                            symbol_diagnostics.append(
                                SymbolDiagnostic(
                                    importing_file=file_path,
                                    imported_symbol="default",
                                    local_alias=sym_ref.local_alias,
                                    source_module=target_path,
                                    raw_module_specifier=sym_ref.raw_module,
                                    issue_type="missing_default_export",
                                    available_exports=list(target_model.exported_symbols),
                                    reason=(
                                        f"'{file_path}' imports default export '{sym_ref.local_alias}' "
                                        f"from '{target_path}' ('{sym_ref.raw_module}'), but '{target_model.name}' "
                                        f"does not declare a default export. {avail_clause}"
                                    ),
                                )
                            )
            else:
                # Target module could not be resolved — flag symbol import if it's a relative/local specifier
                if warning is not None and not warning.is_external:
                    sym_ref.is_valid = False
                    symbol_diagnostics.append(
                        SymbolDiagnostic(
                            importing_file=file_path,
                            imported_symbol=sym_ref.imported_symbol,
                            local_alias=(
                                sym_ref.local_alias
                                if sym_ref.local_alias != sym_ref.imported_symbol
                                else None
                            ),
                            source_module=sym_ref.raw_module,
                            raw_module_specifier=sym_ref.raw_module,
                            issue_type="unresolved_module",
                            available_exports=[],
                            reason=(
                                f"'{file_path}' imports symbol '{sym_ref.imported_symbol}' "
                                f"from '{sym_ref.raw_module}', but module '{sym_ref.raw_module}' "
                                f"could not be resolved to any file in the project."
                            ),
                        )
                    )

    # Populate reverse dependents list on each file model
    for src, dst in sorted(edges_set):
        if src not in file_models[dst].dependents:
            file_models[dst].dependents.append(src)

    for fmodel in file_models.values():
        fmodel.dependents.sort()

    # Build graph nodes and edges
    nodes: List[GraphNode] = []
    for path, fmodel in sorted(file_models.items()):
        nodes.append(
            GraphNode(
                id=path,
                label=fmodel.name,
                language=fmodel.language,
                is_test=fmodel.is_test,
                directory=posixpath.dirname(path) or ".",
                in_degree=len(fmodel.dependents),
                out_degree=len(fmodel.imports),
            )
        )

    edges: List[DependencyEdge] = [
        DependencyEdge(
            id=f"e:{src}->{dst}",
            source=src,
            target=dst,
            relationship="imports",
        )
        for src, dst in sorted(edges_set)
    ]

    project_id = f"proj-{uuid.uuid4().hex[:10]}"
    languages_present = sorted({f.language for f in file_models.values()})
    most_depended: Optional[str] = None
    if file_models:
        top_file = max(file_models.values(), key=lambda f: (len(f.dependents), -len(f.imports)))
        if len(top_file.dependents) > 0:
            most_depended = top_file.path

    # Prioritize non-external unresolved warnings first, then external ones
    unresolved_warnings.sort(key=lambda w: (w.is_external, w.source_file, w.raw_import))
    symbol_diagnostics.sort(key=lambda d: (d.importing_file, d.source_module, d.imported_symbol))

    summary = ProjectSummary(
        project_id=project_id,
        project_name=project_name,
        is_sample=is_sample,
        created_at=datetime.now(timezone.utc).isoformat(),
        total_files=len(file_models),
        total_dependencies=len(edges),
        test_files_count=sum(1 for f in file_models.values() if f.is_test),
        languages=languages_present,
        unresolved_warnings_count=sum(1 for w in unresolved_warnings if not w.is_external),
        symbol_diagnostics_count=len(symbol_diagnostics),
        ignored_files_count=len(ignored_entries),
        most_depended_on_file=most_depended,
    )

    graph = GraphResponse(
        project_id=project_id,
        project_name=project_name,
        nodes=nodes,
        edges=edges,
    )

    return ProjectAnalysisResponse(
        summary=summary,
        files=list(file_models.values()),
        graph=graph,
        unresolved_warnings=unresolved_warnings,
        symbol_diagnostics=symbol_diagnostics,
        ignored_entries=ignored_entries,
    )


def compute_file_impact(
    analysis: ProjectAnalysisResponse,
    changed_file_path: str,
) -> ImpactReportResponse:
    """
    Traverse reverse dependency edges starting from `changed_file_path` using BFS.
    If A imports B (edge A -> B), changing B affects A (reverse hop B -> A).
    Handles cycles safely without infinite loops, and attaches symbol-level import/export
    validation diagnostics to distinguish file-level coupling from broken symbol references.
    """
    file_map: Dict[str, AnalyzedFile] = {f.path: f for f in analysis.files}

    # Allow matching either exact path or normalized slash path
    normalized_input = changed_file_path.replace("\\", "/").strip()
    if normalized_input not in file_map:
        raise AnalysisError(
            f"File '{changed_file_path}' does not exist in project '{analysis.summary.project_name}'.",
            404,
        )

    selected_file = file_map[normalized_input]

    # BFS over `.dependents` (reverse edges: B -> A where A imports B)
    queue: deque[Tuple[str, List[str]]] = deque([(normalized_input, [normalized_input])])
    visited_paths: Dict[str, List[str]] = {normalized_input: [normalized_input]}
    cycles_found: List[List[str]] = []

    while queue:
        current, path_so_far = queue.popleft()
        current_model = file_map[current]

        for dep_path in current_model.dependents:
            if dep_path in path_so_far:
                # Cycle detected! Record the cycle path and do not re-enqueue
                cycle_start_idx = path_so_far.index(dep_path)
                cycle_chain = path_so_far[cycle_start_idx:] + [dep_path]
                if cycle_chain not in cycles_found:
                    cycles_found.append(cycle_chain)
                continue

            if dep_path not in visited_paths:
                next_chain = path_so_far + [dep_path]
                visited_paths[dep_path] = next_chain
                queue.append((dep_path, next_chain))

    direct_dependents: List[AffectedFileDetail] = []
    indirect_dependents: List[AffectedFileDetail] = []

    for target_path, chain in visited_paths.items():
        if target_path == normalized_input:
            continue
        hop_distance = len(chain) - 1
        target_model = file_map[target_path]
        short_chain_names = [posixpath.basename(p) for p in chain]
        upstream_module = chain[-2]

        # Collect symbol imports and diagnostics for this dependent relative to its dependency along the chain
        matching_sym_refs = [
            s
            for s in target_model.symbol_imports
            if s.resolved_module in (normalized_input, upstream_module)
        ]
        imported_syms: List[str] = []
        missing_syms: List[str] = []
        for s in matching_sym_refs:
            label = (
                s.imported_symbol
                if s.import_kind != "default"
                else f"default (as {s.local_alias})"
            )
            if label not in imported_syms:
                imported_syms.append(label)
            if not s.is_valid and label not in missing_syms:
                missing_syms.append(label)

        dep_diagnostics = [
            d
            for d in analysis.symbol_diagnostics
            if d.importing_file == target_path
            and d.source_module in (normalized_input, upstream_module)
        ]

        if hop_distance == 1:
            if dep_diagnostics:
                broken_list = ", ".join(f"'{d.imported_symbol}'" for d in dep_diagnostics)
                avail_str = (
                    ", ".join(f"'{s}'" for s in selected_file.exported_symbols)
                    if selected_file.exported_symbols
                    else "none"
                )
                explanation = (
                    f"File-level dependency: '{target_model.name}' directly imports '{selected_file.name}'. "
                    f"Symbol-level validation: BROKEN EXPORT REFERENCE — '{target_model.name}' imports "
                    f"{broken_list} from '{selected_file.name}', which is not exported by '{selected_file.name}' "
                    f"(available exports: {avail_str})."
                )
            elif imported_syms:
                verified_list = ", ".join(f"'{s}'" for s in imported_syms)
                explanation = (
                    f"File-level dependency: '{target_model.name}' directly imports '{selected_file.name}'. "
                    f"Symbol-level validation: Verified imported symbol(s) {verified_list} are exported by '{selected_file.name}'. "
                    f"Changes to exported signatures, return types, or behavior in '{selected_file.name}' "
                    f"can immediately break compilation or runtime behavior in '{target_model.name}'."
                )
            else:
                explanation = (
                    f"'{target_model.name}' directly imports or references '{selected_file.name}'. "
                    f"Changes to exported signatures, return types, or behavior in '{selected_file.name}' "
                    f"can immediately break compilation or runtime behavior in '{target_model.name}'."
                )

            direct_dependents.append(
                AffectedFileDetail(
                    file_path=target_path,
                    file_name=target_model.name,
                    language=target_model.language,
                    impact_type="direct",
                    distance=1,
                    is_test=target_model.is_test,
                    dependency_path=chain,
                    imported_symbols=imported_syms,
                    missing_symbols=missing_syms,
                    symbol_diagnostics=dep_diagnostics,
                    explanation=explanation,
                )
            )
        else:
            intermediate_names = " -> ".join(f"'{n}'" for n in short_chain_names[1:-1])
            chain_formatted = " -> ".join(f"'{n}'" for n in short_chain_names)
            explanation = (
                f"'{target_model.name}' is transitively coupled ({hop_distance} hops away) via "
                f"{intermediate_names}. Behavioral or contract changes in '{selected_file.name}' "
                f"may propagate upstream through {chain_formatted}."
            )
            if dep_diagnostics:
                broken_list = ", ".join(f"'{d.imported_symbol}'" for d in dep_diagnostics)
                explanation += (
                    f" Symbol-level validation: BROKEN EXPORT REFERENCE — '{target_model.name}' "
                    f"imports missing symbol(s) {broken_list} from '{posixpath.basename(upstream_module)}'."
                )
            indirect_dependents.append(
                AffectedFileDetail(
                    file_path=target_path,
                    file_name=target_model.name,
                    language=target_model.language,
                    impact_type="indirect",
                    distance=hop_distance,
                    is_test=target_model.is_test,
                    dependency_path=chain,
                    imported_symbols=imported_syms,
                    missing_symbols=missing_syms,
                    symbol_diagnostics=dep_diagnostics,
                    explanation=explanation,
                )
            )

    direct_dependents.sort(key=lambda d: (d.is_test, d.file_path))
    indirect_dependents.sort(key=lambda d: (d.distance, d.is_test, d.file_path))

    # Collect all symbol diagnostics relevant to the selected file or its impact subgraph
    visited_set = set(visited_paths.keys())
    report_symbol_diagnostics: List[SymbolDiagnostic] = []
    for diag in analysis.symbol_diagnostics:
        if (
            diag.source_module == normalized_input
            or diag.importing_file == normalized_input
            or (diag.importing_file in visited_set and diag.source_module in visited_set)
        ):
            report_symbol_diagnostics.append(diag)

    total_project_files = len(analysis.files)
    other_files_count = max(0, total_project_files - 1)

    direct_prod_count = sum(1 for d in direct_dependents if not d.is_test)
    direct_test_count = sum(1 for d in direct_dependents if d.is_test)
    direct_total_count = len(direct_dependents)

    indirect_prod_count = sum(1 for d in indirect_dependents if not d.is_test)
    indirect_test_count = sum(1 for d in indirect_dependents if d.is_test)
    indirect_total_count = len(indirect_dependents)

    total_affected = direct_total_count + indirect_total_count
    affected_prod_count = direct_prod_count + indirect_prod_count
    affected_test_count = direct_test_count + indirect_test_count

    blast_radius_pct = (
        round((total_affected / other_files_count) * 100.0, 1)
        if other_files_count > 0
        else 0.0
    )

    suggested_tests = _suggest_tests_for_impact(
        selected_file=selected_file,
        direct_dependents=direct_dependents,
        indirect_dependents=indirect_dependents,
        all_files=file_map,
    )

    risk = _compute_risk_assessment(
        selected_file=selected_file,
        direct_dependents=direct_dependents,
        indirect_dependents=indirect_dependents,
        blast_radius_pct=blast_radius_pct,
        total_project_files=total_project_files,
        other_files_count=other_files_count,
        suggested_tests=suggested_tests,
        cycles_count=len(cycles_found),
        symbol_diagnostics=report_symbol_diagnostics,
    )

    limitations = [
        "Static import analysis detects compile-time and module-level references; it does not execute code or evaluate runtime reflection, dynamic dependency injection containers (e.g., Spring @Autowired without type imports), or REST API boundary calls between separate languages.",
        "Symbol-level export validation checks JavaScript/TypeScript ES module named and default imports against static export declarations (functions, classes, const/let/var, interfaces, types, enums, and re-exports); dynamically computed CommonJS exports or runtime property mutations cannot be statically verified.",
        "Passing all suggested tests reduces regression risk but does not mathematically guarantee the absence of logic bugs.",
        "Dynamic imports constructed with runtime string concatenation cannot be statically resolved.",
    ]

    return ImpactReportResponse(
        project_id=analysis.summary.project_id,
        project_name=analysis.summary.project_name,
        selected_file=selected_file,
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_project_files=total_project_files,
        other_project_files_count=other_files_count,
        direct_dependents=direct_dependents,
        indirect_dependents=indirect_dependents,
        direct_affected_count=direct_total_count,
        direct_production_count=direct_prod_count,
        direct_test_count=direct_test_count,
        indirect_affected_count=indirect_total_count,
        indirect_production_count=indirect_prod_count,
        indirect_test_count=indirect_test_count,
        total_affected_count=total_affected,
        affected_production_count=affected_prod_count,
        affected_test_count=affected_test_count,
        blast_radius_percent=blast_radius_pct,
        broken_symbol_references_count=len(report_symbol_diagnostics),
        symbol_diagnostics=report_symbol_diagnostics,
        risk=risk,
        suggested_tests=suggested_tests,
        cycle_detected=len(cycles_found) > 0,
        cycles_involving_file=cycles_found,
        limitations=limitations,
    )


def _suggest_tests_for_impact(
    selected_file: AnalyzedFile,
    direct_dependents: List[AffectedFileDetail],
    indirect_dependents: List[AffectedFileDetail],
    all_files: Dict[str, AnalyzedFile],
) -> List[SuggestedTest]:
    """Identify existing test files to run and suggest missing test suites."""
    suggestions: List[SuggestedTest] = []
    seen_test_paths: Set[str] = set()

    # 1. If the changed file itself is a test file
    if selected_file.is_test:
        suggestions.append(
            SuggestedTest(
                test_file=selected_file.path,
                recommended_name=selected_file.name,
                priority="High",
                reason="The modified file is itself a test suite; execute it directly to verify test integrity.",
                exists_in_project=True,
            )
        )
        seen_test_paths.add(selected_file.path)

    # 2. Existing test files that directly depend on the changed file
    for dep in direct_dependents:
        if dep.is_test and dep.file_path not in seen_test_paths:
            dep_chain_str = " -> ".join(f"'{posixpath.basename(p)}'" for p in dep.dependency_path)
            suggestions.append(
                SuggestedTest(
                    test_file=dep.file_path,
                    recommended_name=dep.file_name,
                    priority="High",
                    reason=f"Directly imports and tests '{selected_file.name}' (path: {dep_chain_str}).",
                    exists_in_project=True,
                )
            )
            seen_test_paths.add(dep.file_path)

    # 3. Existing test files that transitively depend on the changed file
    for dep in indirect_dependents:
        if dep.is_test and dep.file_path not in seen_test_paths:
            dep_chain_str = " -> ".join(f"'{posixpath.basename(p)}'" for p in dep.dependency_path)
            suggestions.append(
                SuggestedTest(
                    test_file=dep.file_path,
                    recommended_name=dep.file_name,
                    priority="Medium",
                    reason=f"Transitively exercises '{selected_file.name}' via {dep_chain_str}.",
                    exists_in_project=True,
                )
            )
            seen_test_paths.add(dep.file_path)

    # 4. Name-matched test files in the project (even if imports were mocked or indirect)
    stem, ext = os.path.splitext(selected_file.name)
    for path, fmodel in all_files.items():
        if fmodel.is_test and path not in seen_test_paths:
            if stem.lower() in fmodel.name.lower():
                suggestions.append(
                    SuggestedTest(
                        test_file=path,
                        recommended_name=fmodel.name,
                        priority="High",
                        reason=f"Matches naming convention for '{selected_file.name}'.",
                        exists_in_project=True,
                    )
                )
                seen_test_paths.add(path)

    # 5. If no direct existing test covers the changed file (and it's not a test file), recommend creating/running one
    has_direct_unit_test = any(
        s.exists_in_project and stem.lower() in s.recommended_name.lower() for s in suggestions
    )
    if not selected_file.is_test and not has_direct_unit_test:
        rec_name = f"{stem}Test.java" if selected_file.language == "java" else f"{stem}.test{ext}"
        suggestions.append(
            SuggestedTest(
                test_file=None,
                recommended_name=rec_name,
                priority="High",
                reason=f"No dedicated unit test file named '{rec_name}' was found in the project for '{selected_file.name}'. Consider adding unit tests covering its public methods.",
                exists_in_project=False,
            )
        )

    # 6. Check non-test direct dependents that lack their own test coverage
    for dep in direct_dependents:
        if not dep.is_test:
            dep_stem, dep_ext = os.path.splitext(dep.file_name)
            covered = any(dep_stem.lower() in s.recommended_name.lower() for s in suggestions)
            if not covered:
                rec_dep_test = f"{dep_stem}Test.java" if dep.language == "java" else f"{dep_stem}.test{dep_ext}"
                suggestions.append(
                    SuggestedTest(
                        test_file=None,
                        recommended_name=rec_dep_test,
                        priority="Medium",
                        reason=f"Direct dependent '{dep.file_name}' has no matching test file in the project; verify integration behavior between '{selected_file.name}' and '{dep.file_name}'.",
                        exists_in_project=False,
                    )
                )

    return suggestions


def _compute_risk_assessment(
    selected_file: AnalyzedFile,
    direct_dependents: List[AffectedFileDetail],
    indirect_dependents: List[AffectedFileDetail],
    blast_radius_pct: float,
    total_project_files: int,
    other_files_count: int,
    suggested_tests: List[SuggestedTest],
    cycles_count: int,
    symbol_diagnostics: Optional[List[SymbolDiagnostic]] = None,
) -> RiskAssessment:
    """Compute a transparent, deterministic risk score and breakdown."""
    diagnostics_list = symbol_diagnostics or []
    non_test_direct = [d for d in direct_dependents if not d.is_test]
    test_direct = [d for d in direct_dependents if d.is_test]
    non_test_indirect = [d for d in indirect_dependents if not d.is_test]
    test_indirect = [d for d in indirect_dependents if d.is_test]
    existing_tests = [t for t in suggested_tests if t.exists_in_project]

    total_direct = len(direct_dependents)
    total_indirect = len(indirect_dependents)
    total_affected = total_direct + total_indirect
    total_prod_affected = len(non_test_direct) + len(non_test_indirect)
    total_test_affected = len(test_direct) + len(test_indirect)

    score = 10  # Base score for any source change
    score += min(40, len(non_test_direct) * 14)
    score += min(25, len(non_test_indirect) * 7)

    if blast_radius_pct >= 50.0:
        score += 15
    elif blast_radius_pct >= 25.0:
        score += 8

    # Architectural role check
    lower_path = selected_file.path.lower()
    is_core_layer = any(
        token in lower_path
        for token in ("model", "entity", "repository", "schema", "core", "config", "auth", "database", "httpclient")
    )
    if is_core_layer and not selected_file.is_test:
        score += 12

    if not existing_tests and not selected_file.is_test:
        score += 10

    if cycles_count > 0:
        score += 10

    if selected_file.is_test and len(non_test_direct) == 0:
        score = min(score, 20)

    base_topology_score = max(5, min(100, score))

    # Deterministic symbol-breakage penalty (+12 points per broken symbol reference, capped at +24)
    symbol_penalty = min(24, len(diagnostics_list) * 12)
    score = max(5, min(100, base_topology_score + symbol_penalty))

    if score >= 60:
        level: Literal["Low", "Medium", "High"] = "High"
    elif score >= 32:
        level = "Medium"
    else:
        level = "Low"

    factors: List[RiskFactor] = [
        RiskFactor(
            label="Direct Dependents (1 Hop)",
            value=f"{total_direct} total ({len(non_test_direct)} prod, {len(test_direct)} test)",
            severity="high" if len(non_test_direct) >= 3 else ("medium" if len(non_test_direct) >= 1 else "low"),
            detail=(
                f"{total_direct} file(s) directly import '{selected_file.name}': "
                f"{len(non_test_direct)} production file(s) and {len(test_direct)} test file(s). "
                f"Risk scoring weights the {len(non_test_direct)} production dependent(s) so test suites do not inflate risk."
                if total_direct > 0
                else f"No production or test files directly import '{selected_file.name}'."
            ),
        ),
        RiskFactor(
            label="Indirect / Transitive Dependents (2+ Hops)",
            value=f"{total_indirect} total ({len(non_test_indirect)} prod, {len(test_indirect)} test)",
            severity="high" if len(non_test_indirect) >= 3 else ("medium" if len(non_test_indirect) >= 1 else "low"),
            detail=(
                f"{total_indirect} upstream file(s) are transitively affected: "
                f"{len(non_test_indirect)} production file(s) and {len(test_indirect)} test file(s). "
                f"Risk scoring weights the {len(non_test_indirect)} production dependent(s)."
                if total_indirect > 0
                else "No multi-hop transitive dependents detected."
            ),
        ),
        RiskFactor(
            label="Project Blast Radius",
            value=f"{blast_radius_pct}% ({total_affected} of {other_files_count} other files)",
            severity="high" if blast_radius_pct >= 45 else ("medium" if blast_radius_pct >= 20 else "low"),
            detail=(
                f"Modifying '{selected_file.name}' affects {total_affected} unique file(s) "
                f"({total_prod_affected} production, {total_test_affected} test) out of {other_files_count} other project files "
                f"({total_project_files} total analyzed project files minus the 1 selected file)."
            ),
        ),
        RiskFactor(
            label="Automated Test Coverage",
            value=f"{len(existing_tests)} existing test file(s)",
            severity="low" if len(existing_tests) >= 1 else "high",
            detail=(
                f"Found {len(existing_tests)} linked test file(s) in the project to validate regressions."
                if existing_tests
                else "No existing test files in the project directly or transitively cover this file."
            ),
        ),
    ]

    if is_core_layer and not selected_file.is_test:
        factors.append(
            RiskFactor(
                label="Architectural Layer",
                value="Core / Foundational Module",
                severity="medium",
                detail=f"'{selected_file.name}' resides in a foundational layer (model/repository/client/config) where contract changes frequently ripple upward.",
            )
        )

    if cycles_count > 0:
        factors.append(
            RiskFactor(
                label="Circular Dependencies",
                value=f"{cycles_count} cycle(s) detected",
                severity="high",
                detail="Circular dependency loops were detected and bounded during traversal; cyclic coupling increases regression risk.",
            )
        )

    if diagnostics_list:
        broken_pairs = ", ".join(
            f"'{d.imported_symbol}' in '{posixpath.basename(d.importing_file)}'"
            for d in diagnostics_list[:5]
        )
        factors.append(
            RiskFactor(
                label="Breaking Symbol References (Export Validation)",
                value=f"{len(diagnostics_list)} broken import(s) (+{symbol_penalty} risk pts)",
                severity="high",
                detail=(
                    f"Symbol-level validation detected {len(diagnostics_list)} broken symbol reference(s) "
                    f"({broken_pairs}). Risk score increased from {base_topology_score} (file-level dependency topology) "
                    f"by +{symbol_penalty} points (12 pts per broken reference, max +24) to {score}/100 because "
                    f"importing a missing export or unresolved module causes an immediate linkage or runtime error."
                ),
            )
        )
    elif selected_file.language in ("javascript", "typescript"):
        factors.append(
            RiskFactor(
                label="Symbol-Level Export Validation",
                value="0 broken references (+0 risk pts)",
                severity="low",
                detail=(
                    f"All named and default symbol imports referencing '{selected_file.name}' "
                    f"resolve to existing exports ({', '.join(f'{s!r}' for s in selected_file.exported_symbols) or 'none'})."
                ),
            )
        )

    summary = (
        f"{level} impact risk (score {score}/100): Changing '{selected_file.name}' directly affects "
        f"{total_direct} file(s) ({len(non_test_direct)} production, {len(test_direct)} test) and transitively reaches "
        f"{total_indirect} additional file(s) ({len(non_test_indirect)} production, {len(test_indirect)} test) — "
        f"{total_affected} unique affected file(s) out of {other_files_count} other project files "
        f"({total_project_files} total project files; {blast_radius_pct}% blast radius)."
    )
    if diagnostics_list:
        broken_pairs = ", ".join(
            f"'{d.imported_symbol}' in '{posixpath.basename(d.importing_file)}'"
            for d in diagnostics_list[:5]
        )
        summary += (
            f" Symbol-level validation detected {len(diagnostics_list)} breaking symbol reference(s) "
            f"({broken_pairs}), increasing the risk score from {base_topology_score} to {score}/100 (+{symbol_penalty} pts)."
        )

    return RiskAssessment(
        level=level,
        score=score,
        summary=summary,
        factors=factors,
    )

