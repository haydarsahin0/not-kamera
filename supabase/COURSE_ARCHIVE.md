# Lecture reference archive

Active course: Produktion und Logistik. The server overrides stale device profiles;
rules from a different course are discarded. No firmware update is required.

263 original pages from eight supplied PDFs are stored privately in
`not_kamera_course_pages`, with PDF filename, 1-based PDF page, extracted text and
1500-pixel-wide JPEG rendering. These assets must NOT be committed to the public
repository. Provisioning SQL is `course-schema.sql`; only the service role may read.

For each new analysis GPT-6.1 Terra selects up to eight relevant original page images using
the complete text catalog and the current/prior question photos. The final solving
request receives the full lecture text, selected original page images and separate
question photos. Lecture examples never override question data. Source selection
is bounded to 45 seconds within the existing 140-second job budget; one bounded
answer repair remains. Missing assets or invalid source IDs fail visibly.

The authenticated `/api/course` endpoint reports archive readiness. Jobs include
`source_refs` listing pages supplied to the solver (not a guarantee every page was
cited or used). Lecture page IDs never enter the prior-question context indices.

Course revision participates in cache identity. To replace the active course,
update `course.ts`, import assets and verify the readiness endpoint. This release
intentionally makes Produktion und Logistik the active course for all clients.
It does not add a multi-course UI. No model is trained or fine-tuned on the PDFs.

Limitations: PDF text extraction can misorder formulas; selected original images
are provided to mitigate this. Relevant-page selection and generated solutions
are not infallible. The 200x200 display's existing graph limits still apply.

Provider: OpenAI (`gpt-6.1-terra`), server secret `notekran_terra`. Both
source selection and answering/repair use high reasoning. No provider fallback.

## Conditional shared-question references

The solver classifies the current question photo with `context.reference_page`.
Only clear shared case data/instructions are candidates; ordinary independent
questions are not pinned. The flag is stored atomically with successful completion.

`shared-reference-schema.sql` preserves the latest two such original photos plus
six recent completed photos, without duplicates (at most eight previous photos).
A reference is only applicable if the current task clearly matches its case/block;
local task values take precedence. Lecture pages are never question references.
The context `used_pages` indices still refer to the ordered previous question photos.

Reset, clear, profile change and two hours of inactivity release references.
Newer reference candidates replace the oldest beyond the two-reference limit.
This is bounded context retrieval, not guaranteed semantic matching. No firmware
or manual pin button is required. Preview requests never alter reference state.
