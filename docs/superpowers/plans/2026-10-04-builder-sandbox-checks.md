# Builder Sandbox, Step 1 — Run Checks in E2B — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** The builder runs the generated project in an E2B sandbox (install, import,
pytest, and single debug commands) and fixes what fails before packaging. No UI change.

**Design:** `docs/superpowers/specs/2026-10-04-builder-sandbox-design.md`

**Architecture:** `sandbox.py` owns a process-local registry of ADK `E2BEnvironment`s,
one per chat session, plus sync/install/run helpers. `tools/sandbox_tools.py` exposes
`run_checks` and `run_in_sandbox`, registered only when `E2B_API_KEY` is set. The
backend workspace stays the source of truth; every run re-uploads the project.

## Global Constraints

- Generated code never runs on the backend. Only the sandbox executes it.
- No server environment variable reaches the sandbox; it gets an explicit allow-list.
- Only signed-in users (`u_` ADK ids) may run code, unless
  `BUILDER_SANDBOX_SIGNED_IN_ONLY=0` (local dev).
- Without `E2B_API_KEY` the builder behaves exactly as before.
- Tests never call E2B: they use a scripted environment and ADK's `LocalEnvironment`.

---

### Task 1: Shared project file set — DONE

- [x] Move the "files that ship" rule (no caches, no `.env`, no `.pyc`, no symlinks or
      escapes) into `workspace.project_files()`; the zip and the sandbox upload both use it.

### Task 2: Sandbox runner — DONE

- [x] `sandbox.py`: settings from env, `enabled()`, `may_run(user_id)`, registry with a
      lock per session, idle reaping, max-active cap.
- [x] `sync_project`: tar.gz → `write_file` → clean extract under `projects/`.
- [x] `ensure_requirements`: marker per `requirements.txt` hash inside the sandbox.
- [x] `run_command`: `cd` into the project, timeout, output tail.

### Task 3: Tools and prompt — DONE

- [x] `run_checks` (sync → Python version → install → import `<package>.agent` → pytest;
      exit code 5 "no tests" counts as passing with a note).
- [x] `run_in_sandbox(command)`.
- [x] Runs counted in session state; refuse past `BUILDER_SANDBOX_MAX_RUNS`.
- [x] Prompt section when the sandbox is enabled: run checks after validation, mock
      external calls in tests, tell anonymous users once that running needs sign-in.

### Task 4: Template and docs — DONE

- [x] `sandbox_template.py`: E2B template from Python 3.11 + nuvel's template
      `requirements.txt` + pytest (`python -m adk_agent_builder.sandbox_template`).
- [x] README: setup, variables, limits.

### Task 5: Tests — DONE

- [x] Gate (anonymous, disabled, quota, busy), step reporting, truncation, sync of
      deleted files, install marker, through a scripted environment.
- [x] One real run with `LocalEnvironment`: a scaffolded project is uploaded, imported
      and its tests run.

### Follow-ups (Step 2+)

- Live preview canvas (`adk web` in the sandbox), preview access control, LLM key policy.
