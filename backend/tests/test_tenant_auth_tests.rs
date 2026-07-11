mod common;

use auth::infrastructure::auth_user_seeder::admin_user_uuid;
use crate::common::setup::{
    LoginRequest, TEST_TENANT_AUTH_URL, build_auth_header_at, decode_token_tenant,
    run_test_with_both_tenants, run_test_with_both_tenants_and_db_setup,
};
use axum_test::TestServer;
use reqwest::{ClientBuilder, Error, Response, StatusCode};
use serial_test::serial;
use tracing_test::traced_test;

const LIFE_MANAGER_AUTH_URL: &str = "/life-manager/api/v1/auth";

#[tokio::test]
#[serial]
#[traced_test]
async fn given_test_tenant_login_when_decoding_token_then_tenant_is_test_tenant() {
    run_test_with_both_tenants(|server: TestServer| async move {
        let auth_header = build_auth_header_at(&server, TEST_TENANT_AUTH_URL).await;
        assert_eq!(decode_token_tenant(&auth_header), "test-tenant");
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_test_tenant_token_when_calling_protected_endpoint_then_succeeds() {
    run_test_with_both_tenants(|server: TestServer| async move {
        let auth_header = build_auth_header_at(&server, TEST_TENANT_AUTH_URL).await;
        let res = call_protected_endpoint(&server, TEST_TENANT_AUTH_URL, &auth_header)
            .await
            .expect("Failed to send request");
        assert!(res.status().is_success());
        let body = res.text().await.expect("Failed to read protected endpoint body");
        assert_eq!(body, format!("Hello {}", admin_user_uuid()));
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_life_manager_token_when_calling_test_tenant_protected_endpoint_then_fails() {
    run_test_with_both_tenants(|server: TestServer| async move {
        let auth_header = build_auth_header_at(&server, LIFE_MANAGER_AUTH_URL).await;
        let res = call_protected_endpoint(&server, TEST_TENANT_AUTH_URL, &auth_header)
            .await
            .expect("Failed to send request");
        assert!(res.status().is_client_error());
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_test_tenant_token_when_calling_life_manager_protected_endpoint_then_fails() {
    run_test_with_both_tenants(|server: TestServer| async move {
        let auth_header = build_auth_header_at(&server, TEST_TENANT_AUTH_URL).await;
        let res = call_protected_endpoint(&server, LIFE_MANAGER_AUTH_URL, &auth_header)
            .await
            .expect("Failed to send request");
        assert!(res.status().is_client_error());
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_user_only_in_test_tenant_db_when_logging_in_then_tenant_isolation_holds() {
    run_test_with_both_tenants_and_db_setup(
        |_life_manager_pool, test_tenant_pool| async move {
            auth::test_support::insert_auth_user(
                &test_tenant_pool,
                "pilot-user",
                "password",
                "test-tenant",
                true,
            )
            .await;
        },
        |server: TestServer| async move {
            let test_tenant_login =
                do_login(&server, TEST_TENANT_AUTH_URL, "pilot-user", "password")
                    .await
                    .expect("Failed to send request");
            assert!(test_tenant_login.status().is_success());

            let life_manager_login =
                do_login(&server, LIFE_MANAGER_AUTH_URL, "pilot-user", "password")
                    .await
                    .expect("Failed to send request");
            assert_unauthorized_login_response(life_manager_login).await;
        },
    )
    .await;
}

async fn assert_unauthorized_login_response(res: Response) {
    assert_eq!(
        res.status(),
        StatusCode::UNAUTHORIZED,
        "expected 401 Unauthorized, got {}",
        res.status()
    );

    let body: serde_json::Value = res
        .json()
        .await
        .expect("failed login response should be JSON");

    assert_eq!(body["error"], "unauthorized");
    assert_eq!(body["message"], "Unauthorized");
    assert!(
        body.get("token").is_none(),
        "error response must not contain a token"
    );
}

async fn do_login(
    server: &TestServer,
    auth_url: &str,
    username: &str,
    password: &str,
) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{}/login", auth_url).as_str())
        .expect("Failed to get server URL");
    let url = url_result.as_str();
    let req = LoginRequest {
        username: username.into(),
        password: password.into(),
    };
    let client = ClientBuilder::new()
        .build()
        .expect("Failed to build HTTP client");
    client.post(url).json(&req).send().await
}

async fn call_protected_endpoint(
    server: &TestServer,
    auth_url: &str,
    auth_header: &str,
) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{}/protected", auth_url).as_str())
        .expect("Failed to get server URL");
    let url = url_result.as_str();
    let client = ClientBuilder::new()
        .build()
        .expect("Failed to build HTTP client");
    client
        .get(url)
        .header("Authorization", auth_header)
        .send()
        .await
}
