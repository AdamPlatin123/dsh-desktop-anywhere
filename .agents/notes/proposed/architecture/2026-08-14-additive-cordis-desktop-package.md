# Agent Note: Additive Cordis desktop package

Status: proposed

English | [中文](2026-08-14-additive-cordis-desktop-package.zh.md)

## Problem

DSH needs an installable desktop application without turning Electron into a second composition authority. A desktop launcher that starts a fixed Web profile, owns a hardcoded client roster, or patches existing UI packages can display the current product, but third-party packages installed through `dsh plugin --profile desktop add <package>` do not become first-class owners of desktop behavior.

The repository also has an additive constraint for this implementation: existing DSH packages and their Cordis rows cannot change. The current client module catalog and connection provider are coupled to the Web server, so a zero-port IPC carrier cannot be introduced from a standalone package alone. The desktop package must preserve the existing Host and browser Cordis trees while isolating the unavoidable Electron bootstrap.

## Proposal

Publish `dsh-plugin-desktop` as a standalone dual-face DSH package and distribute its executable as the **DSH Desktop** application. The Electron executable performs only operations that precede any Cordis tree: it obtains the single-instance lock, prepares the persistent `desktop` profile, provides an Electron runtime capability, and boots the Host Cordis root in the Electron main process. Window, tray, navigation, close-versus-quit, and renderer-generation ownership belong to the `desktop-shell` Host plugin through one Cordis effect. Its client artifact is loaded by the existing client module graph like any other `dsh.client` package.

The first phase reuses the existing Web carrier. The launcher composes `PROFILE_TEMPLATES.web`, binds `webserver` to `127.0.0.1` on an ephemeral port, and loads the resulting same-origin page into a sandboxed `BrowserWindow`. This is an additive implementation constraint, not a new transport abstraction. The renderer retains the existing fetch and WebSocket connection provider, Host-authored plugin graph, vendored client Loader, slots, and services.

The persistent profile starts with the ordinary Web template bundles. Profile repair places the required `dsh-base` and `dsh-web-app` prefix first, removes the launcher package from the persistent list, and preserves every third-party bundle's relative order. The launcher inserts its desktop patch immediately after the Web application layer and before third-party layers. Profile-local and machine-wide user patches still apply after bundle layers; the loopback-only Web server overlay remains the final launcher-owned security invariant.

Bare plugin imports remain anchored at the persistent profile. A synchronous Node resolve hook applies only when `@deepseek-ai/cordis-plugin-loader` issues a bare import, preserving profile-local third-party dependencies and the healed installation fallback when packaged Electron does not expose Node's internal ESM Loader.

This proposal narrows the implementation route described by [GUI layering and RPC protocol](../../implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) under a strict additive constraint and preserves the [client plugin loading model](../../implemented/architecture/2026-07-23-client-plugin-loading-model.md). It does not supersede either note. A later transport-neutral upstream capability may replace the loopback carrier with IPC without changing profile ownership or the two Cordis plugin trees.

## Alternatives considered

**Start `dsh web` as a supervised child process.** This reuses the product quickly but leaves desktop lifecycle outside the Host Cordis tree and makes the launcher, rather than a plugin, the owner of native behavior.

**Implement an Electron IPC carrier entirely in the standalone package.** Existing client modules directly select the Web fetch and WebSocket provider, while the Host connection row registers routes on `webServer`. A standalone package cannot replace both sides without modifying or duplicating upstream composition.

**Persist `dsh-plugin-desktop` in the profile bundle list.** The package already inserts its own layer from its installation anchor. Persisting it would make startup depend on profile package resolution for the launcher itself and risks duplicate rows. Keeping it launcher-owned leaves the persistent list exclusively under ordinary plugin management.

**Fork the Web client or maintain an Electron plugin roster.** Either choice creates a second composition authority. Third-party `dsh.client` packages would then require Electron-specific registration or builds instead of following the Host-authored graph.

## Acceptance criteria

- A headless profile test proves a profile initially containing only `dsh-base` plus third-party bundles is repaired to the Web template prefix while preserving third-party order and unknown manifest fields.
- The desktop patch is composed after `dsh-web-app` and before third-party bundle layers, while profile and machine patches retain their established precedence.
- The Host plugin owns native shell setup and teardown through a Cordis effect; closing a window preserves the Host, while application quit and process signals use bounded Cordis disposal with timeout and repeated-request escalation.
- The browser artifact registers with the existing client module loader under the `dsh-plugin-desktop` graph id and cleans up its renderer marker on fiber disposal.
- The renderer has no Node integration or raw Electron API, exact-origin navigation stays on the loopback surface, and external allowlisted links open outside the application window.
- The npm launcher supports headless `--help` and `--version` paths without importing Electron, while its ordinary launch starts the persistent `desktop` profile.
- A package-level check compiles both faces, typechecks source and tests, runs the profile and lifecycle-focused tests, activates launcher-owned and profile-local plugins through a built headless Loader smoke, and verifies the publication file set.
- Before release, native-platform jobs verify packaged runtime closure, third-party Host and client plugin activation from an installed profile, installer behavior, signing, and platform trust checks.
- An installer release provides an explicit plugin-management path that can install profile dependencies without assuming a separately installed Node, DSH CLI, or pnpm.

## Risks

Loopback HTTP and WebSocket remain process-local network surfaces. Binding to `127.0.0.1`, using an ephemeral port, validating the exact renderer origin, and exposing no Electron bridge limit the first phase, but they do not provide the reachability properties of an IPC transport.

The Electron executable still contains a small pre-Cordis bootstrap because no plugin can create the tree in which it runs. Native behavior can drift back into that bootstrap unless new window, tray, and operating-system integrations are required to enter through the runtime capability and a Cordis-owned effect.

Published DSH prerelease packages can move independently from the parent source checkout. The standalone project therefore pins exact package versions and validates the installed public interfaces. A release must update the DSH family as one tested set rather than relying on dist tags.

Profile manifest changes are not watched in the first phase. Adding or removing a package requires application restart, and a malformed third-party layer can still fail the ordinary DSH Loader loudly during startup.

The source and npm workflow can use a separately installed `dsh plugin` command, but an installer-only user has no package manager entry yet. Bundling or brokering that management command must preserve the same profile manifest and package installation semantics rather than creating an Electron-owned registry.
