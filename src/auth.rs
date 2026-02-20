use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    body::{Body, to_bytes},
    extract::{Request, State},
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{
    AppState, crypto,
    error::{AppError, AppResult},
};

#[derive(Debug, Clone)]
pub struct AuthenticatedClient {
    pub id: Uuid,
    pub is_admin: bool,
}

pub async fn require_client_signature(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> AppResult<Response> {
    let (parts, body) = request.into_parts();
    let client_id = parse_client_id(&parts)?;
    let signature = parse_header_value(&parts, "X-Signature")?;
    let timestamp = parse_timestamp(&parts)?;
    let nonce = parse_nonce(&parts)?;

    let now_timestamp = validate_timestamp(timestamp, state.config.max_clock_drift_seconds)?;

    let body_bytes = to_bytes(body, state.config.max_body_size_bytes)
        .await
        .map_err(|_| AppError::BadRequest(String::from("request body exceeds allowed size")))?;

    let method = parts.method.as_str().to_owned();
    let path_and_query = parts.uri.path_and_query().map_or_else(
        || parts.uri.path().to_owned(),
        |value| value.as_str().to_owned(),
    );
    let canonical =
        crypto::canonical_string(timestamp, &method, &path_and_query, &nonce, &body_bytes);

    let client = state
        .db
        .get_client_by_id(&client_id)
        .await?
        .ok_or_else(|| AppError::Unauthorized(String::from("invalid client credentials")))?;

    crypto::verify_signature(&client.public_key, &canonical, &signature)?;
    state
        .db
        .register_nonce(&client_id, &nonce, now_timestamp)
        .await?;

    let mut request = Request::from_parts(parts, Body::from(body_bytes));
    request.extensions_mut().insert(AuthenticatedClient {
        id: client.id,
        is_admin: client.is_admin,
    });

    Ok(next.run(request).await)
}

pub fn require_admin(client: &AuthenticatedClient) -> AppResult<()> {
    if !client.is_admin {
        return Err(AppError::Forbidden(String::from("admin access required")));
    }

    Ok(())
}

fn parse_client_id(parts: &Parts) -> AppResult<Uuid> {
    let value = parse_header_value(parts, "X-Client-Id")?;
    Uuid::parse_str(&value).map_err(|_| AppError::Unauthorized(String::from("invalid client id")))
}

fn parse_timestamp(parts: &Parts) -> AppResult<i64> {
    let raw = parse_header_value(parts, "X-Timestamp")?;
    raw.parse::<i64>()
        .map_err(|_| AppError::Unauthorized(String::from("invalid timestamp")))
}

fn parse_nonce(parts: &Parts) -> AppResult<String> {
    let nonce = parse_header_value(parts, "X-Nonce")?;
    if nonce.is_empty() || nonce.len() > 128 {
        return Err(AppError::Unauthorized(String::from(
            "invalid nonce length (must be 1..=128)",
        )));
    }

    Ok(nonce)
}

fn parse_header_value(parts: &Parts, name: &str) -> AppResult<String> {
    let value = parts
        .headers
        .get(name)
        .ok_or_else(|| AppError::Unauthorized(format!("missing header: {name}")))?;

    let value = value
        .to_str()
        .map_err(|_| AppError::Unauthorized(format!("invalid header encoding: {name}")))?;

    Ok(value.to_owned())
}

fn validate_timestamp(timestamp: i64, max_drift_seconds: i64) -> AppResult<i64> {
    let now = current_unix_timestamp()?;
    if (now - timestamp).abs() > max_drift_seconds {
        return Err(AppError::Unauthorized(String::from(
            "timestamp is outside allowed clock drift",
        )));
    }

    Ok(now)
}

fn current_unix_timestamp() -> AppResult<i64> {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    i64::try_from(secs).map_err(|_| AppError::Internal(String::from("unix timestamp overflow")))
}
