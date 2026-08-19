import { RELAY_PRINTER_CODE } from "@/lib/relayPrinter";
import { RELAY_REFRESH_SCRIPT } from "@/lib/relayRefreshScript";
import { SETUP_STEP_DETAILS_PHASE3 } from "@/lib/relaySetupStepsPhase3";
import { RELAY_SERVICE_HARDENING_STEP } from "@/lib/relayServiceHardening";
import {
  RELAY_DB_CODE,
  RELAY_SYNC_CODE,
  RELAY_API_CODE,
  RELAY_SERVER_PHASE1_CODE,
} from "@/lib/relayServerPhase1";

// Detailed per-step instructions for spinning up a store's Local Relay VM.
// step_ids must stay stable — completion state in StoreRelaySetup is keyed on them.

export const SETUP_STEP_DETAILS = [
  {
    step_id: "provision_vm",
    label: "Provision a lightweight Linux VM on the store's Proxmox host",
    instructions: [
      "In the Proxmox web UI, click Create VM and install Debian 12 (netinst ISO is fine).",
      "Recommended sizing: 2 vCPU, 2 GB RAM, 20 GB disk — the relay is very lightweight.",
      "Assign a STATIC IP on the store LAN (e.g. 192.168.1.50) via the router's DHCP reservation or /etc/network/interfaces. The cloud portal must always find the relay at the same address.",
      "Enable 'Start at boot' in the VM's Options tab so the relay survives host reboots.",
    ],
    commands: [],
  },
  {
    step_id: "install_node",
    label: "Install Node.js LTS on the relay VM",
    instructions: ["SSH into the VM and install Node.js LTS plus git:"],
    commands: [
      "sudo apt update && sudo apt install -y curl git",
      "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -",
      "sudo apt install -y nodejs",
      "node -v   # should print v20.x",
    ],
  },
  {
    step_id: "deploy_relay",
    label: "Clone / deploy the SureFlow relay service",
    instructions: [
      "Create the service directory and initialize the project:",
    ],
    commands: [
      "sudo mkdir -p /opt/sureflow-relay && sudo chown $USER /opt/sureflow-relay",
      "cd /opt/sureflow-relay && npm init -y && npm install express",
    ],
    postInstructions: [
      "Do NOT write server.js yet. The relay's application files (db.js, sync.js, api.js, printer.js, telemetry.js and server.js) are all created in the Phase 1 and Phase 3 steps below — there is no separate starter server to install first.",
      "This step only prepares the directory and installs express. Continue to the store ID / printer configuration steps, then Phase 1.",
    ],
  },
  {
    step_id: "configure_store",
    label: "Configure store ID and relay URL",
    instructions: [
      "Create /opt/sureflow-relay/.env with this store's identifiers. STORE_ID must match the store number in the cloud portal exactly.",
    ],
    commands: [
      "STORE_ID=001",
      "PORT=3000",
      "PRINTER_IPS=192.168.1.60,192.168.1.61",
    ],
    postInstructions: [
      "The relay URL you'll register in the portal is http://<vm-static-ip>:<PORT> (e.g. http://192.168.1.50:3000).",
    ],
  },
  {
    step_id: "configure_printers",
    label: "Configure Epson printer IP addresses",
    instructions: [
      "On each Epson TM-H6000IV, print the network settings sheet (hold the Feed button on power-up) to find its NIC's current IP.",
      "Use Epson's TMNet WebConfig (browse to the printer's IP) to assign each printer a static IP on the store LAN.",
      "Add every printer IP to the PRINTER_IPS list in the relay's .env, comma-separated, then restart the relay.",
      "The relay probes TCP port 9100 (ESC/POS raw printing) to report reachability.",
    ],
    commands: [],
  },
  {
    step_id: "enable_service",
    label: "Enable the relay as a system service (auto-start on boot)",
    instructions: [
      "Create the systemd unit now so the service exists and is wired to the .env — it will report 'activating (auto-restart)' until the Phase 1 files below are in place, which is expected at this point.",
      "EnvironmentFile is required: the relay code reads process.env directly and does not use dotenv.",
    ],
    commands: [
      "sudo tee /etc/systemd/system/sureflow-relay.service > /dev/null <<'EOF'\n[Unit]\nDescription=SureFlow Local Relay\nAfter=network.target\n\n[Service]\nWorkingDirectory=/opt/sureflow-relay\nEnvironmentFile=/opt/sureflow-relay/.env\nExecStart=/usr/bin/node server.js\nRestart=always\n\n[Install]\nWantedBy=multi-user.target\nEOF",
      "sudo systemctl daemon-reload",
      "sudo systemctl enable --now sureflow-relay",
      "systemctl status sureflow-relay   # 'active (running)' only after the Phase 1 files exist",
    ],
  },
  {
    step_id: "test_connectivity",
    label: "Test connectivity from the cloud portal",
    instructions: [
      "Do this after the Phase 1 files below are deployed — /status does not exist until then.",
      "From another machine on the store LAN, verify the relay answers: curl http://<vm-ip>:3000/status",
      "In the Infrastructure Command Center, set this store's Relay URL (pencil icon next to 'Relay URL') to http://<vm-ip>:3000.",
      "Click 'Poll Now' — the store card should switch to 'Relay Online' and the VM Health and Network Printers panels will populate live.",
      "Note: the browser must be able to reach the relay's address, so monitoring works from machines on the store network or over a VPN/tunnel to it.",
    ],
    commands: [],
  },
];

// ---- Phase 1: local catalog cache + offline sale capture ----
SETUP_STEP_DETAILS.push(
  {
    step_id: "install_sqlite",
    label: "Phase 1 — Install the local database for offline operation",
    instructions: [
      "The relay keeps a local SQLite copy of this store's catalog plus a queue of sales made while the internet is down.",
      "better-sqlite3 is a native module. On a fresh Debian VM there is no prebuilt binary for the installed Node version, so npm falls back to compiling it — which fails with 'not found: make' unless the build tools are installed FIRST.",
      "Install the compiler toolchain, then the module. Do not skip the first command.",
    ],
    commands: [
      "sudo apt update && sudo apt install -y build-essential python3",
      "cd /opt/sureflow-relay && sudo npm install better-sqlite3",
      "node -e \"require('better-sqlite3'); console.log('sqlite ok')\"   # must print: sqlite ok",
    ],
    postInstructions: [
      "'gyp ERR! stack Error: not found: make' means build-essential is missing — run the first command above and reinstall.",
      "If the compile still fails, clear the half-built module and retry: sudo rm -rf node_modules/better-sqlite3 && sudo npm install better-sqlite3",
      "Compiling takes 1-3 minutes on a small VM — that is normal, let it finish.",
    ],
  },
  {
    step_id: "deploy_sync_engine",
    label: "Phase 1 — Deploy the catalog cache, sale outbox, and sync worker",
    instructions: [
      "These four files ARE the relay application. Create all of them, in this order, in /opt/sureflow-relay.",
      "FILE 1 — db.js: the SQLite layer. Creates the catalog cache table, the pending_sales outbox, and the local stock-movement log, and exposes queueSale / pendingSales / getCatalog helpers.",
      "FILE 2 — sync.js: the cloud worker. Reads CLOUD_SYNC_URL and CLOUD_API_KEY from .env, pulls the catalog every 5 minutes, pushes the outbox every 30 seconds, and tracks online/offline state. Requires db.js.",
      "FILE 3 — api.js: the Express router the terminals and the portal call — GET /api/catalog, GET /api/connectivity, POST /api/sales, GET /api/pending, POST /api/sync, plus the printing routes used in the Phase 2 printing step. Requires db.js, sync.js and printer.js.",
      "FILE 4 — server.js (Phase 1): serves /status and /proxmox/reboot, mounts the router at /api, starts the sync worker, exposes /kiosk, and serves the local POS build from ./pos-dist. Phase 3 replaces this one file with a telemetry-aware version — everything else stays.",
      "Sales are queued locally with a store-prefixed transaction ID so the cloud can de-duplicate them on upload.",
    ],
    commands: [
      "cd /opt/sureflow-relay",
      "nano db.js      # paste FILE 1 below, then Ctrl+O Enter Ctrl+X",
      "nano sync.js    # paste FILE 2",
      "nano api.js     # paste FILE 3",
      "nano server.js  # paste FILE 4",
      "sudo systemctl restart sureflow-relay",
      "ls -1 db.js sync.js api.js server.js   # all four must exist",
    ],
    postInstructions: [
      "api.js requires ./printer, so also create printer.js from the Phase 2 printing step before the service will start cleanly.",
      "Restart is required — systemd runs the file that was loaded at start, so the new routes do not exist until the service restarts.",
      "If the service will not come back up, the paste is almost always the cause: sudo journalctl -u sureflow-relay -n 30 --no-pager",
    ],
    codeFiles: [
      { name: "db.js", code: RELAY_DB_CODE },
      { name: "sync.js", code: RELAY_SYNC_CODE },
      { name: "api.js", code: RELAY_API_CODE },
      { name: "server.js (Phase 1)", code: RELAY_SERVER_PHASE1_CODE },
    ],
  },
  {
    step_id: "configure_cloud_sync",
    label: "Phase 1 — Configure the cloud sync API key (connect an existing relay)",
    instructions: [
      "STEP 1 — Generate the key: in the Infrastructure Command Center, expand this store's card and click 'Generate Key' in the Cloud Sync panel. The key looks like sfr_001_a1b2c3... and is displayed ONLY once — copy it before leaving the page. Regenerating instantly revokes the old key, so the relay stops syncing until you paste the new one.",
      "STEP 2 — Build the sync endpoint URL yourself — there is nothing to copy in the dashboard. Take the address you use to open the published app and append /functions/relaySync. Both forms are confirmed working: the default Base44 address (e.g. https://sure-flow-pos.base44.app/functions/relaySync) and a custom domain mapped to the app (e.g. https://pos.128k.moe/functions/relaySync). No trailing slash, and it must be https.",
      "STEP 3 — Add three variables to the relay's .env (append them to the file you already created; do not remove STORE_ID, PORT, or PRINTER_IPS). Each variable goes on its OWN line with no commas, no quotes, and no spaces around the = sign — pasting all three on one comma-separated line is the most common cause of a failed first sync.",
      "STORE_ID must exactly match the store number the key was generated for — the endpoint rejects a key used with the wrong store.",
      "STEP 4 — Restart the relay so it picks up the new environment, then confirm the first pull landed.",
    ],
    commands: [
      "sudo tee -a /opt/sureflow-relay/.env > /dev/null <<'EOF'\nCLOUD_SYNC_URL=https://sure-flow-pos.base44.app/functions/relaySync\nCLOUD_API_KEY=sfr_001_<paste the generated per-store key>\nDB_PATH=/opt/sureflow-relay/relay.db\nEOF",
      "sudo systemctl restart sureflow-relay",
      "curl -s http://localhost:3000/api/connectivity   # expect online:true + catalog_cached_at",
      "curl -s -X POST http://localhost:3000/api/sync    # force an immediate sync",
    ],
    postInstructions: [
      "How the key is used: the relay sends { store_id, api_key, action } in the JSON body of every call — 'pull' every 5 minutes to refresh the local catalog cache, 'push' every 30 seconds to upload queued offline sales. There is no header auth; the key IS the identity, so keep .env readable only by root (sudo chmod 600 /opt/sureflow-relay/.env).",
      "Test the key by hand from the relay VM (a valid key returns ok:true with the product list; a bad key returns 401):",
      "curl -s -X POST \"$CLOUD_SYNC_URL\" -H 'Content-Type: application/json' -d '{\"store_id\":\"001\",\"api_key\":\"sfr_001_...\",\"action\":\"pull\"}'",
      "Opening the endpoint in a browser returns an error — that is normal, it only accepts POST. A 404 means the URL is wrong (check for a typo or a trailing slash); a 401 means the key or STORE_ID does not match; a 403 means backend functions are not enabled on the plan.",
      "Force Sync in the portal says 'Sync Endpoint Missing' (404)? The relay is answering but has no /api/sync route, so api.js did not load. Re-check the Phase 1 files and restart the service.",
      "Force Sync says 'Relay Unreachable'? Your browser cannot reach the relay's LAN address — you must be on the store network or a VPN into it, the service must be running, and the relay must send the CORS headers included in the code above.",
      "Any other sync failure: read the relay's own log for the exact reason — sudo journalctl -u sureflow-relay -n 50 --no-pager. Verify the .env parsed correctly with: cat /opt/sureflow-relay/.env",
      "Confirm it in the portal: the store's Cloud Sync card turns green and shows the last pull/push time, and every sync is recorded in the sync log. If it stays red — check that STORE_ID matches the store number, that the key was not regenerated after you pasted it, and that the VM can reach the internet (curl -I https://google.com).",
      "Rotating the key: generate a new one, paste it into .env, restart the relay. Queued sales are never lost — they stay in the local outbox and upload once the new key authenticates.",
    ],
  },
  {
    step_id: "diagnose_no_sync",
    label: "Phase 1 — Nothing happens after replacing server.js (no sync, no polling)",
    instructions: [
      "Symptom: the Phase 1 files are in place but the relay shows no sync, no /api routes, and nothing new in the log. In every case so far this is one of four causes, in this order of likelihood.",
      "CAUSE 1 — The service is still running the OLD process. systemd keeps running the code loaded at start; editing the file changes nothing until a restart. A restart also FAILS SILENTLY back to the old state if the new file throws on load.",
      "CAUSE 2 — The service never actually restarted because a require() failed. api.js/sync.js/db.js/printer.js must all sit in /opt/sureflow-relay next to server.js, and better-sqlite3 must be installed (previous step). A missing file gives 'Cannot find module ./api' in the log.",
      "CAUSE 3 — The .env is not being loaded into the process. The Phase 1 code reads process.env directly and does NOT use dotenv, so the systemd unit must have EnvironmentFile=/opt/sureflow-relay/.env. Without it CLOUD_SYNC_URL is undefined, every sync attempt fails instantly, and the relay looks idle.",
      "CAUSE 4 — You are checking the wrong process. If a stray node server.js was ever started by hand it holds port 3000, so systemd's copy never binds and your curl hits the old manual process.",
      "Run the commands below in order — each one identifies one of the causes above.",
    ],
    commands: [
      "sudo systemctl restart sureflow-relay && sudo systemctl status sureflow-relay --no-pager",
      "sudo journalctl -u sureflow-relay -n 40 --no-pager   # look for 'phase 1' in the startup line and any 'Cannot find module' / '[sync] failed'",
      "grep -c EnvironmentFile /etc/systemd/system/sureflow-relay.service   # must print 1 — if it prints 0 see the fix below",
      "sudo systemctl show sureflow-relay -p Environment   # confirm STORE_ID / CLOUD_SYNC_URL / CLOUD_API_KEY are present",
      "ps aux | grep -c '[n]ode server.js'   # must be 1 — more than one means a stray manual process is holding the port",
      "curl -s http://localhost:3000/api/connectivity   # JSON = the relay is live; 404 = a stale process is still bound to the port",
    ],
    postInstructions: [
      "Startup line does not say 'phase 1' → the old file is still being loaded. Confirm you edited /opt/sureflow-relay/server.js (not a copy elsewhere) and that WorkingDirectory in the unit points at /opt/sureflow-relay.",
      "'Cannot find module' → the named file is missing or misnamed. Re-run: ls -1 /opt/sureflow-relay/db.js /opt/sureflow-relay/sync.js /opt/sureflow-relay/api.js",
      "EnvironmentFile missing → add it and reload systemd: sudo sed -i '/\\[Service\\]/a EnvironmentFile=/opt/sureflow-relay/.env' /etc/systemd/system/sureflow-relay.service && sudo systemctl daemon-reload && sudo systemctl restart sureflow-relay",
      "Stray process → kill it and restart the service: sudo pkill -f 'node server.js' && sudo systemctl restart sureflow-relay",
      "'[sync] failed: fetch failed' repeating → the routes are live and the worker IS polling; the cloud call is the problem, so go back to the cloud sync key step and re-check CLOUD_SYNC_URL and CLOUD_API_KEY.",
      "To watch the sync worker live (it pushes every 30s and pulls every 5 min): sudo journalctl -u sureflow-relay -f",
    ],
  },
  {
    step_id: "verify_api_sync",
    label: "Phase 1 — Verify the /api/sync route and force a first sync",
    instructions: [
      "This is the route the portal's Force Sync button calls. If it 404s, the Phase 1 files above are not deployed or the service was not restarted.",
      "Run these on the relay VM in order — each one should return JSON, not an HTML error page.",
    ],
    commands: [
      "curl -s http://localhost:3000/api/connectivity   # online:true once the key works",
      "curl -s -X POST http://localhost:3000/api/sync   # forces a pull + push, returns the sync result",
      "curl -s http://localhost:3000/api/catalog | head -c 300   # cached products (503 = never reached the cloud yet)",
      "curl -s http://localhost:3000/api/pending       # queued offline sales, count:0 on a fresh relay",
    ],
    postInstructions: [
      "Empty reply or 'connection refused' = the relay service is not running: sudo systemctl status sureflow-relay",
      "404 on /api/sync = api.js is missing or failed to load. Re-check the Phase 1 step and restart.",
      "/api/connectivity returns online:false = the routes are fine but the cloud call is failing — verify CLOUD_SYNC_URL and CLOUD_API_KEY in .env and that the VM has internet.",
      "Once these pass, click Force Sync on the store card in the Infrastructure Command Center — it should report Sync Complete and the Cloud Sync panel will show the pull/push timestamps.",
    ],
  },
  {
    step_id: "serve_pos_locally",
    label: "Phase 2 — Serve the POS from the relay and point terminals at it",
    instructions: [
      "WHERE THE BUILD COMES FROM: pos-dist does not exist on the VM yet and there is nothing to download from the portal. It is the compiled output of THIS app's front end, so you must first get the source code out of Base44 with the 2-way GitHub sync (app Settings → GitHub), clone that repo onto any machine with Node installed, then run 'npm install' and 'npm run build'. Vite writes the result to a 'dist' folder — the contents of dist ARE the POS build.",
      "Copy the contents of dist into /opt/sureflow-relay/pos-dist (create the folder), then restart the relay. server.js serves it statically, so terminals load the app even with no internet.",
      "Rebuild and re-copy after any change you make in Base44 — the local copy is a frozen snapshot and does not update itself.",
      "ADMIN PAGES / FEATURES LOOK OUT OF DATE AT http://<relay-ip>:3000: this is expected — pos-dist is a static copy of the app as it was when you last built it. New pages, fields, and fixes shipped in Base44 will NOT appear there until you sync the repo, rebuild, and re-copy dist into pos-dist. Only entity DATA is live (it comes from the cloud); the UI code is frozen. Manage the store from the published cloud URL and treat the relay copy as the register runtime.",
      "REFRESH PROCEDURE after any Base44 change: (1) let the GitHub 2-way sync push the change to the repo, (2) git pull in your repo clone, (3) npm install && npm run build, (4) copy dist/* over /opt/sureflow-relay/pos-dist, (5) sudo systemctl restart sureflow-relay, (6) hard-reload the terminal browser (Ctrl+Shift+R) — a cached index.html is the second most common reason the old UI persists after a re-copy.",
      "Verify which build a terminal is running: compare the hashed asset filenames — ls /opt/sureflow-relay/pos-dist/assets | head — against the ones the browser loaded in its network tab. If they differ, the browser is serving from cache, not the relay.",
      "404s ON /api/apps/public/... AND 'App state check failed: Request failed with status code 404' AT http://<relay-ip>:3000: the bundle was calling the API on the relay origin. The app now resolves the cloud API host at RUNTIME whenever it is served from a LAN IP or port 3000, so simply re-sync the repo, rebuild, and re-copy dist into pos-dist and these 404s disappear even without .env.production. If your cloud app lives at a different address than the built-in default, set it once per terminal in the browser console: localStorage.setItem('cloud_api_url','https://your-app.base44.app') then reload.",
      "SIGN-IN SCREEN SHOWS 'Request failed with status code 404' AT http://<relay-ip>:3000: the build is calling the Base44 API on its own origin (the relay), which has no API. The relay only serves files — every account/auth call must still go to the cloud. Fix it by creating .env.production in the repo (see the commands below) with VITE_BASE44_SERVER_URL and VITE_BASE44_APP_BASE_URL set to your published app address, then rebuild and re-copy dist into pos-dist. The app id is in the app's URL in the Base44 dashboard.",
      "SIGN-IN CANNOT BE COMPLETED FROM THE RELAY ORIGIN AT ALL: even with VITE_BASE44_SERVER_URL set correctly, the platform login flow and 'Sign in with Google' will keep failing (404 / rejected redirect) when the page is loaded from http://<relay-ip>:3000. OAuth redirect URIs and the auth session are bound to the published app domain, and an unrecognized origin is not accepted. Verify the env vars actually made it into the build with: grep -ro 'base44.app' /opt/sureflow-relay/pos-dist/assets | head — no output means you copied a dist built before .env.production existed.",
      "SUPPORTED SEQUENCE: open the terminal's browser at the PUBLISHED cloud URL, sign in there once (Google or email), then switch the kiosk URL to http://<relay-ip>:3000. The relay-served copy is for keeping the register running during an outage, not for authenticating. If a terminal has never been signed in, it must be signed in on the cloud URL first.",
      "Account sign-in always needs internet — it is a cloud account, not a relay account. Cashiers should sign in once on each terminal while the store is online; the session then persists in the browser, and Phase 1 offline selling continues to work through the relay during an outage. Do not expect a first-time login to succeed while the internet is down.",
      "BUILD ERROR 'EACCES: permission denied, open .../vite.config.js.timestamp-....mjs': the repo folder is not writable by your user. This happens when the folder was created at the filesystem root (e.g. /sureflow-pos0) and/or 'sudo npm install' was used — the install left root-owned files, then the build, which runs as your user, cannot write its temporary config file next to vite.config.js. Fix it with: sudo chown -R $USER:$USER <repo-folder> then re-run 'npm run build' WITHOUT sudo. Cleanest path: clone the repo inside your home directory instead of /.",
      "If you do not want to manage builds yet, skip this step: terminals can keep loading the POS from the published cloud URL. Phase 1 offline sale capture still works as long as the POS can reach the relay, you just lose the ability to load the app itself while the internet is down.",
      "On each IBM SurePOS 700, set the browser's home page / kiosk URL to http://<relay-ip>:3000 instead of the cloud URL. The POS auto-detects the relay at whatever origin served it — no extra configuration needed.",
      "Terminal still loading from the cloud URL? Point it at its relay by running this once in the browser console: localStorage.setItem('relay_base_url','http://<relay-ip>:3000') then reload.",
      "Live behavior: the POS polls /api/connectivity every 15 seconds. When the relay reports its cloud link is down it shows a red OFFLINE MODE banner with the number of sales waiting to upload, a stale-catalog warning if the cache is over 24 hours old, and a Retry Now button that forces a sync. Tender is limited to cash and check, and completed sales go to the relay outbox flagged as offline captures.",
      "If the cloud is unreachable at load time the POS falls back to the relay's cached catalog, function keys, and discounts, so cashiers can keep ringing.",
    ],
    commands: [
      "# on your build machine, after cloning the GitHub-synced repo",
      "# clone into your HOME directory, never into / — and never build with sudo",
      "cd ~ && sudo chown -R $USER:$USER <repo-folder> && cd <repo-folder>",
      "# REQUIRED before building: tell the local build where the cloud app lives",
      "cat > .env.production <<'EOF'\nVITE_BASE44_SERVER_URL=https://sure-flow-pos.base44.app\nVITE_BASE44_APP_BASE_URL=https://sure-flow-pos.base44.app\nVITE_BASE44_APP_ID=<your app id>\nEOF",
      "npm install && npm run build   # NO sudo — output lands in ./dist",
      "scp -r dist/* sureflow@<relay-ip>:/tmp/pos-dist/",
      "# then on the relay VM",
      "sudo mkdir -p /opt/sureflow-relay/pos-dist && sudo cp -r /tmp/pos-dist/* /opt/sureflow-relay/pos-dist/",
      "sudo systemctl restart sureflow-relay",
      "curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:3000/   # 200 = the POS is being served locally",
    ],
  },
  {
    step_id: "provision_terminal_token",
    label: "Phase 2 — Auto-provision terminal sessions (no per-register token pasting)",
    instructions: [
      "WHY THIS IS NEEDED: OAuth and the platform login flow are bound to the published app domain, so signing in directly at http://<relay-ip>:3000 always fails with 'Domain is not valid'. The working method is to sign in once on the published cloud URL and carry that session token to the relay-served copy.",
      "Doing that by hand on every register does not scale, so store the token ONCE on the relay and let it hand the session to each terminal automatically.",
      "STEP 1 — On any machine, open the published app (e.g. https://sure-flow-pos.base44.app), sign in as the account the registers should run as, then in the browser console run: localStorage.getItem('base44_access_token') and copy the value (without the quotes).",
      "STEP 2 — Add it to the relay's .env as KIOSK_ACCESS_TOKEN (see commands), restart the relay, and lock the file down — this token IS a logged-in session for that account.",
      "STEP 3 — Set every terminal's kiosk / home URL to http://<relay-ip>:3000/kiosk. The relay redirects to the POS with the token attached, the browser stores it, and the register is signed in. Nothing to paste per register, and it re-provisions itself if the browser cache is ever cleared.",
      "SECURITY: use a dedicated register account (not a personal admin login) for this token, keep .env at chmod 600, and rotate the token by signing that account out in the cloud and repeating steps 1-2.",
      "The token expires (roughly a year). When registers start landing on /login again, repeat steps 1-2 with a fresh token.",
    ],
    commands: [
      "sudo tee -a /opt/sureflow-relay/.env > /dev/null <<'EOF'\nKIOSK_ACCESS_TOKEN=<paste the base44_access_token value>\nEOF",
      "sudo chmod 600 /opt/sureflow-relay/.env",
      "sudo systemctl restart sureflow-relay",
      "curl -s -o /dev/null -w '%{http_code} %{redirect_url}\\n' http://localhost:3000/kiosk   # 302 with /?access_token=... = working",
    ],
    postInstructions: [
      "503 'KIOSK_ACCESS_TOKEN is not set' = the variable did not reach the process. Confirm the systemd unit has EnvironmentFile=/opt/sureflow-relay/.env and that the value is on its own line with no quotes.",
      "404 on /kiosk = server.js was pasted from an older copy. Re-paste it from the Phase 1 step (it includes the /kiosk route) and restart.",
      "Terminal still shows the login page after /kiosk = the token has expired or belongs to an account with no access to this app. Get a fresh one from a signed-in cloud session.",
    ],
  },
  {
    step_id: "deploy_printing",
    label: "Phase 2 — Enable raw ESC/POS receipt printing and cash-drawer kick",
    instructions: [
      "By default the POS Print Receipt button opens the browser's print dialog, so it only works if the Epson is installed as an OS printer on every terminal. This step replaces that with raw ESC/POS printing through the relay — no dialog, and the same command pops the cash drawer on cash sales.",
      "FILE — printer.js: add it to /opt/sureflow-relay next to db.js/sync.js/api.js. It formats the receipt for 80mm paper, sends it to the printer's IP on TCP 9100, and fires the drawer kick (ESC p, pin 2).",
      "That is the only new file — the api.js you pasted in Phase 1 already carries the printing routes: POST /api/print (receipt, with open_drawer for cash sales), POST /api/drawer (pop the drawer alone) and POST /api/print-test (diagnostic slip).",
      "Set each register's Printer IP in the Registers page so receipts go to that lane's printer. Left blank, the relay prints to the first address in PRINTER_IPS.",
      "Cash drawers must be plugged into the printer's DK port — the kick is sent by the printer, not the terminal. If your drawer is wired to pin 5 instead of pin 2, change \\x00 to \\x01 in the KICK constant.",
      "If the relay or printer is unreachable the POS automatically falls back to the old browser print dialog, so cashiers are never blocked.",
    ],
    commands: [
      "cd /opt/sureflow-relay",
      "nano printer.js   # paste the file below, then Ctrl+O Enter Ctrl+X",
      "sudo systemctl restart sureflow-relay",
      "grep -c print-test api.js   # must print 1 — if it prints 0 re-paste api.js from the Phase 1 step",
      "curl -s -X POST http://localhost:3000/api/print-test   # a test slip should print and cut",
      "curl -s -X POST http://localhost:3000/api/drawer        # the drawer should pop",
      "curl -s -X POST http://localhost:3000/api/print-test -H 'Content-Type: application/json' -d '{\"printer_ip\":\"192.168.1.61\"}'   # target a specific lane",
    ],
    postInstructions: [
      "Nothing prints and you get 'Printer timeout' — the printer is not reachable on port 9100. Confirm its static IP, that it is listed in PRINTER_IPS, and that the Network Printers panel shows it online.",
      "404 on /api/print — api.js was pasted from an older copy. Re-paste it from the Phase 1 step and restart.",
      "'Cannot find module ./printer' in the log — printer.js is missing or misnamed in /opt/sureflow-relay.",
      "Prints but text wraps badly — set RECEIPT_WIDTH in .env (42 for 80mm at font A, 32 for 58mm paper).",
      "Paper does not cut — the TM-H6000IV cuts on the receipt station only; confirm the roll is loaded in the receipt side, not the slip printer.",
    ],
    codeFiles: [
      { name: "printer.js", code: RELAY_PRINTER_CODE },
    ],
  },
  {
    step_id: "relay_refresh_script",
    label: "Phase 2 — One-command relay refresh (rebuild + deploy + restart)",
    instructions: [
      "The relay's pos-dist is a frozen snapshot, so every Base44 change needs a rebuild and re-copy. This step replaces that six-step manual routine with a single script you run from the build machine.",
      "FILE — sureflow-refresh.sh: save it in the ROOT of your GitHub-synced repo clone (next to package.json) on the build machine, not on the relay VM.",
      "It pulls the repo, installs dependencies, builds, wipes and replaces /opt/sureflow-relay/pos-dist, restarts the relay service, verifies the relay answers HTTP 200, and prints the live asset hashes so you can confirm the terminals are on the new build.",
      "Run it once per store, passing that store's relay IP. Add a passwordless SSH key to the relay first (ssh-copy-id) so it does not stop for a password mid-deploy.",
      "The script exits non-zero if the build produces no dist or the relay stops serving, so a failed deploy is obvious instead of silently leaving the old build in place.",
      "After it finishes, hard-reload each terminal (Ctrl+Shift+R) — a cached index.html is the usual reason a register still shows the old UI.",
      "Still required before the FIRST run: .env.production in the repo (see the previous POS-serving step) so the build points at the cloud API.",
    ],
    commands: [
      "# on the BUILD MACHINE, inside your repo clone",
      "nano sureflow-refresh.sh   # paste the file below, then Ctrl+O Enter Ctrl+X",
      "chmod +x sureflow-refresh.sh",
      "ssh-copy-id sureflow@<relay-ip>   # one time, so the deploy does not prompt for a password",
      "./sureflow-refresh.sh <relay-ip>",
      "./sureflow-refresh.sh <relay-ip> myuser   # if the relay's SSH user is not 'sureflow'",
    ],
    postInstructions: [
      "'usage: ./sureflow-refresh.sh <relay-ip>' — you ran it without the relay IP.",
      "'build produced no dist/index.html' — the Vite build failed above that line; scroll up for the real error (usually the EACCES permission issue from the previous step: sudo chown -R $USER:$USER . then retry WITHOUT sudo).",
      "Prompted for a password at the ship step — the SSH key was not installed; run ssh-copy-id again.",
      "'sudo: no tty present' — the relay user needs passwordless sudo for the copy/restart, or run the last two steps by hand on the VM.",
      "'relay is not serving the POS' — the copy landed but the service failed to start: sudo journalctl -u sureflow-relay -n 40 on the VM.",
      "Terminal still shows the old UI even though the hashes changed — it is browser cache, not the deploy. Hard-reload with Ctrl+Shift+R.",
    ],
    codeFiles: [
      { name: "sureflow-refresh.sh", code: RELAY_REFRESH_SCRIPT },
    ],
  },
  {
    step_id: "verify_offline_failover",
    label: "Phase 1 — Verify offline failover end to end",
    instructions: [
      "Unplug the relay VM's internet (leave the store LAN up) and confirm a cash sale still completes and prints.",
      "Check the queue grew: curl http://<vm-ip>:3000/api/pending",
      "Restore internet. Within 60 seconds the sale should appear in the cloud Transactions list exactly once, flagged as an offline capture, with stock deducted.",
      "Push the same batch twice (POST /api/sync repeatedly) and confirm no duplicate transaction is created — the cloud endpoint is idempotent on transaction ID.",
    ],
    commands: [],
  },
  ...SETUP_STEP_DETAILS_PHASE3,
  RELAY_SERVICE_HARDENING_STEP
);

export const DEFAULT_SETUP_STEPS = SETUP_STEP_DETAILS.map(({ step_id, label }) => ({ step_id, label }));