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
