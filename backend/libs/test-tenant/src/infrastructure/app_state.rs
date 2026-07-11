use std::sync::Arc;

use auth::{AuthState, AuthStateBuilder};
use deadpool_diesel::sqlite::Pool;

use crate::infrastructure::db::{create_connection_pool, create_connection_pool_from_url};

#[derive(Clone)]
pub struct TestTenantState {
    pub(crate) auth_state: AuthState,
}

#[derive(Clone, Default)]
pub struct TestTenantDeps {
    pub database_url: Option<String>,
    pub db_pool: Option<Arc<Pool>>,
    pub auth_state: Option<AuthState>,
}

impl TestTenantDeps {
    pub fn from_env() -> Self {
        Self::default()
    }
}

pub struct TestTenantStateBuilder;

impl TestTenantStateBuilder {
    pub fn new() -> Self {
        Self
    }

    pub async fn build(self, deps: TestTenantDeps) -> TestTenantState {
        tracing::info!("Building TestTenantState...");
        let pool = match deps.db_pool {
            Some(pool) => pool,
            None => {
                let pool = match deps.database_url {
                    Some(url) => create_connection_pool_from_url(&url),
                    None => create_connection_pool(),
                };
                Arc::new(pool)
            }
        };
        tracing::info!("TestTenantState DB pool initialized.");
        let auth_state = match deps.auth_state {
            Some(auth_state) => auth_state,
            None => {
                AuthStateBuilder::new()
                    .build("test-tenant".to_string(), pool)
                    .await
            }
        };
        TestTenantState { auth_state }
    }
}

impl Default for TestTenantStateBuilder {
    fn default() -> Self {
        Self::new()
    }
}
