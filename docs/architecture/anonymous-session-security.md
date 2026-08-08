# Anonymous session security

Anonymous customers do not need accounts, but anonymous does not mean that a raw lead ID is authorization. NOVA creates a cryptographically random browser token, stores only its SHA-256 hash, and sets the raw token in an HttpOnly cookie. Customer lead routes require that cookie to resolve to the requested lead, and expired/revoked/missing tokens are rejected.

The browser may retain a lead ID as a resume reference, but it is not sufficient to read or mutate conversation, datapoints, completeness, collection actions, or documents. The cookie uses `SameSite=Lax`, production `Secure`, a configurable TTL, and a configurable name. Raw tokens are never logged or persisted.

The current cookie is an anonymous development boundary. Future rotation, session revocation, device/session management, and a signed anonymous-session token can strengthen it without changing domain ownership checks.
