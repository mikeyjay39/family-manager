use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};

use crate::{
    AuthState,
    infrastructure::{
        login_handler::login, signup_handler::signup,
        test_protected_endpoint_handler::test_protected_endpoint,
    },
};

pub fn auth_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    AuthState: FromRef<S>,
{
    Router::new()
        .route("/login", post(login))
        .route("/signup", post(signup))
        .route("/protected", get(test_protected_endpoint))
}
