# CloudConfig

A lightweight, self-hosted configuration sync server. Clients authenticate with Ed25519 keypairs and retrieve project-scoped key/value config over a signed HTTP API. Backed by [Turso](https://turso.tech) (libSQL).

## Features

- Ed25519 request signing — every request is signed and timestamp-validated
- Admin / user role separation
- Project-scoped config with per-client read/write permissions
- Backed by Turso (remote) or any libSQL-compatible database (local file, in-memory)
- Single static binary, no runtime dependencies

## Installation

### Linux (systemd)

```bash
curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/deploy.sh | sudo bash
```

The script will:
1. Detect your architecture (x86\_64 or aarch64)
2. Download and verify the latest release binary
3. Install it to `/usr/local/bin/cloudconfig`
4. Create a config file at `/etc/cloudconfig/.env`
5. Register and start a hardened systemd service

**Update to latest release:**
```bash
curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/deploy.sh | sudo bash
```

**Force reinstall the same version:**
```bash
FORCE=1 curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/deploy.sh | sudo bash
```

**Pin a specific version:**
```bash
VERSION=v1.2.3 curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/deploy.sh | sudo bash
```

### macOS (Homebrew)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/setup-mac.sh)
```

Or manually:
```bash
brew tap dickwu/cloudconfig https://github.com/dickwu/CloudConfig
brew install cloudconfig
brew services start cloudconfig
```

Edit config before starting:
```bash
$EDITOR "$(brew --prefix)/etc/cloudconfig/.env"
brew services restart cloudconfig
```

### Build from source

```bash
cargo build --release --locked
./target/release/cloudconfig_sync_server
```

## Configuration

All configuration is via environment variables (or a `.env` file in the working directory).

| Variable | Default | Description |
|---|---|---|
| `LISTEN_ADDR` | `0.0.0.0:8080` | TCP address to bind |
| `TURSO_URL` | `:memory:` | libSQL connection string. Use `libsql://…` for Turso remote, `./cloudconfig.db` for local file, or `:memory:` for in-process. |
| `TURSO_AUTH_TOKEN` | _(empty)_ | Turso auth token. Not required for local databases. |
| `MAX_CLOCK_DRIFT_SECONDS` | `300` | Maximum allowed difference between request timestamp and server time. |
| `MAX_BODY_SIZE_BYTES` | `1048576` | Maximum request body size (1 MiB default). |

See [`.env.example`](.env.example) for a ready-to-copy template.

## First Run — Bootstrap Admin

On the very first startup, if no clients exist, the server automatically creates a bootstrap admin client and prints its credentials **once**:

```
Bootstrap admin created.
Client ID: <uuid>
Private key (store this safely, shown once):
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

Save the private key immediately. It will not be shown again.

## API Overview

All non-health endpoints require three headers:

| Header | Description |
|---|---|
| `X-Client-Id` | UUID of the authenticating client |
| `X-Timestamp` | Unix timestamp (seconds) |
| `X-Nonce` | Random string, used for replay prevention |
| `X-Signature` | Ed25519 signature of `method\npath\ntimestamp\nnonce\nbody_hex` |

### Health

```
GET /health  →  200 "ok"
```

### Admin endpoints (`/admin/*`)

Requires an admin client.

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/clients` | Create a new client |
| `GET` | `/admin/clients` | List all clients |
| `DELETE` | `/admin/clients/:id` | Delete a client |
| `POST` | `/admin/projects` | Create a project |
| `GET` | `/admin/projects` | List all projects |
| `POST` | `/admin/projects/:id/configs` | Upsert a config key |
| `GET` | `/admin/projects/:id/configs` | List configs for a project |
| `POST` | `/admin/clients/:id/permissions` | Grant project permission |
| `DELETE` | `/admin/clients/:id/permissions/:project_id` | Revoke permission |

### User endpoints (`/api/*`)

Requires any authenticated client with appropriate permissions.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/projects` | List projects the client has access to |
| `GET` | `/api/projects/:id/configs` | Fetch all configs for a project |
| `GET` | `/api/projects/:id/configs/:key` | Fetch a single config value |

## Development

```bash
# Run with in-memory database
cargo run

# Run tests
cargo test

# Lint
cargo clippy --all-targets --all-features

# Format
cargo fmt
```

## Releases

Releases are automated via GitHub Actions. To publish a new version:

```bash
git tag v1.2.3
git push origin v1.2.3
```

CI will:
1. Cross-compile for `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`, `x86_64-apple-darwin`, `aarch64-apple-darwin`
2. Create a GitHub release with binaries and SHA256 checksums
3. Automatically update `Formula/cloudconfig.rb` with the new URLs and hashes

## License

MIT
