use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

use crate::AppError;

pub type AppResult<T> = Result<T, AppError>;

#[derive()]
pub struct AppResponse<T>
where
    T: Serialize,
{
    pub status: StatusCode,
    pub data: T,
}

pub type ApiResult<T> = AppResult<AppResponse<T>>;

impl<T: Serialize> AppResponse<T> {
    pub fn ok(data: T) -> AppResult<Self> {
        Ok(Self {
            status: StatusCode::OK,
            data,
        })
    }

    pub fn created(data: T) -> AppResult<Self> {
        Ok(Self {
            status: StatusCode::CREATED,
            data,
        })
    }

    pub fn unauthorized() -> AppResult<Self> {
        Err(AppError::Unauthorized)
    }

    pub fn not_found() -> AppResult<Self> {
        Err(AppError::NotFound)
    }

    pub fn validation_error(msg: &str) -> AppResult<Self> {
        Err(AppError::Validation(msg.to_string()))
    }

    pub fn internal_anyhow_error(err: anyhow::Error) -> AppResult<Self> {
        Err(AppError::Internal(err))
    }

    pub fn internal_error(err: Box<dyn std::error::Error>) -> AppResult<Self> {
        Err(AppError::from(err))
    }

    pub fn internal_error_from_msg(msg: &str) -> AppResult<Self> {
        Err(AppError::internal_err_from_msg(msg))
    }
}

impl AppResponse<()> {
    pub fn no_content() -> AppResult<Self> {
        Ok(Self {
            status: StatusCode::NO_CONTENT,
            data: (),
        })
    }
}

impl<T: Serialize> IntoResponse for AppResponse<T> {
    fn into_response(self) -> Response {
        if self.status == StatusCode::NO_CONTENT {
            self.status.into_response()
        } else {
            (self.status, Json(self.data)).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use axum::body::to_bytes;
    use axum::response::IntoResponse;
    use serde::Serialize;
    use serde_json::Value;

    use super::*;

    #[derive(Serialize, PartialEq, Debug, Clone)]
    struct SampleDto {
        id: u32,
        name: String,
    }

    async fn response_json(response: Response) -> Value {
        let body = response.into_body();
        let bytes = to_bytes(body, usize::MAX)
            .await
            .expect("failed to read response body");
        serde_json::from_slice(&bytes).expect("response body should be JSON")
    }

    #[test]
    fn given_data_when_ok_then_sets_status_and_data() {
        let dto = SampleDto {
            id: 1,
            name: "alpha".to_string(),
        };
        let response = AppResponse::ok(dto.clone()).expect("ok should succeed");
        assert_eq!(response.status, StatusCode::OK);
        assert_eq!(response.data, dto);
    }

    #[test]
    fn given_data_when_created_then_sets_status_and_data() {
        let dto = SampleDto {
            id: 2,
            name: "beta".to_string(),
        };
        let response = AppResponse::created(dto.clone()).expect("created should succeed");
        assert_eq!(response.status, StatusCode::CREATED);
        assert_eq!(response.data, dto);
    }

    #[test]
    fn given_no_content_when_called_then_sets_204_with_unit() {
        let response = AppResponse::<()>::no_content().expect("no_content should succeed");
        assert_eq!(response.status, StatusCode::NO_CONTENT);
        assert_eq!(response.data, ());
    }

    #[tokio::test]
    async fn given_no_content_when_into_response_then_has_empty_body() {
        let response = AppResponse {
            status: StatusCode::NO_CONTENT,
            data: (),
        }
        .into_response();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);
        let body = response.into_body();
        let bytes = to_bytes(body, usize::MAX)
            .await
            .expect("failed to read response body");
        assert!(bytes.is_empty());
    }

    #[test]
    fn given_unauthorized_helper_when_called_then_returns_unauthorized_error() {
        assert!(matches!(
            AppResponse::<SampleDto>::unauthorized(),
            Err(AppError::Unauthorized)
        ));
    }

    #[test]
    fn given_not_found_helper_when_called_then_returns_not_found_error() {
        assert!(matches!(
            AppResponse::<SampleDto>::not_found(),
            Err(AppError::NotFound)
        ));
    }

    #[test]
    fn given_validation_helper_when_called_then_returns_validation_error() {
        assert!(matches!(
            AppResponse::<SampleDto>::validation_error("bad"),
            Err(AppError::Validation(msg)) if msg == "bad"
        ));
    }

    #[test]
    fn given_internal_helpers_when_called_then_return_internal_error() {
        assert!(matches!(
            AppResponse::<SampleDto>::internal_anyhow_error(anyhow::anyhow!("boom")),
            Err(AppError::Internal(_))
        ));
        let box_err: Box<dyn std::error::Error> = Box::new(std::io::Error::other("save failed"));
        assert!(matches!(
            AppResponse::<SampleDto>::internal_error(box_err),
            Err(AppError::Internal(_))
        ));
        assert!(matches!(
            AppResponse::<SampleDto>::internal_error_from_msg("handler failed"),
            Err(AppError::Internal(_))
        ));
    }

    #[tokio::test]
    async fn given_app_response_when_into_response_then_serializes_data_with_status() {
        let dto = SampleDto {
            id: 42,
            name: "document".to_string(),
        };
        let response = AppResponse {
            status: StatusCode::CREATED,
            data: dto,
        }
        .into_response();

        assert_eq!(response.status(), StatusCode::CREATED);
        let json = response_json(response).await;
        assert_eq!(json["id"], 42);
        assert_eq!(json["name"], "document");
    }
}
