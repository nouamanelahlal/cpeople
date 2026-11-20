#!/usr/bin/env bash
# Builds the CPeople sign-in theme and puts the jar where Keycloak will find it.
#
# Run from the repository root:  pnpm kc:theme
#
# Node runs on this machine; Maven runs in a container (see bin/mvn), so nothing
# here needs a JDK installed.
set -euo pipefail

cd "$(dirname "$0")/../../.."
repo="$PWD"

export PATH="$repo/infra/keycloak/theme-builder/bin:$PATH"

echo "==> building the theme"
rm -rf packages/keycloak-theme/dist_keycloak
pnpm --filter @cpeople/keycloak-theme run build:theme

mkdir -p infra/keycloak/providers
rm -f infra/keycloak/providers/*.jar
cp packages/keycloak-theme/dist_keycloak/cpeople-login-theme.jar infra/keycloak/providers/

echo "==> built:"
ls -1 infra/keycloak/providers/
