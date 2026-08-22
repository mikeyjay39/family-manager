use axum::{Json, extract::State};
use backend_utils::app_result::ApiResult;
use backend_utils::{AppError, AppResponse};

use crate::AuthState;
use crate::domain::signup_request::{SignupRequest, SignupResponse};

/// Registers a new inactive user for the tenant mount.
/// +--------+     +-----------------------+     +---------------------+     +--------+
/// | Client |---->| PrincipalSignupService |---->| INSERT active=false |---->| 201    |
/// |        |     | (validate email/pw)    |     | tenant = mount      |     | message|
/// +--------+     +-----------------------+     +---------------------+     +--------+
pub async fn signup(
    State(auth_state): State<AuthState>,
    Json(req): Json<SignupRequest>,
) -> ApiResult<SignupResponse> {
    tracing::info!("Signup attempt for email: {}", req.email);

    let response = auth_state
        .use_cases
        .signup_service
        .signup(&req)
        .await
        .map_err(|msg| AppError::Validation(msg))?;

    AppResponse::created(response)
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Once};

    use axum::Json;

    use super::*;
    use crate::{
        AuthStateBuilder,
        domain::{
            principal::{CreateUserError, Principal, PrincipalRepository},
            principal_signup_service::PrincipalSignupService,
            signup_request::SignupRequest,
        },
        infrastructure::{
            argon_password_hasher::ArgonPasswordHasher,
            db::test_pool,
            principal_orm_collection::PrincipalOrmCollection,
        },
    };

    fn init_test_env() {
        static INIT: Once = Once::new();
        INIT.call_once(|| unsafe {
            std::env::set_var("JWT_SECRET", "test-secret");
            std::env::set_var("ADMIN_USERNAME", "admin");
            std::env::set_var("ADMIN_PASSWORD", "password");
        });
    }

    async fn given_auth_state(tenant: &str) -> AuthState {
        AuthStateBuilder::new()
            .build(tenant.to_string(), test_pool())
            .await
    }

    #[tokio::test]
    async fn given_valid_signup_when_creating_user_then_returns_created() {
        init_test_env();
        // Given
        let auth_state = given_auth_state("life-manager").await;
        let req = SignupRequest {
            email: "new-user@example.com".to_string(),
            password: "password123".to_string(),
        };

        // When
        let response = signup(State(auth_state), Json(req))
            .await
            .expect("Signup should succeed");

        // Then
        assert!(response.data.message.contains("activate"));
    }

    #[derive(Clone)]
    struct DuplicateRepository;

    #[async_trait::async_trait]
    impl PrincipalRepository for DuplicateRepository {
        async fn get_principal(&self, _username: &str) -> Option<Box<dyn Principal>> {
            None
        }

        async fn create_user(
            &self,
            _username: &str,
            _password_hash: &str,
            _tenant: &str,
            _active: bool,
        ) -> Result<(), CreateUserError> {
            Err(CreateUserError::DuplicateUsername)
        }
    }

    #[tokio::test]
    async fn given_duplicate_email_when_signing_up_then_returns_validation_error() {
        init_test_env();
        // Given
        let pool = test_pool();
        let auth_state = AuthState {
            use_cases: Arc::new(crate::application::auth_use_cases::AuthUseCases::new(
                Arc::new(crate::domain::principal_login_service::PrincipalLoginService {
                    principal_repository: Arc::new(PrincipalOrmCollection::new(pool.clone())),
                    password_hasher: Arc::new(ArgonPasswordHasher),
                }),
                Arc::new(PrincipalSignupService {
                    principal_repository: Arc::new(DuplicateRepository),
                    password_hasher: Arc::new(ArgonPasswordHasher),
                    tenant: "life-manager".to_string(),
                }),
                "life-manager".to_string(),
            )),
            pool,
        };
        let req = SignupRequest {
            email: "existing@example.com".to_string(),
            password: "password123".to_string(),
        };

        // When
        let result = signup(State(auth_state), Json(req)).await;

        // Then
        assert!(result.is_err());
    }
}
