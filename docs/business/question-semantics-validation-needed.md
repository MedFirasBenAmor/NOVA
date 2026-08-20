# Question Semantics Validation Needed

This document records source-supported business concepts that NOVA must not
silently normalize without explicit option or structure validation from the
AutoHabitation reference.

## Implemented From Explicit Source Options

- `request.type`
  - Source question: "Quelle est votre situation ?"
  - Canonical values:
    - `BUNDLE_POLICIES` = Regroupement de contrats
    - `RENEWAL` = Renouvellement
    - `NEW_ACQUISITION` = Nouvelle acquisition
    - `MIXED_NEW_ACQUISITION_AND_RENEWAL` = Nouvelle acquisition pour un produit et renouvellement pour l'autre
- `customer.occupancy_status`
  - Canonical values:
    - `OTHER_SITUATION` = Autre situation
    - `TENANT_OCCUPANT` = Locataire occupant
    - `OWNER_OCCUPANT` = Propriétaire occupant

## Business Validation Required

- `customer.gender`
  - The catalog has the concept, but the active source material used here does
    not provide a safe finite option set.
- `customer.marital_status`
  - The catalog has the concept, but the active source material used here does
    not provide a safe finite option set.
- `co_applicant.civility`
  - The source mentions civility/title, but this milestone did not find an
    authoritative finite value set to encode.
- `vehicle.requested_coverages`
  - The source asks for current or desired protections, but the exact option
    inventory and structure are not fully established. The current catalog keeps
    this as an explicit unresolved structured coverage concept.
- `property.animal_type`
  - The source provides examples such as dogs, cats, reptiles, exotic animals,
    and none, but the exact single-versus-multiple selection semantics still
    need business confirmation.
- `property.detached_structures`
  - Structured representation requires validation before customer rendering.
- `property.renovations_summary`
  - Structured representation requires validation before customer rendering.
- `property.valuable_items_summary`
  - Structured representation requires validation before customer rendering.

## Deferred Relationship Gap

- Additional-driver claims remain a business architecture gap until NOVA has a
  safe relationship model for `CLAIM belongs to ADDITIONAL DRIVER`.
