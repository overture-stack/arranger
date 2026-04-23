# @overture-stack/sqon

Shared SQON definitions for Overture services.

## Purpose

- Define SQON syntax in a centralized place, using Zod Schemas.
- Export TypeScript types from the same shared source code.
- Export a JSON Schema derived from the Zod schema.

## Notes

- This package is intentionally both transport- and endpoint-agnostic.
- Runtime-specific behavior (for example, warnings, normalization side-effects, ACL) belongs in consuming services.
