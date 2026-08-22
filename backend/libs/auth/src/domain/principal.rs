use async_trait::async_trait;
use uuid::Uuid;

/**
 * Represents the authenticated user in the system.
 */
pub trait Principal: Sync + Send {
    fn user_id(&self) -> Uuid;
    fn tenant(&self) -> &str;
    fn password_hash(&self) -> &str;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CreateUserError {
    DuplicateUsername,
    Database,
}

/**
 * Port for principal repository operations.
 */
#[async_trait]
pub trait PrincipalRepository: Sync + Send {
    async fn get_principal(&self, username: &str) -> Option<Box<dyn Principal>>;

    async fn create_user(
        &self,
        username: &str,
        password_hash: &str,
        tenant: &str,
        active: bool,
    ) -> Result<(), CreateUserError>;
}
