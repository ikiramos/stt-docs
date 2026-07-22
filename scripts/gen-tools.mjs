// Generates tools/reference.mdx from the LIVE MCP tools/list catalog, so the
// docs can never drift from the server. Usage:
//   MCP_URL=https://searchthetrend.com/api/mcp MCP_KEY=stt_... node scripts/gen-tools.mjs
//   node scripts/gen-tools.mjs --from-file path/to/captured-response.txt
import { readFileSync, writeFileSync } from "node:fs";

const GROUPS = [
  { title: "Products", tools: ["search_products", "trending_products", "get_product", "get_product_sources", "get_product_history"] },
  { title: "Ads", tools: ["search_ads", "get_ad", "get_ad_reach_history"] },
  { title: "Brands", tools: ["get_brand", "search_brands", "get_domain_intel"] },
  { title: "Advertisers (Facebook pages)", tools: ["search_advertisers", "get_advertiser"] },
  { title: "Your account", tools: ["my_saved_products", "my_saved_ads"] },
  { title: "Actions (cost credits)", tools: ["request_brand_scan", "get_brand_scan_status"] },
];

async function loadCatalog() {
  const fileFlag = process.argv.indexOf("--from-file");
  let raw;
  if (fileFlag !== -1) {
    raw = readFileSync(process.argv[fileFlag + 1], "utf8");
  } else {
    const res = await fetch(process.env.MCP_URL ?? "https://searchthetrend.com/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${process.env.MCP_KEY}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    });
    raw = await res.text();
  }
  const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
  const parsed = JSON.parse(dataLine ? dataLine.slice(6) : raw);
  return parsed.result.tools;
}

function esc(s) {
  return String(s ?? "")
    // Soften the server's em-dashes into commas so the published docs don't
    // read as machine-written (house style: no em-dashes in prose).
    .replaceAll(" — ", ", ")
    .replaceAll("—", ", ")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\n", " ");
}

function paramRows(schema) {
  const props = schema?.properties ?? {};
  const required = new Set(schema?.required ?? []);
  return Object.entries(props).map(([name, p]) => {
    let type = p.type ?? "";
    if (p.enum) type = p.enum.map((v) => `\`${v}\``).join(" · ");
    if (type === "array") type = `array of ${p.items?.enum ? p.items.enum.map((v) => `\`${v}\``).join(" · ") : (p.items?.type ?? "any")}`;
    const bits = [];
    if (p.description) bits.push(esc(p.description));
    if (p.default !== undefined) bits.push(`Default: \`${p.default}\``);
    if (p.minimum !== undefined && p.maximum !== undefined && p.maximum < 9007199254740991) bits.push(`Range: ${p.minimum}–${p.maximum}`);
    return `| \`${name}\` | ${esc(type)} | ${required.has(name) ? "Yes" : "No"} | ${bits.join(". ") || "—"} |`;
  });
}

const tools = await loadCatalog();
const byName = new Map(tools.map((t) => [t.name, t]));

let mdx = `---
title: "Tools reference"
description: "Every tool your assistant can call, with parameters. Generated from the live server, always in sync."
---

All tools are **read-only** except the two under *Actions*, which spend account credits and always ask for confirmation. Results are compact JSON designed for AI context windows (list tools cap at 25 rows).

`;

for (const g of GROUPS) {
  mdx += `## ${g.title}\n\n`;
  for (const name of g.tools) {
    const t = byName.get(name);
    if (!t) continue;
    mdx += `### \`${name}\`\n\n${esc(t.description)}\n\n`;
    const rows = paramRows(t.inputSchema);
    if (rows.length > 0) {
      mdx += `| Parameter | Type | Required | Notes |\n|---|---|---|---|\n${rows.join("\n")}\n\n`;
    } else {
      mdx += `_No parameters._\n\n`;
    }
  }
}

const missing = tools.filter((t) => !GROUPS.some((g) => g.tools.includes(t.name)));
for (const t of missing) {
  mdx += `### \`${t.name}\`\n\n${esc(t.description)}\n\n`;
}

writeFileSync(new URL("../tools/reference.mdx", import.meta.url), mdx);
console.log(`reference.mdx written — ${tools.length} tools${missing.length ? ` (${missing.length} uncategorized: ${missing.map((t) => t.name).join(", ")})` : ""}`);
