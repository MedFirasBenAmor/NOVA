# Intelligent Collection Strategy

The Intelligence Engine extracts observations. The Completeness Resolver determines which required catalog datapoints are missing. Collection Strategy deterministically chooses the lowest-effort reasonable next action; it never replays conversation text to establish business truth.

`NextAction` is a discriminated shared contract: `COMPLETE`, document suggestions, `ASK_DATAPOINT`, conservative grouped questions, and future confirmation. UI metadata comes from the active `DatapointDefinition` (enum options, boolean, number, date, or text semantics).

The capability registry maps real collection mechanisms to existing catalog keys. The MVP has a driver's-license full-document capability and a smaller targeted-capture capability. A document is suggested only when it covers at least two currently missing datapoints. `questionsPotentiallyAvoided` is that current covered count, not a time estimate.

Progressive collection is persistent: a declined full document is not proposed again; the targeted capture is considered next; if that is declined, NOVA asks a datapoint manually. Document refusal never blocks the journey. Accepted/completed upload processing is future work, so this task records the decision but does not pretend to extract data.

Conversation messages are interaction history only. `CustomerFolder` and append-only datapoint provenance remain structured business truth. Message content is stored only in `ConversationMessage`; audit events contain identifiers and action names, never raw text or provider context.

The principle is: **NOVA does not ask what it can obtain more efficiently another way.** Future Document/OCR and Learning engines can add capabilities and measurements without changing this contract. A future Merge Engine will resolve conflicting candidate observations; this strategy does not overwrite datapoints.
