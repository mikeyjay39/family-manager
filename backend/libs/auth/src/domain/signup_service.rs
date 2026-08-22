use async_trait::async_trait;

use crate::domain::signup_request::{SignupRequest, SignupResponse};

#[async_trait]
pub trait SignupService: Sync + Send {
    async fn signup(&self, signup_req: &SignupRequest) -> Result<SignupResponse, String>;
}
