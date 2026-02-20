use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Client {
    pub id: Uuid,
    pub name: String,
    pub public_key: String,
    pub is_admin: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigItem {
    pub id: Uuid,
    pub project_id: Uuid,
    pub key: String,
    pub value: String,
    pub version: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientPermission {
    pub client_id: Uuid,
    pub project_id: Uuid,
    pub can_read: bool,
    pub can_write: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateClientRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CreateClientResponse {
    pub client: Client,
    pub private_key_pem: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpsertConfigRequest {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConfigValueRequest {
    pub value: String,
}

#[derive(Debug, Deserialize)]
pub struct SetPermissionRequest {
    pub project_id: Uuid,
    pub can_read: bool,
    pub can_write: bool,
}
