/**
 * Romanian translations for Qodalis CLI.
 */
export const roTranslations: Record<string, string> = {
    'cli.common.usage': 'Utilizare:',
    'cli.common.examples': 'Exemple:',
    'cli.common.use_hint': 'Folosiți {command} {action}',
    'cli.help.description': 'Afișează ajutorul pentru o comandă',
    'cli.help.long_description': 'Afișează informații de ajutor pentru comenzi',
    'cli.help.shortcuts': 'Scurtături',
    'cli.help.type': 'Tastați',
    'cli.help.help_command': 'help <comandă>',
    'cli.help.for_details': 'pentru informații detaliate',
    'cli.help.unknown_command': 'Comandă necunoscută: {command}',
    'cli.help.see_all': 'pentru a vedea toate comenzile disponibile',
    'cli.help.extension_chain': 'Lanț de extensii',
    'cli.help.subcommands': 'Subcomenzi',
    'cli.help.options': 'Opțiuni',
    'cli.help.global_options': 'Opțiuni globale',
    'cli.help.requires_server': 'Necesită un server conectat',
    'cli.help.aliases': 'Aliasuri:',
    'cli.help.required': '(obligatoriu)',
    'cli.help.show_all': 'Afișează toate comenzile disponibile',
    'cli.help.show_details': 'Afișează detaliile unei comenzi',
    'cli.help.show_sub_details': 'Afișează detaliile unei subcomenzi',
    'cli.help.example_pkg': 'Ajutor manager de pachete',
    'cli.help.example_theme': 'Ajutor subcomandă theme apply',
    'cli.configure.description': 'Gestionarea configurației sistemului și a pluginurilor',
    'cli.configure.long_description': 'Gestionarea configurației sistemului și a pluginurilor interactiv sau prin subcomenzi',
    'cli.configure.open_menu': 'Deschide meniul interactiv de configurare',
    'cli.configure.list_opts': 'Listează toate opțiunile de configurare',
    'cli.configure.get_value': 'Obține o valoare de configurare',
    'cli.configure.set_value': 'Setează o valoare de configurare',
    'cli.configure.reset_defaults': 'Resetează configurația la valorile implicite',
    'cli.configure.system': 'Sistem',
    'cli.configure.exit': 'Ieșire',
    'cli.configure.back': 'Înapoi',
    'cli.configure.current_value': 'Valoare curentă:',
    'cli.configure.invalid_value': 'Valoare invalidă',
    'cli.configure.set_to': '{label} setat la {value}',
    'cli.configure.invalid_format_get': 'Format invalid. Folosiți: configure get <categorie.cheie>',
    'cli.configure.unknown_key': 'Cheie de configurare necunoscută: {path}',
    'cli.configure.invalid_format_set': 'Format invalid. Folosiți: configure set <categorie.cheie> <valoare>',
    'cli.configure.set_success': '{path} setat la {value}',
    'cli.configure.system_reset': 'Configurația sistemului a fost resetată la valorile implicite',
    'cli.configure.unknown_category': 'Categorie necunoscută: {category}',
    'cli.configure.category_reset': 'Configurația „{category}" a fost resetată la valorile implicite',
    'cli.configure.reset_confirm': 'Resetați toată configurația la valorile implicite?',
    'cli.configure.reset_cancelled': 'Resetare anulată',
    'cli.configure.all_reset': 'Toată configurația a fost resetată la valorile implicite',
    'cli.configure.invalid_number': 'Număr invalid: {value}',
    'cli.configure.invalid_options': 'Valoare invalidă. Opțiuni valide: {options}',
    'cli.configure.invalid_boolean':
        'Valoare booleană nevalidă: "{value}". Folosiți true sau false.',
    'cli.echo.description': 'Afișează textul specificat',
    'cli.echo.long_description': 'Afișează textul specificat în terminal',
    'cli.echo.piping_note': 'Suportă ieșire text și obiecte JSON prin conducte',
    'cli.echo.help.print_text_terminal_add':
        'Afișează text în terminal. Adăugați > file pentru a-l salva într-un fișier (înlocuindu-l) sau >> file pentru a-l adăuga la sfârșit.',
    'cli.echo.help.print_text': 'Afișează text',
    'cli.echo.help.write_text_file': 'Scrie text într-un fișier',
    'cli.echo.help.append_text_file': 'Adaugă text la un fișier',
    'cli.echo.help.print_greeting': 'Afișează un salut',
    'cli.echo.help.create_replace_notes_txt': 'Creează sau înlocuiește notes.txt',
    'cli.echo.help.add_line': 'Adaugă o linie în el',
    'cli.clear.description': 'Curăță terminalul',
    'cli.clear.long_description': 'Șterge tot conținutul ecranului terminalului',
    'cli.clear.shortcut': 'Scurtătură:',
    'cli.version.description': 'Afișează informații despre versiune',
    'cli.version.long_description': 'Afișează versiunea curentă a CLI și linkul către documentație',
    'cli.uname.long_description': 'Afișează informații detaliate despre sistem și browser, inclusiv:',
    'cli.uname.cli_versions': 'Versiunile nucleului și bibliotecilor CLI',
    'cli.uname.browser_info': 'Numele browserului, versiunea, user agent, limba și platforma',
    'cli.uname.os': 'Sistem de operare',
    'cli.uname.description': 'Afișează informații detaliate despre sistem și browser',
    'cli.hash.description': 'Generează rezumate hash din text',
    'cli.hash.long_description': 'Generează rezumate hash criptografice folosind Web Crypto API',
    'cli.cal.description': 'Afișează un calendar',
    'cli.cal.long_description': 'Afișează un calendar lunar',
    'cli.cal.highlight_note': 'Ziua curentă este evidențiată',
    'cli.cal.current_month': 'Luna curentă',
    'cli.cal.specific_month': 'Lună specifică',
    'cli.time.description': 'Afișează ora locală curentă și UTC',
    'cli.time.long_description': 'Afișează ora locală curentă și UTC',
    'cli.time.show_current': 'Afișează ora locală curentă și UTC',
    'cli.time.now.description': 'Afișează ora curentă',
    'cli.uptime.description': 'Afișează timpul de funcționare al sesiunii',
    'cli.uptime.long_description': 'Afișează cât timp a fost activă sesiunea curentă a terminalului',
    'cli.convert.description': 'Conversie între unități (lungime, greutate, temperatură, date)',
    'cli.convert.long_description': 'Conversie între diferite unități de măsură',
    'cli.convert.supported': 'Suportate:',
    'cli.eval.description': 'Evaluează o expresie JavaScript',
    'cli.eval.long_description': 'Evaluează o expresie JavaScript',
    'cli.eval.supports': 'Suportă aritmetică, șiruri, tablouri, obiecte și orice JS valid',
    'cli.seq.description': 'Afișează o secvență de numere',
    'cli.seq.long_description': 'Afișează o secvență de numere',
    'cli.seq.numbers_to_end': 'Numere de la 1 până la sfârșit',
    'cli.seq.numbers_range': 'Numere de la început până la sfârșit',
    'cli.seq.with_step': 'Cu pas personalizat',
    'cli.lorem.description': 'Generează text de umplutură lorem ipsum',
    'cli.lorem.long_description': 'Generează text de umplutură lorem ipsum',
    'cli.lorem.gen_words': 'Generează cuvinte',
    'cli.lorem.gen_sentences': 'Generează propoziții',
    'cli.lorem.gen_paragraphs': 'Generează paragrafe',
    'cli.lorem.words.description': 'Generează un număr de cuvinte',
    'cli.lorem.sentences.description': 'Generează un număr de propoziții',
    'cli.lorem.paragraphs.description': 'Generează un număr de paragrafe',
    'cli.alias.description': 'Gestionarea aliasurilor de comenzi',
    'cli.alias.long_description': 'Crearea de aliasuri rapide pentru comenzile utilizate frecvent',
    'cli.alias.create_new': 'Creează un alias nou',
    'cli.alias.list_all': 'Listează toate aliasurile',
    'cli.alias.remove_hint': 'Folosiți {command} pentru a elimina un alias',
    'cli.unalias.description': 'Elimină aliasuri de comenzi',
    'cli.unalias.long_description': 'Elimină un alias de comandă definit anterior',
    'cli.open.description': 'Deschide un URL într-o filă nouă a browserului',
    'cli.open.long_description': 'Deschide un URL într-o filă nouă a browserului',
    'cli.open.auto_https': 'Adaugă automat https:// dacă nu este specificat un protocol',
    'cli.color.description': 'Convertește și previzualizează culori (hex, rgb, hsl)',
    'cli.color.long_description': 'Convertește între formate de culori și previzualizează culori',
    'cli.color.supported_formats': 'Formate suportate:',
    'cli.history.long_description': 'Afișează istoricul comenzilor din sesiunea curentă',
    'cli.history.show': 'Afișează istoricul comenzilor',
    'cli.history.search': 'Caută în istoric după model',
    'cli.history.clear': 'Șterge tot istoricul',
    'cli.history.arrow_hint': 'Folosiți tastele săgeți {keys} pentru a naviga în istoric',
    'cli.history.prefix_hint': 'Tastați un prefix și apăsați {key} pentru a căuta în istoric după prefix',
    'cli.history.description': 'Afișează istoricul comenzilor sesiunii curente',
    'cli.history.clear.description': 'Șterge istoricul comenzilor',
    'cli.history.search.description': 'Caută un model în istoricul comenzilor',
    'cli.theme.description': 'Interacțiune cu tema',
    'cli.theme.long_description': 'Personalizează aspectul terminalului cu teme și culori',
    'cli.hex.description': 'Codificare/decodificare hex și conversie de bază numerică',
    'cli.hex.long_description': 'Codifică/decodifică text în hexazecimal și convertește numere între baze',
    'cli.hex.text_to_hex': 'Text în hexazecimal',
    'cli.hex.hex_to_text': 'Hexazecimal în text',
    'cli.hex.base_conversion': 'Conversie de bază',
    'cli.feedback.long_description': 'Raportați erori, solicitați funcționalități sau sugerați comenzi noi — interactiv sau inline.',
    'cli.feedback.report-bug.description': 'Raportează o eroare pe GitHub',
    'cli.feedback.request-feature.description': 'Solicită o funcționalitate nouă pe GitHub',
    'cli.feedback.request-command.description': 'Solicită o comandă nouă pe GitHub',
    'cli.feedback.description':
        'Permite utilizatorilor să raporteze erori sau să solicite funcționalități',
    'cli.jwt.description': 'Decodifică și inspectează tokenuri JWT',
    'cli.jwt.long_description': 'Decodifică și inspectează JSON Web Token (JWT)',
    'cli.jwt.decode_display': 'Decodifică și afișează conținutul JWT',
    'cli.jwt.shows': 'Afișează: antet, payload, stare expirare, dată emitere',
    'cli.sleep.description': 'Pune în pauză execuția pentru un timp specificat',
    'cli.sleep.long_description': 'Pune în pauză execuția pentru durata specificată (în milisecunde)',
    'cli.services.description': 'Gestionarea serviciilor în fundal și a sarcinilor',
    'cli.services.long_description': 'Gestionarea serviciilor în fundal și a sarcinilor',
    'cli.services.list_desc': 'Listează toate serviciile',
    'cli.services.start_desc': 'Pornește un serviciu',
    'cli.services.stop_desc': 'Oprește un serviciu',
    'cli.services.restart_desc': 'Repornește un serviciu',
    'cli.services.logs_desc': 'Vizualizează jurnalele serviciului',
    'cli.services.info_desc': 'Detalii serviciu',
    'cli.services.list.description': 'Afișează toate serviciile în fundal înregistrate',
    'cli.services.start.description': 'Pornește un serviciu în fundal',
    'cli.services.stop.description': 'Oprește un serviciu în fundal care rulează',
    'cli.services.restart.description': 'Repornește un serviciu în fundal',
    'cli.services.logs.description': 'Afișează jurnalele unui serviciu în fundal',
    'cli.services.info.description': 'Afișează informații detaliate despre un serviciu',
    'cli.yes.description': 'Repetă continuu un șir de caractere',
    'cli.yes.long_description': 'Repetă continuu un șir de caractere',
    'cli.clipboard.description': 'Copiază sau lipește din clipboard',
    'cli.clipboard.long_description': 'Copiază text în clipboard-ul sistemului sau lipește text din acesta',
    'cli.clipboard.copy_desc': 'Copiază text în clipboard',
    'cli.clipboard.paste_desc': 'Lipește din clipboard',
    'cli.clipboard.copy.description': 'Copiază text în clipboard',
    'cli.clipboard.paste.description': 'Lipește text din clipboard',
    'cli.hotkeys.description': 'Afișează informații despre tastele rapide',
    'cli.hotkeys.long_description': 'Afișează toate scurtăturile de tastatură și tastele rapide disponibile',
    'cli.export.description': 'Setează variabile de mediu',
    'cli.export.long_description': 'Setează sau afișează variabile de mediu',
    'cli.export.show_all': 'Afișează toate variabilele',
    'cli.export.set_var': 'Setează o variabilă',
    'cli.export.set_spaces': 'Setează cu spații',
    'cli.export.set_many': 'Setează mai multe deodată',
    'cli.export.set_global': 'Setează pentru toți utilizatorii',
    'cli.export.set_session': 'Doar acest terminal, nesalvat',
    'cli.export.scopes':
        'Folosiți variabilele ca $VAR sau ${VAR}. O valoare setată în acest terminal are prioritate față de cea salvată de dvs., care are prioritate față de una partajată. env arată de unde provine fiecare.',
    'cli.unset.description': 'Elimină variabile de mediu',
    'cli.unset.long_description': 'Elimină o variabilă de mediu',
    'cli.unset.own':
        'Elimină pentru acest terminal și pentru dvs. (o valoare partajată este ascunsă pentru dvs.)',
    'cli.unset.global': 'Elimină valoarea partajată',
    'cli.env.description': 'Afișează variabile de mediu',
    'cli.env.long_description': 'Afișează variabile de mediu',
    'cli.env.show_all': 'Afișează toate variabilele',
    'cli.env.show_single': 'Afișează o singură variabilă',
    'cli.url.description': 'Codifică sau decodifică URL-uri',
    'cli.url.long_description': 'Codificare, decodificare și analiză URL',
    'cli.url.encode_desc': 'Codifică un șir ca URL',
    'cli.url.decode_desc': 'Decodifică un șir URL',
    'cli.url.parse_desc': 'Analizează componentele unui URL',
    'cli.json.description': 'Formatează, minifică sau validează JSON',
    'cli.json.long_description': 'Formatează, minifică sau validează șiruri JSON',
    'cli.json.format_desc': 'Formatează JSON cu indentare',
    'cli.json.minify_desc': 'Elimină spațiile albe',
    'cli.json.validate_desc': 'Verifică dacă este JSON valid',
    'cli.json.format.description': 'Formatează JSON cu indentare',
    'cli.json.minify.description': 'Minimizează JSON eliminând spațiile',
    'cli.json.validate.description': 'Verifică dacă un șir este JSON valid',
    'cli.base64.description': 'Codifică sau decodifică șiruri Base64',
    'cli.base64.long_description': 'Codificare și decodificare șiruri Base64',
    'cli.base64.utf8_note': 'Suportă codificarea textului UTF-8',
    'cli.base64.encode_desc': 'Codifică text în Base64',
    'cli.base64.decode_desc': 'Decodifică Base64 în text',
    'cli.timestamp.description': 'Conversie între marcaje temporale Unix și date',
    'cli.timestamp.long_description': 'Conversie între marcaje temporale Unix și date lizibile',
    'cli.timestamp.current': 'Marcaj temporal Unix curent',
    'cli.timestamp.to_date': 'Marcaj temporal în dată',
    'cli.timestamp.from_date': 'Dată în marcaj temporal',
    'cli.timestamp.now.description': 'Afișează timestamp-ul Unix curent',
    'cli.timestamp.to-date.description': 'Convertește un timestamp Unix într-o dată',
    'cli.timestamp.from-date.description': 'Convertește un șir de dată într-un timestamp Unix',
    'cli.screen.description': 'Afișează informații despre ecran și terminal',
    'cli.screen.long_description': 'Afișează dimensiunile ecranului, viewport-ului și terminalului',
    'cli.screen.shows': 'Afișează: rezoluție, adâncime culoare, raport pixeli, dimensiune fereastră, dimensiune terminal',
    'cli.random.description': 'Generează valori aleatorii',
    'cli.random.long_description': 'Generează numere, șiruri, UUID-uri aleatorii și altele',
    'cli.random.number_desc': 'Număr aleatoriu (0-100)',
    'cli.random.string_desc': 'Șir aleatoriu (16 caractere)',
    'cli.random.uuid_desc': 'UUID v4 aleatoriu',
    'cli.random.coin_desc': 'Aruncă o monedă',
    'cli.random.dice_desc': 'Aruncă un zar',
    'cli.random.number.description': 'Generează un număr aleatoriu',
    'cli.random.string.description': 'Generează un șir aleatoriu',
    'cli.random.uuid.description': 'Generează un UUID v4 aleatoriu',
    'cli.random.coin.description': 'Aruncă o monedă',
    'cli.random.dice.description': 'Aruncă un zar',
    'cli.ping.description': 'Trimite ping de tip ICMP către o gazdă',
    'cli.ping.long_description': 'Trimite ping HTTP de tip ICMP către o gazdă și afișează statistici',
    'cli.ping.ctrl_c': 'Apăsați Ctrl+C pentru a opri și afișa statisticile.',
    'cli.nano.description': 'Deschide editorul de text încorporat',
    'cli.nano.long_description': 'Deschide editorul de text în stil nano încorporat',
    'cli.nano.open_empty': 'Deschide un buffer gol',
    'cli.nano.open_file': 'Deschide sau creează un fișier',
    'cli.nano.keyboard_shortcuts': 'Scurtături de tastatură:',
    'cli.debug.description': 'Afișează diagnostice detaliate ale sistemului și internelor CLI',
    'cli.debug.long_description': 'Afișează diagnostice detaliate ale sistemului și internelor CLI.',
    'cli.debug.hidden_note': 'Această comandă este ascunsă în lista de ajutor, dar este accesibilă direct.',
    'cli.debug.summary': 'Rezumat sistem',
    'cli.debug.processors': 'Toate procesoarele înregistrate',
    'cli.debug.modules': 'Toate modulele încărcate',
    'cli.debug.state': 'Inspectează depozitele de stare',
    'cli.debug.processors.description': 'Afișează toate procesoarele de comenzi înregistrate',
    'cli.debug.modules.description': 'Afișează toate modulele CLI încărcate',
    'cli.debug.state.description': 'Inspectează toate depozitele de stare și valorile lor',
    'cli.debug.services.description': 'Afișează toate serviciile înregistrate în containerul DI',
    'cli.debug.environment.description':
        'Afișează informații despre browser, terminal și framework',
    'cli.debug.history.description': 'Afișează statistici despre istoricul comenzilor',
    'cli.debug.health.description':
        'Verifică starea sistemului: stocare, conectivitate, starea procesoarelor',
    'cli.debug.export.description': 'Exportă toate informațiile de depanare ca JSON',
    'cli.debug.servers.description': 'Afișează serverele configurate și starea conexiunii lor',
    'cli.packages.description': 'Gestionarea pachetelor CLI',

    // ── Servers and events ───────────────────────────────────────────
    'cli.server.description': 'Gestionarea conexiunilor la serverele CLI la distanță',
    'cli.server.list.description': 'Afișează serverele cu starea, versiunea și comenzile lor',
    'cli.server.status.description': 'Verifică dacă serverele răspund (toate, sau unul în detaliu)',
    'cli.server.commands.description': 'Afișează comenzile fiecărui server',
    'cli.server.reconnect.description': 'Reconectare la servere și reîncărcarea comenzilor',
    'cli.server.default.description': 'Afișează sau setează serverul care rulează comenzile comune',
    'cli.server.jobs.description': 'Gestionarea joburilor din fundal de pe serverele conectate',
    'cli.server.jobs.list.description': 'Afișează toate joburile de pe serverele conectate',
    'cli.server.jobs.info.description': 'Afișează informații detaliate despre un job',
    'cli.server.jobs.trigger.description': 'Declanșează execuția imediată a unui job',
    'cli.server.jobs.pause.description': 'Pune în pauză execuția programată a unui job',
    'cli.server.jobs.resume.description': 'Reia un job aflat în pauză',
    'cli.server.jobs.stop.description': 'Oprește un job și anulează execuția curentă, dacă rulează',
    'cli.server.jobs.cancel.description': 'Anulează execuția curentă a unui job',
    'cli.server.jobs.history.description': 'Afișează istoricul execuțiilor unui job',
    'cli.server.jobs.logs.description': 'Afișează jurnalele ultimei sau ale unei anumite execuții',
    'cli.server.jobs.edit.description': 'Editează interactiv setările unui job',
    'cli.server.jobs.watch.description':
        'Vizualizare în direct a evenimentelor joburilor prin WebSocket',
    'cli.server.help.see_everything_you_can': 'pentru a vedea tot ce puteți face',
    'cli.server.help.connect_terminal_remote_cli':
        'Conectează terminalul la servere CLI la distanță (.NET, Node.js, Python) și rulează comenzile lor.',
    'cli.server.help.by_name_or_prefix':
        'Comenzile fiecărui server sunt disponibile după nume ({byName}) și cu serverul ca prefix ({prefixed}). Când mai multe servere au aceeași comandă, o rulează serverul implicit; dacă nu există unul, vi se cere să alegeți serverul. O comandă locală cu același nume are prioritate: folosiți numele cu prefix. Un server care cade este reîncercat la fiecare 30 de secunde, iar comenzile lui revin odată cu el.',
    'cli.server.help.overview_servers': 'Prezentare generală a serverelor',
    'cli.server.help.servers_status_version_commands': 'Servere cu stare, versiune și comenzi',
    'cli.server.help.check_servers_reachable_all':
        'Verifică dacă serverele sunt accesibile (toate, sau unul în detaliu)',
    'cli.server.help.commands_each_server_provides': 'Comenzile oferite de fiecare server',
    'cli.server.help.connect_again_unreachable_servers':
        'Reconectare (serverele inaccesibile, sau unul)',
    'cli.server.help.show_set_server_shared':
        'Afișează sau setează serverul pentru comenzile comune',
    'cli.server.help.open_shell_server_run':
        'Deschide un shell pe un server sau rulează o singură comandă',
    'cli.server.help.ping_node_show_details': 'Ping către node și afișarea detaliilor sale',
    'cli.server.help.what_node_can_do': 'Ce poate face node',
    'cli.server.help.run_echo_node_explicitly': 'Rulează echo explicit pe node',
    'cli.server.help.shared_commands_run_node': 'Comenzile comune rulează pe node',
    'cli.server.help.retry_every_unreachable_server': 'Reîncearcă toate serverele inaccesibile',
    'cli.server.list.help.list_configured_servers_connection':
        'Afișează serverele configurate: starea conexiunii, URL, versiunea serverului și a API-ului, numărul de comenzi și accesul la shell.',
    'cli.server.list.help.see_why_server_unreachable':
        'pentru a vedea de ce un server este inaccesibil, server reconnect pentru a reîncerca',
    'cli.server.status.help.details_server': 'pentru detalii despre un server',
    'cli.server.status.help.try_again': 'pentru a reîncerca',
    'cli.server.status.help.load_commands': 'pentru a-i încărca comenzile',
    'cli.server.status.help.see_commands': 'pentru a-i vedea comenzile',
    'cli.server.status.help.ping_servers_without_name':
        'Face ping serverelor. Fără nume, fiecare server este verificat deodată, cu timpul de răspuns; cu un nume, serverul respectiv este afișat în detaliu (versiuni, SO, shell, streaming), cu indicii când nu poate fi contactat.',
    'cli.server.status.help.check_every_server': 'Verifică toate serverele',
    'cli.server.status.help.details_one_server': 'Detaliile unui server',
    'cli.server.status.help.same_server_status': 'La fel ca server status',
    'cli.server.status.help.details_node': 'Detaliile lui node',
    'cli.server.commands.help.shared_marker':
        'pe mai multe servere: rulează pe serverul implicit (server use <name>) sau întreabă',
    'cli.server.commands.help.local_marker':
        'o comandă locală are același nume: rulați-o cu prefixul serverului',
    'cli.server.commands.help.intro':
        'Afișează comenzile oferite de un server (toate serverele, sau unul). Rulați-le după nume sau cu serverul ca prefix: {example} rulează întotdeauna pe node, chiar și când un alt server sau o comandă locală se numește echo.',
    'cli.server.commands.help.commands_every_server': 'Comenzile tuturor serverelor',
    'cli.server.commands.help.commands_one_server': 'Comenzile unui server',
    'cli.server.commands.help.what_node_can_do': 'Ce poate face node',
    'cli.server.reconnect.help.reconnect_them_anyway': 'pentru a le reconecta oricum',
    'cli.server.reconnect.help.see_why': 'pentru a vedea motivul',
    'cli.server.reconnect.help.connect_servers_again_reload':
        'Se conectează din nou la servere și reîncarcă comenzile lor, de ex. după repornirea sau actualizarea unui server. Fără nume, fiecare server inaccesibil este reîncercat.',
    'cli.server.reconnect.help.retry_unreachable_servers': 'Reîncearcă serverele inaccesibile',
    'cli.server.reconnect.help.reconnect_one_server': 'Reconectează un server',
    'cli.server.reconnect.help.reconnect_every_server': 'Reconectează toate serverele',
    'cli.server.reconnect.help.same_server_reconnect': 'La fel ca server reconnect',
    'cli.server.reconnect.help.reload_commands_node': 'Reîncarcă comenzile lui node',
    'cli.server.default.help.to_remove': 'pentru a-l elimina',
    'cli.server.default.help.to_set_one': 'pentru a seta unul',
    'cli.server.default.help.default_server_runs_commands':
        'Serverul implicit rulează comenzile pe care le au mai multe servere (altfel vi se cere să alegeți unul) și comenzile care necesită un singur server, precum server logs. Este reținut între reîncărcări.',
    'cli.server.default.help.show_default_server': 'Afișează serverul implicit',
    'cli.server.default.help.set': 'Setează-l',
    'cli.server.default.help.remove': 'Elimină-l',
    'cli.server.default.help.same_server_default_node': 'La fel ca server default node',
    'cli.server.jobs.help.see_control_background_jobs':
        'Vedeți și controlați joburile din fundal care rulează pe serverele conectate: listați-le, rulați unul acum, puneți-l în pauză sau opriți-l, citiți istoricul și jurnalele lui, schimbați-i setările sau urmăriți evenimentele în direct. Un job este ales după nume (indiferent de majuscule) sau ID și căutat pe fiecare server conectat; acțiunile se aplică fiecărui server care are jobul, iar --server limitează o comandă la un singur server.',
    'cli.server.jobs.help.same_server_jobs_list': 'La fel ca server jobs list',
    'cli.server.jobs.help.live_job_events': 'Evenimentele joburilor în direct',
    'cli.server.jobs.help.all_jobs': 'Toate joburile',
    'cli.server.jobs.help.run_cleanup_job_now': 'Rulează acum jobul cleanup',
    'cli.server.jobs.help.failed_runs': 'Rulările lui eșuate',
    'cli.server.jobs.help.last_run_output_node': 'Rezultatul ultimei rulări, pe node',
    'cli.server.jobs.list.help.list_jobs_every_connected':
        'Afișează joburile tuturor serverelor conectate: grup, stare, program, ultima și următoarea rulare și cât a durat ultima rulare. Cu mai multe servere, fiecare are propriul tabel.',
    'cli.server.jobs.list.help.jobs_all_connected_servers':
        'Joburile de pe toate serverele conectate',
    'cli.server.jobs.list.help.only_one_group': 'Doar un grup',
    'cli.server.jobs.list.help.jobs_node_server': 'Joburile de pe serverul node',
    'cli.server.jobs.list.help.jobs_reports_group': 'Joburile din grupul reports',
    'cli.server.jobs.info.help.show_everything_about_one':
        'Afișează tot despre un job: programul, reîncercările, timpul limită, politica de suprapunere, execuția curentă și rezultatul ultimei rulări. Jobul este găsit după nume (indiferent de majuscule) sau ID.',
    'cli.server.jobs.info.help.details_cleanup_job': 'Detaliile jobului cleanup',
    'cli.server.jobs.trigger.help.run_job_now_without':
        'Rulează un job acum, fără a aștepta următoarea oră programată. Programul lui nu se schimbă.',
    'cli.server.jobs.trigger.help.run_cleanup_now': 'Rulează cleanup acum',
    'cli.server.jobs.trigger.help.then_read_output': 'Apoi citește rezultatul lui',
    'cli.server.jobs.pause.help.stop_running_job_schedule':
        'Oprește rularea unui job conform programului până când este reluat. Folosiți cancel sau stop pentru o rulare deja în curs.',
    'cli.server.jobs.pause.help.hold_cleanup': 'Pune cleanup în așteptare',
    'cli.server.jobs.pause.help.put_back_schedule': 'Repune-l pe program',
    'cli.server.jobs.resume.help.put_paused_job_back': 'Repune un job în pauză pe programul său.',
    'cli.server.jobs.resume.help.run_cleanup_schedule_again':
        'Rulează din nou cleanup conform programului',
    'cli.server.jobs.stop.help.take_job_off_schedule':
        'Scoate un job de pe program și anulează rularea în curs, dacă există una.',
    'cli.server.jobs.stop.help.stop_cleanup_completely': 'Oprește complet cleanup',
    'cli.server.jobs.cancel.help.cancel_run_progress_job':
        'Anulează rularea în curs a unui job. Jobul rămâne pe program și rulează din nou la următoarea oră.',
    'cli.server.jobs.cancel.help.abort_current_cleanup_run':
        'Întrerupe rularea curentă a lui cleanup',
    'cli.server.jobs.history.help.list_past_runs_job':
        'Afișează rulările anterioare ale unui job: stare, ora de start, durată, încercarea de reluare și începutul mesajului de eroare. Folosiți ID-ul scurt cu logs --exec pentru a citi rezultatul unei rulări.',
    'cli.server.jobs.history.help.last_20_runs': 'Ultimele 20 de rulări',
    'cli.server.jobs.history.help.page_through_older_runs':
        'Parcurge pagină cu pagină rulările mai vechi',
    'cli.server.jobs.history.help.only_failed_runs': 'Doar rulările eșuate',
    'cli.server.jobs.history.help.last_5_runs': 'Ultimele 5 rulări',
    'cli.server.jobs.logs.help.print_log_entries_latest':
        'Afișează intrările de jurnal ale ultimei rulări a unui job sau ale unei rulări alese după ID-ul execuției (din history).',
    'cli.server.jobs.logs.help.logs_latest_run': 'Jurnalele ultimei rulări',
    'cli.server.jobs.logs.help.logs_one_run': 'Jurnalele unei rulări',
    'cli.server.jobs.logs.help.what_last_cleanup_run': 'Ce a afișat ultima rulare cleanup',
    'cli.server.jobs.edit.help.change_job_step_step':
        'Modifică un job pas cu pas: descriere, grup, program cron sau interval, număr maxim de reîncercări, timp limită și politică de suprapunere (skip, queue sau cancel). Apăsați Enter pentru a păstra o valoare și Ctrl+C sau Escape pentru a anula; nimic nu se schimbă până nu confirmați. Un job aflat pe mai multe servere necesită --server.',
    'cli.server.jobs.edit.help.edit_cleanup_server_has': 'Editează cleanup pe serverul care îl are',
    'cli.server.jobs.watch.help.follow_job_events_they':
        'Urmărește evenimentele joburilor pe măsură ce apar (pornit, terminat, eșuat etc.) pe toate serverele conectate, o linie pe eveniment. Apăsați Ctrl+C pentru a opri.',
    'cli.server.jobs.watch.help.events_all_connected_servers':
        'Evenimente de pe toate serverele conectate',
    'cli.server.jobs.watch.help.only_events_node': 'Doar evenimentele de pe node',
    'cli.ssh.description': 'Deschide o sesiune shell la distanță pe un server',
    'cli.ssh.help.open_interactive_shell_server':
        'Deschide un shell interactiv pe un server, în acest terminal, sau rulează acolo o singură comandă și afișează rezultatul. Pot fi folosite doar serverele care activează shell-ul; cu pluginul users aveți nevoie de permisiunea shell:execute. Fără nume, ssh folosește singurul server cu shell, altfel serverul implicit, altfel întreabă pe care să-l folosească.',
    'cli.ssh.help.shell_default_only_server': 'Shell pe serverul implicit (sau singurul)',
    'cli.ssh.help.shell_server_exit_ctrl': 'Shell pe un server (exit sau Ctrl+D pentru a ieși)',
    'cli.ssh.help.run_one_command_print': 'Rulează o singură comandă și afișează rezultatul',
    'cli.ssh.help.same_ssh': 'La fel ca ssh <name>',
    'cli.ssh.help.interactive_shell_node': 'Shell interactiv pe node',
    'cli.ssh.help.one_command_node': 'O comandă pe node',
    'cli.ssh.help.same_ssh_2': 'La fel ca ssh',
    'cli.events.description': 'Urmărește, listează și emite evenimente pe magistrala de evenimente',
    'cli.events.watch.description': 'Afișează evenimentele pe măsură ce apar (Ctrl+C pentru oprire)',
    'cli.events.log.description': 'Afișează evenimentele recente (în memorie, nesalvate)',
    'cli.events.emit.description': 'Emite un eveniment: events emit <tip> [json]',
    'cli.events.watch.help.intro': 'Afișează evenimentele pe măsură ce apar, până la Ctrl+C',
    'cli.events.watch.help.every_event': 'Toate evenimentele',
    'cli.events.watch.help.namespace': 'Un spațiu de nume',
    'cli.events.watch.help.one_type': 'Un singur tip',
    'cli.events.log.help.intro': 'Afișează cele mai recente evenimente, cele mai vechi primele',
    'cli.events.log.help.last_20': 'Ultimele 20 de evenimente',
    'cli.events.log.help.last_50_server': 'Ultimele 50 de evenimente de server',
    'cli.events.emit.help.intro':
        'Emite un eveniment, de ex. pentru a testa un plugin care îl ascultă',
    'cli.events.help.commands': 'Comenzi:',
    'cli.events.help.print_live': 'Afișează evenimentele în direct',
    'cli.events.help.recent': 'Evenimente recente',
    'cli.events.help.emit': 'Emite un eveniment',
    'cli.events.help.patterns':
        'Modele: un tip exact (package:installed), un spațiu de nume (package:*) sau * pentru toate.',
    'cli.events.help.in_memory':
        'Evenimentele sunt păstrate în memorie doar pentru acest terminal; nimic nu este salvat permanent.',

    // ── Capture ──────────────────────────────────────────────────────
    'cli.capture.description': 'Exportă conținutul terminalului într-un fișier descărcabil',
    'cli.capture.help.save_what_terminal_including':
        'Salvează ce se află în terminal, inclusiv istoricul de derulare, ca fișier descărcat de browser. HTML păstrează fundalul și culoarea textului temei; txt este text simplu. Culorile liniilor individuale nu se păstrează.',
    'cli.capture.help.everything_terminal_html': 'Totul ca terminal-<timestamp>.html',
    'cli.capture.help.plain_text_file': 'Fișier text simplu',
    'cli.capture.help.only_last_n_lines': 'Doar ultimele n linii',
    'cli.capture.help.downloads_session_txt': 'Descarcă session.txt',
    'cli.capture.help.last_50_lines_html': 'Ultimele 50 de linii ca HTML',
    'cli.capture.help.same_capture': 'La fel ca capture',

    // ── Diff ─────────────────────────────────────────────────────────
    'cli.diff.description': 'Compară fișiere linie cu linie',
    'cli.diff.help.compare_two_texts_line':
        'Compară două texte linie cu linie: liniile adăugate apar în verde cu +, cele eliminate în roșu cu -, cu câteva linii neschimbate în jurul fiecărei modificări pentru context.',
    'cli.diff.help.compare_two_texts': 'Compară două texte',
    'cli.diff.help.only_changed_lines': 'Doar liniile modificate',
    'cli.diff.help.one_line_changed': 'O linie modificată',
    'cli.diff.help.prints_no_differences_found': 'Afișează: No differences found',
    'cli.diff.help.compare_two_files_line':
        'Compară două fișiere linie cu linie și arată ce s-a schimbat: liniile care încep cu < (sau -) sunt doar în primul fișier, cele care încep cu > (sau +) doar în al doilea.',
    'cli.diff.help.show_differences': 'Afișează diferențele',
    'cli.diff.help.unified_format_context': 'Format unificat cu context',
    'cli.diff.help.what_changed_between_versions': 'Ce s-a schimbat între versiuni',
    'cli.diff.help.review_edits_git_style': 'Revizuiește modificările, în stil git',
    'cli.diff.help.ignore_upper_lower_case': 'Ignoră majusculele/minusculele',

    // ── Font Size ────────────────────────────────────────────────────
    'cli.font-size.description': 'Ajustează dimensiunea fontului terminalului',
    'cli.font-size.reset.description': 'Resetează dimensiunea fontului la cea implicită',
    'cli.font-size.set.description': 'Setează dimensiunea fontului la o valoare anume',
    'cli.font-size.help.intro':
        'Face textul terminalului mai mare sau mai mic, de la {min}px la {max}px. Dimensiunea aleasă este salvată și restabilită la următoarea deschidere a terminalului; reset revine la dimensiunea cu care a pornit pagina.',
    'cli.font-size.help.show_current_size': 'Afișează dimensiunea curentă',
    'cli.font-size.help.bigger_smaller_by': 'Mai mare sau mai mic cu {step}px',
    'cli.font-size.help.exact_size': 'Dimensiune exactă în pixeli ({min}-{max})',
    'cli.font-size.help.back_default_size': 'Înapoi la dimensiunea implicită',
    'cli.font-size.help.use_16px_text': 'Folosește text de 16px',
    'cli.font-size.help.grow_by': 'Mărește cu {step}px',
    'cli.font-size.help.forget_saved_size': 'Uită dimensiunea salvată',

    // ── Snippet ──────────────────────────────────────────────────────
    'cli.snippet.description': 'Salvează și reutilizează șabloane de comenzi parametrizate',
    'cli.snippet.list.description': 'Afișează toate fragmentele salvate',
    'cli.snippet.save.description': 'Salvează un fragment nou: snippet save <name> "<template>"',
    'cli.snippet.show.description': 'Afișează șablonul unui fragment: snippet show <name>',
    'cli.snippet.delete.description': 'Șterge un fragment: snippet delete <name>',
    'cli.snippet.run.description':
        'Rulează un fragment cu valori pentru variabile: snippet run <name> var1=val1 var2=val2',
    'cli.snippet.help.save_command_lines_you':
        'Salvează liniile de comandă folosite des ca șabloane denumite, cu {{placeholders}} completate la rulare. Fragmentele sunt salvate în browser și partajate de toate terminalele și filele dvs.',
    'cli.snippet.help.save_replace_snippet': 'Salvează (sau înlocuiește) un fragment',
    'cli.snippet.help.fill_placeholders_run': 'Completează substituenții și rulează-l',
    'cli.snippet.help.all_saved_snippets': 'Toate fragmentele salvate',
    'cli.snippet.help.print_snippet': 'Afișează un fragment',
    'cli.snippet.help.delete_snippet_rm_remove': 'Șterge un fragment (rm, remove)',
    'cli.snippet.help.template_placeholder': 'Un șablon cu substituent',
    'cli.snippet.help.runs_echo_hello_ada': 'Rulează: echo Hello Ada',
    'cli.snippet.help.quote_values_spaces': 'Valori cu spații între ghilimele',

    // ── Test ─────────────────────────────────────────────────────────
    'cli.test.description': 'Evaluează o condiție (cod de ieșire 0 când este adevărată)',
    'cli.test.help.expressions': 'Expresii:',
    'cli.test.help.empty_not_empty': 'gol / nu este gol',
    'cli.test.help.equal_not_equal': 'egal / diferit',
    'cli.test.help.integer_comparison': 'comparație între numere întregi',
    'cli.test.help.exists_file_directory': 'există / fișier / director',

    // ── Kill ─────────────────────────────────────────────────────────
    'cli.kill.description': 'Oprește un proces în execuție după PID',
    'cli.kill.help.stop_running_process_pid':
        'Oprește un proces în execuție după PID, așa cum apare în ps. O comandă este anulată, un serviciu în fundal este oprit. Doar procesele în execuție pot fi oprite; după aceea apar ca killed, cu codul de ieșire -9.',
    'cli.kill.help.stop_process_pid': 'Oprește procesul cu acel PID',
    'cli.kill.help.find_pid': 'Găsește PID-ul',
    'cli.kill.help.stop_process_3': 'Oprește procesul 3',

    // ── Pkg ──────────────────────────────────────────────────────────
    'cli.pkg.description': 'Gestionarea pachetelor din CLI',
    'cli.pkg.ls.description': 'Afișează toate pachetele din CLI',
    'cli.pkg.browse.description':
        'Afișează toate pachetele disponibile din toate sursele configurate',
    'cli.pkg.add.description': 'Adaugă un pachet în CLI, de ex. pkg add guid.',
    'cli.pkg.remove.description': 'Elimină un pachet din CLI',
    'cli.pkg.versions.description': 'Afișează toate versiunile publicate ale unui pachet',
    'cli.pkg.check.description': 'Verifică dacă pachetele instalate au actualizări disponibile',
    'cli.pkg.update.description':
        'Actualizează un pachet din CLI la ultima versiune sau actualizează toate pachetele',
    'cli.pkg.source.description': 'Afișează sau setează sursa pachetelor pentru descărcări',
    'cli.pkg.source.get.description': 'Afișează sursa CDN curentă',
    'cli.pkg.source.set.description':
        'Setează sursa preferată a pachetelor (interactiv dacă nu se dă un nume)',
    'cli.pkg.help.list_installed_packages': 'Afișează pachetele instalate',
    'cli.pkg.help.browse_all_available_packages': 'Răsfoiește toate pachetele disponibile',
    'cli.pkg.help.install_package': 'Instalează un pachet',
    'cli.pkg.help.remove_package': 'Elimină un pachet',
    'cli.pkg.help.show_all_published_versions': 'Afișează toate versiunile publicate',
    'cli.pkg.help.check_available_updates': 'Verifică actualizările disponibile',
    'cli.pkg.help.update_one_all_packages': 'Actualizează un pachet sau toate pachetele',
    'cli.pkg.help.get_set_package_source': 'Afișează sau setează sursa pachetelor',
    'cli.pkg.help.install_qodalis_cli_guid': 'Instalează @qodalis/cli-guid',
    'cli.pkg.help.install_multiple_packages': 'Instalează mai multe pachete',
    'cli.pkg.help.update_all_packages': 'Actualizează toate pachetele',
    'cli.pkg.browse.help.install_package': 'pentru a instala un pachet',
    'cli.pkg.add.help.short_name': 'Nume scurt',
    'cli.pkg.add.help.full_name': 'Nume complet',
    'cli.pkg.add.help.multiple_packages': 'Mai multe pachete',
    'cli.pkg.add.help.specific_version': 'O versiune anume',
    'cli.pkg.remove.help.remove_one_package': 'Elimină un pachet',
    'cli.pkg.remove.help.remove_multiple': 'Elimină mai multe',
    'cli.pkg.remove.help.short_alias': 'Alias scurt',
    'cli.pkg.versions.help.short_name': 'Nume scurt',
    'cli.pkg.versions.help.full_name': 'Nume complet',
    'cli.pkg.check.help.apply_updates': 'pentru a aplica actualizările',
    'cli.pkg.update.help.update_latest': 'Actualizează la ultima versiune',
    'cli.pkg.update.help.update_specific_version': 'Actualizează la o versiune anume',
    'cli.pkg.update.help.update_all_packages': 'Actualizează toate pachetele',
    'cli.pkg.update.help.install_specific_version': 'Instalează o versiune anume',
    'cli.pkg.source.help.change': 'pentru a schimba',
    'cli.pkg.source.help.show_current_source': 'Afișează sursa curentă',
    'cli.pkg.source.help.set_preferred_source': 'Setează sursa preferată',
    'cli.pkg.help.install_package_2': 'pentru a instala un pachet',

    // ── Ps ───────────────────────────────────────────────────────────
    'cli.ps.description': 'Afișează procesele în execuție și cele recente',
    'cli.ps.help.list_processes_terminal_commands':
        'Afișează procesele acestui terminal: comenzi, servicii în fundal, daemoni și joburi. Cele în execuție sunt afișate împreună cu cele terminate recent, eșuate sau oprite (ultimele 50), cu codul de ieșire și cât timp a trecut de la pornire.',
    'cli.ps.help.all_processes_oldest_first': 'Toate procesele, cele mai vechi primele',
    'cli.ps.help.what_running_now': 'Ce rulează acum',
    'cli.ps.help.stop_process_12_pid': 'Oprește procesul 12 din coloana PID',

    // ── Cron ─────────────────────────────────────────────────────────
    'cli.cron.description': 'Programează comenzi să ruleze la un interval repetitiv',
    'cli.cron.add.description': 'Adaugă un job cron: cron add <name> <interval> <command>',
    'cli.cron.list.description': 'Afișează toate joburile cron',
    'cli.cron.remove.description': 'Elimină un job cron: cron remove <name>',
    'cli.cron.enable.description': 'Activează un job cron în pauză',
    'cli.cron.disable.description': 'Pune un job cron în pauză fără a-l elimina',
    'cli.cron.help.run_command_again_again':
        'Rulează o comandă în mod repetat, la un interval fix, cât timp terminalul este deschis. Joburile sunt salvate: pornesc din nou la pornirea terminalului și pot fi puse în pauză fără a fi eliminate.',
    'cli.cron.help.add_job': 'Adaugă un job',
    'cli.cron.help.jobs_interval_status_run': 'Joburi cu interval, stare și număr de rulări (ls)',
    'cli.cron.help.pause_job': 'Pune un job în pauză',
    'cli.cron.help.resume_paused_job': 'Reia un job în pauză',
    'cli.cron.help.remove_job_rm_delete': 'Elimină un job (rm, delete)',
    'cli.cron.help.intervals_seconds_30_hours':
        'Intervale: secunde (30), sau ore, minute și secunde (1h, 5m, 1h30m, 90s); minimum 10 secunde.',
    'cli.cron.help.every_5_minutes': 'La fiecare 5 minute',
    'cli.cron.help.every_hour_half': 'La fiecare oră și jumătate',
    'cli.cron.help.pause': 'Pune-l în pauză',

    // ── Binary ───────────────────────────────────────────────────────
    'cli.binary.long_description': 'Codifică și decodifică șiruri binare',
    'cli.binary.utf8_note': 'Acceptă codificarea textului UTF-8',
    'cli.binary.encode_desc': 'Text în binar',
    'cli.binary.decode_desc': 'Binar în text',

    // ── Morse ────────────────────────────────────────────────────────
    'cli.morse.long_description': 'Codifică și decodifică codul Morse',
    'cli.morse.note': 'Acceptă litere, cifre și semne de punctuație uzuale',
    'cli.morse.encode_desc': 'Text în Morse',
    'cli.morse.decode_desc': 'Morse în text',

    // ── Rot ──────────────────────────────────────────────────────────
    'cli.rot.long_description': 'Aplică cifrul ROT (rotație) asupra textului',
    'cli.rot.note':
        'Implicit este ROT13 (auto-inversabil: aplicat de două ori returnează originalul)',
    'cli.rot.default_desc': 'Aplică ROT13',
    'cli.rot.shift_desc': 'Aplică ROT-N',

    // ── Awk ──────────────────────────────────────────────────────────
    'cli.awk.description': 'Căutare de modele și procesare de text',
    'cli.awk.help.process_text_records_fields':
        'Procesează textul ca înregistrări și câmpuri: fiecare linie este împărțită în câmpurile $1, $2, ... ($0 este linia întreagă), iar fiecare regulă își execută { action } pe liniile care se potrivesc. Acceptă blocuri BEGIN și END, modele /regex/ și de comparare a câmpurilor, print, variabile, NR și NF. Puneți programul între ghilimele; unul simplu funcționează și fără (awk {print $1} file).',
    'cli.awk.help.run_program_over_file': 'Rulează un program peste un fișier',
    'cli.awk.help.split_fields_instead_spaces': 'Separă câmpurile după <sep> în loc de spații',
    'cli.awk.help.run_program_over_piped': 'Rulează un program peste intrarea transmisă prin pipe',
    'cli.awk.help.print_first_column': 'Afișează prima coloană',
    'cli.awk.help.second_column_csv': 'A doua coloană dintr-un CSV',
    'cli.awk.help.filter_rows_field': 'Filtrează liniile după un câmp',
    'cli.awk.help.sum_second_column': 'Însumează a doua coloană',

    // ── Basename ─────────────────────────────────────────────────────
    'cli.basename.description': 'Elimină directorul dintr-o cale',
    'cli.basename.help.print_last_part_path':
        'Afișează ultima parte a unei căi, numele fișierului sau al directorului, fără directoarele dinaintea lui. Dacă se dă un sufix, este eliminat și el de la final.',
    'cli.basename.help.name_without_directories': 'Numele fără directoare',
    'cli.basename.help.also_remove_trailing_suffix': 'Elimină și un sufix de la final',
    'cli.basename.help.prints_notes_txt': 'Afișează notes.txt',
    'cli.basename.help.prints_notes': 'Afișează notes',
    'cli.basename.help.prints_user': 'Afișează user',

    // ── Cat ──────────────────────────────────────────────────────────
    'cli.cat.description': 'Afișează conținutul fișierelor',
    'cli.cat.help.print_contents_one_more':
        'Afișează conținutul unuia sau mai multor fișiere, concatenate în ordine, sau al intrării transmise prin pipe. Transmiteți rezultatul altor comenzi pentru a-l căuta, sorta sau număra.',
    'cli.cat.help.print_files_one_after': 'Afișează fișierele unul după altul',
    'cli.cat.help.send_file_another_command': 'Trimite un fișier altei comenzi',
    'cli.cat.help.show_whole_file': 'Afișează întregul fișier',
    'cli.cat.help.show_only_lines_error': 'Afișează doar liniile cu error',
    'cli.cat.help.print_lines_sorted': 'Afișează liniile sortate',

    // ── Cd ───────────────────────────────────────────────────────────
    'cli.cd.description': 'Schimbă directorul de lucru curent',
    'cli.cd.help.change_current_directory_without':
        'Schimbă directorul curent. Fără o cale merge în directorul home. Căile pot fi absolute (/...), relative la locul unde vă aflați sau pot începe cu ~ pentru home.',
    'cli.cd.help.go_home_directory': 'Mergi în directorul home',
    'cli.cd.help.go_directory': 'Intră într-un director',
    'cli.cd.help.go_up_one_level': 'Urcă un nivel',
    'cli.cd.help.go_docs_home': 'Mergi la docs din home',
    'cli.cd.help.go_sibling_directory': 'Mergi într-un director vecin',
    'cli.cd.help.go_root': 'Mergi în rădăcină',

    // ── Chmod ────────────────────────────────────────────────────────
    'cli.chmod.description': 'Schimbă permisiunile fișierelor',
    'cli.chmod.help.change_who_can_read':
        'Schimbă cine poate citi (r), scrie (w) și executa (x) un fișier. Folosiți un mod octal, precum 755, sau unul simbolic: cine (u utilizator, g grup, o ceilalți, a toți), apoi + pentru a adăuga, - pentru a elimina sau = pentru a seta, apoi permisiunile.',
    'cli.chmod.help.set_permissions': 'Setează permisiunile',
    'cli.chmod.help.apply_directory_everything': 'Aplică unui director și întregului său conținut',
    'cli.chmod.help.rw_r_r_owner': 'rw-r--r--: proprietarul scrie, ceilalți citesc',
    'cli.chmod.help.let_owner_execute': 'Permite proprietarului să îl execute',
    'cli.chmod.help.take_away_write_group': 'Retrage scrierea pentru grup și ceilalți',
    'cli.chmod.help.set_whole_directory_tree': 'Setează un întreg arbore de directoare',

    // ── Chown ────────────────────────────────────────────────────────
    'cli.chown.description': 'Schimbă proprietarul și grupul fișierelor',
    'cli.chown.help.change_owner_group_files':
        'Schimbă proprietarul și/sau grupul fișierelor. Indicați user, user:group, user: (doar proprietarul) sau :group (doar grupul).',
    'cli.chown.help.change_owner_group_if': 'Schimbă proprietarul și grupul, dacă este dat',
    'cli.chown.help.change_only_group': 'Schimbă doar grupul',
    'cli.chown.help.apply_directory_everything': 'Aplică unui director și întregului său conținut',
    'cli.chown.help.make_alice_owner': 'Face din alice proprietarul',
    'cli.chown.help.set_owner_group': 'Setează proprietarul și grupul',
    'cli.chown.help.give_bob_whole_directory': 'Dă lui bob un întreg director',

    // ── Cp ───────────────────────────────────────────────────────────
    'cli.cp.description': 'Copiază fișiere și directoare',
    'cli.cp.help.copy_file_new_path':
        'Copiază un fișier la o cale nouă sau într-un director existent. Copierea unui director necesită -r, care copiază tot ce se află în el. Un fișier deja existent la destinație este înlocuit.',
    'cli.cp.help.copy_file_new_name': 'Copiază un fișier sub un nume nou',
    'cli.cp.help.copy_files_directory': 'Copiază fișiere într-un director',
    'cli.cp.help.copy_directory_contents': 'Copiază un director și conținutul său',
    'cli.cp.help.make_backup_copy': 'Face o copie de rezervă',
    'cli.cp.help.copy_docs': 'Copiază în ~/docs',
    'cli.cp.help.duplicate_whole_directory': 'Duplică un întreg director',

    // ── Cut ──────────────────────────────────────────────────────────
    'cli.cut.description': 'Extrage coloane sau câmpuri din fiecare linie a unui fișier',
    'cli.cut.help.print_selected_parts_each':
        'Afișează părțile selectate din fiecare linie: câmpuri separate printr-un delimitator (-f, tab implicit) sau poziții de caractere (-c). O listă poate conține numere singure, intervale sau ambele, precum 1,3 sau 2-4 sau 3-.',
    'cli.cut.help.select_fields': 'Selectează câmpuri',
    'cli.cut.help.select_character_positions': 'Selectează poziții de caractere',
    'cli.cut.help.cut_piped_input': 'Decupează intrarea transmisă prin pipe',
    'cli.cut.help.first_third_csv_column': 'Prima și a treia coloană dintr-un CSV',
    'cli.cut.help.first_10_characters_each': 'Primele 10 caractere din fiecare linie',
    'cli.cut.help.first_two_fields_split': 'Primele două câmpuri separate prin :',

    // ── Dirname ──────────────────────────────────────────────────────
    'cli.dirname.description': 'Elimină ultima componentă dintr-o cale',
    'cli.dirname.help.print_directory_part_path':
        'Afișează partea de director a unei căi, tot ce se află înainte de ultimul /. Un nume simplu, fără /, dă . (directorul curent).',
    'cli.dirname.help.path_without_last_part': 'Calea fără ultima parte',
    'cli.dirname.help.prints_home_user': 'Afișează /home/user',
    'cli.dirname.help.prints': 'Afișează .',
    'cli.dirname.help.prints_2': 'Afișează /',

    // ── Du ───────────────────────────────────────────────────────────
    'cli.du.description': 'Estimează spațiul ocupat de fișiere',
    'cli.du.help.show_how_much_space':
        'Arată cât spațiu ocupă fișierele și directoarele, în octeți. Pentru un director, fiecare subdirector este listat cu dimensiunea sa totală; folosiți -s doar pentru total sau -d pentru a limita adâncimea.',
    'cli.du.help.sizes_path_default_current':
        'Dimensiunile unei căi (implicit: directorul curent) și ale subdirectoarelor ei',
    'cli.du.help.only_total': 'Doar totalul',
    'cli.du.help.only_levels_deep': 'Doar <n> niveluri în adâncime',
    'cli.du.help.size_each_directory_docs': 'Dimensiunea fiecărui director din ~/docs',
    'cli.du.help.total_home_k_m': 'Totalul directorului home în K/M/G',
    'cli.du.help.size_each_top_level': 'Dimensiunea fiecărui dosar de nivel superior',

    // ── Find ─────────────────────────────────────────────────────────
    'cli.find.description': 'Caută fișiere și directoare după nume sau tip',
    'cli.find.help.list_files_directories_under':
        'Listează fișierele și directoarele de sub o cale (implicit directorul curent), căutând în toate subdirectoarele. Calea de start este listată prima. Filtrați după nume cu un model glob (* și ?; --name ține cont de majuscule, --iname nu) sau după tip.',
    'cli.find.help.list_everything_under_path': 'Listează tot ce se află sub o cale',
    'cli.find.help.match_names_against_glob': 'Potrivește numele cu un model glob',
    'cli.find.help.same_ignoring_case': 'La fel, ignorând majusculele',
    'cli.find.help.only_files_f_directories': 'Doar fișiere (f) sau directoare (d)',
    'cli.find.help.list_everything_docs': 'Listează tot din ~/docs',
    'cli.find.help.find_all_txt_files': 'Găsește toate fișierele .txt',
    'cli.find.help.directories_near_top': 'Directoarele de la început',
    'cli.find.help.delete_all_tmp_files': 'Șterge toate fișierele .tmp',

    // ── Grep ─────────────────────────────────────────────────────────
    'cli.grep.description': 'Caută un model în conținutul fișierelor',
    'cli.grep.help.print_lines_match_pattern':
        'Afișează liniile care se potrivesc cu un model. Modelul este o expresie regulată, potrivirile sunt evidențiate, iar intrarea poate fi fișiere, directoare (cu -r) sau text transmis prin pipe.',
    'cli.grep.help.search_one_more_files': 'Caută într-unul sau mai multe fișiere',
    'cli.grep.help.search_every_file_under': 'Caută în fiecare fișier dintr-un director',
    'cli.grep.help.filter_piped_input': 'Filtrează intrarea transmisă prin pipe',
    'cli.grep.help.case_insensitive_search': 'Căutare fără deosebire între majuscule și minuscule',
    'cli.grep.help.find_todos_line_numbers': 'Găsește TODO-urile cu numere de linie',
    'cli.grep.help.hide_comment_lines': 'Ascunde liniile de comentariu',
    'cli.grep.help.count_matching_lines': 'Numără liniile care se potrivesc',

    // ── Head ─────────────────────────────────────────────────────────
    'cli.head.description': 'Afișează primele linii ale unui fișier',
    'cli.head.help.print_first_lines_file':
        'Afișează primele linii ale unui fișier, implicit 10. Funcționează și pe intrarea transmisă prin pipe. Cu mai multe fișiere, fiecare primește un antet ==> name <==.',
    'cli.head.help.first_10_lines': 'Primele 10 linii',
    'cli.head.help.first_lines': 'Primele <count> linii',
    'cli.head.help.first_lines_piped_input': 'Primele linii ale intrării transmise prin pipe',
    'cli.head.help.show_start_file': 'Afișează începutul unui fișier',
    'cli.head.help.first_3_lines_each': 'Primele 3 linii din fiecare fișier',
    'cli.head.help.first_20_lines_log': 'Primele 20 de linii din jurnal',

    // ── Ln ───────────────────────────────────────────────────────────
    'cli.ln.description': 'Creează legături simbolice',
    'cli.ln.help.create_symbolic_link_new':
        'Creează o legătură simbolică: o cale nouă care trimite către alt fișier sau director. Sunt acceptate doar legăturile simbolice (-s), iar ținta nu trebuie să existe încă.',
    'cli.ln.help.create_pointing': 'Creează <link> care trimite la <target>',
    'cli.ln.help.shortcut_file': 'Scurtătură către un fișier',
    'cli.ln.help.shortcut_directory': 'Scurtătură către un director',

    // ── Mkdir ────────────────────────────────────────────────────────
    'cli.mkdir.description': 'Creează directoare',
    'cli.mkdir.help.create_new_directory_p':
        'Creează un director nou. Cu -p sunt create și directoarele părinte lipsă.',
    'cli.mkdir.help.create_one_more_directories': 'Creează unul sau mai multe directoare',
    'cli.mkdir.help.create_directory_missing_parents': 'Creează un director și părinții lipsă',
    'cli.mkdir.help.create_projects_current_directory': 'Creează projects în directorul curent',
    'cli.mkdir.help.create_whole_path_once': 'Creează întreaga cale dintr-o dată',

    // ── Mv ───────────────────────────────────────────────────────────
    'cli.mv.description': 'Mută sau redenumește fișiere și directoare',
    'cli.mv.help.move_rename_file_directory':
        'Mută sau redenumește un fișier sau un director. Dacă destinația este un director existent, sursa este mutată în el; altfel este redenumită. Un fișier deja existent la destinație este înlocuit.',
    'cli.mv.help.rename_file_directory': 'Redenumește un fișier sau un director',
    'cli.mv.help.move_them_directory': 'Mută-le într-un director',
    'cli.mv.help.rename_file': 'Redenumește un fișier',
    'cli.mv.help.move_docs': 'Mută-l în ~/docs',
    'cli.mv.help.rename_directory': 'Redenumește un director',

    // ── Paste ────────────────────────────────────────────────────────
    'cli.paste.description': 'Îmbină liniile fișierelor unul lângă altul',
    'cli.paste.help.join_files_side_side':
        'Îmbină fișierele unul lângă altul: linia 1 din fiecare fișier merge pe o singură linie de ieșire, separată printr-un tab, apoi linia 2 și așa mai departe. Cu -s, fiecare fișier este îmbinat pe o singură linie. Intrarea transmisă prin pipe este citită ca fișierul - (sau ca unică intrare când nu este numit niciun fișier); -d primește o listă de delimitatori folosiți pe rând.',
    'cli.paste.help.merge_files_line_line': 'Îmbină fișierele linie cu linie',
    'cli.paste.help.join_all_lines_file': 'Îmbină toate liniile unui fișier într-una singură',
    'cli.paste.help.merge_piped_input_file': 'Îmbină intrarea transmisă prin pipe cu un fișier',
    'cli.paste.help.two_columns_tab_separated': 'Două coloane, separate prin tab',
    'cli.paste.help.merge_comma_separated': 'Îmbină separat prin virgulă',
    'cli.paste.help.turn_list_one_csv': 'Transformă o listă într-o singură linie CSV',

    // ── Pwd ──────────────────────────────────────────────────────────
    'cli.pwd.description': 'Afișează directorul de lucru curent',
    'cli.pwd.help.print_full_path_directory':
        'Afișează calea completă a directorului în care vă aflați. Căile relative din celelalte comenzi pornesc de aici.',
    'cli.pwd.help.show_current_directory': 'Afișează directorul curent',
    'cli.pwd.help.example_home_user': 'De exemplu /home/user',
    'cli.pwd.help.prints_home_user_docs': 'Afișează /home/user/docs',

    // ── Rm ───────────────────────────────────────────────────────────
    'cli.rm.description': 'Elimină fișiere sau directoare',
    'cli.rm.help.delete_file_directories_only':
        'Șterge un fișier. Directoarele sunt eliminate doar cu -r, care șterge tot ce se află în ele. Fișierele șterse nu pot fi recuperate.',
    'cli.rm.help.delete_one_more_files': 'Șterge unul sau mai multe fișiere',
    'cli.rm.help.delete_directory_contents': 'Șterge un director și conținutul său',
    'cli.rm.help.delete_without_error_if': 'Șterge fără eroare dacă lipsește',
    'cli.rm.help.delete_one_file': 'Șterge un fișier',
    'cli.rm.help.delete_whole_directory': 'Șterge un întreg director',
    'cli.rm.help.quiet_if_file_does': 'Silențios dacă fișierul nu există',

    // ── Rmdir ────────────────────────────────────────────────────────
    'cli.rmdir.description': 'Elimină directoare goale',
    'cli.rmdir.help.remove_empty_directory_refuses':
        'Elimină un director gol. Refuză să elimine un director care mai conține fișiere; folosiți rm -r pentru asta.',
    'cli.rmdir.help.remove_empty_directories': 'Elimină directoare goale',
    'cli.rmdir.help.remove_directory_current_one': 'Elimină un director din cel curent',
    'cli.rmdir.help.remove_full_path': 'Elimină după calea completă',

    // ── Sed ──────────────────────────────────────────────────────────
    'cli.sed.description': 'Editor de flux pentru filtrarea și transformarea textului',
    'cli.sed.help.edit_text_line_line':
        'Editează textul linie cu linie cu un script: substituire (s/old/new/), ștergere (d), afișare (p) sau ieșire (q), opțional limitate la un număr de linie, un interval (1,5, 3,$ sau /start/,/end/) ori la liniile care se potrivesc cu /regex/; ! după o adresă o inversează, iar ; separă comenzile. Înlocuirea poate folosi & (potrivirea) și \\1 până la \\9 (grupuri, scrise \\(...\\) sau, cu -E, (...)). Citește fișiere sau intrare transmisă prin pipe și afișează rezultatul, sau rescrie fișierele cu -i.',
    'cli.sed.help.print_edited_file': 'Afișează fișierul editat',
    'cli.sed.help.save_edits_file': 'Salvează modificările în fișier',
    'cli.sed.help.print_only_selected_lines': 'Afișează doar liniile selectate',
    'cli.sed.help.edit_piped_input': 'Editează intrarea transmisă prin pipe',
    'cli.sed.help.replace_every_cat_dog': 'Înlocuiește fiecare cat cu dog',
    'cli.sed.help.edit_file_place': 'Editează fișierul pe loc',
    'cli.sed.help.drop_comment_lines': 'Elimină liniile de comentariu',
    'cli.sed.help.print_lines_1_5': 'Afișează liniile 1 până la 5',
    'cli.sed.help.swap_two_words': 'Inversează două cuvinte',

    // ── Sh ───────────────────────────────────────────────────────────
    'cli.sh.description': 'Execută un fișier script',
    'cli.sh.help.requires_execute': '(necesită permisiunea de execuție)',
    'cli.sh.help.script_syntax': 'Sintaxa scriptului:',
    'cli.sh.help.comments': 'Liniile care încep cu # sunt comentarii',
    'cli.sh.help.several_commands': 'Mai multe comenzi pe o linie',
    'cli.sh.help.assignment': 'Atribuirea unei variabile',
    'cli.sh.help.substitution': 'Substituirea unei variabile',
    'cli.sh.help.stop_on_error': 'Oprire la eroare (implicit)',
    'cli.sh.help.continue_on_errors': 'Continuă la erori',
    'cli.sh.help.exit': 'Oprește scriptul cu starea n',
    'cli.sh.help.control_flow': 'Control al fluxului:',
    'cli.sh.help.until': '(until cmd: invers)',
    'cli.sh.help.break_continue': 'Ieși / sari peste în buclă',
    'cli.sh.help.negate': 'Neagă starea de ieșire',
    'cli.sh.help.conditions': 'Condițiile sunt comenzi:',
    'cli.sh.help.conditions_status':
        '(stare 0 = adevărat; vezi help test). Buclele se opresc după 10000 de iterații',
    'cli.sh.help.conditions_loops': 'de while/until; Ctrl+C oprește scriptul.',
    'cli.sh.help.example_script': 'Script de exemplu:',

    // ── Sort ─────────────────────────────────────────────────────────
    'cli.sort.description': 'Sortează liniile fișierelor text',
    'cli.sort.help.sort_lines_file_piped':
        'Sortează liniile unui fișier sau ale intrării transmise prin pipe, implicit alfabetic. Sortați numeric, invers, după un câmp sau eliminați duplicatele. Mai multe fișiere sunt sortate împreună într-o singură listă.',
    'cli.sort.help.sort_lines_alphabetically': 'Sortează liniile alfabetic',
    'cli.sort.help.sort_field_split': 'Sortează după câmpul <n>, separat prin <sep>',
    'cli.sort.help.sort_piped_input': 'Sortează intrarea transmisă prin pipe',
    'cli.sort.help.z': 'De la A la Z',
    'cli.sort.help.largest_number_first': 'Cel mai mare număr primul',
    'cli.sort.help.sort_csv_second_column': 'Sortează un CSV după a doua coloană',
    'cli.sort.help.sorted_without_duplicates': 'Sortat, fără duplicate',

    // ── Stat ─────────────────────────────────────────────────────────
    'cli.stat.description': 'Afișează metadatele unui fișier/director',
    'cli.stat.help.show_details_about_files':
        'Afișează detalii despre fișiere sau directoare: calea completă, dimensiunea, tipul, permisiunile, proprietarul, grupul și când au fost create și modificate ultima dată.',
    'cli.stat.help.show_details_each_path': 'Afișează detalii pentru fiecare cale',
    'cli.stat.help.details_one_file': 'Detaliile unui fișier',
    'cli.stat.help.several_paths_once': 'Mai multe căi deodată',

    // ── Tac ──────────────────────────────────────────────────────────
    'cli.tac.description': 'Afișează un fișier în ordinea inversă a liniilor',
    'cli.tac.help.print_file_lines_reverse':
        'Afișează un fișier cu liniile în ordine inversă, ultima linie prima. Funcționează și pe intrarea transmisă prin pipe.',
    'cli.tac.help.print_file_bottom_top': 'Afișează un fișier de jos în sus',
    'cli.tac.help.reverse_piped_input': 'Inversează intrarea transmisă prin pipe',
    'cli.tac.help.newest_log_lines_first': 'Cele mai noi linii din jurnal primele',
    'cli.tac.help.reverse_list': 'Inversează o listă',

    // ── Tail ─────────────────────────────────────────────────────────
    'cli.tail.description': 'Afișează ultimele linii ale unui fișier',
    'cli.tail.help.print_last_lines_file':
        'Afișează ultimele linii ale unui fișier, implicit 10. Funcționează și pe intrarea transmisă prin pipe. Cu mai multe fișiere, fiecare primește un antet ==> name <==.',
    'cli.tail.help.last_10_lines': 'Ultimele 10 linii',
    'cli.tail.help.last_lines': 'Ultimele <count> linii',
    'cli.tail.help.last_lines_piped_input': 'Ultimele linii ale intrării transmise prin pipe',
    'cli.tail.help.show_end_log': 'Afișează sfârșitul unui jurnal',
    'cli.tail.help.last_5_lines': 'Ultimele 5 linii',
    'cli.tail.help.last_20_lines_log': 'Ultimele 20 de linii din jurnal',

    // ── Tee ──────────────────────────────────────────────────────────
    'cli.tee.description': 'Copiază intrarea din pipe în fișiere și în ieșire',
    'cli.tee.help.pass_piped_input_through':
        'Transmite intrarea din pipe neschimbată și salvează o copie a ei în fiecare fișier numit, suprascriindu-le sau adăugând cu -a. Ca tee din Unix, citește doar intrarea transmisă prin pipe: pentru a copia un fișier, transmiteți-l cu cat.',
    'cli.tee.help.show_piped_output_save': 'Afișează rezultatul din pipe și îl salvează',
    'cli.tee.help.append_instead_overwriting': 'Adaugă în loc să suprascrie',
    'cli.tee.help.show_save_copy': 'Afișează și salvează o copie',
    'cli.tee.help.add_line_log': 'Adaugă o linie într-un jurnal',
    'cli.tee.help.copy_source_txt_txt': 'Copiază source.txt în a.txt și b.txt',

    // ── Touch ────────────────────────────────────────────────────────
    'cli.touch.description': 'Creează un fișier gol sau îi actualizează marcajul de timp',
    'cli.touch.help.create_empty_file_update':
        'Creează un fișier gol sau actualizează ora modificării unui fișier existent. Directorul părinte trebuie să existe deja.',
    'cli.touch.help.create_files_refresh_their':
        'Creează fișierele sau le reîmprospătează marcajele de timp',
    'cli.touch.help.create_empty_notes_txt': 'Creează un notes.txt gol',
    'cli.touch.help.create_file_docs': 'Creează un fișier în ~/docs',

    // ── Tr ───────────────────────────────────────────────────────────
    'cli.tr.description': 'Transformă sau șterge caractere din intrarea transmisă prin pipe',
    'cli.tr.help.translate_characters_set1_matching':
        'Transformă caracterele din SET1 în caracterele corespunzătoare din SET2, le șterge (-d) sau comprimă repetițiile într-unul singur (-s). Seturile pot folosi intervale precum a-z și clase precum [:upper:], [:lower:], [:digit:], [:alpha:], [:alnum:] și [:space:]. Secvențele \\n, \\t și \\\\ sunt înțelese. Ca tr din Unix, citește doar intrarea transmisă prin pipe și nu primește fișiere ca operanzi: pentru a transforma un fișier, transmiteți-l cu cat.',
    'cli.tr.help.replace_characters': 'Înlocuiește caractere',
    'cli.tr.help.delete_characters': 'Șterge caractere',
    'cli.tr.help.squeeze_repeated_characters': 'Comprimă caracterele repetate',
    'cli.tr.help.convert_file_upper_case': 'Convertește un fișier în majuscule',
    'cli.tr.help.upper_case_piped_text': 'Textul din pipe în majuscule',
    'cli.tr.help.remove_all_digits': 'Elimină toate cifrele',
    'cli.tr.help.collapse_runs_spaces': 'Comprimă secvențele de spații',

    // ── Tree ─────────────────────────────────────────────────────────
    'cli.tree.description': 'Afișează structura arborescentă a directoarelor',
    'cli.tree.help.draw_directory_everything_below':
        'Desenează un director și tot ce se află sub el ca arbore, directoarele primele, urmate de numărul de directoare și fișiere. Implicit directorul curent.',
    'cli.tree.help.show_whole_tree': 'Afișează întregul arbore',
    'cli.tree.help.only_levels_deep': 'Doar <n> niveluri în adâncime',
    'cli.tree.help.tree_current_directory': 'Arborele directorului curent',
    'cli.tree.help.tree_docs': 'Arborele din ~/docs',
    'cli.tree.help.top_two_levels_only': 'Doar primele două niveluri',

    // ── Uniq ─────────────────────────────────────────────────────────
    'cli.uniq.description': 'Filtrează liniile duplicate adiacente dintr-un fișier',
    'cli.uniq.help.collapse_repeated_lines_next':
        'Comprimă într-una singură liniile repetate care se află una lângă alta. Sunt îmbinate doar duplicatele adiacente, deci sortați mai întâi intrarea pentru a le prinde pe toate.',
    'cli.uniq.help.drop_adjacent_duplicate_lines': 'Elimină liniile duplicate adiacente',
    'cli.uniq.help.filter_piped_input': 'Filtrează intrarea transmisă prin pipe',
    'cli.uniq.help.collapse_repeated_lines': 'Comprimă liniile repetate',
    'cli.uniq.help.count_how_often_each': 'Numără de câte ori apare fiecare linie',
    'cli.uniq.help.show_only_duplicated_lines': 'Afișează doar liniile duplicate',

    // ── Wc ───────────────────────────────────────────────────────────
    'cli.wc.description': 'Afișează numărul de linii, cuvinte și caractere',
    'cli.wc.help.count_lines_words_characters':
        'Numără liniile, cuvintele și caracterele din fișiere sau din intrarea transmisă prin pipe. Cu mai multe fișiere, la final este afișată o linie cu totalul.',
    'cli.wc.help.lines_words_characters': 'Linii, cuvinte și caractere',
    'cli.wc.help.only_line_count': 'Doar numărul de linii',
    'cli.wc.help.count_piped_input': 'Numără intrarea transmisă prin pipe',
    'cli.wc.help.all_three_counts': 'Toate cele trei numărători',
    'cli.wc.help.line_counts_total': 'Numărul de linii, cu total',
    'cli.wc.help.how_many_lines_mention': 'Câte linii menționează error',

    // ── Xargs ────────────────────────────────────────────────────────
    'cli.xargs.description': 'Construiește și execută comenzi pe baza intrării din fișier',
    'cli.xargs.help.run_command_arguments_taken':
        'Rulează o comandă cu argumente preluate din intrare, separate prin spații sau linii noi. Implicit toate sunt adăugate la o singură comandă; -n o rulează în loturi, iar -I o rulează o dată pe linie, înlocuind un substituent. Opțiunile xargs se pun înaintea comenzii; tot ce urmează după ea, inclusiv flagurile, aparține comenzii. Intrarea este text transmis prin pipe sau, fără pipe, ultimul fișier numit.',
    'cli.xargs.help.append_input_lines': 'Adaugă liniile de intrare la <cmd>',
    'cli.xargs.help.run_once_per_line': 'Rulează <cmd> o dată pe linie',
    'cli.xargs.help.read_arguments_file': 'Citește argumentele dintr-un fișier',
    'cli.xargs.help.delete_every_tmp_file': 'Șterge fiecare fișier .tmp',
    'cli.xargs.help.copy_each_listed_file': 'Copiază fiecare fișier listat',
    'cli.xargs.help.one_mkdir_per_line': 'Un mkdir pe linie',
    'cli.xargs.help.inner_command_keeps_flags': 'Comanda interioară își păstrează flagurile',

    // ── Markdown ─────────────────────────────────────────────────────
    'cli.md.description': 'Randează Markdown în terminal',
    'cli.md.help.show_markdown_formatted_terminal':
        'Afișează Markdown formatat în terminal: titluri, text aldin și cursiv, liste, citate, cod și linkuri. Transmiteți textul direct (între ghilimele sau nu, \\n începe o linie nouă) sau transmiteți-l prin pipe de la altă comandă.',
    'cli.md.help.render_inline_text': 'Randează text transmis direct',
    'cli.md.help.same_optional_render_verb': 'La fel, cu verbul opțional render (și preview, view)',
    'cli.md.help.render_output_command': 'Randează rezultatul unei comenzi',
    'cli.md.help.heading': 'Un titlu',
    'cli.md.help.several_lines': 'Mai multe linii',
    'cli.md.help.piped_text': 'Text transmis prin pipe',
    'cli.md.help.same_using_aliases': 'La fel, folosind aliasuri',

    // ── Todo ─────────────────────────────────────────────────────────
    'cli.todo.description':
        'Gestionați-vă sarcinile din terminal. Adăugați, listați, editați, finalizați și eliminați elemente TODO.',
    'cli.todo.ls.description': 'Afișează elementele TODO',
    'cli.todo.add.description': 'Adaugă o sarcină nouă',
    'cli.todo.edit.description': 'Editează textul sau termenul limită al unei sarcini',
    'cli.todo.done.description': 'Marchează o sarcină ca finalizată',
    'cli.todo.toggle.description': 'Comută o sarcină între finalizată și nefinalizată',
    'cli.todo.rm.description': 'Elimină o sarcină după ID',
    'cli.todo.help.commands': 'Comenzi:',
    'cli.todo.help.list_all': 'Afișează toate sarcinile',
    'cli.todo.help.list_pending': 'Afișează doar sarcinile în așteptare',
    'cli.todo.help.list_completed': 'Afișează doar sarcinile finalizate',
    'cli.todo.help.list_overdue': 'Afișează doar sarcinile întârziate',
    'cli.todo.help.add': 'Adaugă o sarcină nouă',
    'cli.todo.help.add_due': 'Adaugă cu termen limită',
    'cli.todo.help.edit': 'Editează o sarcină',
    'cli.todo.help.done': 'Marchează o sarcină ca finalizată',
    'cli.todo.help.toggle': 'Comută între finalizat/nefinalizat',
    'cli.todo.help.remove': 'Elimină o sarcină',
    'cli.todo.help.remove_all': 'Elimină toate sarcinile',
    'cli.todo.help.due_formats': 'Formate pentru termenul limită:',

    // ── True ─────────────────────────────────────────────────────────
    'cli.true.description': 'Nu face nimic, cu succes (cod de ieșire 0)',

    // ── False ────────────────────────────────────────────────────────
    'cli.false.description': 'Nu face nimic, fără succes (cod de ieșire 1)',

    // ── Htop ─────────────────────────────────────────────────────────
    'cli.htop.description': 'Monitor interactiv de procese și servicii',
};
