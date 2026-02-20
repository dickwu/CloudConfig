use libsql::{Builder, Connection, Row, params};
use uuid::Uuid;

use crate::{
    config::AppConfig,
    crypto,
    error::{AppError, AppResult},
    models::{Client, ClientPermission, ConfigItem, Project},
};

const SCHEMA_SQL: &str = r#"
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS clients (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    public_key  TEXT NOT NULL,
    is_admin    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS configs (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, key)
);

CREATE TABLE IF NOT EXISTS client_permissions (
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    can_read    INTEGER NOT NULL DEFAULT 1,
    can_write   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (client_id, project_id)
);

CREATE TABLE IF NOT EXISTS used_nonces (
    client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nonce       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (client_id, nonce)
);
"#;

const NONCE_TTL_SECONDS: i64 = 3600;

#[derive(Debug, Clone)]
pub struct Database {
    conn: Connection,
}

#[derive(Debug, Clone)]
pub struct BootstrapAdmin {
    pub client: Client,
    pub private_key_pem: String,
}

impl Database {
    pub async fn connect(config: &AppConfig) -> AppResult<Self> {
        let is_remote =
            config.turso_url.starts_with("libsql://") || config.turso_url.starts_with("https://");

        let db = if is_remote {
            let token = config.turso_auth_token.clone().ok_or_else(|| {
                AppError::BadRequest(String::from(
                    "TURSO_AUTH_TOKEN is required for remote TURSO_URL",
                ))
            })?;
            Builder::new_remote(config.turso_url.clone(), token)
                .build()
                .await?
        } else {
            Builder::new_local(config.turso_url.clone()).build().await?
        };

        let conn = db.connect()?;
        Ok(Self { conn })
    }

    pub async fn migrate(&self) -> AppResult<()> {
        self.conn.execute_batch(SCHEMA_SQL).await?;
        Ok(())
    }

    pub async fn bootstrap_admin_if_missing(
        &self,
        admin_name: &str,
    ) -> AppResult<Option<BootstrapAdmin>> {
        if self.admin_exists().await? {
            return Ok(None);
        }

        let generated = crypto::generate_ed25519_keypair()?;
        let client = self
            .create_client(admin_name, &generated.public_key_b64, true)
            .await?;

        Ok(Some(BootstrapAdmin {
            client,
            private_key_pem: generated.private_key_pem,
        }))
    }

    pub async fn get_client_by_id(&self, client_id: &Uuid) -> AppResult<Option<Client>> {
        let mut rows = self
            .conn
            .query(
                "SELECT id, name, public_key, is_admin, created_at FROM clients WHERE id = ?1 LIMIT 1",
                params![client_id.to_string()],
            )
            .await?;

        if let Some(row) = rows.next().await? {
            return Ok(Some(client_from_row(&row)?));
        }

        Ok(None)
    }

    pub async fn create_client(
        &self,
        name: &str,
        public_key: &str,
        is_admin: bool,
    ) -> AppResult<Client> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::BadRequest(String::from(
                "client name cannot be empty",
            )));
        }

        let id = Uuid::new_v4();
        self.conn
            .execute(
                "INSERT INTO clients (id, name, public_key, is_admin) VALUES (?1, ?2, ?3, ?4)",
                params![id.to_string(), name, public_key, i64::from(is_admin)],
            )
            .await?;

        self.get_client_by_id(&id)
            .await?
            .ok_or_else(|| AppError::Internal(String::from("failed to load created client")))
    }

    pub async fn list_clients(&self) -> AppResult<Vec<Client>> {
        let mut rows = self
            .conn
            .query(
                "SELECT id, name, public_key, is_admin, created_at FROM clients ORDER BY created_at DESC",
                (),
            )
            .await?;

        let mut clients = Vec::new();
        while let Some(row) = rows.next().await? {
            clients.push(client_from_row(&row)?);
        }

        Ok(clients)
    }

    pub async fn delete_client(&self, client_id: &Uuid) -> AppResult<bool> {
        let affected = self
            .conn
            .execute(
                "DELETE FROM clients WHERE id = ?1",
                params![client_id.to_string()],
            )
            .await?;

        Ok(affected > 0)
    }

    pub async fn create_project(&self, name: &str, description: &str) -> AppResult<Project> {
        let name = name.trim();
        if name.is_empty() {
            return Err(AppError::BadRequest(String::from(
                "project name cannot be empty",
            )));
        }

        let id = Uuid::new_v4();
        let insert_result = self
            .conn
            .execute(
                "INSERT INTO projects (id, name, description) VALUES (?1, ?2, ?3)",
                params![id.to_string(), name, description],
            )
            .await;

        if let Err(error) = insert_result {
            if is_unique_constraint_error(&error) {
                return Err(AppError::Conflict(String::from(
                    "project name already exists",
                )));
            }
            return Err(error.into());
        }

        self.get_project_by_id(&id)
            .await?
            .ok_or_else(|| AppError::Internal(String::from("failed to load created project")))
    }

    pub async fn get_project_by_id(&self, project_id: &Uuid) -> AppResult<Option<Project>> {
        let mut rows = self
            .conn
            .query(
                "SELECT id, name, description, created_at FROM projects WHERE id = ?1 LIMIT 1",
                params![project_id.to_string()],
            )
            .await?;

        if let Some(row) = rows.next().await? {
            return Ok(Some(project_from_row(&row)?));
        }

        Ok(None)
    }

    pub async fn list_projects(&self) -> AppResult<Vec<Project>> {
        let mut rows = self
            .conn
            .query(
                "SELECT id, name, description, created_at FROM projects ORDER BY name ASC",
                (),
            )
            .await?;

        let mut projects = Vec::new();
        while let Some(row) = rows.next().await? {
            projects.push(project_from_row(&row)?);
        }

        Ok(projects)
    }

    pub async fn list_projects_for_client(&self, client_id: &Uuid) -> AppResult<Vec<Project>> {
        let mut rows = self
            .conn
            .query(
                r#"
                SELECT p.id, p.name, p.description, p.created_at
                FROM projects p
                JOIN client_permissions cp ON cp.project_id = p.id
                WHERE cp.client_id = ?1 AND (cp.can_read = 1 OR cp.can_write = 1)
                ORDER BY p.name ASC
                "#,
                params![client_id.to_string()],
            )
            .await?;

        let mut projects = Vec::new();
        while let Some(row) = rows.next().await? {
            projects.push(project_from_row(&row)?);
        }

        Ok(projects)
    }

    pub async fn set_permission(
        &self,
        client_id: &Uuid,
        project_id: &Uuid,
        can_read: bool,
        can_write: bool,
    ) -> AppResult<ClientPermission> {
        if self.get_client_by_id(client_id).await?.is_none() {
            return Err(AppError::NotFound(String::from("client not found")));
        }

        if self.get_project_by_id(project_id).await?.is_none() {
            return Err(AppError::NotFound(String::from("project not found")));
        }

        self.conn
            .execute(
                r#"
                INSERT INTO client_permissions (client_id, project_id, can_read, can_write)
                VALUES (?1, ?2, ?3, ?4)
                ON CONFLICT(client_id, project_id) DO UPDATE SET
                    can_read = excluded.can_read,
                    can_write = excluded.can_write
                "#,
                params![
                    client_id.to_string(),
                    project_id.to_string(),
                    i64::from(can_read),
                    i64::from(can_write)
                ],
            )
            .await?;

        self.get_permission(client_id, project_id)
            .await?
            .ok_or_else(|| AppError::Internal(String::from("failed to load permission")))
    }

    pub async fn get_permission(
        &self,
        client_id: &Uuid,
        project_id: &Uuid,
    ) -> AppResult<Option<ClientPermission>> {
        let mut rows = self
            .conn
            .query(
                r#"
                SELECT client_id, project_id, can_read, can_write
                FROM client_permissions
                WHERE client_id = ?1 AND project_id = ?2
                LIMIT 1
                "#,
                params![client_id.to_string(), project_id.to_string()],
            )
            .await?;

        if let Some(row) = rows.next().await? {
            return Ok(Some(permission_from_row(&row)?));
        }

        Ok(None)
    }

    pub async fn register_nonce(
        &self,
        client_id: &Uuid,
        nonce: &str,
        now_timestamp: i64,
    ) -> AppResult<()> {
        let nonce = nonce.trim();
        if nonce.is_empty() {
            return Err(AppError::Unauthorized(String::from("missing nonce")));
        }

        let cutoff = now_timestamp - NONCE_TTL_SECONDS;
        self.conn
            .execute(
                "DELETE FROM used_nonces WHERE created_at < ?1",
                params![cutoff],
            )
            .await?;

        let insert_result = self
            .conn
            .execute(
                "INSERT INTO used_nonces (client_id, nonce, created_at) VALUES (?1, ?2, ?3)",
                params![client_id.to_string(), nonce, now_timestamp],
            )
            .await;

        match insert_result {
            Ok(_) => Ok(()),
            Err(error) => {
                if is_unique_constraint_error(&error) {
                    return Err(AppError::Unauthorized(String::from("replayed request")));
                }
                Err(error.into())
            }
        }
    }

    pub async fn delete_permission(&self, client_id: &Uuid, project_id: &Uuid) -> AppResult<bool> {
        let affected = self
            .conn
            .execute(
                "DELETE FROM client_permissions WHERE client_id = ?1 AND project_id = ?2",
                params![client_id.to_string(), project_id.to_string()],
            )
            .await?;

        Ok(affected > 0)
    }

    pub async fn upsert_config(
        &self,
        project_id: &Uuid,
        key: &str,
        value: &str,
    ) -> AppResult<ConfigItem> {
        if self.get_project_by_id(project_id).await?.is_none() {
            return Err(AppError::NotFound(String::from("project not found")));
        }

        let key = key.trim();
        if key.is_empty() {
            return Err(AppError::BadRequest(String::from(
                "config key cannot be empty",
            )));
        }

        let config_id = Uuid::new_v4();
        self.conn
            .execute(
                r#"
                INSERT INTO configs (id, project_id, key, value, version, updated_at)
                VALUES (?1, ?2, ?3, ?4, 1, datetime('now'))
                ON CONFLICT(project_id, key) DO UPDATE SET
                    value = excluded.value,
                    version = configs.version + 1,
                    updated_at = datetime('now')
                "#,
                params![config_id.to_string(), project_id.to_string(), key, value],
            )
            .await?;

        self.get_config_by_key(project_id, key)
            .await?
            .ok_or_else(|| AppError::Internal(String::from("failed to load upserted config")))
    }

    pub async fn list_configs_for_project(&self, project_id: &Uuid) -> AppResult<Vec<ConfigItem>> {
        if self.get_project_by_id(project_id).await?.is_none() {
            return Err(AppError::NotFound(String::from("project not found")));
        }

        let mut rows = self
            .conn
            .query(
                r#"
                SELECT id, project_id, key, value, version, updated_at
                FROM configs
                WHERE project_id = ?1
                ORDER BY key ASC
                "#,
                params![project_id.to_string()],
            )
            .await?;

        let mut items = Vec::new();
        while let Some(row) = rows.next().await? {
            items.push(config_from_row(&row)?);
        }

        Ok(items)
    }

    pub async fn get_config_by_key(
        &self,
        project_id: &Uuid,
        key: &str,
    ) -> AppResult<Option<ConfigItem>> {
        let mut rows = self
            .conn
            .query(
                r#"
                SELECT id, project_id, key, value, version, updated_at
                FROM configs
                WHERE project_id = ?1 AND key = ?2
                LIMIT 1
                "#,
                params![project_id.to_string(), key],
            )
            .await?;

        if let Some(row) = rows.next().await? {
            return Ok(Some(config_from_row(&row)?));
        }

        Ok(None)
    }

    async fn admin_exists(&self) -> AppResult<bool> {
        let mut rows = self
            .conn
            .query("SELECT id FROM clients WHERE is_admin = 1 LIMIT 1", ())
            .await?;

        Ok(rows.next().await?.is_some())
    }
}

fn is_unique_constraint_error(error: &libsql::Error) -> bool {
    error.to_string().contains("UNIQUE constraint failed")
}

fn client_from_row(row: &Row) -> AppResult<Client> {
    let id_raw = row.get::<String>(0)?;
    let id = Uuid::parse_str(&id_raw)?;
    let name = row.get::<String>(1)?;
    let public_key = row.get::<String>(2)?;
    let is_admin = row.get::<i64>(3)? != 0;
    let created_at = row.get::<String>(4)?;

    Ok(Client {
        id,
        name,
        public_key,
        is_admin,
        created_at,
    })
}

fn project_from_row(row: &Row) -> AppResult<Project> {
    let id_raw = row.get::<String>(0)?;
    let id = Uuid::parse_str(&id_raw)?;
    let name = row.get::<String>(1)?;
    let description = row.get::<String>(2)?;
    let created_at = row.get::<String>(3)?;

    Ok(Project {
        id,
        name,
        description,
        created_at,
    })
}

fn config_from_row(row: &Row) -> AppResult<ConfigItem> {
    let id_raw = row.get::<String>(0)?;
    let project_id_raw = row.get::<String>(1)?;
    let id = Uuid::parse_str(&id_raw)?;
    let project_id = Uuid::parse_str(&project_id_raw)?;
    let key = row.get::<String>(2)?;
    let value = row.get::<String>(3)?;
    let version = row.get::<i64>(4)?;
    let updated_at = row.get::<String>(5)?;

    Ok(ConfigItem {
        id,
        project_id,
        key,
        value,
        version,
        updated_at,
    })
}

fn permission_from_row(row: &Row) -> AppResult<ClientPermission> {
    let client_id_raw = row.get::<String>(0)?;
    let project_id_raw = row.get::<String>(1)?;
    let client_id = Uuid::parse_str(&client_id_raw)?;
    let project_id = Uuid::parse_str(&project_id_raw)?;
    let can_read = row.get::<i64>(2)? != 0;
    let can_write = row.get::<i64>(3)? != 0;

    Ok(ClientPermission {
        client_id,
        project_id,
        can_read,
        can_write,
    })
}
