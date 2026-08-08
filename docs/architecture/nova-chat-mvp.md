# NOVA Chat MVP

> **NOVA Chat is a renderer and interaction channel for intelligent collection. It is not the owner of insurance business logic.**

The backend selects `NextAction`; the client renders it. React does not contain an ordered insurance questionnaire. `NextActionRenderer` handles document suggestions, targeted capture, structured datapoint inputs, confirmation, grouped fields, and completion using shared contracts.

An anonymous visit creates a Lead and Conversation and stores only the lead ID in browser local storage. Returning visits validate that ID through the conversation endpoint and resume stored customer messages. This isolated browser reference can later be replaced by a signed anonymous-session token. No customer account is required.

Conversation messages are interaction history. CustomerFolder and datapoint provenance remain business truth. Structured answers use the collection-action answer endpoint so the backend writes the datapoint, recalculates completeness, and chooses the next action.

Document upload and targeted capture are optional UI suggestions. Declining them is fully functional and progresses to the next backend action. Accepting displays an explicit preview limitation; no upload, OCR, extraction, or fake datapoints are created. Refusal never blocks manual entry.

The layout is mobile-first with a scrollable transcript, sticky composer, touch-sized controls, semantic inputs, and a restrained progress bar. The same shell gains spacing and a bounded surface on desktop rather than becoming a separate application. Customer-facing copy is isolated in renderer components so future French/localized strings can replace it without moving business decisions into the client.

Privacy boundaries: API keys are never exposed, the browser stores only the lead reference, and the UI makes no unsupported encryption, deletion, validation, approval, or eligibility claims.

The principle is: **The customer should only be asked for information that NOVA cannot obtain more efficiently through another acceptable source.** Future Document Engine integration will fulfill accepted upload actions while preserving the same `NextAction` boundary.
