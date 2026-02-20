use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub listen_addr: String,
    pub turso_url: String,
    pub turso_auth_token: Option<String>,
    pub max_clock_drift_seconds: i64,
    pub max_body_size_bytes: usize,
}

impl AppConfig {
    pub fn from_env() -> AppResult<Self> {
        dotenvy::dotenv().ok();

        let listen_addr =
            std::env::var("LISTEN_ADDR").unwrap_or_else(|_| String::from("0.0.0.0:8080"));
        let turso_url = std::env::var("TURSO_URL").unwrap_or_else(|_| String::from(":memory:"));
        let turso_auth_token = std::env::var("TURSO_AUTH_TOKEN")
            .ok()
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());

        let max_clock_drift_seconds = parse_i64("MAX_CLOCK_DRIFT_SECONDS", 300)?;
        let max_body_size_bytes = parse_usize("MAX_BODY_SIZE_BYTES", 1024 * 1024)?;

        if max_clock_drift_seconds < 0 {
            return Err(AppError::BadRequest(String::from(
                "MAX_CLOCK_DRIFT_SECONDS must be >= 0",
            )));
        }

        if max_body_size_bytes == 0 {
            return Err(AppError::BadRequest(String::from(
                "MAX_BODY_SIZE_BYTES must be > 0",
            )));
        }

        Ok(Self {
            listen_addr,
            turso_url,
            turso_auth_token,
            max_clock_drift_seconds,
            max_body_size_bytes,
        })
    }
}

fn parse_i64(var: &str, default_value: i64) -> AppResult<i64> {
    match std::env::var(var) {
        Ok(raw) => raw
            .parse::<i64>()
            .map_err(|e| AppError::BadRequest(format!("invalid {var}: {e}"))),
        Err(_) => Ok(default_value),
    }
}

fn parse_usize(var: &str, default_value: usize) -> AppResult<usize> {
    match std::env::var(var) {
        Ok(raw) => raw
            .parse::<usize>()
            .map_err(|e| AppError::BadRequest(format!("invalid {var}: {e}"))),
        Err(_) => Ok(default_value),
    }
}
