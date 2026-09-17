# Design audit — Web Interface Guidelines + DESIGN.md

Full-app review (14 pages, ~57 components). Legend: `[ ]` open · `[x]` fixed.
Batches: **B1** behavior/UX · **B2** accessibility · **B3** design-system & copy · **B4** infrastructure.

> Status: B1 and B2 done. B3 and B4 remain (Intl date/number helpers,
> design-system leftovers, infra pages like not-found/error).

## B1 — Behavior / UX

- [x] Runs filters not URL-synced — `runs-view.tsx:66-83` (status/agentId/search now in URL; verified active tab SSR)
- [x] Dashboard "Needs attention" links to `?status=failed,running` which matches no tab — now `?status=failed`
- [x] Failed fetches render empty states instead of errors (usePoll `error` ignored) — runs list, run detail, dashboard now show error + retry
- [x] Enter on a run row's Stop button also navigates (event bubbles) — rows are stretched links now
- [x] Stop run cancels without confirmation — both runs list and detail confirm
- [x] Disconnect social account without confirmation — now confirms
- [x] Unsaved edits discarded silently — edit-agent-sheet close guarded; create-agent phases still open (see below)
- [x] "Completed this week" shows all-time `stats.completed` × arbitrary `*4` bar — replaced with success rate
- [x] "Last refreshed 0 seconds ago" never updates — removed
- [x] StatCard `tone` prop has no effect — tone now applied to the icon
- [x] Run duration hardcoded seconds ("5400s") — uses formatDuration
- [x] Billing subscription status raw snake_case ("On_hold") — humanized labels
- [x] Pricing interval lost on sign-in redirect — URL-backed + redirect_url round-trip
- [x] Missing empty states when filters match nothing — integrations + templates
- [x] Category list silently capped at 14 — cap removed (scrollable tab strip)
- [ ] create-agent "Create another"/"View in My Agents" still discard ready-phase edits without warning

## B2 — Accessibility

- [x] Navigation via buttons/divs instead of links — all real `<Link>`s now
- [x] Stat cards keyboard-inaccessible — links with visible focus ring
- [x] Skip link + sticky-header overlap — root-layout skip link, `#main-content` on every page, global `scroll-padding-top`
- [x] Unlabeled controls — runs/integrations/my-agents search+selects, chat textarea+send, config-form schedule/time/frequency/day/date/skills/tools, create-agent composer+submit, icon-only buttons all labeled; inputs gained `name` + `autocomplete="off"`
- [x] Progress bars without accessible name — billing, dashboard, sidebar, wizard all labeled
- [x] Async updates announced — chat log `role="log"`, timeline, wizard step, integrations warning, create-agent status; auth form errors `role="alert"`
- [x] Clarification options — radio/checkbox semantics + `aria-checked`
- [x] TabsContent focus replacement ring
- [x] Heading order — AuthShell panel demoted, EmptyState h2, sr-only h1s in tab phases, markdown h1→h2 demotion
- [x] Disabled Disconnect explanation is visible copy ("Only sign-in method")

## B3 — Design system & copy

- [ ] `text-[10px]` below 11px floor — `agent-config-form.tsx:350`, `integrations-view.tsx:237,240`, `templates-view.tsx:89,108`
- [ ] Pill radius on controls — `agents-view.tsx:46-56` tabs, `pricing-plans.tsx:96` interval toggle
- [ ] `transition-all` — `app-header.tsx:120-121`, `pricing-plans.tsx:101`
- [ ] Theme wipe animates `top` (layout property) — `theme.tsx:92-95`; toggle non-interruptible `:44`
- [ ] Smooth scroll ignores reduced-motion — `create-agent.tsx:448`, `agent-chat.tsx:70`, `run-detail.tsx:172-180`
- [ ] Dashboard page Suspense skeleton doesn't match real grid — `dashboard/page.tsx:31-43`
- [ ] `date-fns` English formats instead of `Intl.*`; SSR timezone hydration risk — `lib/format.ts:12-30`, `dashboard-view.tsx:96,235,282`
- [ ] Raw currency/number formatting + missing `tabular-nums` — `pricing-plans.tsx:125,146,190,197`, `billing/page.tsx:159-161`, `app-sidebar.tsx:176-178`, `dashboard-view.tsx:253-267`, `auth-shell.tsx:47,52,57`, `runs-view.tsx:240-253`
- [ ] Pluralization "1 runs / 1 tools / 1 skills" — `agent-card.tsx:146`, `create-agent.tsx:323-325`
- [ ] Placeholders ending "."; straight apostrophes — `create-agent.tsx:395`, `better-auth-form.tsx:212`, `auth-error/page.tsx:18-62`
- [ ] Tab active `shadow-sm` on dark surfaces — `agents-view.tsx:49,56`

## B4 — Infrastructure

- [ ] No `not-found.tsx` (default Next 404)
- [ ] No `error.tsx` (root/dashboard) — no reset path on render errors
- [ ] No `theme-color` / `viewport.themeColor` — `app/layout.tsx`
- [ ] No `metadataBase` (OG/social URLs resolve to localhost)
- [ ] No `touch-action: manipulation`; no `-webkit-tap-highlight-color` — `globals.css:137`
- [ ] No `overscroll-behavior: contain` in dialog/sheet primitives — `ui/dialog.tsx`, `ui/sheet.tsx`
- [ ] `tool-icon.tsx:160-187` `<img>` without `width`/`height`
- [ ] Stale comment: `dashboard/layout.tsx:11` claims edge middleware; no `src/middleware.ts` exists

## Verified clean

PRM handled globally (`globals.css:210`, motion primitives, ThemeProvider) · focus rings via shadcn primitives · auth form labels associated ·
no zoom blocking · no paste blocking · no `autoFocus` · images on Next `<Image>` where it matters · empty states exist for primary lists.
