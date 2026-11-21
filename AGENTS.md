<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- All price selection and money arithmetic live in `src/lib/pricing-engine.ts` as pure functions using integer paise; AI output never feeds arithmetic directly. Why: deterministic, testable pricing.
- Seed data (documents, terms, conflicts, invoice fixtures) lives in `src/data/`; visitor state lives only in localStorage via `src/lib/demo-store.tsx`. Why: no login or database by design.
- `src/lib/test-cases.ts` is the single source of expected fixture outcomes, shared by the in-app Test Results page and `src/lib/pricing-engine.test.ts`. Why: both must agree.
- The live AI read runs only in a server function (`src/lib/ai.functions.ts` → `ai.server.ts`); quote checks and comparison run in pure `src/lib/live-read.ts`. Why: keys stay server-side and validation is testable.
- The enterprise shell, demo account selection and role-aware navigation live in `src/components/app/app-shell.tsx`; workspace pages use TanStack routes and parent routes render `<Outlet />`. Why: consistent account-aware navigation without authentication or a database.
