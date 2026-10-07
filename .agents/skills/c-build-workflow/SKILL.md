---
name: c-build-workflow
description: "Runbook for building native C code, running test runners, and adhering to the Core C preference rule."
---

# Native C Build Runbook

## Rules
- Strictly avoid modifying Core C unless there is a demonstrable, severe performance constraint.
- Run test suite: `make test` or `./tests/test_runner`.
