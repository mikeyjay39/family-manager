use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Resource not found")]
    NotFound,
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),
    #[error("Unauthorized")]
    Unauthorized,
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not_found", self.to_string()),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "validation_error", msg.clone()),
            AppError::Internal(_) => {
                tracing::error!("Internal server error: {:?}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error",
                    "An internal error occurred".to_string(),
                )
            }
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized", self.to_string()),
        };
        let body = ErrorResponse {
            error: error_type.to_string(),
            message,
        };
        (status, Json(body)).into_response()
    }
}

impl From<Box<dyn std::error::Error>> for AppError {
    fn from(err: Box<dyn std::error::Error>) -> Self {
        AppError::Internal(anyhow::Error::msg(err.to_string()))
    }
}

impl AppError {
    pub fn internal_err_from_msg(msg: &str) -> Self {
        AppError::Internal(anyhow::Error::msg(msg.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;
    use axum::response::IntoResponse;
    use serde_json::Value;

    use super::*;

    async fn response_json(response: Response) -> Value {
        let body = response.into_body();
        let bytes = to_bytes(body, usize::MAX)
            .await
            .expect("failed to read response body");
        serde_json::from_slice(&bytes).expect("response body should be JSON")
    }

    #[tokio::test]
    async fn given_not_found_when_into_response_then_returns_404_json() {
        let response = AppError::NotFound.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let json = response_json(response).await;
        assert_eq!(json["error"], "not_found");
        assert_eq!(json["message"], "Resource not found");
    }

    #[tokio::test]
    async fn given_validation_error_when_into_response_then_returns_400_json() {
        let response = AppError::Validation("bad input".to_string()).into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let json = response_json(response).await;
        assert_eq!(json["error"], "validation_error");
        assert_eq!(json["message"], "bad input");
    }

    #[tokio::test]
    async fn given_unauthorized_when_into_response_then_returns_401_json() {
        let response = AppError::Unauthorized.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let json = response_json(response).await;
        assert_eq!(json["error"], "unauthorized");
        assert_eq!(json["message"], "Unauthorized");
    }

    #[tokio::test]
    async fn given_internal_error_when_into_response_then_returns_500_without_leaking_details() {
        let response =
            AppError::Internal(anyhow::anyhow!("database connection failed")).into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

        let json = response_json(response).await;
        assert_eq!(json["error"], "internal_error");
        assert_eq!(json["message"], "An internal error occurred");
        assert!(
            !json["message"]
                .as_str()
                .unwrap()
                .contains("database"),
            "internal error message must not leak underlying details"
        );
    }

    #[test]
    fn given_box_error_when_from_then_produces_internal_variant() {
        let err: Box<dyn std::error::Error> = Box::new(std::io::Error::other("save failed"));
        assert!(matches!(AppError::from(err), AppError::Internal(_)));
    }

    #[test]
    fn given_message_when_internal_err_from_msg_then_produces_internal_variant() {
        assert!(matches!(
            AppError::internal_err_from_msg("handler failed"),
            AppError::Internal(_)
        ));
    }
}
