import type { ImpactReportResponse } from '../types';

/**
 * Normalize a file path or identifier for display inside Markdown backticks.
 * Ensures forward slashes and strips any accidental surrounding quotes or backslashes.
 */
function normalizePath(pathStr: string): string {
  return pathStr.replace(/\\/g, '/').trim();
}

/**
 * Format a value as clean Markdown inline code (`value`).
 */
function inlineCode(value: string): string {
  const cleaned = normalizePath(value).replace(/`/g, '');
  return `\`${cleaned}\``;
}

/**
 * Convert single-quoted filenames/paths in prose (e.g. 'UserRepository.java')
 * into clean Markdown backticks (`UserRepository.java`) and remove any stray HTML entities.
 */
function formatProseForMarkdown(text: string): string {
  return text
    .replace(/&#x20;/gi, ' ')
    .replace(/(^|[\s(])'([A-Za-z0-9_./$*-]+)'(?=[\s.,;:!?)"]|$)/g, '$1`$2`')
    .trim();
}

export function generateMarkdownReport(report: ImpactReportResponse): string {
  const totalProjectFiles =
    report.total_project_files ??
    report.other_project_files_count + 1;
  const otherProjectFiles =
    report.other_project_files_count ??
    Math.max(1, totalProjectFiles - 1);

  const directTotal = report.direct_affected_count ?? report.direct_dependents.length;
  const directProd =
    report.direct_production_count ??
    report.direct_dependents.filter((d) => !d.is_test).length;
  const directTest =
    report.direct_test_count ??
    report.direct_dependents.filter((d) => d.is_test).length;

  const indirectTotal = report.indirect_affected_count ?? report.indirect_dependents.length;
  const indirectProd =
    report.indirect_production_count ??
    report.indirect_dependents.filter((d) => !d.is_test).length;
  const indirectTest =
    report.indirect_test_count ??
    report.indirect_dependents.filter((d) => d.is_test).length;

  const totalAffected = report.total_affected_count ?? directTotal + indirectTotal;
  const totalProdAffected = report.affected_production_count ?? directProd + indirectProd;
  const totalTestAffected = report.affected_test_count ?? directTest + indirectTest;

  const symbolDiagnostics = report.symbol_diagnostics ?? [];
  const brokenSymbolCount =
    report.broken_symbol_references_count ?? symbolDiagnostics.length;
  const exportedSymbols = report.selected_file.exported_symbols ?? [];
  const hasDefaultExport = report.selected_file.has_default_export ?? false;

  const selectedRole = report.selected_file.is_test ? 'Test Suite' : 'Production Source File';

  const lines: string[] = [
    '# Ripple — Static Code Impact Report',
    '',
    `- **Project**: ${inlineCode(report.project_name)} (${inlineCode(report.project_id)})`,
    `- **Selected Changed File**: ${inlineCode(report.selected_file.path)} (${selectedRole})`,
    `- **Language**: ${inlineCode(report.selected_file.language)}`,
    `- **Generated At (UTC)**: ${inlineCode(report.generated_at)}`,
    `- **Risk Level**: **${report.risk.level}** (Score: **${report.risk.score}/100**)`,
    `- **Total Unique Affected Files**: **${totalAffected}** (${totalProdAffected} production, ${totalTestAffected} test) out of **${otherProjectFiles}** other project files (**${report.blast_radius_percent}%** blast radius)`,
    `- **Symbol-Level Export Validation**: **${brokenSymbolCount}** broken symbol reference(s) detected`,
    '',
    '## 1. Executive Risk Summary & Count Breakdown',
    '',
    formatProseForMarkdown(report.risk.summary),
    '',
    '### Project & Impact Count Breakdown',
    '',
    '| Metric | Total Count | Production Files | Test Files | Definition |',
    '| :--- | :--- | :--- | :--- | :--- |',
    `| **Total Analyzed Project Files** | ${totalProjectFiles} | — | — | All supported source files extracted from archive |`,
    `| **Selected Changed File** | 1 | ${report.selected_file.is_test ? 0 : 1} | ${report.selected_file.is_test ? 1 : 0} | ${inlineCode(report.selected_file.path)} |`,
    `| **Other Project Files (Denominator)** | ${otherProjectFiles} | — | — | ${totalProjectFiles} total files minus the 1 selected file |`,
    `| **Directly Affected Files (1 Hop)** | ${directTotal} | ${directProd} | ${directTest} | Files that directly import ${inlineCode(report.selected_file.name)} (file-level dependency) |`,
    `| **Indirectly Affected Files (2+ Hops)** | ${indirectTotal} | ${indirectProd} | ${indirectTest} | Files transitively coupled via intermediate modules |`,
    `| **Total Unique Affected Files** | **${totalAffected}** | **${totalProdAffected}** | **${totalTestAffected}** | Disjoint union of direct + indirect dependents (${report.blast_radius_percent}% of ${otherProjectFiles} other files) |`,
    `| **Broken Symbol References** | **${brokenSymbolCount}** | — | — | Imported symbols missing from their resolved target module (symbol-level validation) |`,
    '',
    '### Risk Heuristic Factors',
    '',
  ];

  for (const factor of report.risk.factors) {
    lines.push(
      `- **${factor.label.trim()}** (${inlineCode(factor.value)} — *${factor.severity.toUpperCase()}*): ${formatProseForMarkdown(factor.detail)}`
    );
  }

  lines.push('');
  lines.push(`> **Methodology**: ${formatProseForMarkdown(report.risk.methodology_note)}`);
  lines.push('');

  if (
    report.selected_file.language === 'javascript' ||
    report.selected_file.language === 'typescript' ||
    symbolDiagnostics.length > 0
  ) {
    lines.push('### Symbol-Level Export & Import Validation');
    lines.push('');
    const exportListStr =
      exportedSymbols.length > 0
        ? exportedSymbols.map((s) => inlineCode(s)).join(', ')
        : '*none*';
    lines.push(
      `- **Exports Declared by ${inlineCode(report.selected_file.name)}**: Named exports: ${exportListStr}${hasDefaultExport ? ' (plus `default` export)' : ''}`
    );
    if (symbolDiagnostics.length === 0) {
      lines.push(
        `- **Validation Status**: All analyzed symbol imports referencing ${inlineCode(report.selected_file.name)} match its declared exports.`
      );
      lines.push('');
    } else {
      lines.push(
        `- **Validation Status**: **${symbolDiagnostics.length} breaking symbol reference(s)** detected across the impact chain:`
      );
      lines.push('');
      for (const diag of symbolDiagnostics) {
        lines.push(
          `  - **Importing File**: ${inlineCode(diag.importing_file)} | **Imported Symbol**: ${inlineCode(diag.imported_symbol)} | **Source Module**: ${inlineCode(diag.source_module)} (${inlineCode(diag.issue_type)})`
        );
        lines.push(`    - **Reason**: ${formatProseForMarkdown(diag.reason)}`);
      }
      lines.push('');
    }
  }

  lines.push(
    `## 2. Directly Affected Files (${directTotal} total: ${directProd} production, ${directTest} test)`
  );
  lines.push('');

  if (report.direct_dependents.length === 0) {
    lines.push(
      `*No files in the project directly import ${inlineCode(report.selected_file.name)}.*`
    );
    lines.push('');
  } else {
    for (const dep of report.direct_dependents) {
      const roleSuffix = dep.is_test ? ' (Test File)' : ' (Production File)';
      lines.push(`### ${inlineCode(dep.file_path)}${roleSuffix}`);
      lines.push('');
      const formattedChain = dep.dependency_path.map((p) => inlineCode(p)).join(' -> ');
      lines.push(`- **Category**: Direct Dependent (1 hop)${dep.is_test ? ' — Test Suite' : ' — Production Module'}`);
      lines.push(`- **Dependency Path**: ${formattedChain}`);
      if (dep.imported_symbols && dep.imported_symbols.length > 0) {
        lines.push(
          `- **Imported Symbols**: ${dep.imported_symbols.map((s) => inlineCode(s)).join(', ')}`
        );
      }
      if (dep.missing_symbols && dep.missing_symbols.length > 0) {
        lines.push(
          `- **Missing / Broken Symbols**: ${dep.missing_symbols.map((s) => inlineCode(s)).join(', ')} *(Symbol-level validation failure)*`
        );
      }
      lines.push(`- **Why Affected**: ${formatProseForMarkdown(dep.explanation)}`);
      lines.push('');
    }
  }

  lines.push(
    `## 3. Indirectly (Transitively) Affected Files (${indirectTotal} total: ${indirectProd} production, ${indirectTest} test)`
  );
  lines.push('');

  if (report.indirect_dependents.length === 0) {
    lines.push('*No transitive multi-hop dependents found.*');
    lines.push('');
  } else {
    for (const dep of report.indirect_dependents) {
      const roleSuffix = dep.is_test ? ' (Test File)' : ' (Production File)';
      lines.push(`### ${inlineCode(dep.file_path)} — ${dep.distance} hops${roleSuffix}`);
      lines.push('');
      const formattedChain = dep.dependency_path.map((p) => inlineCode(p)).join(' -> ');
      lines.push(`- **Category**: Indirect Dependent (${dep.distance} hops)${dep.is_test ? ' — Test Suite' : ' — Production Module'}`);
      lines.push(`- **Dependency Path**: ${formattedChain}`);
      if (dep.imported_symbols && dep.imported_symbols.length > 0) {
        lines.push(
          `- **Imported Symbols (Final Hop)**: ${dep.imported_symbols.map((s) => inlineCode(s)).join(', ')}`
        );
      }
      if (dep.missing_symbols && dep.missing_symbols.length > 0) {
        lines.push(
          `- **Missing / Broken Symbols**: ${dep.missing_symbols.map((s) => inlineCode(s)).join(', ')} *(Symbol-level validation failure)*`
        );
      }
      lines.push(`- **Why Affected**: ${formatProseForMarkdown(dep.explanation)}`);
      lines.push('');
    }
  }

  lines.push(`## 4. Suggested Verification Tests (${report.suggested_tests.length})`);
  lines.push('');

  if (report.suggested_tests.length === 0) {
    lines.push('*No test suggestions generated.*');
    lines.push('');
  } else {
    for (const test of report.suggested_tests) {
      const statusBadge = test.exists_in_project
        ? 'Existing Project Test'
        : 'Recommended New Test';
      const targetName = test.test_file || test.recommended_name;
      lines.push(
        `- **${test.priority} Priority** — ${inlineCode(targetName)} (${statusBadge})`
      );
      lines.push(`  - ${formatProseForMarkdown(test.reason)}`);
    }
    lines.push('');
  }

  if (report.cycle_detected) {
    lines.push('## 5. Circular Dependency Alert');
    lines.push('');
    lines.push('Circular dependency loops were detected and safely bounded during traversal:');
    for (const cyc of report.cycles_involving_file) {
      lines.push(`- ${cyc.map((p) => inlineCode(p)).join(' -> ')}`);
    }
    lines.push('');
  }

  lines.push('## Analysis Scope & Limitations');
  lines.push('');
  for (const lim of report.limitations) {
    lines.push(`- ${formatProseForMarkdown(lim)}`);
  }
  lines.push('');

  // Ensure zero trailing whitespace on any line so Markdown serializers never emit &#x20;
  return lines.map((line) => line.trimEnd()).join('\n');
}

export function generateJsonReport(report: ImpactReportResponse): string {
  return JSON.stringify(report, null, 2);
}

export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadReportAsMarkdown(report: ImpactReportResponse): void {
  const md = generateMarkdownReport(report);
  const safeFile = report.selected_file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  triggerFileDownload(md, `ripple-impact-${safeFile}.md`, 'text/markdown;charset=utf-8');
}

export function downloadReportAsJson(report: ImpactReportResponse): void {
  const json = generateJsonReport(report);
  const safeFile = report.selected_file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  triggerFileDownload(json, `ripple-impact-${safeFile}.json`, 'application/json;charset=utf-8');
}
