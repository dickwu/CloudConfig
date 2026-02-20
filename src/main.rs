mod auth;
mod config;
mod crypto;
mod db;
mod error;
mod models;
mod routes;

use axum::http::{HeaderName, Method, header};
use axum::{Router, middleware, routing::get};
use tokio::net::TcpListener;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::{
    config::AppConfig,
    db::Database,
    error::{AppError, AppResult},
};

#[derive(Debug, Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
}

#[tokio::main]
async fn main() {
    if let Err(err) = run().await {
        eprintln!("server failed: {err}");
        std::process::exit(1);
    }
}

async fn run() -> AppResult<()> {
    tracing_subscriber::fmt::init();

    let config = AppConfig::from_env()?;
    let db = Database::connect(&config).await?;
    db.migrate().await?;

    if let Some(bootstrap) = db.bootstrap_admin_if_missing("bootstrap-admin").await? {
        println!("Bootstrap admin created.");
        println!("Client ID: {}", bootstrap.client.id);
        println!("Private key (store this safely, shown once):");
        println!("{}", bootstrap.private_key_pem);
    }

    let state = AppState { db, config };
    let app = build_router(state.clone());

    let listener = TcpListener::bind(&state.config.listen_addr)
        .await
        .map_err(|e| {
            AppError::Internal(format!("failed to bind {}: {e}", state.config.listen_addr))
        })?;

    tracing::info!(
        "CloudConfig server listening on {}",
        state.config.listen_addr
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(())
}

fn build_router(state: AppState) -> Router {
    let admin_layer = middleware::from_fn_with_state(state.clone(), auth::require_client_signature);
    let user_layer = middleware::from_fn_with_state(state.clone(), auth::require_client_signature);
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([
            header::CONTENT_TYPE,
            HeaderName::from_static("x-client-id"),
            HeaderName::from_static("x-signature"),
            HeaderName::from_static("x-timestamp"),
            HeaderName::from_static("x-nonce"),
        ]);

    Router::new()
        .route("/health", get(health))
        .nest("/admin", routes::admin::router().route_layer(admin_layer))
        .nest("/api", routes::user::router().route_layer(user_layer))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}

async fn shutdown_signal() {
    if let Err(err) = tokio::signal::ctrl_c().await {
        tracing::warn!("failed to register ctrl+c handler: {err}");
    }
}
