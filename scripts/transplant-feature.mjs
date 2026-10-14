#!/usr/bin/env node
/**
 * scripts/transplant-feature.mjs
 * CLI runner for Cross-Repository Feature Transplanting (RFC 019).
 * Extracts full dependency closures, configs, and unit tests from a source project
 * and generates a structured porting manifest for a target project.
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: node scripts/transplant-feature.mjs [options]

Options:
  --source <project>      Source project name in codebase-memory-mcp
  --target <project>      Target project name in codebase-memory-mcp
  --feature <symbol>      Symbol or function name to transplant
  --list-projects         List all indexed projects and exit
  --mcp-url <url>         CBM Daemon HTTP URL (default: http://127.0.0.1:9749)
  --json                  Output raw JSON manifest
  --out <file>            Save manifest to specified markdown/JSON file
  --help, -h              Show this help message

Examples:
  node scripts/transplant-feature.mjs --list-projects
  node scripts/transplant-feature.mjs --source auth-service --target api-gateway --feature verify_token
`);
}

if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const mcpUrlIdx = args.indexOf("--mcp-url");
const mcpUrl = mcpUrlIdx !== -1 ? args[mcpUrlIdx + 1] : "http://127.0.0.1:9749";

const sourceIdx = args.indexOf("--source");
const sourceProject = sourceIdx !== -1 ? args[sourceIdx + 1] : null;

const targetIdx = args.indexOf("--target");
const targetProject = targetIdx !== -1 ? args[targetIdx + 1] : null;

const featureIdx = args.indexOf("--feature");
const featureName = featureIdx !== -1 ? args[featureIdx + 1] : null;

const isJson = args.includes("--json");
const outIdx = args.indexOf("--out");
const outFile = outIdx !== -1 ? args[outIdx + 1] : null;

async function callMcpTool(toolName, toolArgs) {
  // Try HTTP /rpc first
  try {
    const url = `${mcpUrl.replace(/\/$/, "")}/rpc`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: toolArgs },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.result || data;
    }
  } catch (err) {
    // Fall back to direct binary stdio invocation
    const { execSync } = await import("node:child_process");
    const exePath = path.join(process.env.LOCALAPPDATA || "", "Programs", "codebase-memory-mcp", "codebase-memory-mcp.exe");
    if (fs.existsSync(exePath)) {
      const input = JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: toolName, arguments: toolArgs }
      });
      const output = execSync(`"${exePath}"`, { input, encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
      const data = JSON.parse(output);
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      return data.result || data;
    }
    throw err;
  }
}

async function listProjects() {
  const res = await callMcpTool("list_projects", {});
  return res.projects || res;
}

async function main() {
  if (args.includes("--list-projects")) {
    try {
      const projects = await listProjects();
      if (isJson) {
        console.log(JSON.stringify(projects, null, 2));
      } else {
        console.log("\nIndexed Projects in Codebase Memory:");
        console.log("------------------------------------");
        if (Array.isArray(projects)) {
          for (const p of projects) {
            console.log(`- ${p.name || p} (path: ${p.path || "indexed"})`);
          }
        } else {
          console.log(JSON.stringify(projects, null, 2));
        }
        console.log("");
      }
      process.exit(0);
    } catch (err) {
      console.error(`Failed to list projects from ${mcpUrl}: ${err.message}`);
      process.exit(1);
    }
  }

  if (!sourceProject || !featureName) {
    console.error("Error: --source <project> and --feature <symbol> are required.");
    console.error("Run with --help for usage, or --list-projects to view available repositories.");
    process.exit(1);
  }

  console.log(`\n=== RFC 019: Feature Transplant Slicing ===`);
  console.log(`Source Project: ${sourceProject}`);
  console.log(`Target Project: ${targetProject || "(unspecified / analysis only)"}`);
  console.log(`Feature Symbol: ${featureName}\n`);

  const manifest = {
    feature: featureName,
    sourceProject,
    targetProject,
    timestamp: new Date().toISOString(),
    rootSymbols: [],
    dependencyClosure: [],
    envRequirements: [],
    testSuites: [],
    codeSlices: [],
  };

  function extractToolText(res) {
    if (!res) return "";
    if (typeof res === "string") return res;
    if (res.content && Array.isArray(res.content) && res.content[0] && res.content[0].text) {
      return res.content[0].text;
    }
    return JSON.stringify(res);
  }

  function parseToolOutput(res) {
    const text = extractToolText(res);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  try {
    // 1. Search graph for root symbol
    console.log(`[1/5] Searching for symbol "${featureName}" in project "${sourceProject}"...`);
    const searchRes = await callMcpTool("search_graph", {
      project: sourceProject,
      name_pattern: featureName,
      limit: 10,
    });

    const parsedSearch = parseToolOutput(searchRes);
    manifest.rootSymbols = Array.isArray(parsedSearch) ? parsedSearch : (parsedSearch.symbols || parsedSearch.nodes || [parsedSearch]);
    console.log(`      Candidate search result received.`);

    // 2. Outbound dependency trace
    console.log(`[2/5] Tracing transitive outbound dependency closure...`);
    try {
      const traceRes = await callMcpTool("trace_path", {
        project: sourceProject,
        function_name: featureName,
        direction: "outbound",
        depth: 3,
      });
      const parsedTrace = parseToolOutput(traceRes);
      manifest.dependencyClosure = Array.isArray(parsedTrace) ? parsedTrace : (parsedTrace.paths || parsedTrace.nodes || [parsedTrace]);
      console.log(`      Outbound dependency trace completed.`);
    } catch (e) {
      console.log(`      Note: trace_path outbound returned: ${e.message}`);
    }

    // 3. Environment & config variables
    console.log(`[3/5] Inspecting environment variable dependencies...`);
    try {
      const envRes = await callMcpTool("get_env_vars", {
        project: sourceProject,
      });
      const parsedEnv = parseToolOutput(envRes);
      manifest.envRequirements = Array.isArray(parsedEnv) ? parsedEnv : (parsedEnv.env_vars || parsedEnv.variables || [parsedEnv]);
      console.log(`      Environment variables checked.`);
    } catch (e) {
      console.log(`      Note: get_env_vars returned: ${e.message}`);
    }

    // 4. Test coverage & test suites
    console.log(`[4/5] Searching for covering unit tests in source project...`);
    try {
      const testRes = await callMcpTool("trace_path", {
        project: sourceProject,
        function_name: featureName,
        direction: "inbound",
        include_tests: true,
      });
      const parsedTest = parseToolOutput(testRes);
      manifest.testSuites = Array.isArray(parsedTest) ? parsedTest : (parsedTest.paths || parsedTest.nodes || [parsedTest]);
      console.log(`      Covering tests analyzed.`);
    } catch (e) {
      console.log(`      Note: inbound test search returned: ${e.message}`);
    }

    // 5. Code snippets for primary candidates
    console.log(`[5/5] Extracting exact AST source code slices...`);
    try {
      const snipRes = await callMcpTool("get_code_snippet", {
        project: sourceProject,
        qualified_name: featureName,
      });
      const snipText = extractToolText(snipRes);
      if (snipText) {
        manifest.codeSlices.push({
          symbol: featureName,
          code: snipText,
        });
      }
    } catch (e) {
      console.log(`      Note: snippet extraction returned: ${e.message}`);
    }
    console.log(`      Extracted ${manifest.codeSlices.length} primary code slice(s).`);

    // Output results
    if (isJson) {
      const jsonOut = JSON.stringify(manifest, null, 2);
      if (outFile) {
        fs.writeFileSync(outFile, jsonOut, "utf-8");
        console.log(`\nSaved manifest to ${outFile}`);
      } else {
        console.log(jsonOut);
      }
    } else {
      let md = `# Feature Transplant Manifest: \`${featureName}\`\n\n`;
      md += `- **Source Project:** ${sourceProject}\n`;
      md += `- **Target Project:** ${targetProject || "Unspecified"}\n`;
      md += `- **Candidate Symbols:** ${manifest.rootSymbols.length}\n`;
      md += `- **Closure Nodes:** ${manifest.dependencyClosure.length}\n`;
      md += `- **Covering Test Paths:** ${manifest.testSuites.length}\n\n`;

      if (manifest.codeSlices.length > 0) {
        md += `## Extracted AST Code Slices\n\n`;
        for (const s of manifest.codeSlices) {
          md += `### \`${s.symbol}\` (${s.file || "unknown file"})\n\`\`\`\n${s.code}\n\`\`\`\n\n`;
        }
      }

      if (outFile) {
        fs.writeFileSync(outFile, md, "utf-8");
        console.log(`\nSaved markdown report to ${outFile}`);
      } else {
        console.log("\n" + md);
      }
    }
  } catch (err) {
    console.error(`Transplant analysis failed: ${err.message}`);
    process.exit(1);
  }
}

main();
