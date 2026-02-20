mod auth;
mod cli;
mod config;
mod crypto;
mod db;
mod error;
mod models;
mod routes;

use std::net::SocketAddr;

use axum::http::{HeaderName, Method, header};
use axum::{Router, middleware, routing::get};
use clap::Parser;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

use crate::{
    cli::{Cli, Command},
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
    let _ = tracing_subscriber::fmt::try_init();

    let cli = Cli::parse();
    match cli.command {
        Some(Command::Init) => run_init().await,
        Some(Command::Reset) => run_reset().await,
        Some(Command::Status) => run_status().await,
        Some(Command::Start) | None => run_start().await,
    }
}

async fn run_init() -> AppResult<()> {
    let config = AppConfig::from_env()?;
    let db = Database::connect(&config).await?;
    db.migrate().await?;

    match db.bootstrap_admin_if_missing("bootstrap-admin").await? {
        Some(bootstrap) => {
            println!("Bootstrap admin created.");
            println!("Client ID: {}", bootstrap.client.id);
            println!("Private key (store this safely, shown once):");
            println!("{}", bootstrap.private_key_pem);
        }
        None => {
            if let Some(admin) = db.get_admin_client().await? {
                println!("Bootstrap admin already exists.");
                println!("Client ID: {}", admin.id);
                println!("Run `cloudconfig reset` to generate and print a new private key.");
            } else {
                return Err(AppError::Internal(String::from(
                    "bootstrap admin expected but not found",
                )));
            }
        }
    }

    Ok(())
}

async fn run_start() -> AppResult<()> {
    let config = AppConfig::from_env()?;
    let db = Database::connect(&config).await?;
    db.migrate().await?;

    if db
        .bootstrap_admin_if_missing("bootstrap-admin")
        .await?
        .is_some()
    {
        tracing::warn!(
            "bootstrap admin auto-created during start; run `cloudconfig reset` to print a new private key"
        );
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

async fn run_reset() -> AppResult<()> {
    let config = AppConfig::from_env()?;
    let db = Database::connect(&config).await?;
    db.migrate().await?;

    let bootstrap = db.reset_admin().await?;
    println!("Admin credentials regenerated.");
    println!("Client ID: {}", bootstrap.client.id);
    println!("Private key (store this safely, shown once):");
    println!("{}", bootstrap.private_key_pem);

    Ok(())
}

async fn run_status() -> AppResult<()> {
    let config = AppConfig::from_env()?;
    let connect_addr = status_connect_addr(&config.listen_addr);

    match health_check(&connect_addr).await {
        Ok(true) => {
            println!("status: running (healthy) at http://{connect_addr}/health");
            Ok(())
        }
        Ok(false) => {
            println!("status: unhealthy response from http://{connect_addr}/health");
            Err(AppError::NotFound(format!(
                "cloudconfig responded but /health was not 200 at http://{connect_addr}/health",
            )))
        }
        Err(error) => {
            println!("status: not running at http://{connect_addr}/health");
            Err(AppError::NotFound(format!(
                "cloudconfig is not reachable at http://{connect_addr}/health: {error}",
            )))
        }
    }
}

fn status_connect_addr(listen_addr: &str) -> String {
    match listen_addr.parse::<SocketAddr>() {
        Ok(socket) if socket.ip().is_unspecified() => format!("127.0.0.1:{}", socket.port()),
        Ok(socket) => socket.to_string(),
        Err(_) => listen_addr.to_owned(),
    }
}

async fn health_check(connect_addr: &str) -> Result<bool, std::io::Error> {
    let mut stream = TcpStream::connect(connect_addr).await?;
    let request =
        format!("GET /health HTTP/1.1\r\nHost: {connect_addr}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).await?;
    stream.flush().await?;

    let mut response = Vec::new();
    stream.read_to_end(&mut response).await?;
    let response = String::from_utf8_lossy(&response);
    Ok(response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200"))
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
