# Tauri sidecar spike

> Evaluation spike only. This is not a product-parity replacement for the
> Electron desktop application and must not be promoted as a release branch.

This spike tests one narrow question: can DSH Desktop replace the Electron
window carrier with a Tauri 2 system WebView without replacing the official
DSH Web carrier or its Client plugin graph?

## Architecture

The Rust shell starts `lib/sidecar.js` as a Node child process. The sidecar
boots the normal Cordis/Web profile, binds the renderer to an ephemeral
`127.0.0.1` port, and emits versioned newline-delimited JSON events on stdout.
Rust validates the protocol and loopback URL before navigating the main
WebView. On exit it sends a versioned shutdown command, waits up to five
seconds, and kills the child only as a fallback.

The renderer receives no Tauri global or custom command surface. Compatibility
mode therefore continues to use the official `dsh-web-app` graph and ordinary
third-party `dsh.client` package discovery.

## Run

From the repository root:

```powershell
corepack yarn workspace dsh-plugin-desktop build
corepack yarn workspace dsh-plugin-desktop verify:sidecar
corepack yarn workspace dsh-plugin-desktop spike:tauri:check
corepack yarn workspace dsh-plugin-desktop spike:tauri:dev
corepack yarn workspace dsh-plugin-desktop spike:tauri:build
```

Development requires Node.js, Rust with the MSVC target, Visual Studio Build
Tools, and the WebView2 runtime. `DSH_TAURI_NODE` can select a Node executable,
`DSH_TAURI_SIDECAR` can select a built sidecar entry, and
`DSH_TAURI_PROFILE` can select an existing Web-capable profile configured for
compatibility mode. An advanced-mode profile is rejected without rewriting its
settings.

`spike:tauri:build` creates an isolated Yarn production install, copies the
current Windows x64 Node executable into a physical runtime closure, verifies
that closure with an empty `PATH`, and builds a current-user NSIS installer.
The staging directory and generated Tauri resource overlay live under the
ignored root `.build/` directory. The installer is unsigned and intended for
branch evaluation only.

## Current scope

This is a compatibility-only release-shaped spike. It deliberately disables the
Desktop terminal, bundled pnpm, profile management, and update rows. Advanced
presentation, tray behavior, profile switching and rollback, in-app update
delivery, and Windows ACL migration are not implemented. Development may use a
system Node executable; release builds require and validate the bundled Node
and app resources and do not honor Node or sidecar path overrides.

The NSIS prototype is self-contained for the compatibility Host and does not
run Electron Builder or rebuild native addons. Its production dependency tree
is installed with the root Yarn lockfile and patches, then copied without
workspace links. The installed runtime must still be compared with Electron on
native-addon ABI coverage and third-party plugin behavior before migration.

The shell also has no single-instance lock yet. Its five-second shutdown
fallback terminates only the direct Node child, not a Windows Job Object or an
equivalent supervised process tree. Both are release blockers because parallel
instances can contend for one profile and a stuck Host disposal can otherwise
leave descendant processes behind.

## Decision gates

Compare Electron and Tauri on the same machine with the same profile and
third-party plugins. Continue only if a release-shaped prototype demonstrates:

- at least 30% lower installed size;
- at least 30% lower aggregate idle process-tree memory;
- no regression in official or third-party Host and Web Client plugins; and
- less than 20% cold-start regression.

The observed approximately 537 MiB aggregate working set was a debug-only
Tauri, Node, and WebView2 baseline. It is not a release comparison and does not
support the 10 MiB claims discussed in the linked issues.
