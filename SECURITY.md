# Security Policy

## Supported Versions

FrictionTrace is pre-1.0. Only the latest state of the default branch receives security fixes.

| Version | Supported |
|---|---|
| 0.1.x (main) | ✅ |
| < 0.1 | ❌ |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report vulnerabilities privately via [GitHub Security Advisories](https://github.com/eidast/frictiontrace/security/advisories/new), or by email to eidast@gmail.com.

Include: a description of the issue, steps to reproduce, the affected component (`engine`, `packages/cli`, `scripts/`), and the potential impact. You can expect an acknowledgment within 72 hours.

## Scope notes

- **Secrets**: the CrUX API key lives in a local `.env` (see `.env.example`) and must never be committed. If you believe a key has leaked into the repository or its history, report it immediately through the channels above.
- **Local data**: `data/*.db` and `runs/` contain only publicly observable web performance metrics and page captures; they hold no credentials or personal data by design.
- **Auditing third-party sites**: the tool drives a real browser against target sites. Run it only against sites you own or are authorized to test.
