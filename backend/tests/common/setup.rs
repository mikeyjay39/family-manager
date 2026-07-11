use std::{env::set_var, path::Path, sync::Arc, thread::sleep, time::Duration};

use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use time::{Duration as TimeDuration, OffsetDateTime};
use uuid::Uuid;

use axum_test::{TestServer, TestServerConfig, Transport};
use life_manager::{
    LifeManagerDeps, LifeManagerStateBuilder,
    infrastructure::db::{create_connection_pool_from_url, run_migrations},
};
use mikeyjay_server::{
    build_app_with_life_manager_state, build_app_with_tenant_states,
};
use reqwest::{Client, ClientBuilder};
use serde::{Deserialize, Serialize};
use tempfile::NamedTempFile;
use test_tenant::{TestTenantDeps, TestTenantStateBuilder};

use serde_json::json;
use wiremock::{
    Mock, MockServer, ResponseTemplate,
    matchers::{method, path},
};

use crate::common::docker::{docker_compose_down, start_docker_compose_dev_profile};

pub const LIFE_MANAGER_AUTH_URL: &str = "/life-manager/api/v1/auth";
pub const TEST_TENANT_AUTH_URL: &str = "/test-tenant/api/v1/auth";

#[derive(Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
}

#[derive(Serialize, Deserialize)]
struct TestClaims {
    sub: Uuid,
    exp: usize,
    tenant: String,
}

pub fn decode_token_tenant(token: &str) -> String {
    decode_token_claims(token).tenant
}

pub fn decode_token_user_id(token: &str) -> Uuid {
    decode_token_claims(token).sub
}

fn decode_token_claims(token: &str) -> TestClaims {
    let token = token.strip_prefix("Bearer ").unwrap_or(token);
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    decode::<TestClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .expect("Failed to decode token")
    .claims
}

pub fn build_bearer_token_with_tenant(user_id: Uuid, tenant: &str) -> String {
    let secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");
    let exp = OffsetDateTime::now_utc() + TimeDuration::hours(1);
    let claims = TestClaims {
        sub: user_id,
        exp: exp.unix_timestamp() as usize,
        tenant: tenant.to_string(),
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .expect("Failed to encode test token");
    format!("Bearer {token}")
}

/// Run test with all docker containers started via the repository root `docker-compose.yml`.
///
/// WARNING: This includes starting the Ollama container which is an expensive process. Very few
/// tests should use this setup function. Unless needing to explicitly test Ollama integration,
/// prefer using `run_test_with_test_profile` which omits the Ollama container.
#[allow(dead_code)]
pub async fn run_test_with_all_containers<F, Fut>(test: F)
where
    F: FnOnce(TestServer) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    tracing::info!("Starting beforeEach setup");
    // beforeEach
    start_docker_compose_dev_profile().await;

    // Create temp SQLite database file
    let temp_db = NamedTempFile::new().expect("Failed to create temp DB file");
    let db_path = temp_db.path().to_str().unwrap();
    let database_url = db_path.to_string();

    let server = build_app_server(&database_url).await;
    let url = server
        .server_address()
        .expect("Failed to get server address");

    // run test
    tracing::info!("Running test on url {url}");
    test(server).await;

    // afterEach (async cleanup)
    tracing::info!("Tests completed with all containers.");
    docker_compose_down();
}

pub async fn run_test_with_both_tenants<F, Fut>(test: F)
where
    F: FnOnce(TestServer) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    run_test_with_both_tenants_and_db_setup(|_lm_pool, _tt_pool| async {}, test).await;
}

pub async fn run_test_with_both_tenants_and_db_setup<Setup, SetupFut, F, Fut>(
    db_setup: Setup,
    test: F,
)
where
    Setup: FnOnce(
        Arc<deadpool_diesel::sqlite::Pool>,
        Arc<deadpool_diesel::sqlite::Pool>,
    ) -> SetupFut,
    SetupFut: std::future::Future<Output = ()>,
    F: FnOnce(TestServer) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    tracing::info!("Starting beforeEach setup for both tenants");

    let life_manager_db = NamedTempFile::new().expect("Failed to create temp DB file");
    let test_tenant_db = NamedTempFile::new().expect("Failed to create temp DB file");
    let life_manager_url = life_manager_db.path().to_str().unwrap().to_string();
    let test_tenant_url = test_tenant_db.path().to_str().unwrap().to_string();
    tracing::info!(
        "Created temp SQLite databases at {} and {}",
        life_manager_url,
        test_tenant_url
    );

    let test_env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.test.env");
    dotenv::from_filename(&test_env_path).ok();

    let ollama: MockServer = mock_ollama_response().await;

    unsafe {
        set_var("OLLAMA_URL", ollama.uri());
        set_var("DATABASE_URL", &life_manager_url);
        set_var("TEST_TENANT_DATABASE_URL", &test_tenant_url);
    }

    let server =
        build_both_tenants_app_server_with_db_setup(&life_manager_url, &test_tenant_url, db_setup)
            .await;
    let url = server
        .server_address()
        .expect("Failed to get server address");

    tracing::info!("Running test on url {url}");
    test(server).await;

    tracing::info!("Tests completed with both tenants.");
    docker_compose_down();
}

pub async fn run_test_with_test_profile<F, Fut>(test: F)
where
    F: FnOnce(TestServer) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    run_test_with_test_profile_and_db_setup(|_pool| async {}, test).await;
}

pub async fn run_test_with_test_profile_and_db_setup<Setup, SetupFut, F, Fut>(
    db_setup: Setup,
    test: F,
)
where
    Setup: FnOnce(Arc<deadpool_diesel::sqlite::Pool>) -> SetupFut,
    SetupFut: std::future::Future<Output = ()>,
    F: FnOnce(TestServer) -> Fut,
    Fut: std::future::Future<Output = ()>,
{
    tracing::info!("Starting beforeEach setup");

    // Create temp SQLite database file
    let temp_db = NamedTempFile::new().expect("Failed to create temp DB file");
    let db_path = temp_db.path().to_str().unwrap();
    let database_url = db_path.to_string();
    tracing::info!("Created temp SQLite database at {}", db_path);

    let test_env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.test.env");
    dotenv::from_filename(&test_env_path).ok();

    let ollama: MockServer = mock_ollama_response().await;

    unsafe {
        set_var("OLLAMA_URL", ollama.uri());
        set_var("DATABASE_URL", &database_url);
    }

    let server = build_app_server_with_db_setup(&database_url, db_setup).await;
    let url = server
        .server_address()
        .expect("Failed to get server address");

    // run test
    tracing::info!("Running test on url {url}");
    test(server).await;

    // afterEach (async cleanup)
    // Temp file auto-deleted when temp_db goes out of scope
    tracing::info!("Tests completed with test profile.");
    docker_compose_down();
}

async fn mock_ollama_response() -> MockServer {
    let server = MockServer::start().await;

    let response = json!({
        "model": "llama2",
        "created_at": "2024-05-10T18:42:02.012Z",
        "response": "A friendly hello greeting\nhello world",
        "done": true
    });

    Mock::given(method("POST"))
        .and(path("/api/generate"))
        .respond_with(ResponseTemplate::new(200).set_body_json(response))
        .mount(&server)
        .await;

    tracing::info!("Mocked Ollama server at {}", server.uri());
    server
}

/// Build the application server with the given database URL
/// and runs migrations.
pub async fn build_app_server(url: &str) -> TestServer {
    build_app_server_with_db_setup(url, |_pool| async {}).await
}

pub async fn build_app_server_with_db_setup<Setup, SetupFut>(
    url: &str,
    db_setup: Setup,
) -> TestServer
where
    Setup: FnOnce(Arc<deadpool_diesel::sqlite::Pool>) -> SetupFut,
    SetupFut: std::future::Future<Output = ()>,
{
    tracing::info!("Creating SQLite connection pool...");

    let pool = create_connection_pool_from_url(url);
    let _conn = pool.get().await.expect("Failed to get DB connection");
    tracing::info!("Running migrations...");
    run_migrations(&pool).await;
    auth::infrastructure::db::run_migrations(&pool).await;
    let pool = Arc::new(pool);
    db_setup(pool.clone()).await;
    tracing::info!("Building backend app...");
    let state = LifeManagerStateBuilder::new()
        .build(LifeManagerDeps {
            db_pool: Some(pool),
            ..LifeManagerDeps::default()
        })
        .await;
    let app = build_app_with_life_manager_state(state).await;
    let config = TestServerConfig {
        transport: Some(Transport::HttpRandomPort),
        ..TestServerConfig::default()
    };

    let server = TestServer::new_with_config(app, config).expect("Failed to start test server");
    let health_url = server
        .server_url("/api/health")
        .expect("Failed to get server URL");

    wait_for_service_to_be_ready(health_url.as_str(), "Life Manager Backend").await;
    server
}

pub async fn build_both_tenants_app_server_with_db_setup<Setup, SetupFut>(
    life_manager_url: &str,
    test_tenant_url: &str,
    db_setup: Setup,
) -> TestServer
where
    Setup: FnOnce(
        Arc<deadpool_diesel::sqlite::Pool>,
        Arc<deadpool_diesel::sqlite::Pool>,
    ) -> SetupFut,
    SetupFut: std::future::Future<Output = ()>,
{
    tracing::info!("Creating SQLite connection pools for both tenants...");

    let life_manager_pool = create_connection_pool_from_url(life_manager_url);
    let _conn = life_manager_pool
        .get()
        .await
        .expect("Failed to get life-manager DB connection");
    run_migrations(&life_manager_pool).await;
    auth::infrastructure::db::run_migrations(&life_manager_pool).await;
    let life_manager_pool = Arc::new(life_manager_pool);

    let test_tenant_pool =
        test_tenant::infrastructure::db::create_connection_pool_from_url(test_tenant_url);
    let _conn = test_tenant_pool
        .get()
        .await
        .expect("Failed to get test-tenant DB connection");
    auth::infrastructure::db::run_migrations(&test_tenant_pool).await;
    let test_tenant_pool = Arc::new(test_tenant_pool);

    db_setup(life_manager_pool.clone(), test_tenant_pool.clone()).await;

    tracing::info!("Building backend app with both tenants...");
    let life_manager_state = LifeManagerStateBuilder::new()
        .build(LifeManagerDeps {
            db_pool: Some(life_manager_pool),
            ..LifeManagerDeps::default()
        })
        .await;
    let test_tenant_state = TestTenantStateBuilder::new()
        .build(TestTenantDeps {
            db_pool: Some(test_tenant_pool),
            ..TestTenantDeps::default()
        })
        .await;
    let app = build_app_with_tenant_states(life_manager_state, test_tenant_state).await;
    let config = TestServerConfig {
        transport: Some(Transport::HttpRandomPort),
        ..TestServerConfig::default()
    };

    let server = TestServer::new_with_config(app, config).expect("Failed to start test server");
    let health_url = server
        .server_url("/api/health")
        .expect("Failed to get server URL");

    wait_for_service_to_be_ready(health_url.as_str(), "Life Manager Backend").await;
    server
}

pub async fn wait_for_service_to_be_ready(url: &str, service_name: &str) {
    let client = Client::new();

    for attempt in 0..30 {
        if let Ok(resp) = client.get(url).send().await
            && resp.status().is_success()
        {
            tracing::info!("{} is ready!", service_name);
            return;
        }
        tracing::info!(
            "Attemp {} Waiting for {} to become ready...",
            attempt,
            service_name
        );
        sleep(Duration::from_secs(1));
    }

    panic!("{} did not become ready at {}", service_name, url);
}

pub async fn build_auth_header(server: &TestServer) -> String {
    build_auth_header_at(server, LIFE_MANAGER_AUTH_URL).await
}

pub async fn build_auth_header_at(server: &TestServer, auth_url: &str) -> String {
    let username = "admin";
    let password = "password";

    let url_result = server
        .server_url(format!("{}/login", auth_url).as_str())
        .expect("Failed to get server URL");

    let url = url_result.as_str();
    tracing::info!("URL: {}", url);
    let req = LoginRequest {
        username: username.into(),
        password: password.into(),
    };
    let client = ClientBuilder::new()
        .build()
        .expect("Failed to build HTTP client");
    let res = match client.post(url).json(&req).send().await {
        Ok(response) => response,
        Err(e) => panic!("Failed to send request: {}", e),
    };

    tracing::info!("Response: {:?}", res);
    assert!(
        res.status().is_success(),
        "Response status was not successful: {}",
        res.error_for_status().unwrap_err()
    );
    let login_response: LoginResponse = res.json().await.unwrap();
    assert_ne!(login_response.token.len(), 0);
    format!("Bearer {}", login_response.token)
}
