use axum::{
    Json, Router,
    extract::{Extension, Path, State},
    response::IntoResponse,
    routing::get,
};
use uuid::Uuid;

use crate::{
    AppState,
    auth::AuthenticatedClient,
    error::{AppError, AppResult},
    models::UpdateConfigValueRequest,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/projects", get(list_projects))
        .route("/projects/{project_id}/configs", get(list_configs))
        .route(
            "/projects/{project_id}/configs/{key}",
            get(get_config).put(update_config),
        )
}

async fn list_projects(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
) -> AppResult<impl IntoResponse> {
    let projects = state.db.list_projects_for_client(&auth_client.id).await?;
    Ok(Json(projects))
}

async fn list_configs(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path(project_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let permission = load_permission(&state, auth_client.id, project_id).await?;
    if !permission.can_read {
        return Err(AppError::Forbidden(String::from(
            "read permission required",
        )));
    }

    let configs = state.db.list_configs_for_project(&project_id).await?;
    Ok(Json(configs))
}

async fn get_config(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path((project_id, key)): Path<(Uuid, String)>,
) -> AppResult<impl IntoResponse> {
    let permission = load_permission(&state, auth_client.id, project_id).await?;
    if !permission.can_read {
        return Err(AppError::Forbidden(String::from(
            "read permission required",
        )));
    }

    let config_item = state
        .db
        .get_config_by_key(&project_id, &key)
        .await?
        .ok_or_else(|| AppError::NotFound(String::from("config not found")))?;
    Ok(Json(config_item))
}

async fn update_config(
    State(state): State<AppState>,
    Extension(auth_client): Extension<AuthenticatedClient>,
    Path((project_id, key)): Path<(Uuid, String)>,
    Json(payload): Json<UpdateConfigValueRequest>,
) -> AppResult<impl IntoResponse> {
    let permission = load_permission(&state, auth_client.id, project_id).await?;
    if !permission.can_write {
        return Err(AppError::Forbidden(String::from(
            "write permission required",
        )));
    }

    validate_json_string(&payload.value)?;
    let config_item = state
        .db
        .upsert_config(&project_id, &key, &payload.value)
        .await?;
    Ok(Json(config_item))
}

async fn load_permission(
    state: &AppState,
    client_id: Uuid,
    project_id: Uuid,
) -> AppResult<crate::models::ClientPermission> {
    state
        .db
        .get_permission(&client_id, &project_id)
        .await?
        .ok_or_else(|| AppError::Forbidden(String::from("no project access granted")))
}

fn validate_json_string(raw: &str) -> AppResult<()> {
    serde_json::from_str::<serde_json::Value>(raw).map_err(|e| {
        AppError::BadRequest(format!("config value must be valid JSON string: {e}"))
    })?;
    Ok(())
}
