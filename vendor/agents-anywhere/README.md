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

Enabling adds AA to the selected bundle list, resolves it through the same
Desktop/Profile package overlay as dshmarket, and reads the package's declared
`dsh.bundle.patch`. Desktop preserves that patch and supplies only the real
DSH home and the physical Connector payload path required by Electron ASAR.
The package retains ownership of login, device pairing, account storage, and
its native runtime endpoint. Desktop does not rewrite `stateRoot` or invent a
separate DSH home for each Profile. Native AA account/device state may therefore
be reused across Profiles; the Desktop enable/disable preference stays per Profile.

A missing or malformed bundle, invalid canonical entry, missing Connector
payload, or conflicting AA user patch disables AA for that generation. Desktop
logs the diagnostic and Settings shows a retry action. This preflight follows
the market loading boundary; it does not suppress arbitrary errors thrown later
by a plugin during Cordis initialization.

Connector startup requires uv (on PATH or via `UV_PATH`) and Python 3.12+, and
may download Python dependencies. AA's native handling of an installed Agents
Anywhere desktop app remains in effect. The older `@agents-anywhere/dsh-bridge`
is a separate user plugin, not the bundled `dsh-bridge-next`; its configuration
is not migrated or removed by this option.

The earlier integration wrote AA accounts under each Profile's `agents-anywhere`
directory. Those files are preserved but are no longer selected automatically;
users may need to sign in once using AA's native state directory. No account,
credential, or device binding is silently copied between the two layouts.

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
