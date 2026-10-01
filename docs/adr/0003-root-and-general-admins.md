# 0003 — Root admin and invitation-only general admins

## Context

Admins have broad access. Public admin sign-up is unacceptable, and someone must be able to bootstrap the first
admin on a fresh deployment.

## Decision

- One **root** admin is created idempotently by the seed from `ROOT_ADMIN_EMAIL` / `ROOT_ADMIN_PASSWORD`. Its
  password cannot be changed or reset through the app; rotation happens through config + reseed. It cannot be
  disabled.
- **General** admins only join through an email invitation created by root: random token, stored hashed,
  single-use, 48h expiry, revocable. Accepting it creates an already-verified ADMIN/GENERAL account.
- General admins manage their password like users (change + forgot password).
- Capability checks live in `@offerleap/shared` (`isRootAdmin`, `canManageOwnPassword`, `canInviteAdmins`).

## Consequences

- No credential-reset path exists for root inside the product, which removes a high-value attack surface but
  requires server access to rotate.
- Losing root access means updating env and redeploying.
