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
