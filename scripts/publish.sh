#!/usr/bin/env bash
# Bump version in Cargo.toml, commit, tag, and push to trigger CI release.
#
# Usage:
#   ./scripts/publish.sh               # interactive: prompts for version
#   ./scripts/publish.sh 1.2.3         # explicit version (no "v" prefix)
#   ./scripts/publish.sh patch         # auto-bump patch  (1.2.3 → 1.2.4)
#   ./scripts/publish.sh minor         # auto-bump minor  (1.2.3 → 1.3.0)
#   ./scripts/publish.sh major         # auto-bump major  (1.2.3 → 2.0.0)
set -euo pipefail

CARGO_TOML="Cargo.toml"
FRONTEND_DIR="frontend"
FRONTEND_PACKAGE_JSON="${FRONTEND_DIR}/package.json"
FRONTEND_LOCK="${FRONTEND_DIR}/bun.lock"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
die()     { echo -e "${RED}[error]${NC} $*" >&2; exit 1; }

# ── helpers ──────────────────────────────────────────────────────────────────

require_command() {
  command -v "$1" &>/dev/null || die "'$1' is required but not installed."
}

current_version() {
  grep '^version' "$CARGO_TOML" | head -1 | sed 's/.*"\(.*\)".*/\1/'
}

bump_version() {
  local current="$1" bump="$2"
  local major minor patch
  IFS='.' read -r major minor patch <<< "$current"
  case "$bump" in
    major) echo "$((major + 1)).0.0" ;;
    minor) echo "${major}.$((minor + 1)).0" ;;
    patch) echo "${major}.${minor}.$((patch + 1))" ;;
    *)     die "Unknown bump type: $bump" ;;
  esac
}

validate_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Version must be semver (e.g. 1.2.3), got: $1"
}

confirm() {
  local prompt="$1"
  local reply
  read -r -p "$(echo -e "${YELLOW}[?]${NC} ${prompt} [y/N] ")" reply
  [[ "$reply" =~ ^[Yy]$ ]]
}

# ── pre-flight ────────────────────────────────────────────────────────────────

require_command git
require_command cargo
require_command bun

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || die "Not inside a git repository."
cd "$REPO_ROOT"

[ -f "$CARGO_TOML" ] || die "$CARGO_TOML not found in repo root."
[ -f "$FRONTEND_PACKAGE_JSON" ] || die "${FRONTEND_PACKAGE_JSON} not found."

# Ensure working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree has uncommitted changes. Commit or stash them first."
fi

# Ensure we are on main (warn only — allow override with SKIP_BRANCH_CHECK=1)
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ] && [ "${SKIP_BRANCH_CHECK:-}" != "1" ]; then
  warn "You are on branch '${CURRENT_BRANCH}', not 'main'."
  confirm "Continue anyway?" || exit 0
fi

# Pull latest to avoid pushing a stale tag
info "Pulling latest from origin..."
git pull --rebase origin "$CURRENT_BRANCH" --quiet

# ── resolve target version ────────────────────────────────────────────────────

CURRENT=$(current_version)
info "Current version: ${CURRENT}"

ARG="${1:-}"

case "$ARG" in
  major|minor|patch)
    TARGET=$(bump_version "$CURRENT" "$ARG")
    ;;
  "")
    read -r -p "$(echo -e "${BLUE}[?]${NC}  New version (current: ${CURRENT}): ")" TARGET
    TARGET="${TARGET#v}"   # strip accidental "v" prefix
    ;;
  *)
    TARGET="${ARG#v}"      # strip accidental "v" prefix
    ;;
esac

validate_semver "$TARGET"
TAG="v${TARGET}"

[ "$TARGET" != "$CURRENT" ] || die "Version is already ${CURRENT}. Nothing to publish."

# Check the tag does not already exist locally or on remote
if git tag | grep -q "^${TAG}$"; then
  die "Tag ${TAG} already exists locally."
fi
if git ls-remote --tags origin | grep -q "refs/tags/${TAG}$"; then
  die "Tag ${TAG} already exists on remote."
fi

echo ""
echo -e "  Current version : ${YELLOW}${CURRENT}${NC}"
echo -e "  New version     : ${GREEN}${TARGET}${NC}"
echo -e "  Git tag         : ${GREEN}${TAG}${NC}"
echo ""
confirm "Proceed with release?" || exit 0

# ── frontend and rust validation ──────────────────────────────────────────────

info "Refreshing frontend dependencies (bun update -r)..."
(
  cd "$FRONTEND_DIR"
  bun update -r
)

info "Building frontend (bun run build)..."
(
  cd "$FRONTEND_DIR"
  bun run build
)

info "Running Rust compile check (cargo check)..."
cargo check
success "Frontend and Rust checks passed."

# ── bump Cargo.toml ──────────────────────────────────────────────────────────

info "Updating ${CARGO_TOML}..."
# Replace only the first `version = "…"` line (the [package] version).
# Uses Python to stay portable across macOS (BSD sed) and Linux (GNU sed).
python3 - "$CARGO_TOML" "$CURRENT" "$TARGET" <<'PYEOF'
import sys, re
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
text = open(path).read()
patched, n = re.subn(rf'^version = "{re.escape(old)}"', f'version = "{new}"', text, count=1, flags=re.MULTILINE)
if n == 0:
    sys.exit(f"Could not find version = \"{old}\" in {path}")
open(path, "w").write(patched)
PYEOF

# Update Cargo.lock without a full build
cargo update --workspace --quiet 2>/dev/null || true

# ── commit, tag, push ────────────────────────────────────────────────────────

info "Committing version bump..."
git add "$CARGO_TOML" Cargo.lock "$FRONTEND_PACKAGE_JSON" "$FRONTEND_LOCK"
git commit -m "chore: release ${TAG}"

info "Creating annotated tag ${TAG}..."
git tag -a "$TAG" -m "Release ${TAG}"

info "Pushing commit and tag to origin..."
git push origin "$CURRENT_BRANCH"
git push origin "$TAG"

echo ""
success "Released ${TAG}. CI will now build and publish the GitHub release."
echo ""
echo "  Monitor CI:  https://github.com/dickwu/CloudConfig/actions"
echo "  Releases:    https://github.com/dickwu/CloudConfig/releases/tag/${TAG}"
