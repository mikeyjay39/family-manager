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

impl<T: Serialize> IntoResponse for AppResponse<T> {
    fn into_response(self) -> Response {
        (self.status, Json(self.data)).into_response()
    }
}
