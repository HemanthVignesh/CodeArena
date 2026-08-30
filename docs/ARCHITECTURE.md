# CodeArena System Architecture

This document specifies the technical architecture for **CodeArena**, a production-grade online judge and competitive programming platform.

---

## 1. High-Level System Architecture

CodeArena uses a decoupled, asynchronous, event-driven architecture designed to separate interactive web traffic from CPU/memory-intensive, untrusted code execution.

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer"]
        UserBrowser["User Browser / SPA\n(Next.js React Client + Monaco Editor)"]
        AdminDashboard["Admin Dashboard\n(Next.js App Router)"]
    end

    subgraph ApplicationLayer ["Application Layer (apps/web)"]
        NextServer["Next.js Server (App Router)\n- Server Components\n- REST / Route Handlers\n- Server Actions\n- SSE Stream Handlers"]
        AuthModule["Auth Service\n(Session-based Auth)"]
        ProblemService["Problem Catalog & Search"]
    end

    subgraph DataAndQueueLayer ["Data & Messaging Layer"]
        PostgreSQL[("PostgreSQL\n(Prisma ORM)\nUsers, Problems, Submissions, TestCases")]
        RedisQueue[("Redis (BullMQ & Pub/Sub)\n- 'code-execution' Queue\n- 'submission-events' Pub/Sub")]
    end

    subgraph JudgeWorkerLayer ["Judge & Execution Layer (apps/judge-worker)"]
        WorkerManager["Judge Worker Dispatcher\n(BullMQ Consumer)"]
        SandboxPool["Docker Sandbox Manager\n- Resource Limiter (cgroups v2)\n- Syscall Filter (seccomp)\n- Isolated Network (--net=none)"]
        CodeRunner["Language Execution Runners\n(Python, C++, TypeScript/JS)"]
    end

    UserBrowser -->|HTTP / SSE| NextServer
    AdminDashboard -->|HTTP| NextServer

    NextServer --> AuthModule
    NextServer --> ProblemService
    NextServer --> PostgreSQL
    NextServer -->|Enqueue Job| RedisQueue

    WorkerManager -->|Consume Submission Job| RedisQueue
    WorkerManager -->|Fetch Test Cases| PostgreSQL
    WorkerManager --> SandboxPool
    SandboxPool --> CodeRunner

    WorkerManager -->|Publish Verdict Progress| RedisQueue
    RedisQueue -->|Pub/Sub Event| NextServer
    NextServer -->|SSE Realtime Stream| UserBrowser
    WorkerManager -->|Persist Verdict & Stats| PostgreSQL
```

> **Note on Architecture Evolution:** Infrastructure components like Edge WAF/CDNs (Cloudflare), Ingress Proxies (Nginx), S3/MinIO Object Storage for massive test cases, and AI Assistant integrations are part of the target production architecture but are **explicitly excluded from the MVP baseline** to maintain focus on the core vertical slice.

---

## 2. Monorepo Repository Structure

CodeArena is organized as a modular monorepo managed with **Turborepo** and **pnpm workspaces**.

```
codearena/
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, Typecheck, Test
│       └── deploy.yml             # Build & Deploy verification
├── apps/
│   ├── web/                       # Next.js (App Router) frontend & API backend
│   │   ├── app/
│   │   │   ├── (auth)/            # Login, Register
│   │   │   ├── (dashboard)/       # User profile, Submissions
│   │   │   ├── (platform)/
│   │   │   │   ├── problems/      # Problem list, search, tags
│   │   │   │   └── problems/[slug]/ # Problem view & Monaco IDE split-view
│   │   │   ├── admin/             # Basic problem & test case management
│   │   │   └── api/
│   │   │       ├── auth/          # Authentication handlers
│   │   │       ├── submissions/   # Run, Submit, History, SSE stream
│   │   │       └── problems/      # Problem CRUD & search
│   │   ├── components/            # UI components (Monaco editor, Test panel)
│   │   ├── hooks/                 # Custom React hooks (useSubmission, useSSE)
│   │   ├── lib/                   # API clients, auth session helpers, db instance
│   │   └── styles/                # Tailwind CSS configs and global styles
│   │
│   └── judge-worker/              # Asynchronous execution worker (Node.js/TypeScript)
│       ├── src/
│       │   ├── consumers/         # BullMQ queue consumer
│       │   ├── engines/           # Execution orchestrator per language
│       │   ├── sandbox/           # Docker runner wrapper (cgroups & seccomp)
│       │   ├── evaluators/        # Exact match and whitespace normalization
│       │   └── index.ts           # Worker bootstrap
│       ├── Dockerfile             # Multi-stage worker image
│       └── sandboxes/             # Language runner Dockerfiles
│           ├── cpp/
│           ├── python/
│           └── typescript/
│
├── packages/
│   ├── db/                        # Prisma schema, migrations, and client singleton
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/index.ts
│   │
│   ├── judge-shared/              # Shared types, judge status enums, execution DTOs
│   │   ├── src/
│   │   │   ├── types.ts           # SubmissionJob, ExecutionResult, Verdict
│   │   │   ├── constants.ts       # Time limits, Memory bounds
│   │   │   └── languages.ts       # Supported language metadata
│   │   └── package.json
│   │
│   ├── ui/                        # Shared UI primitives
│   ├── tsconfig/                  # Shared TypeScript configuration
│   └── eslint-config/             # Shared ESLint rules
│
├── docs/                          # Architectural, Database, Security, & Roadmap docs
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── SECURITY.md
│   ├── ROADMAP.md
│   └── MVP_SPEC.md
│
├── docker-compose.yml             # Local full-stack environment (Postgres, Redis, Worker)
├── turbo.json                     # Turborepo task pipeline
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Technology Choices & Trade-off Analysis

| Area                     | Chosen Technology                            | Alternatives Considered        | Trade-off Rationale                                                                                                                                                                                                             |
| :----------------------- | :------------------------------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Monorepo Management**  | **Turborepo + pnpm**                         | Nx, Polyrepo                   | Turborepo provides fast zero-config caching and lightweight configuration. pnpm saves disk space and strictly isolates dependencies. Shared types between `web` and `judge-worker` prevent API drift.                           |
| **Full-Stack Framework** | **Next.js (Current Stable App Router)**      | Vite SPA + Express API         | App Router gives hybrid Server Components for fast SEO problem rendering and Server Actions for low-boilerplate mutations, combined with Route Handlers for SSE streaming.                                                      |
| **Styling**              | **Tailwind CSS**                             | CSS Modules, styled-components | Rapid UI development, zero runtime overhead, excellent dark-mode support, and consistent token-driven design system.                                                                                                            |
| **Code Editor**          | **Monaco Editor**                            | CodeMirror, Ace                | Monaco powers VS Code, offering first-class syntax highlighting, keyboard shortcuts, and code editing for competitive programmers.                                                                                              |
| **Database & ORM**       | **PostgreSQL + Prisma**                      | Drizzle, TypeORM, MongoDB      | PostgreSQL offers rock-solid ACID transactions, relational integrity, and composite indices. Prisma provides type-safe query generation and migration tracking.                                                                 |
| **Queue & Messaging**    | **Redis + BullMQ**                           | RabbitMQ, Kafka, SQS           | Redis serves as both a low-latency cache and the backing store for BullMQ. BullMQ supports priority queues (run vs submit), retries, and events with minimal operational complexity.                                            |
| **Live Updates**         | **Server-Sent Events (SSE) + Redis Pub/Sub** | WebSockets, Polling            | SSE is unidirectional, lightweight, works seamlessly over HTTP, traverses corporate proxies, and requires no custom WebSocket connection handshake.                                                                             |
| **Code Sandboxing**      | **Docker with cgroups v2 + seccomp + tmpfs** | Firecracker, bare nsjail       | Docker with hardened non-root profiles, zero network (`--net none`), read-only root, memory/CPU cgroups, and seccomp syscall filtering offers the optimal balance between security, language versatility, and setup simplicity. |

---

## 4. Asynchronous Code Execution Flow

The code execution pipeline separates **Run Code** (testing against public sample cases / custom input) and **Submit Code** (grading against hidden test suites).

```mermaid
sequenceDiagram
    autonumber
    actor User as User Browser (Monaco IDE)
    participant NextAPI as Next.js API Layer
    participant DB as PostgreSQL (Prisma)
    participant Redis as Redis (BullMQ & Pub/Sub)
    participant Worker as Judge Worker
    participant Sandbox as Docker Sandbox

    User->>NextAPI: POST /api/submissions (code, lang, problemId, mode="SUBMIT")
    NextAPI->>DB: Create Submission record (status: "QUEUED")
    NextAPI->>Redis: Enqueue 'code-execution' job (submissionId, priority)
    NextAPI-->>User: Return { submissionId, status: "QUEUED" }

    User->>NextAPI: GET /api/submissions/:id/stream (SSE Connection)
    NextAPI->>Redis: Subscribe to channel "submission:{submissionId}"

    Worker->>Redis: Dequeue Job from 'code-execution'
    Worker->>Redis: Publish progress { status: "RUNNING", currentCase: 0 }
    Redis-->>NextAPI: Event "RUNNING"
    NextAPI-->>User: SSE Data: { status: "RUNNING" }

    Worker->>DB: Fetch problem test cases
    Worker->>Sandbox: Spin up isolated container with compiler & code

    alt Compilation Error
        Sandbox-->>Worker: Non-zero exit code + stderr
        Worker->>DB: Update Submission (verdict: "COMPILATION_ERROR", compileOutput)
        Worker->>Redis: Publish final verdict
    else Execution Loop (Test Cases 1..N)
        loop Each Test Case
            Worker->>Sandbox: Execute code with stdin (time/mem limits enforced)
            Sandbox-->>Worker: stdout, execution_time, memory_used, exit_code
            Worker->>Worker: Evaluate output vs expected (Exact match / Whitespace trimmed)
            opt Failure (WA, TLE, MLE, RE)
                Worker->>Worker: Record failed case, halt if fail-fast enabled
            end
        end
        Worker->>DB: Update Submission (verdict: "ACCEPTED" | "WRONG_ANSWER" | etc., stats)
        Worker->>DB: Update User Solved Stats (if Accepted)
        Worker->>Redis: Publish final verdict event
    end

    Redis-->>NextAPI: Final Event: { status: "COMPLETED", verdict: "ACCEPTED", runtime: 42ms }
    NextAPI-->>User: SSE Data: { status: "COMPLETED", ... }
    User->>User: Render verdict badge, runtime/memory stats & test case chips
```

---

## 5. Online Judge Verdict State Machine

The online judge categorizes execution outputs into deterministic verdicts:

```mermaid
stateDiagram-v2
    [*] --> QUEUED: User Submits Code
    QUEUED --> COMPILING: Worker Picks Up Job

    COMPILING --> COMPILATION_ERROR: Compiler Exits != 0
    COMPILING --> RUNNING: Compilation Succeeded / Interpreted

    state RUNNING {
        [*] --> RUN_CASE: Input fed to Sandbox
        RUN_CASE --> EVAL_OUTPUT: Process Finished
        RUN_CASE --> TIME_LIMIT_EXCEEDED: Wall/CPU time exceeded limit
        RUN_CASE --> MEMORY_LIMIT_EXCEEDED: OOM / cgroup memory exceeded
        RUN_CASE --> RUNTIME_ERROR: Non-zero exit code / Signal (SIGSEGV, SIGFPE)

        EVAL_OUTPUT --> WRONG_ANSWER: Output mismatch
        EVAL_OUTPUT --> NEXT_CASE: Output matches expected
        NEXT_CASE --> RUN_CASE: More test cases remain
    }

    RUNNING --> ACCEPTED: All test cases passed
    RUNNING --> TIME_LIMIT_EXCEEDED
    RUNNING --> MEMORY_LIMIT_EXCEEDED
    RUNNING --> RUNTIME_ERROR
    RUNNING --> WRONG_ANSWER
    RUNNING --> INTERNAL_ERROR: Sandbox or worker fault

    COMPILATION_ERROR --> [*]
    ACCEPTED --> [*]
    TIME_LIMIT_EXCEEDED --> [*]
    MEMORY_LIMIT_EXCEEDED --> [*]
    RUNTIME_ERROR --> [*]
    WRONG_ANSWER --> [*]
    INTERNAL_ERROR --> [*]
```

---

## 6. Supported Programming Languages

### MVP Languages:

1. **Python**: 3.12 (CPython)
2. **C++**: C++20 (GCC)
3. **TypeScript / JavaScript**: Node.js 20

### Language Specifications:

| Language          | Environment | Execution Command                                           | Default Time Limit | Default Memory Limit |
| :---------------- | :---------- | :---------------------------------------------------------- | :----------------- | :------------------- |
| **Python**        | Python 3.12 | `python3 solution.py`                                       | 2000 ms            | 256 MB               |
| **C++**           | GCC (C++20) | `g++ -O3 -std=c++20 solution.cpp -o solution && ./solution` | 1000 ms            | 256 MB               |
| **TypeScript/JS** | Node.js 20  | `node solution.js`                                          | 2000 ms            | 256 MB               |

_(Java, Rust, and Go are planned for Post-MVP)._
