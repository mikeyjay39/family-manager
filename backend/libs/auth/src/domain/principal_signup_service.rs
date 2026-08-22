use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::{
    auth_password_hasher::AuthPasswordHasher,
    principal::{CreateUserError, PrincipalRepository},
    signup_request::{SignupRequest, SignupResponse},
    signup_service::SignupService,
};

const MIN_PASSWORD_LEN: usize = 8;

pub struct PrincipalSignupService {
    pub principal_repository: Arc<dyn PrincipalRepository>,
    pub password_hasher: Arc<dyn AuthPasswordHasher>,
    pub tenant: String,
}

fn validate_email(email: &str) -> Result<String, String> {
    let email = email.trim();
    if email.is_empty() {
        return Err("Email is required.".to_string());
    }

    let Some((local, domain)) = email.split_once('@') else {
        return Err("Enter a valid email address.".to_string());
    };

    if local.is_empty() || domain.is_empty() || !domain.contains('.') {
        return Err("Enter a valid email address.".to_string());
    }

    Ok(email.to_string())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < MIN_PASSWORD_LEN {
        return Err(format!(
            "Password must be at least {MIN_PASSWORD_LEN} characters."
        ));
    }
    Ok(())
}

#[async_trait]
impl SignupService for PrincipalSignupService {
    async fn signup(&self, signup_req: &SignupRequest) -> Result<SignupResponse, String> {
        let email = validate_email(&signup_req.email)?;
        validate_password(&signup_req.password)?;

        let password_hash = self.password_hasher.hash_password(&signup_req.password);

        self.principal_repository
            .create_user(&email, &password_hash, &self.tenant, false)
            .await
            .map_err(|err| match err {
                CreateUserError::DuplicateUsername => {
                    "An account with this email already exists.".to_string()
                }
                CreateUserError::Database => {
                    "Could not create account. Please try again later.".to_string()
                }
            })?;

        Ok(SignupResponse {
            message: "Account created. An administrator must activate your account before you can sign in.".to_string(),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use async_trait::async_trait;

    use crate::domain::{
        auth_password_hasher::AuthPasswordHasher,
        principal::{CreateUserError, Principal, PrincipalRepository},
    };

    use super::*;

    struct StubRepository {
        duplicate: bool,
        last_username: std::sync::Mutex<Option<String>>,
        last_active: std::sync::Mutex<Option<bool>>,
    }

    #[async_trait]
    impl PrincipalRepository for StubRepository {
        async fn get_principal(&self, _username: &str) -> Option<Box<dyn Principal>> {
            None
        }

        async fn create_user(
            &self,
            username: &str,
            _password_hash: &str,
            _tenant: &str,
            active: bool,
        ) -> Result<(), CreateUserError> {
            if self.duplicate {
                return Err(CreateUserError::DuplicateUsername);
            }
            *self.last_username.lock().unwrap() = Some(username.to_string());
            *self.last_active.lock().unwrap() = Some(active);
            Ok(())
        }
    }

    struct StubHasher;

    impl AuthPasswordHasher for StubHasher {
        fn hash_password(&self, _password: &str) -> String {
            "hashed".to_string()
        }

        fn verify_password(&self, _password: &str, _hashed_password: &str) -> bool {
            true
        }
    }

    fn given_service(duplicate: bool) -> PrincipalSignupService {
        PrincipalSignupService {
            principal_repository: Arc::new(StubRepository {
                duplicate,
                last_username: std::sync::Mutex::new(None),
                last_active: std::sync::Mutex::new(None),
            }),
            password_hasher: Arc::new(StubHasher),
            tenant: "life-manager".to_string(),
        }
    }

    #[tokio::test]
    async fn given_valid_signup_when_creating_user_then_returns_pending_message() {
        // Given
        let service = given_service(false);
        let req = SignupRequest {
            email: " user@example.com ".to_string(),
            password: "password123".to_string(),
        };

        // When
        let response = service.signup(&req).await.expect("Signup should succeed");

        // Then
        assert!(response.message.contains("activate"));
    }

    #[tokio::test]
    async fn given_duplicate_email_when_signing_up_then_returns_duplicate_error() {
        // Given
        let service = given_service(true);
        let req = SignupRequest {
            email: "user@example.com".to_string(),
            password: "password123".to_string(),
        };

        // When
        let result = service.signup(&req).await;

        // Then
        assert_eq!(
            result.err(),
            Some("An account with this email already exists.".to_string())
        );
    }

    #[tokio::test]
    async fn given_invalid_email_when_signing_up_then_returns_validation_error() {
        // Given
        let service = given_service(false);
        let req = SignupRequest {
            email: "not-an-email".to_string(),
            password: "password123".to_string(),
        };

        // When
        let result = service.signup(&req).await;

        // Then
        assert_eq!(result.err(), Some("Enter a valid email address.".to_string()));
    }

    #[tokio::test]
    async fn given_short_password_when_signing_up_then_returns_validation_error() {
        // Given
        let service = given_service(false);
        let req = SignupRequest {
            email: "user@example.com".to_string(),
            password: "short".to_string(),
        };

        // When
        let result = service.signup(&req).await;

        // Then
        assert_eq!(
            result.err(),
            Some("Password must be at least 8 characters.".to_string())
        );
    }
}
