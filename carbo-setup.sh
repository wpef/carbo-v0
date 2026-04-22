#!/usr/bin/env bash
# Carbo bootstrap script — clones, installs, and launches the app.
# Usage: bash carbo-setup.sh

set -e

REPO_URL="https://github.com/wpef/carbo-v0.git"
BRANCH="implement/phase-1-v3"
APP_DIR="carbo-v0"
MIN_NODE_MAJOR=18

has_cmd() { command -v "$1" >/dev/null 2>&1; }

node_major() {
  if has_cmd node; then
    node -v | sed 's/v//' | cut -d. -f1
  else
    echo "0"
  fi
}

detect_os() {
  case "$(uname -s)" in
    Darwin*) echo "macos" ;;
    Linux*)  echo "linux" ;;
    MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
    *) echo "unknown" ;;
  esac
}

install_git() {
  local os="$1"
  echo "    git is missing — installing..."
  case "$os" in
    macos)
      if ! has_cmd brew; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install git
      ;;
    linux)
      if has_cmd apt-get; then
        sudo apt-get update && sudo apt-get install -y git
      elif has_cmd dnf; then
        sudo dnf install -y git
      elif has_cmd pacman; then
        sudo pacman -S --noconfirm git
      else
        echo "    ERROR: no supported package manager found."
        exit 1
      fi
      ;;
    *)
      echo "    ERROR: cannot auto-install git on this OS."
      exit 1
      ;;
  esac
}

install_node() {
  local os="$1"
  echo "    Installing Node.js ${MIN_NODE_MAJOR}+ ..."
  case "$os" in
    macos)
      if ! has_cmd brew; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install node@20
      brew link --overwrite --force node@20 || true
      ;;
    linux)
      if has_cmd apt-get; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif has_cmd dnf; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
      elif has_cmd pacman; then
        sudo pacman -S --noconfirm nodejs npm
      else
        echo "    ERROR: no supported package manager found."
        exit 1
      fi
      ;;
    *)
      echo "    ERROR: cannot auto-install Node on this OS."
      exit 1
      ;;
  esac
}

OS="$(detect_os)"

if [ "$OS" = "windows" ]; then
  echo "ERROR: this script is for macOS and Linux."
  echo "On Windows, install Git for Windows (https://git-scm.com/download/win) + Node.js 20 (https://nodejs.org/),"
  echo "then re-run this script in Git Bash."
  exit 1
fi

if [ "$OS" = "unknown" ]; then
  echo "ERROR: unsupported OS. Install git + Node 20 manually and re-run."
  exit 1
fi

echo "==> [1/7] Checking prerequisites (detected OS: ${OS})"

if ! has_cmd git; then
  install_git "$OS"
else
  echo "    git: OK ($(git --version))"
fi

CURRENT_NODE_MAJOR="$(node_major)"
if [ "$CURRENT_NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]; then
  if [ "$CURRENT_NODE_MAJOR" = "0" ]; then
    echo "    Node.js: not found"
  else
    echo "    Node.js: v${CURRENT_NODE_MAJOR} is too old (need ${MIN_NODE_MAJOR}+)"
  fi
  install_node "$OS"
else
  echo "    Node.js: OK ($(node -v))"
fi

echo "==> [2/7] Cloning repo from ${REPO_URL}"
if [ -d "${APP_DIR}" ]; then
  echo "    Directory '${APP_DIR}' already exists — skipping clone."
else
  git clone "${REPO_URL}" "${APP_DIR}"
fi

echo "==> [3/7] Entering ${APP_DIR}"
cd "${APP_DIR}"

echo "==> [4/7] Checking out branch ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull origin "${BRANCH}"

echo "==> [5/7] Installing dependencies (this may take a few minutes)"
if [ ! -f ".env" ]; then
  echo "    Creating .env from .env.example"
  cp .env.example .env
fi
npm install
npx prisma generate
npx prisma db push

echo "==> [6/7] Launching the app"
echo "==> [7/7] Once the server is ready, open: http://localhost:3000"
echo "    (Press Ctrl+C to stop the server)"
echo ""
npm run dev