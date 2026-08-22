mod common;

use std::sync::{Arc, Mutex};

use auth::test_support;
use crate::common::setup::{
    LoginRequest, run_test_with_test_profile, run_test_with_test_profile_and_db_setup,
};
use axum_test::TestServer;
use reqwest::{ClientBuilder, Error, Response, StatusCode};
use serial_test::serial;
use tracing_test::traced_test;

const AUTH_URL: &str = "/life-manager/api/v1/auth";

#[derive(serde::Serialize)]
struct SignupRequest {
    email: String,
    password: String,
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_valid_signup_when_creating_user_then_login_fails_until_activated() {
    run_test_with_test_profile(|server: TestServer| async move {
        let email = "new-user@example.com";
        let password = "password123";

        let signup_res = do_signup(&server, email, password)
            .await
            .expect("Failed to send signup request");
        assert_eq!(signup_res.status(), StatusCode::CREATED);
        let body: serde_json::Value = signup_res.json().await.expect("signup JSON");
        assert!(body["message"]
            .as_str()
            .unwrap()
            .contains("activate"));

        let login_res = do_login(&server, email, password)
            .await
            .expect("Failed to send login request");
        assert_eq!(login_res.status(), StatusCode::UNAUTHORIZED);
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_inactive_signup_when_activated_then_login_succeeds() {
    let pool_holder: Arc<Mutex<Option<Arc<deadpool_diesel::sqlite::Pool>>>> =
        Arc::new(Mutex::new(None));
    let pool_holder_clone = pool_holder.clone();
    let email = "pending-user@example.com";
    let password = "password123";

    run_test_with_test_profile_and_db_setup(
        move |pool| async move {
            *pool_holder_clone.lock().unwrap() = Some(pool);
        },
        move |server: TestServer| async move {
            let signup_res = do_signup(&server, email, password)
                .await
                .expect("Failed to send signup request");
            assert_eq!(signup_res.status(), StatusCode::CREATED);

            let pool = pool_holder.lock().unwrap().clone().expect("pool should be set");
            test_support::set_user_active(&pool, email, true).await;

            let login_res = do_login(&server, email, password)
                .await
                .expect("Failed to send login request");
            assert!(login_res.status().is_success());
        },
    )
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_duplicate_email_when_signing_up_then_returns_validation_error() {
    run_test_with_test_profile(|server: TestServer| async move {
        let email = "duplicate@example.com";
        let password = "password123";

        let first = do_signup(&server, email, password)
            .await
            .expect("Failed to send signup request");
        assert_eq!(first.status(), StatusCode::CREATED);

        let second = do_signup(&server, email, password)
            .await
            .expect("Failed to send signup request");
        assert_eq!(second.status(), StatusCode::BAD_REQUEST);
        let body: serde_json::Value = second.json().await.expect("error JSON");
        assert_eq!(body["error"], "validation_error");
    })
    .await;
}

async fn do_signup(server: &TestServer, email: &str, password: &str) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{AUTH_URL}/signup").as_str())
        .expect("Failed to get server URL");
    let url = url_result.as_str();
    let req = SignupRequest {
        email: email.into(),
        password: password.into(),
    };
    let client = ClientBuilder::new()
        .build()
        .expect("Failed to build HTTP client");
    client.post(url).json(&req).send().await
}

async fn do_login(server: &TestServer, username: &str, password: &str) -> Result<Response, Error> {
    let url_result = server
        .server_url(format!("{AUTH_URL}/login").as_str())
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
