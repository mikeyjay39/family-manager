use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use deadpool_diesel::sqlite::Pool;
use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl, SelectableHelper};
use uuid::Uuid;

use crate::{
    domain::principal::{CreateUserError, Principal, PrincipalRepository},
    infrastructure::auth_user_entity::{AuthUserEntity, NewAuthUserEntity},
    schema::auth_users,
};

#[derive(Clone)]
pub struct PrincipalOrmCollection {
    pub pool: Arc<Pool>,
}

impl PrincipalOrmCollection {
    pub fn new(pool: Arc<Pool>) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PrincipalRepository for PrincipalOrmCollection {
    async fn get_principal(&self, username: &str) -> Option<Box<dyn Principal>> {
        let conn = match self.pool.get().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::error!("Failed to get database connection from pool: {}", e);
                return None;
            }
        };

        let username_for_query = username.to_string();
        let result = conn
            .interact(move |conn| {
                auth_users::table
                    .filter(auth_users::username.eq(username_for_query))
                    .filter(auth_users::active.eq(true))
                    .select(AuthUserEntity::as_select())
                    .get_result(conn)
            })
            .await;

        return match result {
            Ok(r) => match r {
                Ok(entity) => Some(Box::new(entity)),
                Err(_) => {
                    tracing::warn!("No active user found with username: {}", username);
                    None
                }
            },
            Err(e) => {
                tracing::error!("Database error: {}", e);
                None
            }
        };
    }

    async fn create_user(
        &self,
        username: &str,
        password_hash: &str,
        tenant: &str,
        active: bool,
    ) -> Result<(), CreateUserError> {
        let new_user = NewAuthUserEntity {
            id: Uuid::new_v4().to_string(),
            username: username.to_string(),
            password_hash: password_hash.to_string(),
            tenant: tenant.to_string(),
            active,
            created_at: Utc::now().naive_utc(),
        };

        let conn = self.pool.get().await.map_err(|e| {
            tracing::error!("Failed to get database connection from pool: {}", e);
            CreateUserError::Database
        })?;

        let result = conn
            .interact(move |conn| {
                diesel::insert_into(auth_users::table)
                    .values(&new_user)
                    .execute(conn)
            })
            .await
            .map_err(|e| {
                tracing::error!("Database interact error: {}", e);
                CreateUserError::Database
            })?;

        match result {
            Ok(_) => Ok(()),
            Err(diesel::result::Error::DatabaseError(
                diesel::result::DatabaseErrorKind::UniqueViolation,
                _,
            )) => Err(CreateUserError::DuplicateUsername),
            Err(e) => {
                tracing::error!("Failed to insert auth user: {}", e);
                Err(CreateUserError::Database)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Once};

    use crate::{
        domain::principal::PrincipalRepository,
        infrastructure::{
            auth_user_seeder::ensure_default_admin_user,
            db::{fresh_test_pool, run_migrations},
            test_support::{insert_auth_user, set_user_active},
        },
    };

    use super::*;

    fn init_test_env() {
        static INIT: Once = Once::new();
        INIT.call_once(|| unsafe {
            std::env::set_var("ADMIN_USERNAME", "admin");
            std::env::set_var("ADMIN_PASSWORD", "password");
        });
    }

    #[tokio::test]
    async fn given_seeded_admin_when_getting_principal_then_returns_user() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        ensure_default_admin_user(&pool, "life-manager").await;
        let repository = PrincipalOrmCollection::new(pool);

        // When
        let principal = repository
            .get_principal("admin")
            .await
            .expect("Seeded admin should exist");

        // Then
        assert_eq!(principal.tenant(), "life-manager");
        assert!(!principal.password_hash().is_empty());
    }

    #[tokio::test]
    async fn given_unknown_username_when_getting_principal_then_returns_none() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        ensure_default_admin_user(&pool, "life-manager").await;
        let repository = PrincipalOrmCollection::new(pool);

        // When
        let principal = repository.get_principal("nobody").await;

        // Then
        assert!(principal.is_none());
    }

    #[tokio::test]
    async fn given_inactive_user_when_getting_principal_then_returns_none() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        insert_auth_user(&pool, "inactive", "password", "life-manager", false).await;
        let repository = PrincipalOrmCollection::new(pool);

        // When
        let principal = repository.get_principal("inactive").await;

        // Then
        assert!(principal.is_none());
    }

    #[tokio::test]
    async fn given_deactivated_admin_when_getting_principal_then_returns_none() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        ensure_default_admin_user(&pool, "life-manager").await;
        set_user_active(&pool, "admin", false).await;
        let repository = PrincipalOrmCollection::new(pool);

        // When
        let principal = repository.get_principal("admin").await;

        // Then
        assert!(principal.is_none());
    }

    #[tokio::test]
    async fn given_new_user_when_creating_user_then_inserts_inactive_row() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        let repository = PrincipalOrmCollection::new(pool.clone());

        // When
        repository
            .create_user(
                "signup@example.com",
                "hashed-password",
                "life-manager",
                false,
            )
            .await
            .expect("create_user should succeed");

        // Then
        let principal = repository.get_principal("signup@example.com").await;
        assert!(principal.is_none());

        set_user_active(&pool, "signup@example.com", true).await;
        let principal = repository
            .get_principal("signup@example.com")
            .await
            .expect("activated user should exist");
        assert_eq!(principal.tenant(), "life-manager");
    }

    #[tokio::test]
    async fn given_duplicate_username_when_creating_user_then_returns_duplicate_error() {
        init_test_env();
        // Given
        let pool = fresh_test_pool();
        run_migrations(pool.as_ref()).await;
        insert_auth_user(&pool, "dup@example.com", "password", "life-manager", false).await;
        let repository = PrincipalOrmCollection::new(pool);

        // When
        let result = repository
            .create_user(
                "dup@example.com",
                "other-hash",
                "life-manager",
                false,
            )
            .await;

        // Then
        assert_eq!(result, Err(crate::domain::principal::CreateUserError::DuplicateUsername));
    }
}
