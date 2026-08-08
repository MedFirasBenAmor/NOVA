# Document upload boundary

> **Receiving a document and understanding a document are separate responsibilities.**

The upload boundary accepts a file for an accepted `CollectionAttempt`, validates it, stores it privately, and records safe metadata. It does not classify the document, run OCR, extract facts, or create datapoints. **Document upload must never create business datapoints until a Document Engine has actually extracted and validated them.**

## Domain and lifecycle

`Document` links the Lead, CustomerFolder, optional scoped entity, and originating CollectionAttempt. `FULL_DOCUMENT` and `TARGETED_CAPTURE` are distinct database values so privacy choices and future analytics remain measurable.

Statuses are `PENDING_UPLOAD`, `UPLOADED`, `PROCESSING`, `PROCESSED`, `FAILED`, and `REJECTED`. This MVP performs only the real transition to `UPLOADED`. Consent changes the CollectionAttempt to `ACCEPTED`; only successful byte storage and metadata persistence changes it to `COMPLETED`.

An uploaded, unprocessed document produces `WAIT_FOR_PROCESSING`. Collection Strategy does not immediately ask manual questions for information that may be present in that document.

## Private storage

`DocumentStorageProvider` owns binary operations. The development implementation writes random-keyed files under configurable `DOCUMENT_STORAGE_PATH` with private file permissions. The directory is outside Next.js public assets and Git-ignored. APIs never return `storageKey` or filesystem paths.

Allowed types are JPEG, PNG, WebP, and PDF. NOVA checks configured size limits, MIME allowlisting, and basic magic bytes. Original filenames are sanitized and are never storage keys. If storage succeeds but database persistence fails, NOVA attempts to delete the stored bytes.

## Security boundary

The action ID must belong to the URL lead, represent a document capability, and be `ACCEPTED`. The current browser session still relies on possession of a lead ID in local storage; this is a development limitation, not strong authorization. The verification is isolated in the document service so a signed anonymous-session token can replace it later.

Production work still requires private cloud object storage, malware scanning, retention/deletion policies, stronger anonymous-session authorization, and operational monitoring. No public download URL or document-content logging exists.

Targeted capture is specifically intended to reduce unnecessary disclosure: the customer is asked to photograph only the relevant section, but NOVA does not claim it technically removes information outside the submitted image.

The future Document Engine will move documents through processing, classification, OCR, extraction, candidate datapoints, provenance, and completeness recalculation. Those responsibilities remain outside this boundary.
