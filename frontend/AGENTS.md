# Frontend — agent instructions

Hub: [../AGENTS.md](../AGENTS.md) (**Critical Rules** and **Do not assume** apply). API / URLs: [../docs/agents/api.md](../docs/agents/api.md). Tests: [../docs/agents/testing.md](../docs/agents/testing.md).

Update this file and the hub when frontend conventions change.

## Layout

| Path | Role |
|------|------|
| `app/` | Expo Router shell (`(tabs)/`, `login.tsx`, `_layout.tsx`) — routes are shared across tenants |
| `components/` | Shared UI; co-locate `*.test.tsx` |
| `components/ui/` | Shared primitives (`confirm-dialog.tsx` for themed confirmations) |
| `components/auth/` | Shared auth UI (`login-form.tsx`) |
| `contexts/` | `AuthContext` (tenant-scoped token + login) |
| `lib/tenant/` | Tenant registry, resolution, `TenantProvider`, `useTenant()` |
| `lib/tenant/theme/` | Theme types, defaults, `mergeTenantTheme()`, `TenantThemeProvider` |
| `lib/api/` | `client.ts` — `apiFetch`, `authenticatedFetch`, `apiV1`; `types.ts` — generated API DTOs |
| `lib/api/generated/` | ts-rs output from Rust — **do not hand-edit** (see `generated/README.md`) |
| `tenants/<id>/` | Tenant-owned screens, components, and `config.ts` |
| `constants/` | `theme.ts` — `defaultColors` / `Fonts`; `config.ts` — `API_BASE_URL` |

Use `@/` path alias (`tsconfig.json`).

**Convention:** code under `tenants/<id>/` is tenant-specific; everything else in `components/`, `contexts/`, and `lib/` (except `lib/tenant/`) is shared.

## Multi-tenant

- Each tenant exports a `TenantModule` from `tenants/<id>/config.ts` (mirrors backend `TenantMount`).
- Register hostnames and mount metadata in `lib/tenant/registry.ts`.
- `TenantProvider` resolves the active tenant at bootstrap (hostname on web, env on native) and configures the API client prefix.
- `useTenant()` exposes `tenant.displayName`, `tenant.screens.Home`, and `tenant.apiV1Prefix`.
- Local dev options: [../docs/development_faq.md](../docs/development_faq.md#multi-tenant-frontend-dev).

## Tenant theme and branding

Provider order: `TenantProvider` → `TenantThemeProvider` → `AuthProvider` (see `app/_layout.tsx`).

Optional `theme` block on `tenants/<id>/meta.ts` — all fields optional; unspecified values use app defaults from `lib/tenant/theme/defaults.ts`:

- **Colors:** `theme.light` / `theme.dark` partial overrides merged over `defaultColors`
- **Copy:** `theme.copy.loginSubtitle`, `theme.copy.homeTitleSuffix`
- **Assets:** `theme.assets.logo`, `theme.assets.headerImage` (`require()` tenant assets from `tenants/<id>/assets/` or shared `@/assets/images/`)
- **Header:** `theme.headerBackground` for parallax screens

**UI convention:** do not import `Colors` directly in components — use `useColorPalette()` or `useThemeColor()`. Use `useTenantBranding()` for copy and assets on tenant screens. For filled buttons using `palette.tint` as background, use `palette.onTint` for label text and spinners. Prefer `components/ui/confirm-dialog.tsx` over `Alert.alert` / `window.confirm` for user confirmations (themed, blurred backdrop, works on web).

Light/dark **mode** is resolved by `useColorScheme()` (`hooks/use-color-scheme.ts` / `.web.ts`). On web, browser `prefers-color-scheme` wins; React Native/OS is the fallback when the browser reports no preference. Native uses OS `Appearance` only.

| Hook | Use for |
|------|---------|
| `useColorPalette()` | Current scheme palette (`tint`, `onTint`, `background`, `text`, …) |
| `useThemeColor(props, name)` | Themed text/view color with optional per-mode overrides |
| `useTenantBranding()` | Resolved copy, assets, header background |
| `useNavigationTheme()` | React Navigation theme (primary = tenant tint) |

Tests: wrap UI under test with `TenantThemeTestProvider` + `defaultResolvedTheme` (or a merged theme from `mergeTenantTheme()`).

## API and auth

- Base URL and device notes: [../docs/agents/api.md](../docs/agents/api.md)
- `API_BASE_URL` — server origin (e.g. `http://localhost:3000` in dev, empty for same-origin prod)
- Build API paths with `apiV1('/documents')` from `@/lib/api/client` — prefix comes from the active tenant via `configureApiClient`
- Do not hard-code `/life-manager` or `/api/v1` in components
- `authenticatedFetch` from `@/lib/api/client` — not raw `fetch` with hard-coded hosts
- API DTO types: import from `@/lib/api/types` (generated from Rust via ts-rs)
- `useAuth()` from `@/contexts/AuthContext`; 401/403 → `handleUnauthorized`
- JWT tokens are stored per tenant (`auth_token:<tenant-id>`)

## Tests

- Vitest + Testing Library; mock `AuthContext` and `@/lib/api/client` (see existing `*.test.tsx`)
- Wrap components that call `useTenant()` or `useAuth()` with `TenantTestProvider` + `AuthProvider` as needed
- BDD-style names and Given/When/Then comments: [../docs/agents/testing.md](../docs/agents/testing.md)

```bash
cd frontend && npm ci && npm run test:run
npm run lint
```

## Workflow diagrams

Multi-step UI flows (auth → fetch → render, wizards, tenant resolution, etc.) follow the hub [**Definition of done**](../AGENTS.md#definition-of-done): add an ASCII UML sequence or activity diagram as a comment on the orchestrating component or hook. Canonical backend example: [`document_handler.rs`](../backend/libs/life-manager/src/infrastructure/document/document_handler.rs) (`create_document`).

## Examples

| Task | Files |
|------|--------|
| Tenant config | `tenants/life-manager/meta.ts` (hostnames, API prefix, optional `theme`) |
| Tenant theme merge | `lib/tenant/theme/merge-theme.ts`, `TenantThemeContext.tsx` |
| Shared login | `components/auth/login-form.tsx`, `app/login.tsx` |
| Tenant home screen | `tenants/life-manager/screens/HomeScreen.tsx` |
| List + tests | `tenants/life-manager/components/document-list.tsx`, `document-list.test.tsx` |
| Form + tests | `tenants/life-manager/components/document-create-form.tsx`, `document-create-form.test.tsx` |
| API client | `lib/api/client.ts` |
| Tenant resolution | `lib/tenant/resolve.ts`, `lib/tenant/TenantContext.tsx` |
