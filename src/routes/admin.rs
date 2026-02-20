use axum::{
    Json, Router,
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, post},
};
use uuid::Uuid;

use crate::{
    AppState,
    auth::{AuthenticatedClient, require_admin},
    crypto,
    error::{AppError, AppResult},
    models::{
        CreateClientRequest, CreateClientResponse, CreateProjectRequest, SetPermissionRequest,
        UpsertConfigRequest,
    },
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/clients", post(create_client).get(list_clients))
        .route("/clients/{id}", delete(delete_client))
        .route("/projects", post(create_project).get(list_projects))
        .route(
            "/projects/{project_id}/configs",
            post(upsert_project_config).get(list_project_configs),
        )
        .route("/clients/{client_id}/permissions", post(set_permission))
        .route(
            "/clients/{client_id}/permissions/{project_id}",
            delete(revoke_permission),
        )
}

async fn create_client(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Json(payload): Json<CreateClientRequest>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;

    let generated = crypto::generate_ed25519_keypair()?;
    let client = state
        .db
        .create_client(&payload.name, &generated.public_key_b64, false)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(CreateClientResponse {
            client,
            private_key_pem: generated.private_key_pem,
        }),
    ))
}

async fn list_clients(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;
    let clients = state.db.list_clients().await?;
    Ok(Json(clients))
}

async fn delete_client(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path(client_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;

    if auth_client.id == client_id {
        return Err(AppError::Conflict(String::from(
            "cannot delete the currently authenticated admin client",
        )));
    }

    let removed = state.db.delete_client(&client_id).await?;
    if !removed {
        return Err(AppError::NotFound(String::from("client not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn create_project(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Json(payload): Json<CreateProjectRequest>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;

    let description = payload.description.unwrap_or_default();
    let project = state.db.create_project(&payload.name, &description).await?;
    Ok((StatusCode::CREATED, Json(project)))
}

async fn list_projects(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;
    let projects = state.db.list_projects().await?;
    Ok(Json(projects))
}

async fn upsert_project_config(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<UpsertConfigRequest>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;
    validate_json_string(&payload.value)?;

    let config_item = state
        .db
        .upsert_config(&project_id, &payload.key, &payload.value)
        .await?;

    Ok(Json(config_item))
}

async fn list_project_configs(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path(project_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;
    let configs = state.db.list_configs_for_project(&project_id).await?;
    Ok(Json(configs))
}

async fn set_permission(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path(client_id): Path<Uuid>,
    Json(payload): Json<SetPermissionRequest>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;

    let can_read = payload.can_read || payload.can_write;
    let permission = state
        .db
        .set_permission(&client_id, &payload.project_id, can_read, payload.can_write)
        .await?;

    Ok(Json(permission))
}

async fn revoke_permission(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path((client_id, project_id)): Path<(Uuid, Uuid)>,
) -> AppResult<impl IntoResponse> {
    require_admin(&auth_client)?;

    let removed = state.db.delete_permission(&client_id, &project_id).await?;
    if !removed {
        return Err(AppError::NotFound(String::from("permission not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}

fn validate_json_string(raw: &str) -> AppResult<()> {
    serde_json::from_str::<serde_json::Value>(raw).map_err(|e| {
        AppError::BadRequest(format!("config value must be valid JSON string: {e}"))
    })?;
    Ok(())
}
