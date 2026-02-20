#!/usr/bin/env bash
# CloudConfig macOS setup via Homebrew
# Usage: bash scripts/setup-mac.sh
set -euo pipefail

REPO="dickwu/CloudConfig"
TAP_NAME="dickwu/cloudconfig"
FORMULA="cloudconfig"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()     { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

require_brew() {
  command -v brew &>/dev/null || die "Homebrew is required. Install from https://brew.sh"
}

setup_config() {
  local config_dir
  config_dir="$(brew --prefix)/etc/cloudconfig"
  local env_file="${config_dir}/.env"

  mkdir -p "$config_dir"

  if [ -f "$env_file" ]; then
    info "Config already exists at ${env_file} — skipping."
    return
  fi

  cat > "$env_file" <<'ENVEOF'
# CloudConfig server configuration
# Edit this file, then: brew services restart cloudconfig

LISTEN_ADDR=127.0.0.1:8080
TURSO_URL=:memory:
TURSO_AUTH_TOKEN=
MAX_CLOCK_DRIFT_SECONDS=300
MAX_BODY_SIZE_BYTES=1048576
ENVEOF
  chmod 600 "$env_file"
  success "Created config at ${env_file}"
  warn "Edit ${env_file} to configure TURSO_URL and TURSO_AUTH_TOKEN."
}

main() {
  require_brew

  info "Tapping ${TAP_NAME}..."
  brew tap "$TAP_NAME" "https://github.com/${REPO}"

  if brew list --formula | grep -q "^${FORMULA}$"; then
    info "Formula already installed — upgrading..."
    brew upgrade "$FORMULA" || true
  else
    info "Installing ${FORMULA}..."
    brew install "$FORMULA"
  fi

  setup_config

  info "Starting service via brew services..."
  brew services start "$FORMULA"

  echo ""
  success "CloudConfig is running."
  echo ""
  echo "  Config:   $(brew --prefix)/etc/cloudconfig/.env"
  echo "  Logs:     tail -f $(brew --prefix)/var/log/cloudconfig.log"
  echo "  Status:   brew services info cloudconfig"
  echo "  Stop:     brew services stop cloudconfig"
  echo "  Update:   brew upgrade cloudconfig && brew services restart cloudconfig"
  echo ""
  warn "On first start, check logs for the bootstrap admin credentials:"
  echo "  grep -A3 'Bootstrap admin' $(brew --prefix)/var/log/cloudconfig.log"
}

main "$@"
