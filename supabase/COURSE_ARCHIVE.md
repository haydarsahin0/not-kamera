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
