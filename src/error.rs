use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("database error: {0}")]
    Database(String),
    #[error("crypto error: {0}")]
    Crypto(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, public_message) = match &self {
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            Self::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg.clone()),
            Self::Forbidden(msg) => (StatusCode::FORBIDDEN, msg.clone()),
            Self::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            Self::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            Self::Database(_) | Self::Crypto(_) | Self::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                String::from("internal server error"),
            ),
        };

        if status.is_server_error() {
            tracing::error!("{self}");
        }

        (status, Json(json!({ "error": public_message }))).into_response()
    }
}

impl From<libsql::Error> for AppError {
    fn from(value: libsql::Error) -> Self {
        Self::Database(value.to_string())
    }
}

impl From<std::time::SystemTimeError> for AppError {
    fn from(value: std::time::SystemTimeError) -> Self {
        Self::Internal(value.to_string())
    }
}

impl From<rcgen::Error> for AppError {
    fn from(value: rcgen::Error) -> Self {
        Self::Crypto(value.to_string())
    }
}

impl From<ring::error::Unspecified> for AppError {
    fn from(_: ring::error::Unspecified) -> Self {
        Self::Crypto(String::from("cryptographic operation failed"))
    }
}

impl From<ring::error::KeyRejected> for AppError {
    fn from(value: ring::error::KeyRejected) -> Self {
        Self::Crypto(value.to_string())
    }
}

impl From<uuid::Error> for AppError {
    fn from(value: uuid::Error) -> Self {
        Self::BadRequest(value.to_string())
    }
}
