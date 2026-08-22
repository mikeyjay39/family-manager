use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Serialize, Deserialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/auth/SignupRequest.ts"
)]
pub struct SignupRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/auth/SignupResponse.ts"
)]
pub struct SignupResponse {
    pub message: String,
}

#[cfg(test)]
mod export_ts_bindings {
    use super::*;

    #[test]
    fn export_typescript_bindings() {
        SignupRequest::export().unwrap();
        SignupResponse::export().unwrap();
    }
}
