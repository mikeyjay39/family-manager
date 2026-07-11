use async_trait::async_trait;
use auth::auth_router;
use axum::Router;
use server_host::{AppBootstrap, TenantMount};

use crate::infrastructure::{
    app_state::{TestTenantDeps, TestTenantState, TestTenantStateBuilder},
};

pub struct TestTenant;

#[async_trait]
impl TenantMount for TestTenant {
    const MOUNT_PATH: &'static str = "/test-tenant";

    type Deps = TestTenantDeps;
    type State = TestTenantState;

    fn deps_from_bootstrap(_bootstrap: &AppBootstrap) -> Self::Deps {
        TestTenantDeps::from_env()
    }

    async fn build_state(deps: Self::Deps) -> Self::State {
        TestTenantStateBuilder::new().build(deps).await
    }

    fn router() -> Router<Self::State> {
        api_router()
    }
}

/// Routes for the test-tenant API (auth-only pilot).
pub fn api_router() -> Router<TestTenantState> {
    Router::new().nest(
        "/api/v1",
        Router::new().nest("/auth", auth_router::<TestTenantState>()),
    )
}
