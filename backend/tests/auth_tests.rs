mod common;

use auth::infrastructure::auth_user_seeder::admin_user_uuid;
use crate::common::setup::{
    LoginRequest, build_auth_header, build_bearer_token_with_tenant, decode_token_tenant,
    decode_token_user_id, run_test_with_test_profile, run_test_with_test_profile_and_db_setup,
};
use axum_test::TestServer;
use reqwest::{ClientBuilder, Error, Response, StatusCode};
use serial_test::serial;
use tracing_test::traced_test;
use uuid::Uuid;

const AUTH_URL: &str = "/life-manager/api/v1/auth";

#[tokio::test]
#[serial]
#[traced_test]
async fn login_and_jwt_auth_good_credentials() {
    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        // Test JWT validation
        let res = match call_protected_endpoint(&server, &auth_header).await {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Protected Endpoint Response: {:?}", res);
        assert!(
            res.status().is_success(),
            "Response status was not successful: {}",
            res.error_for_status().unwrap_err()
        );
        let body = res.text().await.expect("Failed to read protected endpoint body");
        assert_eq!(body, format!("Hello {}", admin_user_uuid()));
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn bad_credentials_fail_login() {
    run_test_with_test_profile(|server: TestServer| async move {
        let res = match do_login(&server, "admin", "badpassword").await {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Response: {:?}", res);
        assert_unauthorized_login_response(res).await;
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_valid_login_when_decoding_token_then_tenant_is_life_manager() {
    run_test_with_test_profile(|server: TestServer| async move {
        // Given
        let auth_header = build_auth_header(&server).await;

        // When
        let tenant = decode_token_tenant(&auth_header);

        // Then
        assert_eq!(tenant, "life-manager");
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_valid_login_when_decoding_token_then_sub_is_admin_user_id() {
    run_test_with_test_profile(|server: TestServer| async move {
        // Given
        let auth_header = build_auth_header(&server).await;

        // When
        let user_id = decode_token_user_id(&auth_header);

        // Then
        assert_eq!(user_id, admin_user_uuid());
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn unknown_username_fail_login() {
    run_test_with_test_profile(|server: TestServer| async move {
        let res = match do_login(&server, "nobody", "password").await {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Response: {:?}", res);
        assert_unauthorized_login_response(res).await;
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn protected_endpoint_mismatched_tenant_fails_auth() {
    run_test_with_test_profile(|server: TestServer| async move {
        // Given a valid JWT signed with the wrong tenant claim
        let auth_header = build_bearer_token_with_tenant(Uuid::new_v4(), "wrong-tenant");

        // When
        let res = match call_protected_endpoint(&server, &auth_header).await {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };

        // Then
        tracing::info!("Protected Endpoint Response: {:?}", res);
        assert!(
            res.status().is_client_error(),
            "Response status was not a 4xx: {}",
            res.error_for_status().unwrap_err()
        );
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn protected_endpoint_bad_token_fails_auth() {
    run_test_with_test_profile(|server: TestServer| async move {
        let res = match call_protected_endpoint(&server, "badtoken").await {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Protected Endpoint Response: {:?}", res);
        assert!(
            res.status().is_client_error(),
            "Response status was not a 4xx: {}",
            res.error_for_status().unwrap_err()
        );
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn inactive_user_fail_login() {
    run_test_with_test_profile_and_db_setup(
        |pool| async move {
            auth::infrastructure::auth_user_seeder::ensure_default_admin_user(
                &pool,
                "life-manager",
            )
            .await;
            auth::test_support::set_user_active(&pool, "admin", false).await;
        },
        |server: TestServer| async move {
            let res = match do_login(&server, "admin", "password").await {
                Ok(response) => response,
                Err(e) => panic!("Failed to send request: {}", e),
            };
            assert_unauthorized_login_response(res).await;
        },
    )
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn wrong_tenant_principal_fail_login() {
    run_test_with_test_profile_and_db_setup(
        |pool| async move {
            auth::test_support::insert_auth_user(
                &pool,
                "other-user",
                "password",
                "other-tenant",
                true,
            )
            .await;
        },
        |server: TestServer| async move {
            let res = match do_login(&server, "other-user", "password").await {
                Ok(response) => response,
                Err(e) => panic!("Failed to send request: {}", e),
            };
            assert_unauthorized_login_response(res).await;
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

async fn do_login(server: &TestServer, username: &str, password: &str) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{}/login", AUTH_URL).as_str())
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
    client.post(url).json(&req).send().await
}

async fn call_protected_endpoint(
    server: &TestServer,
    auth_header: &str,
) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{}/protected", AUTH_URL).as_str())
        .expect("Failed to get server URL");
    let url = url_result.as_str();
    tracing::info!("URL: {}", url);
    let client = ClientBuilder::new()
        .build()
        .expect("Failed to build HTTP client");
    client
        .get(url)
        .header("Authorization", auth_header)
        .send()
        .await
}
