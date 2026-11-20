# The Keycloak image Dev, Test and Prod run.
#
# The CPeople sign-in theme is baked in rather than mounted: Keycloak falls back to
# its own pages when a theme is missing, silently, and a deployed environment must
# never do that. The COPY below fails the build outright if the jar was not built,
# and infra/keycloak/verify-theme.mjs fails the deploy if a running Keycloak is not
# actually serving our pages.
#
# Build it with:  pnpm kc:image     (which builds the theme first)
FROM quay.io/keycloak/keycloak:26.0

# The image runs as uid 1000; files copied in belong to root unless told otherwise,
# and the import directory has to stay writable for environments that add to it.
# Built by `pnpm kc:theme` into infra/keycloak/providers/.
COPY --chown=1000:0 providers/cpeople-login-theme.jar /opt/keycloak/providers/cpeople-login-theme.jar

# The base realm, which every environment imports. The fake local users are not in
# this image: they live in import-local-dev/ and only the local stack loads them.
COPY --chown=1000:0 import/ /opt/keycloak/data/import/

# E-mail templates, still a folder theme (see the issue about folding them in).
COPY --chown=1000:0 themes/ /opt/keycloak/themes/

# Fail the image build if the theme did not make it in, rather than at sign-in.
RUN test -s /opt/keycloak/providers/cpeople-login-theme.jar

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
