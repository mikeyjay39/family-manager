use std::sync::Arc;

use crate::domain::{login_service::LoginService, signup_service::SignupService};

#[derive(Clone)]
pub struct AuthUseCases {
    pub login_service: Arc<dyn LoginService>,
    pub signup_service: Arc<dyn SignupService>,
    pub tenant: String,
}

impl AuthUseCases {
    pub fn new(
        login_service: Arc<dyn LoginService>,
        signup_service: Arc<dyn SignupService>,
        tenant: String,
    ) -> Self {
        AuthUseCases {
            login_service,
            signup_service,
            tenant,
        }
    }
}
