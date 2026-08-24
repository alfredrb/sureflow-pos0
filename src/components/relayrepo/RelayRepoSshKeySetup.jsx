import React from "react";

// One-time SSH key setup for a Windows box. Shown alongside the push steps because
// "Permission denied (publickey)" is the first wall every new machine hits: git is fine,
// the repo is fine, GitHub simply has no key for this computer yet.
// Uses ssh-agent so the passphrase is typed once rather than on every push.
export default function RelayRepoSshKeySetup() {
  const script = `# PowerShell, run ONCE per computer. Skip if "ssh -T git@github.com" already
# answers "Hi <you>! You've successfully authenticated".

# 1. Create the key (press Enter at every prompt to accept the defaults)
ssh-keygen -t ed25519 -C "sureflow-windows"

# 2. Start the agent so the key is remembered between pushes
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add "$HOME\\.ssh\\id_ed25519"

# 3. Copy the PUBLIC key to the clipboard
Get-Content "$HOME\\.ssh\\id_ed25519.pub" | Set-Clipboard

# 4. Paste it into GitHub -> Settings -> SSH and GPG keys -> New SSH key, then re-test
ssh -T git@github.com`;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        First time on this PC — add an SSH key
      </p>
      <pre className="overflow-x-auto rounded-xl bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
        <code className="font-mono">{script}</code>
      </pre>
      <p className="text-xs text-gray-500">
        Only the <code className="font-mono">.pub</code> file is pasted into GitHub — never the file without the
        extension. If <code className="font-mono">Set-Service</code> is refused, re-open PowerShell as Administrator for
        that one line. Prefer not to use keys at all? Clone over HTTPS instead and paste a GitHub personal access token
        when prompted for a password.
      </p>
    </div>
  );
}