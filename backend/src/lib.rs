mod build_info;
use axum::{
    Router,
    body::Body,
    http::{Method, Request, header},
    routing::get,
};
use life_manager::{LifeManagerState, LifeManagerTenant};
use server_host::{AppBootstrap, TenantMount};
use test_tenant::{TestTenant, TestTenantState};
use std::env;
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing::Level;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
pub async fn start_server() {
    tracing::info!("Starting server");
    build_info::init();
    let app = build_app().await;

    // Define the address to run the server on
    let app_port = env::var("APP_PORT").expect("APP_PORT must be set");
    let addr = SocketAddr::from((
        [0, 0, 0, 0],
        app_port.parse().expect("Could not parse app_port"),
    ));
    tracing::info!("Tracing Listening on http://{}", addr);

    axum_server::bind(addr)
        .serve(app.into_make_service())
        .await
        .expect("Could not start axum_server")
}

pub async fn build_app() -> Router {
    let bootstrap = AppBootstrap::from_env();
    build_app_with_bootstrap(bootstrap).await
}

/// TODO: This is only used for int tests. Could we remove this and use build_app_with_bootstrap
/// with a test-specific bootstrap instead?
pub async fn build_app_with_life_manager_state(state: LifeManagerState) -> Router {
    let life_manager = LifeManagerTenant::mount_with_state(state);
    build_app_with_tenants(Some(life_manager), None).await
}

pub async fn build_app_with_test_tenant_state(state: TestTenantState) -> Router {
    let test_tenant = TestTenant::mount_with_state(state);
    build_app_with_tenants(None, Some(test_tenant)).await
}

pub async fn build_app_with_tenant_states(
    life_manager_state: LifeManagerState,
    test_tenant_state: TestTenantState,
) -> Router {
    let life_manager = LifeManagerTenant::mount_with_state(life_manager_state);
    let test_tenant = TestTenant::mount_with_state(test_tenant_state);
    build_app_with_tenants(Some(life_manager), Some(test_tenant)).await
}

async fn build_app_with_bootstrap(bootstrap: AppBootstrap) -> Router {
    let life_manager = LifeManagerTenant::mount(&bootstrap).await;
    let test_tenant = TestTenant::mount(&bootstrap).await;
    build_app_with_tenants(Some(life_manager), Some(test_tenant)).await
}

async fn build_app_with_tenants(
    life_manager: Option<Router>,
    test_tenant: Option<Router>,
) -> Router {
    tracing::info!("Building application...");

    // logging
    tracing_subscriber::registry()
        .with(
            fmt::layer()
                .json()
                .with_timer(tracing_subscriber::fmt::time::UtcTime::rfc_3339())
                .with_ansi(false),
        )
        .try_init()
        .ok();

    let mut app = Router::new()
        .route("/api/health", get(|| async { "up" }))
        .route("/api/version", get(|| async { build_info::git_commit() }));

    if let Some(life_manager) = life_manager {
        app = app.nest(LifeManagerTenant::MOUNT_PATH, life_manager);
    }
    if let Some(test_tenant) = test_tenant {
        app = app.nest(TestTenant::MOUNT_PATH, test_tenant);
    }

    app.layer(
            CorsLayer::new()
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
                .allow_origin(tower_http::cors::Any),
        )
        .layer(
            ServiceBuilder::new().layer(TraceLayer::new_for_http().make_span_with(
                |request: &Request<Body>| {
                    let trace_id = uuid::Uuid::new_v4();
                    let host = request
                        .headers()
                        .get(header::HOST)
                        .and_then(|v| v.to_str().ok())
                        .unwrap_or("-");
                    // Prefer gateway-set headers; fall back if the backend is hit directly.
                    let client_ip = request
                        .headers()
                        .get("x-real-ip")
                        .or_else(|| request.headers().get("x-forwarded-for"))
                        .and_then(|v| v.to_str().ok())
                        .map(|s| s.split(',').next().unwrap_or(s).trim())
                        .unwrap_or("-");
                    tracing::span!(
                        Level::DEBUG,
                        "request",
                        method = tracing::field::display(request.method()),
                        uri = tracing::field::display(request.uri()),
                        version = tracing::field::debug(request.version()),
                        trace_id = tracing::field::display(trace_id),
                        host = tracing::field::display(host),
                        client_ip = tracing::field::display(client_ip),
                    )
                },
            )),
        )
}
