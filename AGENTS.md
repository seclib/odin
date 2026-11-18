# ETHAN OS

## Objective

Configure yourself to operate as a first-class engineering agent within the ETHAN OS project.

You must share the same architectural understanding, technical history, engineering constraints, and persistent knowledge base as Cline and Codex.

The canonical project repository is:

`/home/fatsio/AI/Ethan`

The canonical technical knowledge base is:

`~/AI/Ethan/daena`

## 1. Initial Repository Inspection

Before creating or modifying anything:

- Inspect the Git repository and current working tree.
- Identify existing `AGENTS.md`, `GEMINI.md`, `.agents/`, `.agent/`, and other agent configuration files.
- Read `~/AI/Ethan/daena/AGENTS.md`.
- Read `~/AI/Ethan/daena/README.md`.
- Inspect the current daena structure and metadata conventions.
- Identify existing Antigravity customizations.
- Preserve all existing configurations and user modifications.

Do not create duplicate instruction systems.

## 2. Persistent Project Rules

Configure Antigravity using its native customization mechanisms.

Use:

- `AGENTS.md` for permanent project instructions.
- `.agents/rules/` for architectural constraints.
- `.agents/workflows/` for repeatable engineering procedures.
- `.agents/skills/` for reusable ETHAN-specific procedures.

Rules must remain concise and reference the canonical daena documentation rather than duplicating hundreds of existing documents.

## 3. Mandatory Daena Protocol

At the beginning of every engineering task:

1. Read the canonical project instructions.
2. Identify the active engineering campaign.
3. Retrieve relevant architecture documentation.
4. Retrieve relevant ADR, ESR, and ASR documents.
5. Search previous investigations and attempts.
6. Review related incidents and anomalies.
7. Review relevant runbooks.
8. Establish the latest verified implementation state.

Never assume that a new task starts from zero.

Do not indiscriminately load the entire daena repository.

Use targeted document retrieval.

## 4. Continuous Learning Loop

Apply the ETHAN ECLL process:

`RETRIEVE → ANALYZE → COMPARE → PLAN → EXECUTE → EVALUATE → CAPITALIZE`

Before repeating a previous approach, identify:

- What was attempted.
- Why it failed or partially worked.
- Which conditions have changed.
- What evidence supports a different approach.

Record significant attempts in Operational-Memory.

Preserve failed and superseded attempts.

Never rewrite history to conceal failures.

## 5. Architecture Constraints

Respect ETHAN's existing architecture:

- Core-first architecture.
- HROT as the canonical security authority.
- Existing ProviderManager.
- Existing Application Manager.
- Existing integration registries and repositories.
- Existing lifecycle and dispatch mechanisms.

Do not create duplicate managers, registries, gateways, or parallel systems.

Do not bypass authorization.

Do not silently install, start, or execute discovered applications.

## 6. Current Engineering Context

The current functional priority includes Dynamic Tool & Application Integration.

ComfyUI is the application integration pilot.

Its discovery and catalog API were previously validated, but its actual browser display remained unconfirmed.

A possible environment configuration mismatch involving `NEXT_PUBLIC_ETHAN_API_URL` and `ETHAN_API_URL` was identified.

Continue from the latest verified state.

Knowledge Workspace Phase 0 and Phase 1 documentation exist, but implementation is suspended.

Do not resume that implementation unless explicitly requested.

Quantar remains paused.

## 7. Engineering Preservation

Before making any changes:

- Record the Git branch and HEAD.
- Record staged, unstaged, and untracked changes.
- Preserve existing modifications.
- Inspect runtime state before deployment.

Do not execute destructive Git or Docker operations without explicit authorization.

Do not commit or push unless explicitly requested.

## 8. End-of-Task Documentation

After every significant engineering intervention:

- Update the existing campaign report.
- Record significant attempts.
- Update relevant architecture documentation.
- Update anomalies when their status changes.
- Update runbooks when procedures change.
- Preserve historical records.
- Add wikilinks where appropriate.

Clearly distinguish:

`PROPOSED`, `IMPLEMENTED`, `TESTED`, `RUNTIME_VALIDATED`, `E2E_VALIDATED`, `PARTIAL`, and `BLOCKED`.

Never claim validation without evidence.

## 9. Cross-Agent Continuity

Antigravity must work with the same durable technical memory as Cline and Codex.

Do not create a separate Antigravity project history.

All significant engineering knowledge must be recoverable from daena.

Another agent must be able to continue the work without relying on hidden conversation history.

## 10. Deliverables

First inspect the repository and propose the smallest appropriate customization structure.

Then configure the native Antigravity rules, workflows, and skills.

Do not modify ETHAN production code during this configuration task.

Report:

- Existing configurations discovered.
- Files created or modified.
- Rules activated.
- Workflows created.
- Skills created.
- Daena access verification.
- Remaining limitations.

---

# AGENTS.md — ETHAN Architecture Guidelines

# ETHAN's First Law

ETHAN is the system.

Core represents intelligence.

Runtime represents orchestration.

Services represent infrastructure.

Interfaces represent the means of interacting with ETHAN.

---

A capability must be implemented in Core or Runtime whenever it remains meaningful even if all interfaces disappear.

A capability belongs to an interface only when it concerns display, user experience, or interaction.

---

ETHAN must continue to operate when:

- The WebUI is stopped.
- The CLI is unavailable.
- No Desktop application exists.

---

Interfaces reveal ETHAN.

They do not define it.

An interface may:

- Display.
- Visualize.
- Configure.
- Trigger.
- Supervise.

An interface must not:

- Implement business logic.
- Store business state.
- Define providers.
- Define agents.
- Define memory.
- Define RAG.
- Define missions.

Every ETHAN capability must exist in Core or Runtime before being exposed through an interface.

Interfaces are replaceable.

ETHAN must continue to operate even when all interfaces are stopped.

Every new feature must answer the following question:

"Does this capability belong to ETHAN or to its interface?"

If it belongs to ETHAN, it must be implemented in Core or Runtime.

## Mission

You are working on ETHAN, a modular AI system composed of a Core, a Runtime, services, and multiple interfaces.

ETHAN is not a Web application.

ETHAN is an intelligent runtime to which different interfaces can connect.

---

# Fundamental Principle

## ETHAN Exists Independently of Its Interfaces

Interfaces do not define ETHAN.

They reveal it.

The following components are interfaces:

- WebUI
- CLI
- Desktop
- Mobile
- External APIs

They provide ways to interact with ETHAN but must not become the owners of its business capabilities.

---

# Source of Truth

The source of truth must remain:

```text
core/
runtime/
services/
```

ETHAN capabilities must belong to Core or Runtime.

Examples:

- LLM Providers
- AI Models
- AI Configuration
- RAG
- Documents
- Memory
- Planner
- Agents
- Skills
- Knowledge
- Automation

These components must never be implemented exclusively within an interface.

---

# Absolute Rule: Avoid Duplication

Before creating a new feature:

1. Check whether it already exists in `core/`.
2. Check whether it already exists in `runtime/`.
3. Reuse existing implementations whenever possible.
4. Migrate to Core if business logic currently resides inside an interface.

Never create:

```text
core/providers/
interfaces/webui/providers/
```

with two different implementations of the same logic.

There must be a single implementation:

```text
core/providers/
```

The WebUI must only display and control it.

---

# Interface Responsibilities

Interfaces may contain:

- UI components.
- Pages.
- Forms.
- Themes.
- Navigation.
- Visualization.
- User experience.

Interfaces must not contain:

- ETHAN business logic.
- Actual provider management.
- RAG engine.
- Memory.
- Planning.
- Agent intelligence.

---

# LLM Provider Example

Incorrect:

```text
WebUI
 └── Ollama configuration
 └── Active model
 └── Connection logic
```

Correct:

```text
ETHAN Core

providers/
 └── ollama

ETHAN Configuration
 └── Active provider

WebUI
 └── Displays
 └── Updates through API
```

---

# RAG Example

Incorrect:

```text
WebUI
 └── Complete RAG implementation
```

Correct:

```text
ETHAN Core

rag/
 ├── ingestion
 ├── embeddings
 ├── retrieval
 └── context

WebUI
 └── Document interface
```

---

# Target Architecture

```text
                  ETHAN

          Core + Runtime + Services

                    |
                    |

              API / Events

                    |

     ---------------------------------

     WebUI        CLI        Desktop

     Interface   Interface   Interface
```

Every interface uses the same ETHAN capabilities.

---

# New Interface

When creating a new interface:

Do not recreate ETHAN.

Do not recreate:

- Providers
- Memory
- RAG
- Agents
- Skills
- Configuration

Create only a new representation.

An interface must ask:

"What capabilities does ETHAN provide?"

Not:

"How can these capabilities be recreated?"

---

# Existing Code Migration

If a feature exists in the WebUI but should belong to Core:

Do not remove it abruptly.

Follow this procedure:

1. Identify the business logic.
2. Move it to Core/Runtime.
3. Create an API or service access layer.
4. Transform the WebUI into a client.
5. Verify that the CLI and other interfaces can use the same capability.

---

# Long-Term Vision

ETHAN must be able to operate without the WebUI.

ETHAN must be able to operate without the CLI.

ETHAN must support:

- Desktop Jarvis
- Voice Assistant
- Mobile
- Autonomous Agents
- New AI Providers

All these interfaces must discover and use the same ETHAN system.

---

# Final Rule

Before making any modification, always ask:

"Am I building ETHAN, or am I only building an interface for ETHAN?"

If the answer concerns an intelligent capability, it belongs in Core.

---

# Cross-Session Memory Protocol — Codex

## Memory Files

- `docs/memory/README.md`: Minimal conventions.
- `docs/memory/PROJECT_STATE.md`: Current state, next task, and blockers.
- `docs/memory/DECISIONS.md`: Validated decisions, proposals, and assumptions.
- `docs/memory/sessions/YYYY-MM-DD.md`: Dated session archives.

## Session Start

1. Read `AGENTS.md`, followed by `docs/memory/PROJECT_STATE.md`, `docs/memory/DECISIONS.md`, and the latest available session archive.
2. Check the repository state, especially local modifications and untracked files, before taking any action.
3. Cross-check reports against the actual repository. A previous intention is never a validated decision unless explicitly stated.
4. Distinguish verified facts, assumptions, and recommendations.

## During the Session

- Reuse existing structures instead of creating duplicates.
- Do not modify application behavior, migrations, or production configuration for a documentation-only task.
- Never archive secrets, tokens, passwords, private keys, or personal data.

## Session End

1. Update `docs/memory/PROJECT_STATE.md` with the current state, next task, and blockers.
2. Update `docs/memory/DECISIONS.md` only for decisions that have actually been made and validated.
3. Create or update `docs/memory/sessions/YYYY-MM-DD.md`, clearly separating:
   - Changes made.
   - Tests executed.
   - Results.
   - Assumptions.
   - Incomplete tasks.
4. Preserve existing modifications and never perform destructive Git operations.

All work performed on ETHAN must be recorded in its Engineering Memory.

No agent must consider its work complete until the corresponding events, results, and evidence have been documented.

Raw data must be preserved whenever its historical or evidentiary value justifies retention.

Summaries must never replace original archives.

---

## Final Principle

Antigravity is another engineering agent working on ETHAN.

It must share the same architecture, the same technical memory, and the same engineering history.

**One project. One architecture. One persistent engineering memory. Multiple collaborating agents.**