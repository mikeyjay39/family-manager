# Architecture

Overview of the Life Manager stack: backend workspace layout, HTTP routing, production deployment, and how dev/test/prod profiles differ.

## Backend workspace

The backend is a Cargo workspace. The **`mikeyjay-server`** binary crate wires Axum routes and depends on two library crates under **`backend/libs/`**. Integration tests live in **`backend/tests/`** and exercise the assembled app.

```mermaid
flowchart TB
  subgraph backend["backend/"]
    bin["mikeyjay-server (binary)\nsrc/lib.rs, src/main.rs"]
    subgraph libs["libs/"]
      host["server-host\nAppBootstrap, TenantMount"]
      auth["auth\nJWT login, auth middleware"]
      lm["life-manager tenant\nLifeManagerState, own DB pool"]
    end
    tests["tests/ (integration)"]
  end

  bin --> host
  bin --> lm
  lm --> host
  lm --> auth
  tests --> bin
  tests --> auth
  tests --> lm
```

| Crate | Role |
|-------|------|
| **`mikeyjay-server`** | HTTP server entrypoint; stateless top-level routes (`/api/health`, `/api/version`); mounts tenant routers |
| **`server-host`** | Composition-only `AppBootstrap` and `TenantMount` trait — not Axum state |
| **`auth`** | Authentication router and JWT helpers; mounted under `/life-manager/api/v1/auth` |
| **`life-manager`** | First tenant crate: domain logic, Diesel/SQLite, document API; owns `LifeManagerState` and DB pool |

Each tenant crate implements `TenantMount`, builds its own state (including DB pool and migrations), and registers `.with_state()` on its nested router only. The parent router has no global Axum state.

Diesel migrations and schema live in **`backend/libs/life-manager/`** (see **`backend/diesel.toml`**) and **`backend/libs/auth/`** (see **`backend/libs/auth/diesel.toml`**). Life-manager startup runs life-manager migrations on its pool; auth migrations run when `AuthStateBuilder` builds auth state for that tenant.

## HTTP routing

In production, browsers hit the **gateway** (nginx). The gateway forwards API traffic to the Rust server and static assets to the frontend container. In dev, the Expo app usually talks directly to the backend on **`APP_PORT`**.

```mermaid
flowchart LR
  subgraph client["Client"]
    fe["Expo frontend\ntenant apiV1Prefix"]
  end

  subgraph gateway["nginx gateway (prod)"]
    loc1["/life-manager/api/*"]
    loc2["/api/health, /api/version"]
    loc3["/ → static frontend"]
  end

  subgraph server["mikeyjay-server (Axum)"]
    r1["/life-manager\nLifeManagerTenant::mount()"]
    r2["/api/v1\nauth + documents\n.with_state(LifeManagerState)"]
    r3["/api/health, /api/version\n(stateless top-level)"]
  end

  fe -->|"same-origin /life-manager/api/v1/..."| loc1
  loc1 --> r1 --> r2
  loc2 --> r3
```

### Route map

| Public path | Handler |
|-------------|---------|
| `/life-manager/api/v1/auth/login` | `auth` crate — login |
| `/life-manager/api/v1/documents` | `life-manager` — list / create documents |
| `/life-manager/api/v1/documents/{id}` | `life-manager` — get document by UUID |
| `/api/health` | Top-level — liveness |
| `/api/version` | Top-level — git commit |

The v1 API prefix is resolved at runtime from the active tenant module (`frontend/lib/tenant/` → `configureApiClient`). Ops endpoints stay at **`/api/*`** so health checks do not move when product APIs are namespaced.

## Production deployment

Compose **prod** profile runs three main app services, an **`alloy`** log shipper, and an optional OCR sidecar.

```mermaid
flowchart TB
  browser["Browser / mobile"]
  gateway["gateway (nginx)\n:NGINX_PORT"]
  frontend["frontend (static Expo web)\n:FRONTEND_PORT"]
  api["life-manager (Rust API)\n:APP_PORT"]
  db[("SQLite\nbackend/data")]
  ocr["tesseract (optional OCR)"]
  alloy["alloy (log shipper)"]
  grafanaCloud["Grafana Cloud Loki"]

  browser --> gateway
  gateway -->|"/"| frontend
  gateway -->|"/life-manager/api, /api"| api
  api --> db
  api -.->|"TESSERACT_ENABLED"| ocr
  gateway -->|"stdout"| alloy
  frontend -->|"stdout"| alloy
  api -->|"stdout"| alloy
  alloy -->|"HTTPS push"| grafanaCloud
```

Log UI is hosted by Grafana Cloud (14-day retention on free tier), not proxied through the gateway. Set **`GRAFANA_LOKI_URL`**, **`GRAFANA_LOKI_USERNAME`**, **`GRAFANA_CLOUD_API_KEY`**, and **`GRAFANA_LOKI_ENVIRONMENT`** in **`.prod.env`** (and **`.dev.env`** for local **docker-dev** testing). See [`README.md`](../README.md#grafana-cloud-logs-prod-and-docker-dev).

The **`alloy`** log shipper also runs under the **docker-dev** profile (same config; **`GRAFANA_LOKI_ENVIRONMENT=local`** in **`.dev.env`**).

The prod frontend build defaults to an empty **`EXPO_PUBLIC_API_BASE_URL`**, so the browser uses same-origin paths (via the gateway). Override with a full origin when the API is on another host (e.g. physical devices on the LAN).

See **`docker-compose.yml`** header comments and **`nginx/templates/default.conf.template`** for proxy rules.

### CI deploy to AWS (merge to `main`)

Workflow: [`.github/workflows/main.yml`](../.github/workflows/main.yml). Pull requests run tests only. A push to **`main`** runs tests, then builds and pushes each prod image to ECR only when its source tree changed (`backend/**`, `frontend/**`, `nginx/**`, `observability/**`); Lightsail deploy always runs after that job.

```mermaid
sequenceDiagram
  participant Dev as Developer
  participant GH as GitHubActions
  participant ECR as AmazonECR
  participant LS as Lightsail

  Dev->>GH: merge to main
  GH->>GH: frontend, backend, integration tests
  GH->>GH: paths-filter backend frontend nginx observability
  opt backend changed
    GH->>ECR: push life-manager-backend latest and sha
  end
  opt frontend changed
    GH->>ECR: push life-manager-frontend latest and sha
  end
  opt gateway changed
    GH->>ECR: push life-manager-gateway latest and sha
  end
  opt alloy changed
    GH->>ECR: push alloy latest and sha
  end
  GH->>LS: SSH git pull and deploy-prod-lightsail.sh
  LS->>ECR: docker compose pull prod images
  LS->>LS: docker compose up -d prod profile
  LS->>LS: force-recreate gateway no-deps
```

Image URLs are set in **`.prod.env`** at the repo root (`LIFE_MANAGER_*_IMAGE`). The deploy script is [`scripts/deploy-prod-lightsail.sh`](../scripts/deploy-prod-lightsail.sh). The gateway is always recreated after `up -d` so nginx re-resolves fresh upstream container IPs (avoids 502 when only backend/frontend images change).

## Dev, test, and prod profiles

**`build_and_start_app.sh`** and **`backend/start_backend.sh`** select a profile; each loads **`.<profile>.env`** at the repo root (**`docker-dev`** loads **`.dev.env`**).

```mermaid
flowchart TB
  subgraph dev["dev profile"]
    dev_be["Backend: cargo run on host\n:APP_PORT (3000)"]
    dev_fe["Frontend: npx expo start on host\n:8080"]
    dev_url["API URL: http://localhost:3000"]
    dev_be --- dev_fe
    dev_fe --> dev_url
  end

  subgraph dockerDev["docker-dev profile"]
    dd_compose["Compose: docker-dev profile"]
    dd_be["life_manager_dev\ncargo run + baked source"]
    dd_fe["frontend_dev\nExpo development target"]
    dd_env[".dev.env"]
    dd_compose --> dd_be
    dd_compose --> dd_fe
    dd_env --> dd_compose
    dd_fe -->|"EXPO_PUBLIC_API_BASE_URL"| dd_be
  end

  subgraph test["test profile"]
    test_be["Backend: cargo build only\n(no server started)"]
    test_fe["Frontend: Expo on host"]
    test_compose["Compose: none"]
  end

  subgraph prod["prod profile"]
    prod_gw["Entry: gateway :NGINX_PORT (80)"]
    prod_fe["frontend container (static)"]
    prod_be["life-manager container\n:APP_PORT"]
    prod_url["API URL: same origin as gateway\n(relative /life-manager/api/v1/...)"]
    prod_gw --> prod_fe
    prod_gw --> prod_be
    prod_fe --> prod_url
  end
```

| Profile | Backend | Frontend | Compose services | Typical API base |
|---------|---------|----------|------------------|------------------|
| **dev** | Host **`cargo run`** | Host Expo | *(none)* | `http://localhost:3000` |
| **docker-dev** | Container **`life_manager_dev`** | Container **`frontend_dev`** | `life_manager_dev`, `frontend_dev`, `alloy` | `http://localhost:3000` |
| **test** | **`cargo build`** only | Host Expo | *(none)* | N/A (integration tests spin up the app) |
| **prod** | Container **`life-manager`** | Container **`frontend`** via **`gateway`** | `life-manager`, `frontend`, `gateway`, `alloy` | Same origin as gateway (empty **`EXPO_PUBLIC_API_BASE_URL`**) |

More detail: [`README.md`](../README.md) (how to run), [`development_faq.md`](development_faq.md) (API URLs, mobile, TLS).
