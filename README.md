# CloudConfig Sync Server

Rust-based cloud configuration sync service with Turso/libSQL storage, split into two API areas:

- `admin` API for provisioning clients/projects/config/permissions
- `user` API for reading/updating project config under per-client `read` / `write` permissions

Config values are stored as **JSON strings** with integer versioning.

## Core Capabilities

- ED25519 client identity (public key stored, private key returned once)
- Signature-based request authentication for both admin and user APIs
- Replay protection (`timestamp` window + nonce uniqueness)
- Per-project client permissions (`can_read`, `can_write`)
- Config version auto-increment on update
- Turso remote DB support and local libSQL mode

## Tech Stack

- `axum` for HTTP routing/middleware
- `libsql` for Turso/local database access
- `rcgen` for ED25519 key generation
- `ring` for ED25519 signature verification
- `tokio`, `serde`, `tower-http`, `tracing`

## API Areas

- **Admin API:** `/admin/*` (must be authenticated **and** `is_admin = true`)
- **User API:** `/api/*` (must be authenticated; permissions checked per project)
- **Health:** `/health` (no auth)

## Authentication

All `/admin/*` and `/api/*` routes require these headers:

- `X-Client-Id`: client UUID
- `X-Timestamp`: unix timestamp (seconds)
- `X-Nonce`: unique request nonce (1..=128 chars)
- `X-Signature`: base64 signature bytes

### Canonical String

The server verifies signature against:

```text
{timestamp}\n{HTTP_METHOD}\n{path_and_query}\n{nonce}\n{sha256_hex(body)}
```

Notes:

- `path_and_query` is used (not only path)
- body hash is over raw request bytes
- timestamp drift is validated via `MAX_CLOCK_DRIFT_SECONDS`
- replay prevention uses `used_nonces` table per `(client_id, nonce)`

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `LISTEN_ADDR` | No | `0.0.0.0:8080` | Bind address |
| `TURSO_URL` | No | `:memory:` | `libsql://...` for Turso remote, or local path/`:memory:` |
| `TURSO_AUTH_TOKEN` | Remote only | empty | Required when `TURSO_URL` is remote |
| `MAX_CLOCK_DRIFT_SECONDS` | No | `300` | Allowed signature timestamp drift |
| `MAX_BODY_SIZE_BYTES` | No | `1048576` | Max request body for signed routes |

## Data Model

### `clients`

- `id` (UUID text, PK)
- `name`
- `public_key` (base64 ED25519 public key)
- `is_admin` (`0/1`)
- `created_at`

### `projects`

- `id` (UUID text, PK)
- `name` (unique)
- `description`
- `created_at`

### `configs`

- `id` (UUID text, PK)
- `project_id` (FK)
- `key`
- `value` (**JSON string**)
- `version` (integer)
- `updated_at`
- unique `(project_id, key)`

### `client_permissions`

- `client_id` (FK)
- `project_id` (FK)
- `can_read` (`0/1`)
- `can_write` (`0/1`)
- primary key `(client_id, project_id)`

### `used_nonces`

- `client_id` (FK)
- `nonce`
- `created_at` (unix seconds)
- primary key `(client_id, nonce)`

## Full API Reference

## 1) Health

### `GET /health`

- Auth: none
- Response `200`: `"ok"`

## 2) Admin API (`/admin/*`)

All admin endpoints:

- require valid signature headers
- require authenticated client with `is_admin = true`

### `POST /admin/clients`

Create a non-admin client keypair.

Request body:

```json
{
  "name": "client-a"
}
```

Response `201`:

```json
{
  "client": {
    "id": "uuid",
    "name": "client-a",
    "public_key": "base64-ed25519-public-key",
    "is_admin": false,
    "created_at": "2026-02-20 12:34:56"
  },
  "private_key_pem": "-----BEGIN PRIVATE KEY-----\n..."
}
```

Behavior:

- server generates ED25519 keypair
- stores only public key
- returns private key PEM once in response

### `GET /admin/clients`

Response `200`: array of client objects.

### `DELETE /admin/clients/{id}`

- Response `204` on success
- `404` if client not found
- `409` if trying to delete currently authenticated admin client

### `POST /admin/projects`

Request:

```json
{
  "name": "project-a",
  "description": "optional description"
}
```

Response `201`: created project object.

Errors:

- `409` if project name already exists

### `GET /admin/projects`

Response `200`: array of project objects.

### `POST /admin/projects/{project_id}/configs`

Upsert one config key/value for a project.

Request:

```json
{
  "key": "app-config",
  "value": "{\"featureFlag\":true,\"timeoutMs\":5000}"
}
```

Rules:

- `value` must be valid JSON **string content**
- insert starts at `version = 1`
- existing key increments `version = version + 1`

Response `200`: config object.

### `GET /admin/projects/{project_id}/configs`

Response `200`: array of config objects for the project.

### `POST /admin/clients/{client_id}/permissions`

Grant/update project permission for one client.

Request:

```json
{
  "project_id": "uuid",
  "can_read": true,
  "can_write": false
}
```

Behavior:

- if `can_write = true`, server ensures read is also effectively true
- upserts permission row

Response `200`:

```json
{
  "client_id": "uuid",
  "project_id": "uuid",
  "can_read": true,
  "can_write": false
}
```

### `DELETE /admin/clients/{client_id}/permissions/{project_id}`

- Response `204` on success
- `404` if permission row does not exist

## 3) User API (`/api/*`)

All user endpoints:

- require valid signature headers
- require project permission checks

### `GET /api/projects`

Returns projects where client has any permission (`can_read` or `can_write`).

Response `200`: array of projects.

### `GET /api/projects/{project_id}/configs`

Requires `can_read = true`.

Response `200`: array of configs with `version`.

### `GET /api/projects/{project_id}/configs/{key}`

Requires `can_read = true`.

Response `200`: config object.

Errors:

- `404` if config key not found

### `PUT /api/projects/{project_id}/configs/{key}`

Requires `can_write = true`.

Request:

```json
{
  "value": "{\"featureFlag\":false,\"timeoutMs\":3000}"
}
```

Rules:

- `value` must be valid JSON string content
- upsert behavior, version auto-increments

Response `200`: updated config object with new `version`.

## Error Model

Common HTTP statuses:

- `400` bad request / invalid JSON value / body too large
- `401` missing/invalid auth headers, invalid signature, replayed request
- `403` admin required or missing read/write permission
- `404` missing resource
- `409` conflict (for example duplicate project name)
- `500` internal/server/database/crypto failures

Response shape:

```json
{
  "error": "message"
}
```

## Bootstrap and First Admin

On first startup (when no admin exists):

- server generates an admin keypair
- stores admin public key in `clients` with `is_admin = true`
- prints client id and private key to stdout

This bootstrap admin credential is then used to call `/admin/*` and provision all other clients.

## Data Flow

### Provisioning Flow (Admin)

```mermaid
sequenceDiagram
    participant AdminClient
    participant Server
    participant TursoDB
    participant UserClient

    AdminClient->>Server: Signed POST /admin/clients
    Server->>Server: Verify signature + nonce + timestamp
    Server->>Server: Generate ED25519 keypair
    Server->>TursoDB: Insert client(public_key, is_admin=0)
    Server-->>AdminClient: Return client + private_key_pem
    AdminClient->>UserClient: Deliver private key securely

    AdminClient->>Server: Signed POST /admin/clients/{id}/permissions
    Server->>Server: Verify admin
    Server->>TursoDB: Upsert client_permissions
    Server-->>AdminClient: Permission row
```

### Runtime Read/Write Flow (User)

```mermaid
sequenceDiagram
    participant UserClient
    participant Server
    participant TursoDB

    UserClient->>Server: Signed GET /api/projects/{project_id}/configs
    Server->>Server: Verify signature + replay protection
    Server->>TursoDB: Check client_permissions(can_read)
    Server->>TursoDB: Query configs for project
    Server-->>UserClient: Config list with version

    UserClient->>Server: Signed PUT /api/projects/{project_id}/configs/{key}
    Server->>TursoDB: Check client_permissions(can_write)
    Server->>TursoDB: Upsert config, version = version + 1
    Server-->>UserClient: Updated config with incremented version
```

## Local Run

1. Copy env:

```bash
cp .env.example .env
```

2. Start:

```bash
cargo run
```

3. Verify:

```bash
curl http://127.0.0.1:8080/health
```

## Permission Semantics

- `read` allows listing/getting project configs.
- `write` allows updating config values.
- server coerces `write => read` when setting permissions.

## Version Semantics

- New config key: `version = 1`
- Update existing key via admin upsert or user put: `version += 1`

