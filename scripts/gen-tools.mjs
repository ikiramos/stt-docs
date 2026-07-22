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

// Both locales share the generated tables; only the page frame is localized.
// Tool descriptions stay in English in BOTH (they come from the live server;
// the assistant reads them in English regardless of the user's language).
const LOCALES = [
  {
    out: "../tools/reference.mdx",
    title: "Tools reference",
    description: "Every tool your assistant can call, with parameters. Generated from the live server, always in sync.",
    intro:
      "All tools are **read-only** except the two under *Actions*, which spend account credits and always ask for confirmation. Results are compact JSON designed for AI context windows (list tools cap at 25 rows).",
    headers: "| Parameter | Type | Required | Notes |",
    noParams: "_No parameters._",
    groupTitles: {},
  },
  {
    out: "../es/tools/reference.mdx",
    title: "Referencia de tools",
    description: "Cada herramienta que tu asistente puede llamar, con sus parámetros. Generada desde el servidor en vivo, siempre sincronizada.",
    intro:
      "Todas las herramientas son de **solo lectura** salvo las dos de *Acciones*, que gastan créditos de la cuenta y siempre piden confirmación. Los resultados son JSON compacto pensado para ventanas de contexto de IA (las listas devuelven máximo 25 filas). Las descripciones se muestran en inglés: son las que lee tu asistente, generadas desde el servidor.",
    headers: "| Parámetro | Tipo | Obligatorio | Notas |",
    noParams: "_Sin parámetros._",
    groupTitles: {
      Products: "Productos",
      Ads: "Anuncios",
      Brands: "Marcas",
      "Advertisers (Facebook pages)": "Anunciantes (páginas de Facebook)",
      "Your account": "Tu cuenta",
      "Actions (cost credits)": "Acciones (cuestan créditos)",
    },
  },
];

const missing = tools.filter((t) => !GROUPS.some((g) => g.tools.includes(t.name)));

for (const loc of LOCALES) {
  let mdx = `---\ntitle: "${loc.title}"\ndescription: "${loc.description}"\n---\n\n${loc.intro}\n\n`;
  for (const g of GROUPS) {
    mdx += `## ${loc.groupTitles[g.title] ?? g.title}\n\n`;
    for (const name of g.tools) {
      const t = byName.get(name);
      if (!t) continue;
      mdx += `### \`${name}\`\n\n${esc(t.description)}\n\n`;
      const rows = paramRows(t.inputSchema);
      mdx += rows.length > 0 ? `${loc.headers}\n|---|---|---|---|\n${rows.join("\n")}\n\n` : `${loc.noParams}\n\n`;
    }
  }
  for (const t of missing) {
    mdx += `### \`${t.name}\`\n\n${esc(t.description)}\n\n`;
  }
  writeFileSync(new URL(loc.out, import.meta.url), mdx);
}
console.log(`reference.mdx written (en + es) — ${tools.length} tools${missing.length ? ` (${missing.length} uncategorized: ${missing.map((t) => t.name).join(", ")})` : ""}`);
