#!/usr/bin/env bash
# CloudConfig Linux deploy script
# Usage: curl -fsSL https://raw.githubusercontent.com/dickwu/CloudConfig/main/scripts/deploy.sh | bash
# Or for a specific version: VERSION=v1.2.3 bash deploy.sh
set -euo pipefail

REPO="dickwu/CloudConfig"
BINARY_NAME="cloudconfig"
INSTALL_DIR="/usr/local/bin"
CONFIG_DIR="/etc/cloudconfig"
SERVICE_NAME="cloudconfig"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
VERSION_FILE="${CONFIG_DIR}/version"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()     { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "This script must be run as root (use sudo)."
}

detect_arch() {
  case "$(uname -m)" in
    x86_64)  echo "x86_64-unknown-linux-gnu" ;;
    aarch64) echo "aarch64-unknown-linux-gnu" ;;
    *)       die "Unsupported architecture: $(uname -m)" ;;
  esac
}

fetch_latest_version() {
  curl -sf "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' \
    | cut -d'"' -f4
}

installed_version() {
  cat "${VERSION_FILE}" 2>/dev/null || echo "none"
}

download_and_install() {
  local version="$1"
  local target="$2"
  local archive="cloudconfig-${version}-${target}.tar.gz"
  local url="https://github.com/${REPO}/releases/download/${version}/${archive}"
  local tmpdir
  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  info "Downloading ${archive}..."
  curl -fsSL "${url}" -o "${tmpdir}/${archive}"
  curl -fsSL "${url}.sha256" -o "${tmpdir}/${archive}.sha256"

  info "Verifying checksum..."
  local expected actual
  expected=$(cat "${tmpdir}/${archive}.sha256")
  actual=$(sha256sum "${tmpdir}/${archive}" | awk '{print $1}')
  [ "$expected" = "$actual" ] || die "Checksum mismatch! Expected ${expected}, got ${actual}."

  info "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
  tar -C "${tmpdir}" -xzf "${tmpdir}/${archive}"
  install -m 755 "${tmpdir}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"

  mkdir -p "${CONFIG_DIR}"
  echo "${version}" > "${VERSION_FILE}"
  success "Installed ${BINARY_NAME} ${version}"
}

create_env_file() {
  local env_file="${CONFIG_DIR}/.env"
  if [ -f "$env_file" ]; then
    info "Config already exists at ${env_file} — skipping."
    return
  fi
  cat > "$env_file" <<'ENVEOF'
# CloudConfig server configuration
# Edit this file, then: systemctl restart cloudconfig
# Management console is served from the same binary at "/"

LISTEN_ADDR=0.0.0.0:8080
TURSO_URL=:memory:
TURSO_AUTH_TOKEN=
MAX_CLOCK_DRIFT_SECONDS=300
MAX_BODY_SIZE_BYTES=1048576
ENVEOF
  chmod 600 "$env_file"
  success "Created config at ${env_file}"
  warn "Edit ${env_file} to set TURSO_URL and TURSO_AUTH_TOKEN before starting."
}

create_systemd_service() {
  if [ -f "$SERVICE_FILE" ]; then
    info "Systemd service already exists — skipping unit file creation."
    return
  fi

  local service_user="cloudconfig"
  if ! id -u "$service_user" &>/dev/null; then
    useradd --system --no-create-home --shell /sbin/nologin "$service_user"
    chown "$service_user:$service_user" "$CONFIG_DIR"
    success "Created system user '${service_user}'"
  fi

  cat > "$SERVICE_FILE" <<UNITEOF
[Unit]
Description=CloudConfig sync server
Documentation=https://github.com/${REPO}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${service_user}
Group=${service_user}
WorkingDirectory=${CONFIG_DIR}
EnvironmentFile=${CONFIG_DIR}/.env
ExecStart=${INSTALL_DIR}/${BINARY_NAME}
Restart=on-failure
RestartSec=5s
KillMode=process
TimeoutStopSec=30s

# Hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=${CONFIG_DIR}
PrivateTmp=yes
PrivateDevices=yes

[Install]
WantedBy=multi-user.target
UNITEOF
  chmod 644 "$SERVICE_FILE"
  success "Created systemd unit at ${SERVICE_FILE}"
}

main() {
  require_root

  local target
  target=$(detect_arch)

  local latest
  if [ -n "${VERSION:-}" ]; then
    latest="$VERSION"
    info "Using requested version: ${latest}"
  else
    info "Fetching latest release from GitHub..."
    latest=$(fetch_latest_version)
    [ -n "$latest" ] || die "Could not determine latest release."
    info "Latest release: ${latest}"
  fi

  local current
  current=$(installed_version)

  if [ "$current" = "$latest" ] && [ "${FORCE:-}" != "1" ]; then
    success "Already up to date (${current}). Use FORCE=1 to reinstall."
    exit 0
  fi

  if [ "$current" != "none" ]; then
    info "Updating ${current} → ${latest}..."
  else
    info "Installing ${latest}..."
  fi

  download_and_install "$latest" "$target"
  create_env_file
  create_systemd_service

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}"

  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    systemctl restart "${SERVICE_NAME}"
    success "Service restarted."
  else
    systemctl start "${SERVICE_NAME}"
    success "Service started."
  fi

  echo ""
  success "CloudConfig ${latest} is running."
  echo ""
  echo "  Config:   ${CONFIG_DIR}/.env"
  echo "  Logs:     journalctl -fu ${SERVICE_NAME}"
  echo "  Status:   systemctl status ${SERVICE_NAME}"
  echo "  Console:  http://<server-ip>:8080/"
  echo "  Health:   curl http://127.0.0.1:8080/health"
  echo ""
  warn "On first boot, check logs for the bootstrap admin credentials:"
  echo "  journalctl -u ${SERVICE_NAME} | grep -A3 'Bootstrap admin'"
}

main "$@"
