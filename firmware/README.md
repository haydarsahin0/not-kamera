# Not Ekran V2 — 0.10.3

**0.10.3:** PWR 1,2 s gedrückt halten → die NotCamera im selben Hotspot fotografiert und sendet; die Antwort erscheint hier. Kurzer Druck schaltet den Bildschirm wie bisher. UDP-Broadcast (Port 47123) mit einem Hash des App-Zugangscodes; die Kamera bestätigt an Port 47124.

Diese Version ist für das Waveshare ESP32-S3-ePaper-1.54 V2 mit 8 MB Flash und 8 MB PSRAM.

## Was sich ändert

Die nächste Seite erscheint nach 50 Sekunden. Die Zeit beginnt nach dem fertigen Bildschirmwechsel. Ein manueller Wechsel oder das Wiederöffnen des Bildschirms startet die Zeit neu. Bei einer einzelnen Seite, in der Infoansicht und im Ruhebildschirm gibt es keinen automatischen Wechsel.

Die KI soll die kürzeste vollständige Antwort geben: ein Satz für eine Definition, meist ein bis zwei Sätze für eine einfache Erklärung und ein kurzer Rechenweg mit Ergebnis und Einheit. Verlangte ausführliche Lösungen und Grafiken bleiben vollständig. Antworten werden nicht abgeschnitten. Richtige Ergebnisse und Noten können nicht garantiert werden.

## Update installieren

1. [Installationsseite](https://haydarsahin0.github.io/not-kamera/install/?v=0.10.3) in Windows Chrome oder Edge öffnen.
2. Das Gerät mit einem USB-Datenkabel anschließen und den passenden USB-Anschluss wählen.
3. Beim Update **Erase device / Gerät löschen ausgeschaltet lassen**, damit Einstellungen und Antwortverlauf erhalten bleiben.
4. Bis zum Abschluss warten. Danach zeigt die lokale Geräteseite Version 0.10.3.

Für den Wechsel nach 50 Sekunden ist dieses USB-Update nötig. Die neuen Antwortregeln wirken auf neue Fotos bereits über den Server. Das Update kann nicht über iPhone oder iPad installiert werden.

## Bedienung

BOOT einmal: nächste Seite. Zweimal: vorherige Seite. Etwa drei Sekunden halten: Verbindungsinformationen. PWR kurz: Ruhebildschirm öffnen oder zur letzten Leseposition zurückkehren. Im Ruhebildschirm bleiben Seitenwechsel angehalten.

18-Pixel-Text, mathematische Zeichen, Grafiken, Frageüberschriften und Antwortverlauf bleiben erhalten. Die Batterieanzeige ist eine Schätzung. Ein zu großer Akku darf nicht durch Druck auf den Deckel passend gemacht werden.

## Prüfung

Die Tests prüfen die Grenze bei 49.999/50.000 Millisekunden, manuelle Wechsel, Pause/Wiederaufnahme, Tasten und den Überlauf der Zeitmessung. Hinzu kommen API-Tests, Schrift- und Grafikgrenzen sowie die Prüfung, dass die Update-Dateien gespeicherte Einstellungen und den Verlauf nicht überschreiben. Der Test am echten Gerät steht nach der USB-Installation noch aus.
