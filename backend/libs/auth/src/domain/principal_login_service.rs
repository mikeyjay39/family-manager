use std::sync::Arc;

use async_trait::async_trait;

use crate::domain::{
    auth_password_hasher::AuthPasswordHasher,
    login_request::LoginRequest,
    login_service::{LoginResult, LoginService},
    principal::PrincipalRepository,
};

pub struct PrincipalLoginService {
    pub principal_repository: Arc<dyn PrincipalRepository>,
    pub password_hasher: Arc<dyn AuthPasswordHasher>,
}

#[async_trait]
impl LoginService for PrincipalLoginService {
    async fn login(&self, login_req: &LoginRequest) -> Result<LoginResult, String> {
        let principal = self
            .principal_repository
            .get_principal(&login_req.username)
            .await
            .ok_or_else(|| "User not found".to_string())?;

        if !(self
            .password_hasher
            .verify_password(&login_req.password, principal.password_hash()))
        {
            tracing::warn!(
                "Failed login attempt for user '{}': password mismatch",
                login_req.username
            );
            return Err("Password does not match".to_string());
        }

        Ok(LoginResult {
            user_id: principal.user_id().to_owned(),
            tenant: principal.tenant().to_owned(),
        })
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use uuid::Uuid;

    use crate::domain::{
        auth_password_hasher::AuthPasswordHasher,
        login_request::LoginRequest,
        principal::{Principal, PrincipalRepository},
    };

    use super::*;

    #[derive(Clone)]
    struct TestPrincipal {
        user_id: Uuid,
        tenant: String,
        password_hash: String,
    }

    impl Principal for TestPrincipal {
        fn user_id(&self) -> Uuid {
            self.user_id
        }

        fn tenant(&self) -> &str {
            &self.tenant
        }

        fn password_hash(&self) -> &str {
            &self.password_hash
        }
    }

    struct StubRepository {
        principal: Option<TestPrincipal>,
    }

    #[async_trait]
    impl PrincipalRepository for StubRepository {
        async fn get_principal(&self, _username: &str) -> Option<Box<dyn Principal>> {
            self.principal
                .as_ref()
                .map(|principal| Box::new(principal.clone()) as Box<dyn Principal>)
        }

        async fn create_user(
            &self,
            _username: &str,
            _password_hash: &str,
            _tenant: &str,
            _active: bool,
        ) -> Result<(), crate::domain::principal::CreateUserError> {
            Ok(())
        }
    }

    struct StubHasher {
        accept: bool,
    }

    impl AuthPasswordHasher for StubHasher {
        fn hash_password(&self, _password: &str) -> String {
            "stored-hash".to_string()
        }

        fn verify_password(&self, _password: &str, _hashed_password: &str) -> bool {
            self.accept
        }
    }

    fn given_service(
        principal: Option<TestPrincipal>,
        accept_password: bool,
    ) -> PrincipalLoginService {
        PrincipalLoginService {
            principal_repository: Arc::new(StubRepository { principal }),
            password_hasher: Arc::new(StubHasher {
                accept: accept_password,
            }),
        }
    }

    #[tokio::test]
    async fn given_valid_credentials_when_logging_in_then_returns_user_id_and_tenant() {
        // Given
        let user_id = Uuid::new_v4();
        let service = given_service(
            Some(TestPrincipal {
                user_id,
                tenant: "life-manager".to_string(),
                password_hash: "stored-hash".to_string(),
            }),
            true,
        );
        let login_req = LoginRequest {
            username: "admin".to_string(),
            password: "password".to_string(),
        };

        // When
        let result = service
            .login(&login_req)
            .await
            .expect("Login should succeed");

        // Then
        assert_eq!(result.user_id, user_id);
        assert_eq!(result.tenant, "life-manager");
    }

    #[tokio::test]
    async fn given_unknown_user_when_logging_in_then_returns_user_not_found() {
        // Given
        let service = given_service(None, true);
        let login_req = LoginRequest {
            username: "nobody".to_string(),
            password: "password".to_string(),
        };

        // When
        let result = service.login(&login_req).await;

        // Then
        assert_eq!(result.err(), Some("User not found".to_string()));
    }

    #[tokio::test]
    async fn given_wrong_password_when_logging_in_then_returns_password_mismatch() {
        // Given
        let service = given_service(
            Some(TestPrincipal {
                user_id: Uuid::new_v4(),
                tenant: "life-manager".to_string(),
                password_hash: "stored-hash".to_string(),
            }),
            false,
        );
        let login_req = LoginRequest {
            username: "admin".to_string(),
            password: "wrong".to_string(),
        };

        // When
        let result = service.login(&login_req).await;

        // Then
        assert_eq!(result.err(), Some("Password does not match".to_string()));
    }
}
