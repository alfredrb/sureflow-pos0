// One-command POS refresh for the store's Local Relay VM.
// Lives on the BUILD MACHINE (the one with the GitHub-synced repo clone).
// It pulls the latest code, builds it, ships dist to the relay, and restarts the service.
export const RELAY_REFRESH_SCRIPT = `#!/usr/bin/env bash
# sureflow-refresh.sh — rebuild the POS and push it to a store's relay VM.
# Usage:  ./sureflow-refresh.sh <relay-ip> [ssh-user]
set -euo pipefail

RELAY_IP="\${1:-}"
SSH_USER="\${2:-sureflow}"
REPO_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
REMOTE_DIR="/opt/sureflow-relay/pos-dist"

if [ -z "\$RELAY_IP" ]; then
  echo "usage: ./sureflow-refresh.sh <relay-ip> [ssh-user]" >&2
  exit 1
fi

cd "\$REPO_DIR"

echo "==> 1/5 pulling latest code"
git pull --ff-only

echo "==> 2/5 installing dependencies"
npm install --no-audit --no-fund

echo "==> 3/5 building POS bundle"
npm run build
test -f dist/index.html || { echo "build produced no dist/index.html" >&2; exit 1; }

echo "==> 4/5 shipping build to \$RELAY_IP"
ssh "\$SSH_USER@\$RELAY_IP" "rm -rf /tmp/pos-dist && mkdir -p /tmp/pos-dist"
scp -q -r dist/* "\$SSH_USER@\$RELAY_IP:/tmp/pos-dist/"
ssh "\$SSH_USER@\$RELAY_IP" "sudo rm -rf \$REMOTE_DIR && sudo mkdir -p \$REMOTE_DIR && sudo cp -r /tmp/pos-dist/* \$REMOTE_DIR/ && rm -rf /tmp/pos-dist"

echo "==> 5/5 restarting relay"
ssh "\$SSH_USER@\$RELAY_IP" "sudo systemctl restart sureflow-relay"
sleep 2
CODE=\$(curl -s -o /dev/null -w '%{http_code}' "http://\$RELAY_IP:3000/")
echo "relay returned HTTP \$CODE for /"
[ "\$CODE" = "200" ] || { echo "relay is not serving the POS — check: sudo journalctl -u sureflow-relay -n 40" >&2; exit 1; }

echo "==> asset hashes now live on the relay:"
ssh "\$SSH_USER@\$RELAY_IP" "ls \$REMOTE_DIR/assets | head"
echo "DONE — hard-reload each terminal (Ctrl+Shift+R) to drop the cached index.html."
`;