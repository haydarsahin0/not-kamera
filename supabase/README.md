## Active provider: Gemini 4 Argon

The server reads the Supabase secret `gemini-key` (exact name) and calls
`gemini-4-argon` through Google's generateContent API. No OpenAI fallback is
used. The key stays server-side in the x-goog-api-key header. No firmware update
is required. Ordered original photos, cross-page context, diagram validation,
and device delivery remain unchanged.

The adapter requests typed JSON schema output and high thinking for the first attempt,
medium for bounded recovery. Only STOP responses are accepted; thought text and
truncated/blocked responses never reach the display. Output wording is direct,
concise German without filler or claims of human authorship.

Earlier release notes below describe historical provider settings.

# Genauere Antworten: hohe Denkstufe und Selbstkontrolle

Auf echten Seiten wurden drei typische Fehler beobachtet: Verwendungs- statt Verteilungsrechnung des BIP, Lockerung statt Verschärfung des Kündigungsschutzes, umgekehrte Richtung bei der Phillipskurve. Das Modell (`gpt-6.1-sol`) arbeitet jetzt mit `reasoning.effort: high` und einer internen Kontrolle von Schlüsselbegriffen, Richtungen und Vorzeichen vor der Ausgabe. Antworten dauern etwas länger (Analysegrenze 140 s statt 110 s) und kosten mehr. Richtige Ergebnisse können weiterhin nicht garantiert werden.

Nur der Server ändert sich; NotCamera und NotEkran brauchen kein Update. Aktivieren:

```
supabase functions deploy not-kamera-api --project-ref jckoovsocynnxbrsalld --no-verify-jwt
```

(`--no-verify-jwt`, weil die Geräte mit dem App-Zugangscode statt mit einem Supabase-JWT anfragen; die Funktion prüft den Code selbst.)

# Kurze und vollständige Antworten

Die Antwortregeln sind für jede Teilfrage enger gefasst: eine Definition in einem Satz, eine einfache Erklärung meist in ein bis zwei Sätzen und eine Rechnung mit dem nötigen Rechenweg, Ergebnis und Einheit.

Ausdrücklich verlangte Herleitungen, Diskussionen und Grafiken bleiben vollständig. Wiederholungen und zusätzliche allgemeine Erklärungen sollen entfallen. Der Antworttext wird nicht nachträglich abgeschnitten. Richtige Ergebnisse oder eine bestimmte Note können nicht garantiert werden.

Die Regeln gelten für neu gesendete Fotos. Für den automatischen Seitenwechsel nach 50 Sekunden wird das [Geräteupdate 0.10.2](https://haydarsahin0.github.io/not-kamera/install/?v=0.10.2) benötigt.

### 2026-10-13: theory questions and unsupported unreadability claims

The answer instructions distinguish a named theoretical model from a supplied
figure. Qualitative questions can use domain knowledge without numeric data or
an existing diagram. Explicit model variants (e.g. interest-rate targeting) take
precedence over generic examples. All other recent camera/device changes remain.

A structurally valid answer claiming unreadable data or missing context gets one
additional reading of the same original images when time permits. The review
preserves genuine uncertainty; it does not substitute canned answers. It shares
the existing two-request/140-second budget with layout repair. Normal answers
still require one request. Prompt changes participate in the image fingerprint
so an old cached answer is not reused. This is a server-only update.

### 2026-10-13: continuation recovery

Production continuation jobs failed with both analysis timeouts and validation
errors. The first high-reasoning request now has a 95-second timeout, reserving
part of the existing 140-second total budget for one medium-reasoning recovery.
Original prior/current photos are retained. A layout/context repair receives the
rejected JSON plus a bounded error code instead of blindly generating it again.
Context-reference failures have their own code. No extra model, credentials,
firmware changes, context deletion, or silently truncated answers are involved.

Tests cover timeout recovery, exact original-image preservation, rejected JSON
being included in repair, graph delivery, context validation, and real missing
information remaining uncertain. Recovery is bounded, not a guarantee against
all future network/model failures.

The active secret name is `gemini-key`. The REST adapter uses enum values
`APPLICATION_JSON` and `HIGH`/`MEDIUM`. Gemini's transport schema retains data
types, required fields, and enums but omits numeric/cardinality/extra-property
constraints rejected by the provider. The unchanged device validation enforces
coordinate, graph, context-reference, and size limits before delivery.
