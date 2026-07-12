# AGENTS.md

Version: 1.0
Status: Approved
Owner: MoneyPulse Leadership

## Purpose

This file defines how development work must be performed on MoneyPulse.

## Required Reading Order

Before implementing anything, read:

1. `docs/00_GOVERNANCE/PRODUCT_MANIFESTO.md`
2. `docs/00_GOVERNANCE/PRINCIPLES.md`
3. `docs/01_PRODUCT/PRODUCT.md`
4. `docs/03_ENGINEERING/ARCHITECTURE.md`
5. `docs/04_AI/DECISION_ENGINE.md`
6. `docs/05_MANAGEMENT/TASKS.md`

## Rules

- Never invent undocumented features.
- Never add complexity without a documented reason.
- Documentation wins over code when conflicts exist.
- Keep the Decision Engine deterministic and explainable.
- Mobile-first always.
- TypeScript strict mode always.
- Backend must expose simple REST APIs.
- Update `CHANGELOG.md` after every completed task.

## Product Rule

Every screen must help the user answer one question:

- How much can I safely spend today?
- Can I afford this before I buy it?
- What happens next?
- What should I improve?

## Engineering Rule

The core must be pure:

- no database access;
- no HTTP calls;
- no hidden state;
- same input, same output.
﻿2026-07-11T18:20:17.6787592Z Node 20 is being deprecated. This workflow is running with Node 24 by default. If you need to temporarily use Node 20, you can set the ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION=true environment variable. For more information see: https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/
Run actions/setup-node@v4
Attempting to download 20...
(node:2318) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Acquiring 20.20.2 - x64 from https://github.com/actions/node-versions/releases/download/20.20.2-23521894959/node-20.20.2-linux-x64.tar.gz
Extracting ...
/usr/bin/tar xz --strip 1 --warning=no-unknown-keyword --overwrite -C /home/runner/work/_temp/3d53aedc-6cfb-45bc-8771-d4f085d8d6a4 -f /home/runner/work/_temp/b50cf9f5-a56f-41c3-bece-d9c0de11a70e
Adding to the cache ...
Environment details
Unable to locate executable file: pnpm. Please verify either the file path exists or the file can be found within a directory specified by the PATH environment variable. Also check the file mode to verify the file is executable.