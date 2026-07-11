use auth::AuthState;
use axum::extract::FromRef;

use crate::infrastructure::app_state::TestTenantState;

impl FromRef<TestTenantState> for AuthState {
    fn from_ref(state: &TestTenantState) -> Self {
        state.auth_state.clone()
    }
}
