# SearchTheTrend Docs

Public documentation for the SearchTheTrend MCP server, published with [Mintlify](https://mintlify.com) at **docs.searchthetrend.com**.

## Local preview

```bash
npm i -g mint
mint dev
```

Opens a live-reload preview at `http://localhost:3000`.

## Structure

- `docs.json` — site config (nav, theme, logo).
- `index.mdx` — "Connect your AI" landing.
- `limits.mdx` — allowances, credits, giant-brand policy.
- `quickstart/*` — per-client setup (Claude, ChatGPT, Claude Code, Cursor, Gemini CLI).
- `tools/reference.mdx` — **generated**, do not hand-edit.
- `playbooks/index.mdx` — copy-paste prompt recipes.

## Regenerating the tools reference

`tools/reference.mdx` is generated from the live MCP catalog so it never drifts:

```bash
MCP_URL=https://searchthetrend.com/api/mcp MCP_KEY=stt_xxx node scripts/gen-tools.mjs
```

Re-run it (and commit the result) whenever a tool's name, description or parameters change.

## Deploy

Mintlify auto-deploys on every push to the default branch once the repo is connected in the Mintlify dashboard. Custom domain: add a `CNAME` for `docs` → `cname.vercel-dns.com` (Mintlify shows the exact target in Settings → Custom domain).
