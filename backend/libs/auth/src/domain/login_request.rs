use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub exp: usize,
    pub tenant: String,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/auth/LoginRequest.ts"
)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Deserialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/auth/LoginResponse.ts"
)]
pub struct LoginResponse {
    pub token: String,
}

#[cfg(test)]
mod export_ts_bindings {
    use super::*;

    #[test]
    fn export_typescript_bindings() {
        LoginRequest::export().unwrap();
        LoginResponse::export().unwrap();
    }
}
