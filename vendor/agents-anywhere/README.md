# Bundled Agents Anywhere (Beta)

Desktop consumes `@agents-anywhere/dsh-bridge-next` as an external package. The
pinned tarball is built from the AA v2 commit recorded in `provenance.json`;
Desktop does not require an adjacent AA checkout at runtime. It includes the
Host and browser bundles, their source maps, and Python Connector sources.
The source code is unchanged. The manifest has a Desktop build version and
explicit peers for both Desktop runtime versions (including the emitted
`dsh-llm` import). The SHA-256 identifies the exact shipped artifact.

## Updating

1. Check out the selected AA commit in a separate checkout.
2. In `dsh-bridge-next`, run `corepack yarn install`, `corepack yarn check`.
   Its integration tests also use `connector`, `contracts`, `desktop-workbench`
   and `server` from that same checkout, plus uv/Python.
3. In a staging copy, set a new exact Desktop build version and the reviewed
   runtime peer ranges. Package `package.json`, `lib`, `cordis.patch.yml`,
   `README.md`, `RUNTIME_READS.md`, and `USER_QUESTIONS.md` beneath `package/`
   in an npm-compatible tarball. Do not run lifecycle scripts when consuming it.
4. Update both Desktop dependencies, the root Yarn lockfile and provenance.
5. Run both Desktop checks and `DSH_VERIFY_AA=1 corepack yarn workspace
   <desktop-package> verify:profile`. Verify Python sources are unpacked outside
   `app.asar`, then test device onboarding against the matching AA Server/Web.

## Product behavior

The AA option is stored per Profile in Desktop preferences, independently of the
market provider. Old preferences and first-run selections default to disabled;
skipping Setup explicitly saves disabled. Safe Mode excludes AA. Changing the
option acknowledges persistence before scheduling a Desktop restart.

Enabling loads AA's bundle and exposes its Phone connection sidebar entry.
Account login and device pairing remain in AA. Connector startup requires uv
(on PATH or via `UV_PATH`) and Python 3.12+, and may download Python dependencies.
Desktop provides a Profile-specific discovery home (`agents-anywhere/runtime`
under the Profile), a Profile-specific state directory, and a physical Connector
source path. AA uses this discovery home only for its endpoint and Connector;
the actual Harness home and session storage remain unchanged. A Connector paired
with another Profile or the global DSH home cannot automatically attach to this
Profile. Existing per-Profile accounts remain valid and reconnect at the new
endpoint after restart; new Profiles must be authorized through Phone connection.
Selecting the option alone does not log in or start pairing.

## Validation of this pin

Both Desktop variants pass their build, type checks, unit suites, runtime
closure, CLI, Loader, profile, license and operation checks. The explicit AA
profile smoke checks both Host services and the browser module graph.

AA's own suite at the pinned commit passes 70 of 72 tests in an isolated copy.
The event and question Python/backend tests fail in Server migration `v2_14`:
SQLite rejects `ALTER COLUMN`. This is upstream Server test compatibility,
not a Desktop Loader failure. End-to-end pairing with a deployed AA Server has
not been performed here.

A macOS arm64 directory package passes the selective ASAR payload check and
contains the physical Connector sources. The existing final Electron fuses
hook fails to infer the architecture of the directory-only target; a complete
release/package gate is therefore not claimed for this validation.
