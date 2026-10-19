/**
 * German translations for Qodalis CLI.
 */
export const deTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Verwendung:',
    'cli.common.examples': 'Beispiele:',
    'cli.common.use_hint': 'Verwenden Sie {command} {action}',

    // ── Help ─────────────────────────────────────────────────────────
    'cli.help.description': 'Zeigt Hilfe für einen Befehl an',
    'cli.help.long_description': 'Zeigt Hilfeinformationen für Befehle an',
    'cli.help.shortcuts': 'Tastenkürzel',
    'cli.help.type': 'Geben Sie',
    'cli.help.help_command': 'help <Befehl>',
    'cli.help.for_details': 'für detaillierte Informationen ein',
    'cli.help.unknown_command': 'Unbekannter Befehl: {command}',
    'cli.help.see_all': 'um alle verfügbaren Befehle anzuzeigen',
    'cli.help.extension_chain': 'Erweiterungskette',
    'cli.help.subcommands': 'Unterbefehle',
    'cli.help.options': 'Optionen',
    'cli.help.global_options': 'Globale Optionen',
    'cli.help.requires_server': 'Erfordert einen verbundenen Server',
    'cli.help.aliases': 'Aliase:',
    'cli.help.required': '(erforderlich)',
    'cli.help.show_all': 'Alle verfügbaren Befehle anzeigen',
    'cli.help.show_details': 'Details zu einem Befehl anzeigen',
    'cli.help.show_sub_details': 'Details zu einem Unterbefehl anzeigen',
    'cli.help.example_pkg': 'Hilfe zum Paketmanager',
    'cli.help.example_theme': 'Hilfe zum Unterbefehl theme apply',

    // ── Configure ────────────────────────────────────────────────────
    'cli.configure.description': 'System- und Plugin-Konfiguration verwalten',
    'cli.configure.long_description':
        'System- und Plugin-Konfiguration interaktiv oder über Unterbefehle verwalten',
    'cli.configure.open_menu': 'Interaktives Konfigurationsmenü öffnen',
    'cli.configure.list_opts': 'Alle Konfigurationsoptionen auflisten',
    'cli.configure.get_value': 'Einen Konfigurationswert abrufen',
    'cli.configure.set_value': 'Einen Konfigurationswert festlegen',
    'cli.configure.reset_defaults': 'Konfiguration auf Standardwerte zurücksetzen',
    'cli.configure.system': 'System',
    'cli.configure.exit': 'Beenden',
    'cli.configure.back': 'Zurück',
    'cli.configure.current_value': 'Aktueller Wert:',
    'cli.configure.invalid_value': 'Ungültiger Wert',
    'cli.configure.set_to': '{label} auf {value} gesetzt',
    'cli.configure.invalid_format_get':
        'Ungültiges Format. Verwenden Sie: configure get <Kategorie.Schlüssel>',
    'cli.configure.unknown_key': 'Unbekannter Konfigurationsschlüssel: {path}',
    'cli.configure.invalid_format_set':
        'Ungültiges Format. Verwenden Sie: configure set <Kategorie.Schlüssel> <Wert>',
    'cli.configure.set_success': '{path} auf {value} gesetzt',
    'cli.configure.system_reset': 'Systemkonfiguration auf Standardwerte zurückgesetzt',
    'cli.configure.unknown_category': 'Unbekannte Kategorie: {category}',
    'cli.configure.category_reset':
        'Konfiguration für "{category}" auf Standardwerte zurückgesetzt',
    'cli.configure.reset_confirm': 'Gesamte Konfiguration auf Standardwerte zurücksetzen?',
    'cli.configure.reset_cancelled': 'Zurücksetzen abgebrochen',
    'cli.configure.all_reset': 'Gesamte Konfiguration auf Standardwerte zurückgesetzt',
    'cli.configure.invalid_number': 'Ungültige Zahl: {value}',
    'cli.configure.invalid_options': 'Ungültiger Wert. Gültige Optionen: {options}',
    'cli.configure.invalid_boolean':
        'Ungültiger boolescher Wert: "{value}". Verwenden Sie true oder false.',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Gibt den angegebenen Text aus',
    'cli.echo.long_description': 'Gibt den angegebenen Text im Terminal aus',
    'cli.echo.piping_note': 'Unterstützt Text- und JSON-Ausgabe über Pipes',
    'cli.echo.help.print_text_terminal_add':
        'Text im Terminal ausgeben. Fügen Sie > file hinzu, um ihn in eine Datei zu speichern (ersetzt sie), oder >> file, um ihn am Ende anzuhängen.',
    'cli.echo.help.print_text': 'Text ausgeben',
    'cli.echo.help.write_text_file': 'Text in eine Datei schreiben',
    'cli.echo.help.append_text_file': 'Text an eine Datei anhängen',
    'cli.echo.help.print_greeting': 'Eine Begrüßung ausgeben',
    'cli.echo.help.create_replace_notes_txt': 'notes.txt erstellen oder ersetzen',
    'cli.echo.help.add_line': 'Eine Zeile hinzufügen',

    // ── Clear ─────────────────────────────────────────────────────────
    'cli.clear.description': 'Terminal leeren',
    'cli.clear.long_description': 'Löscht den gesamten Inhalt des Terminal-Bildschirms',
    'cli.clear.shortcut': 'Tastenkürzel:',

    // ── Version ───────────────────────────────────────────────────────
    'cli.version.description': 'Versionsinformationen anzeigen',
    'cli.version.long_description':
        'Zeigt die aktuelle CLI-Version und den Link zur Dokumentation an',

    // ── Uname ─────────────────────────────────────────────────────────
    'cli.uname.long_description':
        'Zeigt detaillierte System- und Browserinformationen an, darunter:',
    'cli.uname.cli_versions': 'Kern- und Bibliotheksversionen des CLI',
    'cli.uname.browser_info':
        'Browsername, Version, User-Agent, Sprache und Plattform',
    'cli.uname.os': 'Betriebssystem',
    'cli.uname.description': 'Gibt detaillierte System- und Browserinformationen aus',

    // ── Hash ──────────────────────────────────────────────────────────
    'cli.hash.description': 'Hash-Prüfsummen von Text erzeugen',
    'cli.hash.long_description':
        'Kryptografische Hash-Prüfsummen mit der Web Crypto API erzeugen',

    // ── Cal ───────────────────────────────────────────────────────────
    'cli.cal.description': 'Kalender anzeigen',
    'cli.cal.long_description': 'Monatskalender anzeigen',
    'cli.cal.highlight_note': 'Der aktuelle Tag ist hervorgehoben',
    'cli.cal.current_month': 'Aktueller Monat',
    'cli.cal.specific_month': 'Bestimmter Monat',

    // ── Time ──────────────────────────────────────────────────────────
    'cli.time.description': 'Aktuelle Ortszeit und UTC anzeigen',
    'cli.time.long_description': 'Aktuelle Ortszeit und UTC anzeigen',
    'cli.time.show_current': 'Aktuelle Ortszeit und UTC anzeigen',
    'cli.time.now.description': 'Die aktuelle Uhrzeit anzeigen',

    // ── Uptime ────────────────────────────────────────────────────────
    'cli.uptime.description': 'Sitzungslaufzeit anzeigen',
    'cli.uptime.long_description':
        'Zeigt an, wie lange die aktuelle Terminalsitzung aktiv ist',

    // ── Convert ───────────────────────────────────────────────────────
    'cli.convert.description': 'Zwischen Einheiten umrechnen (Länge, Gewicht, Temperatur, Daten)',
    'cli.convert.long_description': 'Zwischen verschiedenen Maßeinheiten umrechnen',
    'cli.convert.supported': 'Unterstützt:',

    // ── Eval ──────────────────────────────────────────────────────────
    'cli.eval.description': 'JavaScript-Ausdruck auswerten',
    'cli.eval.long_description': 'JavaScript-Ausdruck auswerten',
    'cli.eval.supports':
        'Unterstützt Arithmetik, Zeichenketten, Arrays, Objekte und beliebiges gültiges JS',

    // ── Seq ───────────────────────────────────────────────────────────
    'cli.seq.description': 'Zahlenfolge ausgeben',
    'cli.seq.long_description': 'Zahlenfolge ausgeben',
    'cli.seq.numbers_to_end': 'Zahlen von 1 bis Ende',
    'cli.seq.numbers_range': 'Zahlen von Anfang bis Ende',
    'cli.seq.with_step': 'Mit benutzerdefinierter Schrittweite',

    // ── Lorem ─────────────────────────────────────────────────────────
    'cli.lorem.description': 'Lorem-Ipsum-Platzhaltertext erzeugen',
    'cli.lorem.long_description': 'Lorem-Ipsum-Platzhaltertext erzeugen',
    'cli.lorem.gen_words': 'Wörter erzeugen',
    'cli.lorem.gen_sentences': 'Sätze erzeugen',
    'cli.lorem.gen_paragraphs': 'Absätze erzeugen',
    'cli.lorem.words.description': 'Eine Anzahl Wörter erzeugen',
    'cli.lorem.sentences.description': 'Eine Anzahl Sätze erzeugen',
    'cli.lorem.paragraphs.description': 'Eine Anzahl Absätze erzeugen',

    // ── Alias / Unalias ──────────────────────────────────────────────
    'cli.alias.description': 'Befehlsaliase verwalten',
    'cli.alias.long_description': 'Alias-Kurzformen für häufig verwendete Befehle erstellen',
    'cli.alias.create_new': 'Neuen Alias erstellen',
    'cli.alias.list_all': 'Alle Aliase auflisten',
    'cli.alias.remove_hint': 'Verwenden Sie {command} um einen Alias zu entfernen',
    'cli.unalias.description': 'Befehlsaliase entfernen',
    'cli.unalias.long_description': 'Einen zuvor definierten Befehlsalias entfernen',

    // ── Open ──────────────────────────────────────────────────────────
    'cli.open.description': 'URL in neuem Browser-Tab öffnen',
    'cli.open.long_description': 'URL in neuem Browser-Tab öffnen',
    'cli.open.auto_https': 'Fügt automatisch https:// hinzu, wenn kein Protokoll angegeben ist',

    // ── Color ─────────────────────────────────────────────────────────
    'cli.color.description': 'Farben konvertieren und anzeigen (hex, rgb, hsl)',
    'cli.color.long_description': 'Zwischen Farbformaten konvertieren und Farben anzeigen',
    'cli.color.supported_formats': 'Unterstützte Formate:',

    // ── History ───────────────────────────────────────────────────────
    'cli.history.long_description': 'Zeigt den Befehlsverlauf der aktuellen Sitzung an',
    'cli.history.show': 'Befehlsverlauf anzeigen',
    'cli.history.search': 'Verlauf nach Muster durchsuchen',
    'cli.history.clear': 'Gesamten Verlauf löschen',
    'cli.history.arrow_hint':
        'Verwenden Sie die Pfeiltasten {keys} um den Verlauf zu durchsuchen',
    'cli.history.prefix_hint':
        'Geben Sie ein Präfix ein und drücken Sie {key} um den Verlauf nach Präfix zu durchsuchen',
    'cli.history.description': 'Gibt den Befehlsverlauf der aktuellen Sitzung aus',
    'cli.history.clear.description': 'Löscht den Befehlsverlauf',
    'cli.history.search.description': 'Den Befehlsverlauf nach einem Muster durchsuchen',

    // ── Theme ─────────────────────────────────────────────────────────
    'cli.theme.description': 'Mit dem Thema interagieren',
    'cli.theme.long_description':
        'Das Erscheinungsbild des Terminals mit Themen und Farben anpassen',

    // ── Hex ───────────────────────────────────────────────────────────
    'cli.hex.description': 'Hex kodieren/dekodieren und Zahlenbasen konvertieren',
    'cli.hex.long_description':
        'Text hexadezimal kodieren/dekodieren und Zahlen zwischen Basen konvertieren',
    'cli.hex.text_to_hex': 'Text zu Hexadezimal',
    'cli.hex.hex_to_text': 'Hexadezimal zu Text',
    'cli.hex.base_conversion': 'Basiskonvertierung',

    // ── Feedback ──────────────────────────────────────────────────────
    'cli.feedback.long_description':
        'Fehler melden, Funktionen anfragen oder neue Befehle vorschlagen — interaktiv oder inline.',
    'cli.feedback.report-bug.description': 'Meldet einen Fehler auf GitHub',
    'cli.feedback.request-feature.description': 'Beantragt eine neue Funktion auf GitHub',
    'cli.feedback.request-command.description': 'Beantragt einen neuen Befehl auf GitHub',
    'cli.feedback.description': 'Ermöglicht Benutzern, Fehler zu melden oder Funktionen anzufragen',

    // ── JWT ───────────────────────────────────────────────────────────
    'cli.jwt.description': 'JWT-Token dekodieren und untersuchen',
    'cli.jwt.long_description': 'JSON Web Tokens (JWT) dekodieren und untersuchen',
    'cli.jwt.decode_display': 'JWT-Inhalt dekodieren und anzeigen',
    'cli.jwt.shows': 'Zeigt: Header, Payload, Ablaufstatus, Ausstellungsdatum',

    // ── Sleep ─────────────────────────────────────────────────────────
    'cli.sleep.description': 'Ausführung für eine bestimmte Zeit pausieren',
    'cli.sleep.long_description':
        'Pausiert die Ausführung für die angegebene Dauer (in Millisekunden)',

    // ── Services ──────────────────────────────────────────────────────
    'cli.services.description': 'Hintergrunddienste und Aufgaben verwalten',
    'cli.services.long_description': 'Hintergrunddienste und Aufgaben verwalten',
    'cli.services.list_desc': 'Alle Dienste auflisten',
    'cli.services.start_desc': 'Dienst starten',
    'cli.services.stop_desc': 'Dienst stoppen',
    'cli.services.restart_desc': 'Dienst neu starten',
    'cli.services.logs_desc': 'Dienstprotokolle anzeigen',
    'cli.services.info_desc': 'Dienstdetails',
    'cli.services.list.description': 'Alle registrierten Hintergrunddienste auflisten',
    'cli.services.start.description': 'Einen Hintergrunddienst starten',
    'cli.services.stop.description': 'Einen laufenden Hintergrunddienst stoppen',
    'cli.services.restart.description': 'Einen Hintergrunddienst neu starten',
    'cli.services.logs.description': 'Logs eines Hintergrunddienstes anzeigen',
    'cli.services.info.description': 'Detaillierte Informationen zu einem Dienst anzeigen',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Eine Zeichenkette kontinuierlich wiederholen',
    'cli.yes.long_description': 'Eine Zeichenkette kontinuierlich wiederholen',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'In die Zwischenablage kopieren oder daraus einfügen',
    'cli.clipboard.long_description':
        'Text in die Systemzwischenablage kopieren oder daraus einfügen',
    'cli.clipboard.copy_desc': 'Text in die Zwischenablage kopieren',
    'cli.clipboard.paste_desc': 'Aus der Zwischenablage einfügen',
    'cli.clipboard.copy.description': 'Text in die Zwischenablage kopieren',
    'cli.clipboard.paste.description': 'Text aus der Zwischenablage einfügen',

    // ── Hotkeys ───────────────────────────────────────────────────────
    'cli.hotkeys.description': 'Tastenkürzel-Informationen anzeigen',
    'cli.hotkeys.long_description':
        'Zeigt alle verfügbaren Tastenkombinationen und Tastenkürzel an',

    // ── Export / Unset / Env ──────────────────────────────────────────
    'cli.export.description': 'Umgebungsvariablen setzen',
    'cli.export.long_description': 'Umgebungsvariablen setzen oder anzeigen',
    'cli.export.show_all': 'Alle Variablen anzeigen',
    'cli.export.set_var': 'Variable setzen',
    'cli.export.set_spaces': 'Mit Leerzeichen setzen',
    'cli.export.set_many': 'Mehrere auf einmal setzen',
    'cli.export.set_global': 'Für alle Benutzer setzen',
    'cli.export.set_session': 'Nur für dieses Terminal, nicht gespeichert',
    'cli.export.scopes':
        'Verwenden Sie Variablen als $VAR oder ${VAR}. Ein in diesem Terminal gesetzter Wert hat Vorrang vor Ihrem eigenen gespeicherten, und dieser vor einem gemeinsamen. env zeigt, woher jeder stammt.',
    'cli.unset.description': 'Umgebungsvariablen entfernen',
    'cli.unset.long_description': 'Eine Umgebungsvariable entfernen',
    'cli.unset.own':
        'Für dieses Terminal und Sie entfernen (ein gemeinsamer Wert wird für Sie ausgeblendet)',
    'cli.unset.global': 'Den gemeinsamen Wert entfernen',
    'cli.env.description': 'Umgebungsvariablen anzeigen',
    'cli.env.long_description': 'Umgebungsvariablen anzeigen',
    'cli.env.show_all': 'Alle Variablen anzeigen',
    'cli.env.show_single': 'Eine Variable anzeigen',

    // ── URL ───────────────────────────────────────────────────────────
    'cli.url.description': 'URLs kodieren oder dekodieren',
    'cli.url.long_description': 'URLs kodieren, dekodieren und analysieren',
    'cli.url.encode_desc': 'Zeichenkette als URL kodieren',
    'cli.url.decode_desc': 'URL-Zeichenkette dekodieren',
    'cli.url.parse_desc': 'URL-Bestandteile analysieren',

    // ── JSON ──────────────────────────────────────────────────────────
    'cli.json.description': 'JSON formatieren, minimieren oder validieren',
    'cli.json.long_description': 'JSON-Zeichenketten formatieren, minimieren oder validieren',
    'cli.json.format_desc': 'JSON mit Einrückung formatieren',
    'cli.json.minify_desc': 'Leerzeichen entfernen',
    'cli.json.validate_desc': 'Auf gültiges JSON prüfen',
    'cli.json.format.description': 'JSON mit Einrückung formatiert ausgeben',
    'cli.json.minify.description': 'JSON durch Entfernen von Leerraum minimieren',
    'cli.json.validate.description': 'Prüfen, ob eine Zeichenkette gültiges JSON ist',

    // ── Base64 ────────────────────────────────────────────────────────
    'cli.base64.description': 'Base64-Zeichenketten kodieren oder dekodieren',
    'cli.base64.long_description': 'Base64-Zeichenketten kodieren und dekodieren',
    'cli.base64.utf8_note': 'Unterstützt UTF-8-Textkodierung',
    'cli.base64.encode_desc': 'Text zu Base64 kodieren',
    'cli.base64.decode_desc': 'Base64 zu Text dekodieren',

    // ── Timestamp ─────────────────────────────────────────────────────
    'cli.timestamp.description': 'Zwischen Unix-Zeitstempeln und Daten konvertieren',
    'cli.timestamp.long_description':
        'Zwischen Unix-Zeitstempeln und lesbaren Daten konvertieren',
    'cli.timestamp.current': 'Aktueller Unix-Zeitstempel',
    'cli.timestamp.to_date': 'Zeitstempel zu Datum',
    'cli.timestamp.from_date': 'Datum zu Zeitstempel',
    'cli.timestamp.now.description': 'Aktuellen Unix-Zeitstempel anzeigen',
    'cli.timestamp.to-date.description': 'Einen Unix-Zeitstempel in ein Datum umwandeln',
    'cli.timestamp.from-date.description':
        'Eine Datumszeichenkette in einen Unix-Zeitstempel umwandeln',

    // ── Screen ────────────────────────────────────────────────────────
    'cli.screen.description': 'Bildschirm- und Terminalinformationen anzeigen',
    'cli.screen.long_description':
        'Bildschirm-, Viewport- und Terminalabmessungen anzeigen',
    'cli.screen.shows':
        'Zeigt: Auflösung, Farbtiefe, Pixelverhältnis, Fenstergröße, Terminalgröße',

    // ── Random ────────────────────────────────────────────────────────
    'cli.random.description': 'Zufällige Werte erzeugen',
    'cli.random.long_description': 'Zufällige Zahlen, Zeichenketten, UUIDs und mehr erzeugen',
    'cli.random.number_desc': 'Zufallszahl (0-100)',
    'cli.random.string_desc': 'Zufällige Zeichenkette (16 Zeichen)',
    'cli.random.uuid_desc': 'Zufällige UUID v4',
    'cli.random.coin_desc': 'Münze werfen',
    'cli.random.dice_desc': 'Würfel werfen',
    'cli.random.number.description': 'Eine Zufallszahl erzeugen',
    'cli.random.string.description': 'Eine zufällige Zeichenkette erzeugen',
    'cli.random.uuid.description': 'Eine zufällige UUID v4 erzeugen',
    'cli.random.coin.description': 'Eine Münze werfen',
    'cli.random.dice.description': 'Würfeln',

    // ── Ping ──────────────────────────────────────────────────────────
    'cli.ping.description': 'ICMP-ähnliche Pings an einen Host senden',
    'cli.ping.long_description':
        'HTTP-basierte ICMP-ähnliche Pings an einen Host senden und Umlaufstatistiken anzeigen',
    'cli.ping.ctrl_c': 'Drücken Sie Strg+C um zu stoppen und Statistiken anzuzeigen.',

    // ── Nano ──────────────────────────────────────────────────────────
    'cli.nano.description': 'Integrierten Texteditor öffnen',
    'cli.nano.long_description': 'Integrierten Nano-ähnlichen Texteditor öffnen',
    'cli.nano.open_empty': 'Leeren Puffer öffnen',
    'cli.nano.open_file': 'Datei öffnen oder erstellen',
    'cli.nano.keyboard_shortcuts': 'Tastenkürzel:',

    // ── Debug ─────────────────────────────────────────────────────────
    'cli.debug.description': 'Detaillierte System- und CLI-Diagnosen anzeigen',
    'cli.debug.long_description':
        'Zeigt detaillierte System- und CLI-interne Diagnosen an.',
    'cli.debug.hidden_note':
        'Dieser Befehl ist in der Hilfeliste versteckt, aber direkt zugänglich.',
    'cli.debug.summary': 'Systemzusammenfassung',
    'cli.debug.processors': 'Alle registrierten Prozessoren',
    'cli.debug.modules': 'Alle geladenen Module',
    'cli.debug.state': 'Zustandsspeicher untersuchen',
    'cli.debug.processors.description': 'Alle registrierten Befehlsprozessoren auflisten',
    'cli.debug.modules.description': 'Alle geladenen CLI-Module auflisten',
    'cli.debug.state.description': 'Alle State-Stores und ihre Werte untersuchen',
    'cli.debug.services.description': 'Alle registrierten Dienste im DI-Container auflisten',
    'cli.debug.environment.description': 'Browser-, Terminal- und Framework-Informationen anzeigen',
    'cli.debug.history.description': 'Statistiken zum Befehlsverlauf anzeigen',
    'cli.debug.health.description':
        'Systemzustand prüfen: Speicher, Konnektivität, Prozessorstatus',
    'cli.debug.export.description': 'Alle Debug-Informationen als JSON exportieren',
    'cli.debug.servers.description': 'Konfigurierte Server und ihren Verbindungsstatus auflisten',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Pakete im CLI verwalten',

    // ── Servers and events ───────────────────────────────────────────
    'cli.server.description': 'Verbindungen zu entfernten CLI-Servern verwalten',
    'cli.server.list.description': 'Server mit Status, Version und Befehlen anzeigen',
    'cli.server.status.description': 'Prüfen, ob Server erreichbar sind (alle oder einen im Detail)',
    'cli.server.commands.description': 'Die Befehle jedes Servers anzeigen',
    'cli.server.reconnect.description': 'Erneut mit Servern verbinden und ihre Befehle neu laden',
    'cli.server.default.description': 'Den Server anzeigen oder festlegen, der gemeinsame Befehle ausführt',
    'cli.server.jobs.description': 'Hintergrund-Jobs auf verbundenen Servern verwalten',
    'cli.server.jobs.list.description': 'Alle Jobs auf verbundenen Servern auflisten',
    'cli.server.jobs.info.description': 'Detaillierte Informationen zu einem Job anzeigen',
    'cli.server.jobs.trigger.description': 'Sofortige Ausführung eines Jobs auslösen',
    'cli.server.jobs.pause.description': 'Zeitgesteuerte Ausführung eines Jobs pausieren',
    'cli.server.jobs.resume.description': 'Einen pausierten Job fortsetzen',
    'cli.server.jobs.stop.description': 'Einen Job stoppen und die laufende Ausführung abbrechen',
    'cli.server.jobs.cancel.description': 'Die aktuelle Ausführung eines Jobs abbrechen',
    'cli.server.jobs.history.description': 'Ausführungsverlauf eines Jobs anzeigen',
    'cli.server.jobs.logs.description':
        'Logs der letzten oder einer bestimmten Ausführung anzeigen',
    'cli.server.jobs.edit.description': 'Job-Einstellungen interaktiv bearbeiten',
    'cli.server.jobs.watch.description': 'Live-Ansicht von Job-Ereignissen per WebSocket',
    'cli.server.help.see_everything_you_can': 'um alles zu sehen, was Sie tun können',
    'cli.server.help.connect_terminal_remote_cli':
        'Das Terminal mit entfernten CLI-Servern (.NET, Node.js, Python) verbinden und deren Befehle ausführen.',
    'cli.server.help.by_name_or_prefix':
        'Die Befehle jedes Servers sind über ihren Namen ({byName}) und mit dem Server als Präfix ({prefixed}) verfügbar. Haben mehrere Server denselben Befehl, führt ihn der Standardserver aus; ohne einen wird gefragt, welcher Server verwendet werden soll. Ein lokaler Befehl mit demselben Namen hat Vorrang: verwenden Sie den Namen mit Präfix. Ein Server, der ausfällt, wird alle 30 Sekunden erneut versucht, und seine Befehle sind wieder da, sobald er zurück ist.',
    'cli.server.help.overview_servers': 'Übersicht der Server',
    'cli.server.help.servers_status_version_commands': 'Server mit Status, Version und Befehlen',
    'cli.server.help.check_servers_reachable_all':
        'Prüfen, ob Server erreichbar sind (alle oder einer im Detail)',
    'cli.server.help.commands_each_server_provides': 'Befehle, die jeder Server bereitstellt',
    'cli.server.help.connect_again_unreachable_servers':
        'Erneut verbinden (nicht erreichbare Server oder einen)',
    'cli.server.help.show_set_server_shared':
        'Den Server für gemeinsame Befehle anzeigen oder festlegen',
    'cli.server.help.open_shell_server_run':
        'Eine Shell auf einem Server öffnen oder einen Befehl ausführen',
    'cli.server.help.ping_node_show_details': 'node anpingen und Details anzeigen',
    'cli.server.help.what_node_can_do': 'Was node kann',
    'cli.server.help.run_echo_node_explicitly': 'echo ausdrücklich auf node ausführen',
    'cli.server.help.shared_commands_run_node': 'Gemeinsame Befehle laufen auf node',
    'cli.server.help.retry_every_unreachable_server':
        'Jeden nicht erreichbaren Server erneut versuchen',
    'cli.server.list.help.list_configured_servers_connection':
        'Die konfigurierten Server auflisten: Verbindungsstatus, URL, Server- und API-Version, Anzahl der Befehle und Shell-Zugriff.',
    'cli.server.list.help.see_why_server_unreachable':
        'um zu sehen, warum ein Server nicht erreichbar ist, server reconnect für einen neuen Versuch',
    'cli.server.status.help.details_server': 'für Details zu einem Server',
    'cli.server.status.help.try_again': 'um es erneut zu versuchen',
    'cli.server.status.help.load_commands': 'um seine Befehle zu laden',
    'cli.server.status.help.see_commands': 'um seine Befehle zu sehen',
    'cli.server.status.help.ping_servers_without_name':
        'Die Server anpingen. Ohne Namen wird jeder Server auf einmal mit seiner Antwortzeit geprüft; mit einem Namen wird dieser Server im Detail angezeigt (Versionen, Betriebssystem, Shell, Streaming), mit Hinweisen, wenn er nicht erreichbar ist.',
    'cli.server.status.help.check_every_server': 'Jeden Server prüfen',
    'cli.server.status.help.details_one_server': 'Details eines Servers',
    'cli.server.status.help.same_server_status': 'Wie server status',
    'cli.server.status.help.details_node': 'Details zu node',
    'cli.server.commands.help.shared_marker':
        'auf mehreren Servern: läuft auf dem Standardserver (server use <name>) oder fragt nach',
    'cli.server.commands.help.local_marker':
        'ein lokaler Befehl hat denselben Namen: mit dem Server-Präfix ausführen',
    'cli.server.commands.help.intro':
        'Die Befehle eines Servers auflisten (alle Server oder einen). Führen Sie sie über den Namen oder mit dem Server als Präfix aus: {example} läuft immer auf node, auch wenn ein anderer Server oder ein lokaler Befehl echo heißt.',
    'cli.server.commands.help.commands_every_server': 'Befehle jedes Servers',
    'cli.server.commands.help.commands_one_server': 'Befehle eines Servers',
    'cli.server.commands.help.what_node_can_do': 'Was node kann',
    'cli.server.reconnect.help.reconnect_them_anyway': 'um sie trotzdem neu zu verbinden',
    'cli.server.reconnect.help.see_why': 'um den Grund zu sehen',
    'cli.server.reconnect.help.connect_servers_again_reload':
        'Erneut mit Servern verbinden und deren Befehle neu laden, z. B. nachdem ein Server neu gestartet oder aktualisiert wurde. Ohne Namen wird jeder nicht erreichbare Server erneut versucht.',
    'cli.server.reconnect.help.retry_unreachable_servers':
        'Die nicht erreichbaren Server erneut versuchen',
    'cli.server.reconnect.help.reconnect_one_server': 'Einen Server neu verbinden',
    'cli.server.reconnect.help.reconnect_every_server': 'Jeden Server neu verbinden',
    'cli.server.reconnect.help.same_server_reconnect': 'Wie server reconnect',
    'cli.server.reconnect.help.reload_commands_node': 'Die Befehle von node neu laden',
    'cli.server.default.help.to_remove': 'um ihn zu entfernen',
    'cli.server.default.help.to_set_one': 'um einen festzulegen',
    'cli.server.default.help.default_server_runs_commands':
        'Der Standardserver führt Befehle aus, die mehrere Server haben (sonst werden Sie gefragt, welcher), und Befehle, die einen bestimmten Server brauchen, wie server logs. Er bleibt über Neuladen hinweg gespeichert.',
    'cli.server.default.help.show_default_server': 'Den Standardserver anzeigen',
    'cli.server.default.help.set': 'Festlegen',
    'cli.server.default.help.remove': 'Entfernen',
    'cli.server.default.help.same_server_default_node': 'Wie server default node',
    'cli.server.jobs.help.see_control_background_jobs':
        'Die Hintergrund-Jobs auf verbundenen Servern ansehen und steuern: auflisten, sofort ausführen, pausieren oder stoppen, Verlauf und Logs lesen, Einstellungen ändern oder Ereignisse live verfolgen. Ein Job wird über Name (beliebige Schreibung) oder ID ausgewählt und auf jedem verbundenen Server gesucht; Aktionen gelten für jeden Server, der den Job hat, und --server beschränkt einen Befehl auf einen Server.',
    'cli.server.jobs.help.same_server_jobs_list': 'Wie server jobs list',
    'cli.server.jobs.help.live_job_events': 'Job-Ereignisse live',
    'cli.server.jobs.help.all_jobs': 'Alle Jobs',
    'cli.server.jobs.help.run_cleanup_job_now': 'Den Job cleanup jetzt ausführen',
    'cli.server.jobs.help.failed_runs': 'Seine fehlgeschlagenen Ausführungen',
    'cli.server.jobs.help.last_run_output_node': 'Ausgabe der letzten Ausführung, auf node',
    'cli.server.jobs.list.help.list_jobs_every_connected':
        'Die Jobs jedes verbundenen Servers auflisten: Gruppe, Status, Zeitplan, letzte und nächste Ausführung sowie Dauer der letzten Ausführung. Bei mehreren Servern erhält jeder eine eigene Tabelle.',
    'cli.server.jobs.list.help.jobs_all_connected_servers': 'Jobs auf allen verbundenen Servern',
    'cli.server.jobs.list.help.only_one_group': 'Nur eine Gruppe',
    'cli.server.jobs.list.help.jobs_node_server': 'Jobs auf dem Server node',
    'cli.server.jobs.list.help.jobs_reports_group': 'Jobs in der Gruppe reports',
    'cli.server.jobs.info.help.show_everything_about_one':
        'Alles zu einem Job anzeigen: Zeitplan, Wiederholungen, Timeout, Überlappungsrichtlinie, die aktuell laufende Ausführung und das Ergebnis der letzten Ausführung. Der Job wird über Name (beliebige Schreibung) oder ID gefunden.',
    'cli.server.jobs.info.help.details_cleanup_job': 'Details des Jobs cleanup',
    'cli.server.jobs.trigger.help.run_job_now_without':
        'Einen Job jetzt ausführen, ohne auf den nächsten geplanten Zeitpunkt zu warten. Sein Zeitplan ändert sich nicht.',
    'cli.server.jobs.trigger.help.run_cleanup_now': 'cleanup jetzt ausführen',
    'cli.server.jobs.trigger.help.then_read_output': 'Danach seine Ausgabe lesen',
    'cli.server.jobs.pause.help.stop_running_job_schedule':
        'Die zeitgesteuerte Ausführung eines Jobs anhalten, bis er fortgesetzt wird. Verwenden Sie cancel oder stop für eine bereits laufende Ausführung.',
    'cli.server.jobs.pause.help.hold_cleanup': 'cleanup anhalten',
    'cli.server.jobs.pause.help.put_back_schedule': 'Wieder in den Zeitplan aufnehmen',
    'cli.server.jobs.resume.help.put_paused_job_back':
        'Einen pausierten Job wieder in seinen Zeitplan aufnehmen.',
    'cli.server.jobs.resume.help.run_cleanup_schedule_again':
        'cleanup wieder nach Zeitplan ausführen',
    'cli.server.jobs.stop.help.take_job_off_schedule':
        'Einen Job aus seinem Zeitplan nehmen und die laufende Ausführung abbrechen, falls vorhanden.',
    'cli.server.jobs.stop.help.stop_cleanup_completely': 'cleanup vollständig stoppen',
    'cli.server.jobs.cancel.help.cancel_run_progress_job':
        'Die laufende Ausführung eines Jobs abbrechen. Der Job bleibt im Zeitplan und läuft zum nächsten Zeitpunkt erneut.',
    'cli.server.jobs.cancel.help.abort_current_cleanup_run':
        'Die aktuelle Ausführung von cleanup abbrechen',
    'cli.server.jobs.history.help.list_past_runs_job':
        'Die vergangenen Ausführungen eines Jobs auflisten: Status, Startzeit, Dauer, Wiederholungsversuch und den Anfang der Fehlermeldung. Verwenden Sie die Kurz-ID mit logs --exec, um die Ausgabe einer Ausführung zu lesen.',
    'cli.server.jobs.history.help.last_20_runs': 'Die letzten 20 Ausführungen',
    'cli.server.jobs.history.help.page_through_older_runs': 'Durch ältere Ausführungen blättern',
    'cli.server.jobs.history.help.only_failed_runs': 'Nur fehlgeschlagene Ausführungen',
    'cli.server.jobs.history.help.last_5_runs': 'Die letzten 5 Ausführungen',
    'cli.server.jobs.logs.help.print_log_entries_latest':
        'Die Log-Einträge der letzten Ausführung eines Jobs ausgeben, oder einer über ihre Ausführungs-ID (aus history) gewählten Ausführung.',
    'cli.server.jobs.logs.help.logs_latest_run': 'Logs der letzten Ausführung',
    'cli.server.jobs.logs.help.logs_one_run': 'Logs einer Ausführung',
    'cli.server.jobs.logs.help.what_last_cleanup_run':
        'Was die letzte Ausführung von cleanup ausgegeben hat',
    'cli.server.jobs.edit.help.change_job_step_step':
        'Einen Job Schritt für Schritt ändern: Beschreibung, Gruppe, Cron-Zeitplan oder Intervall, maximale Wiederholungen, Timeout und Überlappungsrichtlinie (skip, queue oder cancel). Drücken Sie Enter, um einen Wert beizubehalten, und Ctrl+C oder Escape zum Abbrechen; nichts ändert sich, bis Sie bestätigen. Ein Job auf mehreren Servern benötigt --server.',
    'cli.server.jobs.edit.help.edit_cleanup_server_has':
        'cleanup auf dem Server bearbeiten, der ihn hat',
    'cli.server.jobs.watch.help.follow_job_events_they':
        'Job-Ereignisse verfolgen, sobald sie auftreten (gestartet, abgeschlossen, fehlgeschlagen usw.), auf jedem verbundenen Server, eine Zeile pro Ereignis. Drücken Sie Ctrl+C zum Beenden.',
    'cli.server.jobs.watch.help.events_all_connected_servers':
        'Ereignisse von allen verbundenen Servern',
    'cli.server.jobs.watch.help.only_events_node': 'Nur Ereignisse von node',
    'cli.ssh.description': 'Eine entfernte Shell-Sitzung auf einem Server öffnen',
    'cli.ssh.help.open_interactive_shell_server':
        'Eine interaktive Shell auf einem Server in diesem Terminal öffnen oder dort einen Befehl ausführen und dessen Ausgabe anzeigen. Nur Server mit aktivierter Shell können verwendet werden; mit dem Users-Plugin benötigen Sie die Berechtigung shell:execute. Ohne Namen verwendet ssh den einzigen Shell-Server, sonst den Standardserver, sonst wird gefragt, welcher.',
    'cli.ssh.help.shell_default_only_server': 'Shell auf dem Standardserver (oder einzigen Server)',
    'cli.ssh.help.shell_server_exit_ctrl':
        'Shell auf einem Server (exit oder Ctrl+D zum Verlassen)',
    'cli.ssh.help.run_one_command_print': 'Einen Befehl ausführen und dessen Ausgabe anzeigen',
    'cli.ssh.help.same_ssh': 'Wie ssh <name>',
    'cli.ssh.help.interactive_shell_node': 'Interaktive Shell auf node',
    'cli.ssh.help.one_command_node': 'Ein Befehl auf node',
    'cli.ssh.help.same_ssh_2': 'Wie ssh',
    'cli.events.description': 'Ereignisse des Ereignisbusses beobachten, auflisten und senden',
    'cli.events.watch.description': 'Ereignisse anzeigen, sobald sie eintreten (Strg+C zum Beenden)',
    'cli.events.log.description': 'Letzte Ereignisse anzeigen (im Speicher, nicht gespeichert)',
    'cli.events.emit.description': 'Ein Ereignis senden: events emit <typ> [json]',
    'cli.events.watch.help.intro': 'Ereignisse ausgeben, sobald sie auftreten, bis Ctrl+C',
    'cli.events.watch.help.every_event': 'Jedes Ereignis',
    'cli.events.watch.help.namespace': 'Ein Namespace',
    'cli.events.watch.help.one_type': 'Ein Typ',
    'cli.events.log.help.intro': 'Die neuesten Ereignisse anzeigen, älteste zuerst',
    'cli.events.log.help.last_20': 'Letzte 20 Ereignisse',
    'cli.events.log.help.last_50_server': 'Letzte 50 Server-Ereignisse',
    'cli.events.emit.help.intro':
        'Ein Ereignis auslösen, z. B. um ein Plugin zu testen, das darauf wartet',
    'cli.events.help.commands': 'Befehle:',
    'cli.events.help.print_live': 'Ereignisse live ausgeben',
    'cli.events.help.recent': 'Letzte Ereignisse',
    'cli.events.help.emit': 'Ein Ereignis auslösen',
    'cli.events.help.patterns':
        'Muster: ein genauer Typ (package:installed), ein Namespace (package:*) oder * für alle.',
    'cli.events.help.in_memory':
        'Ereignisse werden nur für dieses Terminal im Arbeitsspeicher gehalten; nichts wird dauerhaft gespeichert.',

    // ── Capture ──────────────────────────────────────────────────────
    'cli.capture.description': 'Terminalausgabe in eine herunterladbare Datei exportieren',
    'cli.capture.help.save_what_terminal_including':
        'Speichert den Inhalt des Terminals samt Scrollback als Datei, die Ihr Browser herunterlädt. HTML behält Hintergrund- und Textfarbe des Themas; txt ist reiner Text. Farben einzelner Zeilen bleiben nicht erhalten.',
    'cli.capture.help.everything_terminal_html': 'Alles als terminal-<timestamp>.html',
    'cli.capture.help.plain_text_file': 'Reine Textdatei',
    'cli.capture.help.only_last_n_lines': 'Nur die letzten n Zeilen',
    'cli.capture.help.downloads_session_txt': 'Lädt session.txt herunter',
    'cli.capture.help.last_50_lines_html': 'Die letzten 50 Zeilen als HTML',
    'cli.capture.help.same_capture': 'Wie capture',

    // ── Diff ─────────────────────────────────────────────────────────
    'cli.diff.description': 'Dateien zeilenweise vergleichen',
    'cli.diff.help.compare_two_texts_line':
        'Zwei Texte zeilenweise vergleichen: hinzugefügte Zeilen erscheinen grün mit +, entfernte rot mit -, mit einigen unveränderten Zeilen um jede Änderung als Kontext.',
    'cli.diff.help.compare_two_texts': 'Zwei Texte vergleichen',
    'cli.diff.help.only_changed_lines': 'Nur die geänderten Zeilen',
    'cli.diff.help.one_line_changed': 'Eine Zeile geändert',
    'cli.diff.help.prints_no_differences_found': 'Gibt aus: No differences found',
    'cli.diff.help.compare_two_files_line':
        'Zwei Dateien zeilenweise vergleichen und anzeigen, was sich geändert hat: Zeilen, die mit < (oder -) beginnen, sind nur in der ersten Datei, Zeilen mit > (oder +) nur in der zweiten.',
    'cli.diff.help.show_differences': 'Die Unterschiede anzeigen',
    'cli.diff.help.unified_format_context': 'Unified-Format mit Kontext',
    'cli.diff.help.what_changed_between_versions': 'Was sich zwischen Versionen geändert hat',
    'cli.diff.help.review_edits_git_style': 'Änderungen prüfen, im Git-Stil',
    'cli.diff.help.ignore_upper_lower_case': 'Groß-/Kleinschreibung ignorieren',

    // ── Font Size ────────────────────────────────────────────────────
    'cli.font-size.description': 'Die Schriftgröße des Terminals anpassen',
    'cli.font-size.reset.description': 'Schriftgröße auf den Standard zurücksetzen',
    'cli.font-size.set.description': 'Schriftgröße auf einen bestimmten Wert setzen',
    'cli.font-size.help.intro':
        'Terminaltext vergrößern oder verkleinern, von {min}px bis {max}px. Die gewählte Größe wird gespeichert und beim nächsten Öffnen des Terminals wiederhergestellt; reset kehrt zur Größe zurück, mit der die Seite gestartet wurde.',
    'cli.font-size.help.show_current_size': 'Aktuelle Größe anzeigen',
    'cli.font-size.help.bigger_smaller_by': 'Größer oder kleiner um {step}px',
    'cli.font-size.help.exact_size': 'Genaue Größe in Pixeln ({min}-{max})',
    'cli.font-size.help.back_default_size': 'Zurück zur Standardgröße',
    'cli.font-size.help.use_16px_text': '16px-Text verwenden',
    'cli.font-size.help.grow_by': 'Um {step}px vergrößern',
    'cli.font-size.help.forget_saved_size': 'Gespeicherte Größe verwerfen',

    // ── Snippet ──────────────────────────────────────────────────────
    'cli.snippet.description': 'Parametrisierte Befehlsvorlagen speichern und wiederverwenden',
    'cli.snippet.list.description': 'Alle gespeicherten Snippets auflisten',
    'cli.snippet.save.description': 'Ein neues Snippet speichern: snippet save <name> "<template>"',
    'cli.snippet.show.description': 'Eine Snippet-Vorlage anzeigen: snippet show <name>',
    'cli.snippet.delete.description': 'Ein Snippet löschen: snippet delete <name>',
    'cli.snippet.run.description':
        'Ein Snippet mit Variablenwerten ausführen: snippet run <name> var1=val1 var2=val2',
    'cli.snippet.help.save_command_lines_you':
        'Häufig verwendete Befehlszeilen als benannte Vorlagen speichern, wobei {{placeholders}} beim Ausführen ausgefüllt werden. Snippets werden im Browser gespeichert und von allen Ihren Terminals und Tabs gemeinsam genutzt.',
    'cli.snippet.help.save_replace_snippet': 'Ein Snippet speichern (oder ersetzen)',
    'cli.snippet.help.fill_placeholders_run': 'Platzhalter ausfüllen und ausführen',
    'cli.snippet.help.all_saved_snippets': 'Alle gespeicherten Snippets',
    'cli.snippet.help.print_snippet': 'Ein Snippet ausgeben',
    'cli.snippet.help.delete_snippet_rm_remove': 'Ein Snippet löschen (rm, remove)',
    'cli.snippet.help.template_placeholder': 'Eine Vorlage mit einem Platzhalter',
    'cli.snippet.help.runs_echo_hello_ada': 'Führt aus: echo Hello Ada',
    'cli.snippet.help.quote_values_spaces': 'Werte mit Leerzeichen in Anführungszeichen setzen',

    // ── Test ─────────────────────────────────────────────────────────
    'cli.test.description': 'Eine Bedingung auswerten (Exit-Status 0, wenn wahr)',
    'cli.test.help.expressions': 'Ausdrücke:',
    'cli.test.help.empty_not_empty': 'leer / nicht leer',
    'cli.test.help.equal_not_equal': 'gleich / ungleich',
    'cli.test.help.integer_comparison': 'Ganzzahlvergleich',
    'cli.test.help.exists_file_directory': 'existiert / Datei / Verzeichnis',

    // ── Kill ─────────────────────────────────────────────────────────
    'cli.kill.description': 'Einen laufenden Prozess anhand der PID beenden',
    'cli.kill.help.stop_running_process_pid':
        'Einen laufenden Prozess anhand seiner PID beenden, wie von ps angezeigt. Ein Befehl wird abgebrochen, ein Hintergrunddienst wird gestoppt. Nur laufende Prozesse können beendet werden; danach erscheinen sie als killed mit Exit-Code -9.',
    'cli.kill.help.stop_process_pid': 'Den Prozess mit dieser PID beenden',
    'cli.kill.help.find_pid': 'Die PID finden',
    'cli.kill.help.stop_process_3': 'Prozess 3 beenden',

    // ── Pkg ──────────────────────────────────────────────────────────
    'cli.pkg.description': 'Pakete im CLI verwalten',
    'cli.pkg.ls.description': 'Alle Pakete im CLI auflisten',
    'cli.pkg.browse.description':
        'Alle verfügbaren Pakete aus allen konfigurierten Quellen auflisten',
    'cli.pkg.add.description': 'Ein Paket zum CLI hinzufügen, z. B. pkg add guid.',
    'cli.pkg.remove.description': 'Ein Paket aus dem CLI entfernen',
    'cli.pkg.versions.description': 'Alle veröffentlichten Versionen eines Pakets anzeigen',
    'cli.pkg.check.description': 'Installierte Pakete auf verfügbare Updates prüfen',
    'cli.pkg.update.description':
        'Ein Paket im CLI auf die neueste Version aktualisieren oder alle Pakete aktualisieren',
    'cli.pkg.source.description': 'Die Paketquelle für Downloads anzeigen oder festlegen',
    'cli.pkg.source.get.description': 'Die aktuelle CDN-Quelle anzeigen',
    'cli.pkg.source.set.description':
        'Die bevorzugte Paketquelle festlegen (interaktiv, wenn kein Name angegeben)',
    'cli.pkg.help.list_installed_packages': 'Installierte Pakete auflisten',
    'cli.pkg.help.browse_all_available_packages': 'Alle verfügbaren Pakete durchsuchen',
    'cli.pkg.help.install_package': 'Ein Paket installieren',
    'cli.pkg.help.remove_package': 'Ein Paket entfernen',
    'cli.pkg.help.show_all_published_versions': 'Alle veröffentlichten Versionen anzeigen',
    'cli.pkg.help.check_available_updates': 'Nach verfügbaren Updates suchen',
    'cli.pkg.help.update_one_all_packages': 'Ein Paket oder alle Pakete aktualisieren',
    'cli.pkg.help.get_set_package_source': 'Paketquelle anzeigen oder festlegen',
    'cli.pkg.help.install_qodalis_cli_guid': '@qodalis/cli-guid installieren',
    'cli.pkg.help.install_multiple_packages': 'Mehrere Pakete installieren',
    'cli.pkg.help.update_all_packages': 'Alle Pakete aktualisieren',
    'cli.pkg.browse.help.install_package': 'um ein Paket zu installieren',
    'cli.pkg.add.help.short_name': 'Kurzname',
    'cli.pkg.add.help.full_name': 'Vollständiger Name',
    'cli.pkg.add.help.multiple_packages': 'Mehrere Pakete',
    'cli.pkg.add.help.specific_version': 'Bestimmte Version',
    'cli.pkg.remove.help.remove_one_package': 'Ein Paket entfernen',
    'cli.pkg.remove.help.remove_multiple': 'Mehrere entfernen',
    'cli.pkg.remove.help.short_alias': 'Kurzer Alias',
    'cli.pkg.versions.help.short_name': 'Kurzname',
    'cli.pkg.versions.help.full_name': 'Vollständiger Name',
    'cli.pkg.check.help.apply_updates': 'um Updates anzuwenden',
    'cli.pkg.update.help.update_latest': 'Auf die neueste Version aktualisieren',
    'cli.pkg.update.help.update_specific_version': 'Auf eine bestimmte Version aktualisieren',
    'cli.pkg.update.help.update_all_packages': 'Alle Pakete aktualisieren',
    'cli.pkg.update.help.install_specific_version': 'Bestimmte Version installieren',
    'cli.pkg.source.help.change': 'um sie zu ändern',
    'cli.pkg.source.help.show_current_source': 'Aktuelle Quelle anzeigen',
    'cli.pkg.source.help.set_preferred_source': 'Bevorzugte Quelle festlegen',
    'cli.pkg.help.install_package_2': 'um ein Paket zu installieren',

    // ── Ps ───────────────────────────────────────────────────────────
    'cli.ps.description': 'Laufende und kürzliche Prozesse auflisten',
    'cli.ps.help.list_processes_terminal_commands':
        'Die Prozesse dieses Terminals auflisten: Befehle, Hintergrunddienste, Daemons und Jobs. Laufende werden zusammen mit kürzlich beendeten, fehlgeschlagenen und abgebrochenen (die letzten 50) angezeigt, mit Exit-Code und wie lange sie gestartet wurden.',
    'cli.ps.help.all_processes_oldest_first': 'Alle Prozesse, älteste zuerst',
    'cli.ps.help.what_running_now': 'Was gerade läuft',
    'cli.ps.help.stop_process_12_pid': 'Prozess 12 aus der PID-Spalte beenden',

    // ── Cron ─────────────────────────────────────────────────────────
    'cli.cron.description': 'Befehle in wiederkehrendem Intervall ausführen lassen',
    'cli.cron.add.description': 'Einen Cron-Job hinzufügen: cron add <name> <interval> <command>',
    'cli.cron.list.description': 'Alle Cron-Jobs auflisten',
    'cli.cron.remove.description': 'Einen Cron-Job entfernen: cron remove <name>',
    'cli.cron.enable.description': 'Einen pausierten Cron-Job aktivieren',
    'cli.cron.disable.description': 'Einen Cron-Job pausieren, ohne ihn zu entfernen',
    'cli.cron.help.run_command_again_again':
        'Einen Befehl in festem Intervall wiederholt ausführen, solange das Terminal geöffnet ist. Jobs werden gespeichert: Sie starten beim Start des Terminals erneut und können pausiert werden, ohne sie zu entfernen.',
    'cli.cron.help.add_job': 'Einen Job hinzufügen',
    'cli.cron.help.jobs_interval_status_run':
        'Jobs mit Intervall, Status und Anzahl der Ausführungen (ls)',
    'cli.cron.help.pause_job': 'Einen Job pausieren',
    'cli.cron.help.resume_paused_job': 'Einen pausierten Job fortsetzen',
    'cli.cron.help.remove_job_rm_delete': 'Einen Job entfernen (rm, delete)',
    'cli.cron.help.intervals_seconds_30_hours':
        'Intervalle: Sekunden (30) oder Stunden, Minuten und Sekunden (1h, 5m, 1h30m, 90s); mindestens 10 Sekunden.',
    'cli.cron.help.every_5_minutes': 'Alle 5 Minuten',
    'cli.cron.help.every_hour_half': 'Jede Stunde und eine halbe',
    'cli.cron.help.pause': 'Pausieren',

    // ── Binary ───────────────────────────────────────────────────────
    'cli.binary.long_description': 'Binärstrings kodieren und dekodieren',
    'cli.binary.utf8_note': 'Unterstützt UTF-8-Textkodierung',
    'cli.binary.encode_desc': 'Text zu Binär',
    'cli.binary.decode_desc': 'Binär zu Text',

    // ── Morse ────────────────────────────────────────────────────────
    'cli.morse.long_description': 'Morsecode kodieren und dekodieren',
    'cli.morse.note': 'Unterstützt Buchstaben, Zahlen und gängige Satzzeichen',
    'cli.morse.encode_desc': 'Text zu Morse',
    'cli.morse.decode_desc': 'Morse zu Text',

    // ── Rot ──────────────────────────────────────────────────────────
    'cli.rot.long_description': 'ROT-Chiffre (Rotation) auf Text anwenden',
    'cli.rot.note': 'Standard ist ROT13 (selbstinvers: zweifache Anwendung ergibt das Original)',
    'cli.rot.default_desc': 'ROT13 anwenden',
    'cli.rot.shift_desc': 'ROT-N anwenden',

    // ── Awk ──────────────────────────────────────────────────────────
    'cli.awk.description': 'Mustersuche und Textverarbeitung',
    'cli.awk.help.process_text_records_fields':
        'Text als Datensätze und Felder verarbeiten: jede Zeile wird in die Felder $1, $2, ... zerlegt ($0 ist die ganze Zeile), und jede Regel führt ihre { action } auf passenden Zeilen aus. Unterstützt BEGIN- und END-Blöcke, /regex/ und Feldvergleichsmuster, print, Variablen, NR und NF. Das Programm in Anführungszeichen setzen; ein einfaches funktioniert auch ohne (awk {print $1} file).',
    'cli.awk.help.run_program_over_file': 'Ein Programm auf eine Datei anwenden',
    'cli.awk.help.split_fields_instead_spaces': 'Felder an <sep> statt an Leerzeichen trennen',
    'cli.awk.help.run_program_over_piped': 'Ein Programm auf weitergeleitete Eingabe anwenden',
    'cli.awk.help.print_first_column': 'Die erste Spalte ausgeben',
    'cli.awk.help.second_column_csv': 'Zweite Spalte einer CSV',
    'cli.awk.help.filter_rows_field': 'Zeilen nach einem Feld filtern',
    'cli.awk.help.sum_second_column': 'Die zweite Spalte summieren',

    // ── Basename ─────────────────────────────────────────────────────
    'cli.basename.description': 'Verzeichnis aus einem Pfad entfernen',
    'cli.basename.help.print_last_part_path':
        'Den letzten Teil eines Pfads ausgeben, den Datei- oder Verzeichnisnamen ohne die vorangehenden Verzeichnisse. Wird ein Suffix angegeben, wird es ebenfalls am Ende entfernt.',
    'cli.basename.help.name_without_directories': 'Name ohne die Verzeichnisse',
    'cli.basename.help.also_remove_trailing_suffix': 'Auch ein abschließendes Suffix entfernen',
    'cli.basename.help.prints_notes_txt': 'Gibt notes.txt aus',
    'cli.basename.help.prints_notes': 'Gibt notes aus',
    'cli.basename.help.prints_user': 'Gibt user aus',

    // ── Cat ──────────────────────────────────────────────────────────
    'cli.cat.description': 'Dateiinhalt anzeigen',
    'cli.cat.help.print_contents_one_more':
        'Den Inhalt einer oder mehrerer Dateien der Reihe nach verbunden ausgeben, oder weitergeleitete Eingabe. Leiten Sie die Ausgabe an andere Befehle weiter, um sie zu durchsuchen, zu sortieren oder zu zählen.',
    'cli.cat.help.print_files_one_after': 'Dateien nacheinander ausgeben',
    'cli.cat.help.send_file_another_command': 'Eine Datei an einen anderen Befehl senden',
    'cli.cat.help.show_whole_file': 'Die ganze Datei anzeigen',
    'cli.cat.help.show_only_lines_error': 'Nur Zeilen mit error anzeigen',
    'cli.cat.help.print_lines_sorted': 'Die Zeilen sortiert ausgeben',

    // ── Cd ───────────────────────────────────────────────────────────
    'cli.cd.description': 'Das aktuelle Arbeitsverzeichnis wechseln',
    'cli.cd.help.change_current_directory_without':
        'Das aktuelle Verzeichnis wechseln. Ohne Pfad geht es in Ihr Home-Verzeichnis. Pfade können absolut (/...), relativ zum aktuellen Ort sein oder mit ~ für das Home-Verzeichnis beginnen.',
    'cli.cd.help.go_home_directory': 'In Ihr Home-Verzeichnis wechseln',
    'cli.cd.help.go_directory': 'In ein Verzeichnis wechseln',
    'cli.cd.help.go_up_one_level': 'Eine Ebene nach oben',
    'cli.cd.help.go_docs_home': 'Zu docs in Ihrem Home-Verzeichnis wechseln',
    'cli.cd.help.go_sibling_directory': 'In ein Nachbarverzeichnis wechseln',
    'cli.cd.help.go_root': 'In das Wurzelverzeichnis wechseln',

    // ── Chmod ────────────────────────────────────────────────────────
    'cli.chmod.description': 'Dateiberechtigungen ändern',
    'cli.chmod.help.change_who_can_read':
        'Ändern, wer eine Datei lesen (r), schreiben (w) und ausführen (x) darf. Verwenden Sie einen oktalen Modus wie 755 oder einen symbolischen: wer (u Benutzer, g Gruppe, o andere, a alle), dann + zum Hinzufügen, - zum Entfernen oder = zum Festlegen, dann die Berechtigungen.',
    'cli.chmod.help.set_permissions': 'Berechtigungen festlegen',
    'cli.chmod.help.apply_directory_everything': 'Auf ein Verzeichnis und alles darin anwenden',
    'cli.chmod.help.rw_r_r_owner': 'rw-r--r--: Besitzer schreibt, andere lesen',
    'cli.chmod.help.let_owner_execute': 'Dem Besitzer die Ausführung erlauben',
    'cli.chmod.help.take_away_write_group': 'Schreibrecht für Gruppe und andere entziehen',
    'cli.chmod.help.set_whole_directory_tree': 'Einen ganzen Verzeichnisbaum festlegen',

    // ── Chown ────────────────────────────────────────────────────────
    'cli.chown.description': 'Dateibesitzer und -gruppe ändern',
    'cli.chown.help.change_owner_group_files':
        'Besitzer und/oder Gruppe von Dateien ändern. Geben Sie user, user:group, user: (nur Besitzer) oder :group (nur Gruppe) an.',
    'cli.chown.help.change_owner_group_if': 'Besitzer ändern, und Gruppe, falls angegeben',
    'cli.chown.help.change_only_group': 'Nur die Gruppe ändern',
    'cli.chown.help.apply_directory_everything': 'Auf ein Verzeichnis und alles darin anwenden',
    'cli.chown.help.make_alice_owner': 'alice zur Besitzerin machen',
    'cli.chown.help.set_owner_group': 'Besitzer und Gruppe festlegen',
    'cli.chown.help.give_bob_whole_directory': 'bob ein ganzes Verzeichnis übergeben',

    // ── Cp ───────────────────────────────────────────────────────────
    'cli.cp.description': 'Dateien und Verzeichnisse kopieren',
    'cli.cp.help.copy_file_new_path':
        'Eine Datei an einen neuen Pfad oder in ein vorhandenes Verzeichnis kopieren. Zum Kopieren eines Verzeichnisses ist -r nötig, das alles darin mitkopiert. Eine am Ziel vorhandene Datei wird ersetzt.',
    'cli.cp.help.copy_file_new_name': 'Eine Datei unter neuem Namen kopieren',
    'cli.cp.help.copy_files_directory': 'Dateien in ein Verzeichnis kopieren',
    'cli.cp.help.copy_directory_contents': 'Ein Verzeichnis samt Inhalt kopieren',
    'cli.cp.help.make_backup_copy': 'Eine Sicherungskopie anlegen',
    'cli.cp.help.copy_docs': 'Nach ~/docs kopieren',
    'cli.cp.help.duplicate_whole_directory': 'Ein ganzes Verzeichnis duplizieren',

    // ── Cut ──────────────────────────────────────────────────────────
    'cli.cut.description': 'Spalten oder Felder aus jeder Zeile einer Datei extrahieren',
    'cli.cut.help.print_selected_parts_each':
        'Ausgewählte Teile jeder Zeile ausgeben: durch ein Trennzeichen getrennte Felder (-f, standardmäßig Tab) oder Zeichenpositionen (-c). Eine Liste kann aus einzelnen Zahlen, Bereichen oder beidem bestehen, etwa 1,3 oder 2-4 oder 3-.',
    'cli.cut.help.select_fields': 'Felder auswählen',
    'cli.cut.help.select_character_positions': 'Zeichenpositionen auswählen',
    'cli.cut.help.cut_piped_input': 'Weitergeleitete Eingabe zerschneiden',
    'cli.cut.help.first_third_csv_column': 'Erste und dritte CSV-Spalte',
    'cli.cut.help.first_10_characters_each': 'Die ersten 10 Zeichen jeder Zeile',
    'cli.cut.help.first_two_fields_split': 'Die ersten zwei Felder, getrennt an :',

    // ── Dirname ──────────────────────────────────────────────────────
    'cli.dirname.description': 'Letzte Komponente aus einem Pfad entfernen',
    'cli.dirname.help.print_directory_part_path':
        'Den Verzeichnisteil eines Pfads ausgeben, alles vor dem letzten /. Ein einfacher Name ohne / ergibt . (das aktuelle Verzeichnis).',
    'cli.dirname.help.path_without_last_part': 'Pfad ohne seinen letzten Teil',
    'cli.dirname.help.prints_home_user': 'Gibt /home/user aus',
    'cli.dirname.help.prints': 'Gibt . aus',
    'cli.dirname.help.prints_2': 'Gibt / aus',

    // ── Du ───────────────────────────────────────────────────────────
    'cli.du.description': 'Dateispeicherbelegung abschätzen',
    'cli.du.help.show_how_much_space':
        'Anzeigen, wie viel Speicherplatz Dateien und Verzeichnisse belegen, in Bytes. Bei einem Verzeichnis wird jedes Unterverzeichnis mit seiner Gesamtgröße aufgelistet; mit -s nur die Gesamtsumme oder mit -d die Tiefe begrenzen.',
    'cli.du.help.sizes_path_default_current':
        'Größen eines Pfads (Standard: das aktuelle Verzeichnis) und seiner Unterverzeichnisse',
    'cli.du.help.only_total': 'Nur die Gesamtsumme',
    'cli.du.help.only_levels_deep': 'Nur <n> Ebenen tief',
    'cli.du.help.size_each_directory_docs': 'Größe jedes Verzeichnisses in ~/docs',
    'cli.du.help.total_home_k_m': 'Gesamtgröße Ihres Home-Verzeichnisses in K/M/G',
    'cli.du.help.size_each_top_level': 'Größe jedes Ordners der obersten Ebene',

    // ── Find ─────────────────────────────────────────────────────────
    'cli.find.description': 'Dateien und Verzeichnisse nach Name oder Typ suchen',
    'cli.find.help.list_files_directories_under':
        'Dateien und Verzeichnisse unter einem Pfad auflisten (standardmäßig das aktuelle Verzeichnis), wobei alle Unterverzeichnisse durchsucht werden. Der Startpfad selbst wird zuerst aufgelistet. Nach Namen mit einem Glob-Muster filtern (* und ?; --name unterscheidet Groß-/Kleinschreibung, --iname nicht) oder nach Typ.',
    'cli.find.help.list_everything_under_path': 'Alles unter einem Pfad auflisten',
    'cli.find.help.match_names_against_glob': 'Namen mit einem Glob abgleichen',
    'cli.find.help.same_ignoring_case': 'Dasselbe, ohne Beachtung der Groß-/Kleinschreibung',
    'cli.find.help.only_files_f_directories': 'Nur Dateien (f) oder Verzeichnisse (d)',
    'cli.find.help.list_everything_docs': 'Alles in ~/docs auflisten',
    'cli.find.help.find_all_txt_files': 'Alle .txt-Dateien finden',
    'cli.find.help.directories_near_top': 'Verzeichnisse nahe der Spitze',
    'cli.find.help.delete_all_tmp_files': 'Alle .tmp-Dateien löschen',

    // ── Grep ─────────────────────────────────────────────────────────
    'cli.grep.description': 'Dateiinhalte nach einem Muster durchsuchen',
    'cli.grep.help.print_lines_match_pattern':
        'Die Zeilen ausgeben, die einem Muster entsprechen. Das Muster ist ein regulärer Ausdruck, Treffer werden hervorgehoben, und die Eingabe können Dateien, Verzeichnisse (mit -r) oder weitergeleiteter Text sein.',
    'cli.grep.help.search_one_more_files': 'Eine oder mehrere Dateien durchsuchen',
    'cli.grep.help.search_every_file_under': 'Jede Datei unter einem Verzeichnis durchsuchen',
    'cli.grep.help.filter_piped_input': 'Weitergeleitete Eingabe filtern',
    'cli.grep.help.case_insensitive_search': 'Suche ohne Beachtung der Groß-/Kleinschreibung',
    'cli.grep.help.find_todos_line_numbers': 'TODOs mit Zeilennummern finden',
    'cli.grep.help.hide_comment_lines': 'Kommentarzeilen ausblenden',
    'cli.grep.help.count_matching_lines': 'Passende Zeilen zählen',

    // ── Head ─────────────────────────────────────────────────────────
    'cli.head.description': 'Die ersten Zeilen einer Datei anzeigen',
    'cli.head.help.print_first_lines_file':
        'Die ersten Zeilen einer Datei ausgeben, standardmäßig 10. Funktioniert auch mit weitergeleiteter Eingabe. Bei mehreren Dateien erhält jede eine Kopfzeile ==> name <==.',
    'cli.head.help.first_10_lines': 'Die ersten 10 Zeilen',
    'cli.head.help.first_lines': 'Die ersten <count> Zeilen',
    'cli.head.help.first_lines_piped_input': 'Die ersten Zeilen weitergeleiteter Eingabe',
    'cli.head.help.show_start_file': 'Den Anfang einer Datei anzeigen',
    'cli.head.help.first_3_lines_each': 'Die ersten 3 Zeilen jeder Datei',
    'cli.head.help.first_20_lines_log': 'Die ersten 20 Zeilen des Logs',

    // ── Ln ───────────────────────────────────────────────────────────
    'cli.ln.description': 'Symbolische Links erstellen',
    'cli.ln.help.create_symbolic_link_new':
        'Einen symbolischen Link erstellen: ein neuer Pfad, der auf eine andere Datei oder ein anderes Verzeichnis zeigt. Nur symbolische Links (-s) werden unterstützt, und das Ziel muss noch nicht existieren.',
    'cli.ln.help.create_pointing': '<link> erstellen, der auf <target> zeigt',
    'cli.ln.help.shortcut_file': 'Verknüpfung zu einer Datei',
    'cli.ln.help.shortcut_directory': 'Verknüpfung zu einem Verzeichnis',

    // ── Mkdir ────────────────────────────────────────────────────────
    'cli.mkdir.description': 'Verzeichnisse erstellen',
    'cli.mkdir.help.create_new_directory_p':
        'Ein neues Verzeichnis erstellen. Mit -p werden auch fehlende übergeordnete Verzeichnisse erstellt.',
    'cli.mkdir.help.create_one_more_directories': 'Ein oder mehrere Verzeichnisse erstellen',
    'cli.mkdir.help.create_directory_missing_parents':
        'Ein Verzeichnis samt fehlenden übergeordneten Verzeichnissen erstellen',
    'cli.mkdir.help.create_projects_current_directory':
        'projects im aktuellen Verzeichnis erstellen',
    'cli.mkdir.help.create_whole_path_once': 'Den ganzen Pfad auf einmal erstellen',

    // ── Mv ───────────────────────────────────────────────────────────
    'cli.mv.description': 'Dateien und Verzeichnisse verschieben oder umbenennen',
    'cli.mv.help.move_rename_file_directory':
        'Eine Datei oder ein Verzeichnis verschieben oder umbenennen. Ist das Ziel ein vorhandenes Verzeichnis, wird die Quelle hineinverschoben; andernfalls wird sie umbenannt. Eine am Ziel vorhandene Datei wird ersetzt.',
    'cli.mv.help.rename_file_directory': 'Eine Datei oder ein Verzeichnis umbenennen',
    'cli.mv.help.move_them_directory': 'Sie in ein Verzeichnis verschieben',
    'cli.mv.help.rename_file': 'Eine Datei umbenennen',
    'cli.mv.help.move_docs': 'Nach ~/docs verschieben',
    'cli.mv.help.rename_directory': 'Ein Verzeichnis umbenennen',

    // ── Paste ────────────────────────────────────────────────────────
    'cli.paste.description': 'Zeilen von Dateien nebeneinander zusammenführen',
    'cli.paste.help.join_files_side_side':
        'Dateien nebeneinander zusammenführen: Zeile 1 jeder Datei kommt in eine Ausgabezeile, durch Tab getrennt, dann Zeile 2 und so weiter. Mit -s wird stattdessen jede Datei zu einer einzigen Zeile verbunden. Weitergeleitete Eingabe wird als Datei - gelesen (oder als einzige Eingabe, wenn keine Datei genannt ist); -d nimmt eine Liste von Trennzeichen, die der Reihe nach verwendet werden.',
    'cli.paste.help.merge_files_line_line': 'Dateien zeilenweise zusammenführen',
    'cli.paste.help.join_all_lines_file': 'Alle Zeilen einer Datei zu einer verbinden',
    'cli.paste.help.merge_piped_input_file':
        'Weitergeleitete Eingabe mit einer Datei zusammenführen',
    'cli.paste.help.two_columns_tab_separated': 'Zwei Spalten, durch Tab getrennt',
    'cli.paste.help.merge_comma_separated': 'Kommagetrennt zusammenführen',
    'cli.paste.help.turn_list_one_csv': 'Eine Liste in eine CSV-Zeile umwandeln',

    // ── Pwd ──────────────────────────────────────────────────────────
    'cli.pwd.description': 'Das aktuelle Arbeitsverzeichnis ausgeben',
    'cli.pwd.help.print_full_path_directory':
        'Den vollständigen Pfad des aktuellen Verzeichnisses ausgeben. Relative Pfade in anderen Befehlen beginnen hier.',
    'cli.pwd.help.show_current_directory': 'Das aktuelle Verzeichnis anzeigen',
    'cli.pwd.help.example_home_user': 'Zum Beispiel /home/user',
    'cli.pwd.help.prints_home_user_docs': 'Gibt /home/user/docs aus',

    // ── Rm ───────────────────────────────────────────────────────────
    'cli.rm.description': 'Dateien oder Verzeichnisse entfernen',
    'cli.rm.help.delete_file_directories_only':
        'Eine Datei löschen. Verzeichnisse werden nur mit -r entfernt, das alles darin löscht. Gelöschte Dateien können nicht wiederhergestellt werden.',
    'cli.rm.help.delete_one_more_files': 'Eine oder mehrere Dateien löschen',
    'cli.rm.help.delete_directory_contents': 'Ein Verzeichnis samt Inhalt löschen',
    'cli.rm.help.delete_without_error_if': 'Ohne Fehler löschen, falls nicht vorhanden',
    'cli.rm.help.delete_one_file': 'Eine Datei löschen',
    'cli.rm.help.delete_whole_directory': 'Ein ganzes Verzeichnis löschen',
    'cli.rm.help.quiet_if_file_does': 'Still, wenn die Datei nicht existiert',

    // ── Rmdir ────────────────────────────────────────────────────────
    'cli.rmdir.description': 'Leere Verzeichnisse entfernen',
    'cli.rmdir.help.remove_empty_directory_refuses':
        'Ein leeres Verzeichnis entfernen. Ein Verzeichnis, das noch Dateien enthält, wird nicht entfernt; verwenden Sie dafür rm -r.',
    'cli.rmdir.help.remove_empty_directories': 'Leere Verzeichnisse entfernen',
    'cli.rmdir.help.remove_directory_current_one': 'Ein Verzeichnis im aktuellen entfernen',
    'cli.rmdir.help.remove_full_path': 'Über den vollständigen Pfad entfernen',

    // ── Sed ──────────────────────────────────────────────────────────
    'cli.sed.description': 'Stream-Editor zum Filtern und Umwandeln von Text',
    'cli.sed.help.edit_text_line_line':
        'Text zeilenweise mit einem Skript bearbeiten: ersetzen (s/old/new/), löschen (d), ausgeben (p) oder beenden (q), optional beschränkt auf eine Zeilennummer, einen Bereich (1,5, 3,$ oder /start/,/end/) oder Zeilen, die /regex/ entsprechen; ! nach einer Adresse kehrt sie um und ; trennt Befehle. Die Ersetzung kann & (den Treffer) und \\1 bis \\9 (Gruppen, geschrieben \\(...\\) oder, mit -E, (...)) verwenden. Liest Dateien oder weitergeleitete Eingabe und gibt das Ergebnis aus, oder schreibt die Dateien mit -i um.',
    'cli.sed.help.print_edited_file': 'Die bearbeitete Datei ausgeben',
    'cli.sed.help.save_edits_file': 'Die Änderungen in der Datei speichern',
    'cli.sed.help.print_only_selected_lines': 'Nur ausgewählte Zeilen ausgeben',
    'cli.sed.help.edit_piped_input': 'Weitergeleitete Eingabe bearbeiten',
    'cli.sed.help.replace_every_cat_dog': 'Jedes cat durch dog ersetzen',
    'cli.sed.help.edit_file_place': 'Die Datei direkt bearbeiten',
    'cli.sed.help.drop_comment_lines': 'Kommentarzeilen entfernen',
    'cli.sed.help.print_lines_1_5': 'Die Zeilen 1 bis 5 ausgeben',
    'cli.sed.help.swap_two_words': 'Zwei Wörter vertauschen',

    // ── Sh ───────────────────────────────────────────────────────────
    'cli.sh.description': 'Eine Skriptdatei ausführen',
    'cli.sh.help.requires_execute': '(erfordert Ausführungsberechtigung)',
    'cli.sh.help.script_syntax': 'Skriptsyntax:',
    'cli.sh.help.comments': 'Zeilen, die mit # beginnen, sind Kommentare',
    'cli.sh.help.several_commands': 'Mehrere Befehle in einer Zeile',
    'cli.sh.help.assignment': 'Variablenzuweisung',
    'cli.sh.help.substitution': 'Variablenersetzung',
    'cli.sh.help.stop_on_error': 'Bei Fehler anhalten (Standard)',
    'cli.sh.help.continue_on_errors': 'Bei Fehlern fortfahren',
    'cli.sh.help.exit': 'Das Skript mit Status n beenden',
    'cli.sh.help.control_flow': 'Ablaufsteuerung:',
    'cli.sh.help.until': '(until cmd: das Gegenteil)',
    'cli.sh.help.break_continue': 'In einer Schleife verlassen / überspringen',
    'cli.sh.help.negate': 'Den Exit-Status negieren',
    'cli.sh.help.conditions': 'Bedingungen sind Befehle:',
    'cli.sh.help.conditions_status':
        '(Status 0 = wahr; siehe help test). Schleifen enden nach 10000 Durchläufen',
    'cli.sh.help.conditions_loops': 'von while/until; Ctrl+C beendet das Skript.',
    'cli.sh.help.example_script': 'Beispielskript:',

    // ── Sort ─────────────────────────────────────────────────────────
    'cli.sort.description': 'Zeilen von Textdateien sortieren',
    'cli.sort.help.sort_lines_file_piped':
        'Die Zeilen einer Datei oder weitergeleiteter Eingabe sortieren, standardmäßig alphabetisch. Numerisch, rückwärts, nach einem Feld sortieren oder Duplikate entfernen. Mehrere Dateien werden zusammen zu einer Liste sortiert.',
    'cli.sort.help.sort_lines_alphabetically': 'Zeilen alphabetisch sortieren',
    'cli.sort.help.sort_field_split': 'Nach Feld <n> sortieren, getrennt an <sep>',
    'cli.sort.help.sort_piped_input': 'Weitergeleitete Eingabe sortieren',
    'cli.sort.help.z': 'A bis Z',
    'cli.sort.help.largest_number_first': 'Größte Zahl zuerst',
    'cli.sort.help.sort_csv_second_column': 'Eine CSV nach ihrer zweiten Spalte sortieren',
    'cli.sort.help.sorted_without_duplicates': 'Sortiert, ohne Duplikate',

    // ── Stat ─────────────────────────────────────────────────────────
    'cli.stat.description': 'Datei-/Verzeichnis-Metadaten anzeigen',
    'cli.stat.help.show_details_about_files':
        'Details zu Dateien oder Verzeichnissen anzeigen: vollständiger Pfad, Größe, Typ, Berechtigungen, Besitzer, Gruppe sowie Erstellungs- und letzter Änderungszeitpunkt.',
    'cli.stat.help.show_details_each_path': 'Details zu jedem Pfad anzeigen',
    'cli.stat.help.details_one_file': 'Details einer Datei',
    'cli.stat.help.several_paths_once': 'Mehrere Pfade auf einmal',

    // ── Tac ──────────────────────────────────────────────────────────
    'cli.tac.description': 'Datei in umgekehrter Zeilenreihenfolge ausgeben',
    'cli.tac.help.print_file_lines_reverse':
        'Eine Datei mit ihren Zeilen in umgekehrter Reihenfolge ausgeben, letzte Zeile zuerst. Funktioniert auch mit weitergeleiteter Eingabe.',
    'cli.tac.help.print_file_bottom_top': 'Eine Datei von unten nach oben ausgeben',
    'cli.tac.help.reverse_piped_input': 'Weitergeleitete Eingabe umkehren',
    'cli.tac.help.newest_log_lines_first': 'Neueste Log-Zeilen zuerst',
    'cli.tac.help.reverse_list': 'Eine Liste umkehren',

    // ── Tail ─────────────────────────────────────────────────────────
    'cli.tail.description': 'Die letzten Zeilen einer Datei anzeigen',
    'cli.tail.help.print_last_lines_file':
        'Die letzten Zeilen einer Datei ausgeben, standardmäßig 10. Funktioniert auch mit weitergeleiteter Eingabe. Bei mehreren Dateien erhält jede eine Kopfzeile ==> name <==.',
    'cli.tail.help.last_10_lines': 'Die letzten 10 Zeilen',
    'cli.tail.help.last_lines': 'Die letzten <count> Zeilen',
    'cli.tail.help.last_lines_piped_input': 'Die letzten Zeilen weitergeleiteter Eingabe',
    'cli.tail.help.show_end_log': 'Das Ende eines Logs anzeigen',
    'cli.tail.help.last_5_lines': 'Die letzten 5 Zeilen',
    'cli.tail.help.last_20_lines_log': 'Die letzten 20 Zeilen des Logs',

    // ── Tee ──────────────────────────────────────────────────────────
    'cli.tee.description': 'Weitergeleitete Eingabe in Dateien und in die Ausgabe kopieren',
    'cli.tee.help.pass_piped_input_through':
        'Weitergeleitete Eingabe unverändert durchreichen und eine Kopie in jeder genannten Datei speichern, wobei diese überschrieben oder mit -a erweitert werden. Wie Unix-tee liest es nur weitergeleitete Eingabe: um eine Datei zu kopieren, leiten Sie sie mit cat hinein.',
    'cli.tee.help.show_piped_output_save': 'Weitergeleitete Ausgabe anzeigen und speichern',
    'cli.tee.help.append_instead_overwriting': 'Anhängen statt überschreiben',
    'cli.tee.help.show_save_copy': 'Anzeigen und eine Kopie speichern',
    'cli.tee.help.add_line_log': 'Eine Zeile zu einem Log hinzufügen',
    'cli.tee.help.copy_source_txt_txt': 'source.txt nach a.txt und b.txt kopieren',

    // ── Touch ────────────────────────────────────────────────────────
    'cli.touch.description': 'Eine leere Datei erstellen oder ihren Zeitstempel aktualisieren',
    'cli.touch.help.create_empty_file_update':
        'Eine leere Datei erstellen oder den Änderungszeitpunkt einer vorhandenen Datei aktualisieren. Das übergeordnete Verzeichnis muss bereits existieren.',
    'cli.touch.help.create_files_refresh_their':
        'Die Dateien erstellen oder ihre Zeitstempel aktualisieren',
    'cli.touch.help.create_empty_notes_txt': 'Eine leere notes.txt erstellen',
    'cli.touch.help.create_file_docs': 'Eine Datei in ~/docs erstellen',

    // ── Tr ───────────────────────────────────────────────────────────
    'cli.tr.description': 'Zeichen in weitergeleiteter Eingabe umsetzen oder löschen',
    'cli.tr.help.translate_characters_set1_matching':
        'Zeichen aus SET1 in die entsprechenden Zeichen aus SET2 umsetzen, sie löschen (-d) oder Wiederholungen zu einem zusammenfassen (-s). Mengen können Bereiche wie a-z und Klassen wie [:upper:], [:lower:], [:digit:], [:alpha:], [:alnum:] und [:space:] verwenden. Escapes \\n, \\t und \\\\ werden verstanden. Wie Unix-tr liest es nur weitergeleitete Eingabe und nimmt keine Dateiargumente: um eine Datei umzuwandeln, leiten Sie sie mit cat hinein.',
    'cli.tr.help.replace_characters': 'Zeichen ersetzen',
    'cli.tr.help.delete_characters': 'Zeichen löschen',
    'cli.tr.help.squeeze_repeated_characters': 'Wiederholte Zeichen zusammenfassen',
    'cli.tr.help.convert_file_upper_case': 'Eine Datei in Großbuchstaben umwandeln',
    'cli.tr.help.upper_case_piped_text': 'Weitergeleiteten Text in Großbuchstaben umwandeln',
    'cli.tr.help.remove_all_digits': 'Alle Ziffern entfernen',
    'cli.tr.help.collapse_runs_spaces': 'Folgen von Leerzeichen zusammenfassen',

    // ── Tree ─────────────────────────────────────────────────────────
    'cli.tree.description': 'Verzeichnisbaum anzeigen',
    'cli.tree.help.draw_directory_everything_below':
        'Ein Verzeichnis und alles darunter als Baum darstellen, Verzeichnisse zuerst, gefolgt von der Anzahl der Verzeichnisse und Dateien. Standard ist das aktuelle Verzeichnis.',
    'cli.tree.help.show_whole_tree': 'Den ganzen Baum anzeigen',
    'cli.tree.help.only_levels_deep': 'Nur <n> Ebenen tief',
    'cli.tree.help.tree_current_directory': 'Baum des aktuellen Verzeichnisses',
    'cli.tree.help.tree_docs': 'Baum von ~/docs',
    'cli.tree.help.top_two_levels_only': 'Nur die obersten zwei Ebenen',

    // ── Uniq ─────────────────────────────────────────────────────────
    'cli.uniq.description': 'Benachbarte doppelte Zeilen aus einer Datei herausfiltern',
    'cli.uniq.help.collapse_repeated_lines_next':
        'Wiederholte Zeilen, die direkt nebeneinander stehen, zu einer zusammenfassen. Nur benachbarte Duplikate werden zusammengeführt, sortieren Sie die Eingabe daher zuerst, um alle zu erfassen.',
    'cli.uniq.help.drop_adjacent_duplicate_lines': 'Benachbarte doppelte Zeilen entfernen',
    'cli.uniq.help.filter_piped_input': 'Weitergeleitete Eingabe filtern',
    'cli.uniq.help.collapse_repeated_lines': 'Wiederholte Zeilen zusammenfassen',
    'cli.uniq.help.count_how_often_each': 'Zählen, wie oft jede Zeile vorkommt',
    'cli.uniq.help.show_only_duplicated_lines': 'Nur die doppelten Zeilen anzeigen',

    // ── Wc ───────────────────────────────────────────────────────────
    'cli.wc.description': 'Zeilen-, Wort- und Zeichenanzahl ausgeben',
    'cli.wc.help.count_lines_words_characters':
        'Zeilen, Wörter und Zeichen in Dateien oder weitergeleiteter Eingabe zählen. Bei mehreren Dateien wird am Ende eine Summenzeile ausgegeben.',
    'cli.wc.help.lines_words_characters': 'Zeilen, Wörter und Zeichen',
    'cli.wc.help.only_line_count': 'Nur die Zeilenanzahl',
    'cli.wc.help.count_piped_input': 'Weitergeleitete Eingabe zählen',
    'cli.wc.help.all_three_counts': 'Alle drei Zählungen',
    'cli.wc.help.line_counts_total': 'Zeilenanzahlen mit Summe',
    'cli.wc.help.how_many_lines_mention': 'Wie viele Zeilen error erwähnen',

    // ── Xargs ────────────────────────────────────────────────────────
    'cli.xargs.description': 'Befehle aus Dateieingabe aufbauen und ausführen',
    'cli.xargs.help.run_command_arguments_taken':
        'Einen Befehl mit Argumenten ausführen, die aus der Eingabe stammen, getrennt durch Leerzeichen oder Zeilenumbrüche. Standardmäßig werden alle an einen Befehl angehängt; -n führt ihn in Stapeln aus und -I einmal pro Zeile, wobei ein Platzhalter ersetzt wird. xargs-Optionen stehen vor dem Befehl; alles danach, einschließlich Flags, gehört zum Befehl. Die Eingabe ist weitergeleiteter Text oder, ohne Pipe, die zuletzt genannte Datei.',
    'cli.xargs.help.append_input_lines': 'Eingabezeilen an <cmd> anhängen',
    'cli.xargs.help.run_once_per_line': '<cmd> einmal pro Zeile ausführen',
    'cli.xargs.help.read_arguments_file': 'Die Argumente aus einer Datei lesen',
    'cli.xargs.help.delete_every_tmp_file': 'Jede .tmp-Datei löschen',
    'cli.xargs.help.copy_each_listed_file': 'Jede aufgelistete Datei kopieren',
    'cli.xargs.help.one_mkdir_per_line': 'Ein mkdir pro Zeile',
    'cli.xargs.help.inner_command_keeps_flags': 'Der innere Befehl behält seine Flags',

    // ── Markdown ─────────────────────────────────────────────────────
    'cli.md.description': 'Markdown im Terminal darstellen',
    'cli.md.help.show_markdown_formatted_terminal':
        'Markdown formatiert im Terminal anzeigen: Überschriften, fetter und kursiver Text, Listen, Zitate, Code und Links. Den Text inline übergeben (mit oder ohne Anführungszeichen, \\n beginnt eine neue Zeile) oder von einem anderen Befehl weiterleiten.',
    'cli.md.help.render_inline_text': 'Inline-Text darstellen',
    'cli.md.help.same_optional_render_verb':
        'Dasselbe, mit dem optionalen Verb render (auch preview, view)',
    'cli.md.help.render_output_command': 'Die Ausgabe eines Befehls darstellen',
    'cli.md.help.heading': 'Eine Überschrift',
    'cli.md.help.several_lines': 'Mehrere Zeilen',
    'cli.md.help.piped_text': 'Weitergeleiteter Text',
    'cli.md.help.same_using_aliases': 'Dasselbe, mit Aliasen',

    // ── Todo ─────────────────────────────────────────────────────────
    'cli.todo.description':
        'Aufgaben im Terminal verwalten. TODO-Einträge hinzufügen, auflisten, bearbeiten, abschließen und entfernen.',
    'cli.todo.ls.description': 'TODO-Einträge auflisten',
    'cli.todo.add.description': 'Eine neue Aufgabe hinzufügen',
    'cli.todo.edit.description': 'Text oder Fälligkeitsdatum einer Aufgabe bearbeiten',
    'cli.todo.done.description': 'Eine Aufgabe als erledigt markieren',
    'cli.todo.toggle.description': 'Eine Aufgabe zwischen erledigt und offen umschalten',
    'cli.todo.rm.description': 'Eine Aufgabe anhand der ID entfernen',
    'cli.todo.help.commands': 'Befehle:',
    'cli.todo.help.list_all': 'Alle Aufgaben auflisten',
    'cli.todo.help.list_pending': 'Nur offene Aufgaben auflisten',
    'cli.todo.help.list_completed': 'Nur erledigte Aufgaben auflisten',
    'cli.todo.help.list_overdue': 'Nur überfällige Aufgaben auflisten',
    'cli.todo.help.add': 'Eine neue Aufgabe hinzufügen',
    'cli.todo.help.add_due': 'Mit Fälligkeitsdatum hinzufügen',
    'cli.todo.help.edit': 'Eine Aufgabe bearbeiten',
    'cli.todo.help.done': 'Eine Aufgabe als erledigt markieren',
    'cli.todo.help.toggle': 'Zwischen erledigt/offen umschalten',
    'cli.todo.help.remove': 'Eine Aufgabe entfernen',
    'cli.todo.help.remove_all': 'Alle Aufgaben entfernen',
    'cli.todo.help.due_formats': 'Formate für Fälligkeitsdaten:',

    // ── True ─────────────────────────────────────────────────────────
    'cli.true.description': 'Nichts tun, erfolgreich (Exit-Status 0)',

    // ── False ────────────────────────────────────────────────────────
    'cli.false.description': 'Nichts tun, erfolglos (Exit-Status 1)',

    // ── Htop ─────────────────────────────────────────────────────────
    'cli.htop.description': 'Interaktiver Prozess- und Dienstmonitor',
};
