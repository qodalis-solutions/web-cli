/**
 * German translations for Qodalis CLI.
 */
export const deTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Verwendung:',
    'cli.common.examples': 'Beispiele:',

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

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Gibt den angegebenen Text aus',
    'cli.echo.long_description': 'Gibt den angegebenen Text im Terminal aus',
    'cli.echo.piping_note': 'Unterstützt Text- und JSON-Ausgabe über Pipes',

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

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Eine Zeichenkette kontinuierlich wiederholen',
    'cli.yes.long_description': 'Eine Zeichenkette kontinuierlich wiederholen',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'In die Zwischenablage kopieren oder daraus einfügen',
    'cli.clipboard.long_description':
        'Text in die Systemzwischenablage kopieren oder daraus einfügen',
    'cli.clipboard.copy_desc': 'Text in die Zwischenablage kopieren',
    'cli.clipboard.paste_desc': 'Aus der Zwischenablage einfügen',

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
    'cli.unset.description': 'Umgebungsvariablen entfernen',
    'cli.unset.long_description': 'Eine Umgebungsvariable entfernen',
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

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Pakete im CLI verwalten',
};
