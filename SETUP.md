# Atrium — Setup

This guide takes a fresh macOS (or Windows / Linux) machine to a running Atrium dev window. No assumed knowledge.

If something doesn't match what's on your screen, that's a documentation bug — open an issue or fix this file.

---

## 1. One-time install (do these once per machine)

These are the toolchains Atrium depends on. Already have them? Skip ahead.

### 1.1 Install Bun

Bun is the package manager and JS runtime Atrium uses (instead of Node + npm).

**macOS / Linux** — open Terminal and run:

```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell)**:

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

Close and re-open your terminal. Verify:

```bash
bun --version
```

You should see something like `1.3.13` or newer.

### 1.2 Install Rust

Tauri's core is a Rust binary. You need the Rust toolchain to compile it.

**All platforms**: <https://rustup.rs/>

Or in Terminal:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Press Enter to accept defaults. Close and re-open your terminal. Verify:

```bash
cargo --version
rustc --version
```

You should see `cargo 1.94.0` (or newer) and `rustc 1.94.0` (or newer).

### 1.3 Install platform build tools

Tauri compiles native binaries, so you need your OS's standard build toolchain.

**macOS** — install Xcode Command Line Tools:

```bash
xcode-select --install
```

A dialog will pop up. Click **Install** and wait (it can take 15–20 minutes the first time).

**Windows** — install [Visual Studio 2022 Build Tools](https://visualstudio.microsoft.com/downloads/?q=build+tools) with the **"Desktop development with C++"** workload.

**Linux (Ubuntu/Debian)**:

```bash
sudo apt update && sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### 1.4 Install the Claude CLI

Atrium spawns the real `claude` binary as a sidecar — it doesn't reimplement Claude Code.

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Sign in once:

```bash
claude auth
```

Atrium inherits this session — there's no separate auth in Atrium.

---

## 2. Each-time-you-pull setup

Run this every time you clone the repo or pull new changes that touch dependencies.

### 2.1 Install JS dependencies

```bash
cd path/to/atrium
bun install
```

You should see something like `73 packages installed` and a `node_modules/` folder appear.

### 2.2 Configure environment variables

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. For T-001 there are no required values — Atrium runs with the file empty. Later tickets will document which keys you need.

---

## 3. Run the app

```bash
bun tauri dev
```

**First run takes 5–10 minutes** because Cargo compiles the entire Tauri Rust core from scratch. Subsequent runs are seconds.

You should see:

1. Vite logs: `VITE v7.x.x ready in ~XXX ms`
2. Cargo logs: `Compiling atrium v0.1.0 (.../src-tauri)`
3. A native window opens titled **Atrium** showing a centered "Atrium" headline and a small subtitle "Tauri 2 · React 19 · Vite · Tailwind".

If you see that window — you're done. Edit `src/App.tsx` and changes appear instantly via Vite HMR.

---

## 4. Build a release binary (optional)

```bash
bun tauri build
```

Produces a signed `.app` bundle in `src-tauri/target/release/bundle/macos/` (macOS), `.msi` on Windows, or `.AppImage` on Linux. **Code signing and notarisation are out of scope for v0.x** — see CLAUDE.md.

---

## Troubleshooting

### "linker `cc` not found"

You skipped the platform build tools step (§1.3). Go back and install them.

### "command not found: bun" or "command not found: cargo"

Your terminal is using an old environment. Close and re-open your terminal completely (not just the tab).

### Vite warns about Node version

Atrium uses Bun, not Node. Vite's warning is cosmetic — you can ignore it. If it bothers you, install Node 22 alongside Bun via [nvm](https://github.com/nvm-sh/nvm).

### Tauri dev window doesn't open

Check that `src-tauri/target/` was created. If Cargo failed silently, run `cd src-tauri && cargo check` to see the real error.

### Anything else

Open an issue with the full error output, your OS + version, and `bun --version` + `rustc --version`.
