/**
 * Spanish translations for Qodalis CLI.
 *
 * Keys follow the pattern `cli.<command>.<key>` and match the default English
 * strings used in the `t()` calls across all built-in processors.
 */
export const esTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Uso:',
    'cli.common.examples': 'Ejemplos:',

    // ── Help ─────────────────────────────────────────────────────────
    'cli.help.description': 'Muestra la ayuda de un comando',
    'cli.help.long_description': 'Muestra informaci\u00f3n de ayuda para los comandos',
    'cli.help.shortcuts': 'Atajos',
    'cli.help.type': 'Escriba',
    'cli.help.help_command': 'help <comando>',
    'cli.help.for_details': 'para informaci\u00f3n detallada',
    'cli.help.unknown_command': 'Comando desconocido: {command}',
    'cli.help.see_all': 'para ver todos los comandos disponibles',
    'cli.help.extension_chain': 'Cadena de extensiones',
    'cli.help.subcommands': 'Subcomandos',
    'cli.help.options': 'Opciones',
    'cli.help.global_options': 'Opciones globales',
    'cli.help.requires_server': 'Requiere un servidor conectado',
    'cli.help.aliases': 'Alias:',
    'cli.help.required': '(obligatorio)',
    'cli.help.show_all': 'Mostrar todos los comandos disponibles',
    'cli.help.show_details': 'Mostrar detalles de un comando',
    'cli.help.show_sub_details': 'Mostrar detalles de un subcomando',
    'cli.help.example_pkg': 'Ayuda del gestor de paquetes',
    'cli.help.example_theme': 'Ayuda del subcomando theme apply',

    // ── Configure ────────────────────────────────────────────────────
    'cli.configure.description': 'Gestionar la configuraci\u00f3n del sistema y los plugins',
    'cli.configure.long_description':
        'Gestionar la configuraci\u00f3n del sistema y de plugins de forma interactiva o mediante subcomandos',
    'cli.configure.open_menu': 'Abrir el men\u00fa de configuraci\u00f3n interactivo',
    'cli.configure.list_opts': 'Listar todas las opciones de configuraci\u00f3n',
    'cli.configure.get_value': 'Obtener un valor de configuraci\u00f3n',
    'cli.configure.set_value': 'Establecer un valor de configuraci\u00f3n',
    'cli.configure.reset_defaults': 'Restablecer la configuraci\u00f3n a los valores predeterminados',
    'cli.configure.system': 'Sistema',
    'cli.configure.exit': 'Salir',
    'cli.configure.back': 'Volver',
    'cli.configure.current_value': 'Valor actual:',
    'cli.configure.invalid_value': 'Valor no v\u00e1lido',
    'cli.configure.set_to': '{label} establecido a {value}',
    'cli.configure.invalid_format_get': 'Formato no v\u00e1lido. Use: configure get <categor\u00eda.clave>',
    'cli.configure.unknown_key': 'Clave de configuraci\u00f3n desconocida: {path}',
    'cli.configure.invalid_format_set': 'Formato no v\u00e1lido. Use: configure set <categor\u00eda.clave> <valor>',
    'cli.configure.set_success': '{path} establecido a {value}',
    'cli.configure.system_reset': 'Configuraci\u00f3n del sistema restablecida a los valores predeterminados',
    'cli.configure.unknown_category': 'Categor\u00eda desconocida: {category}',
    'cli.configure.category_reset':
        'Configuraci\u00f3n de "{category}" restablecida a los valores predeterminados',
    'cli.configure.reset_confirm': '\u00bfRestablecer toda la configuraci\u00f3n a los valores predeterminados?',
    'cli.configure.reset_cancelled': 'Restablecimiento cancelado',
    'cli.configure.all_reset': 'Toda la configuraci\u00f3n restablecida a los valores predeterminados',
    'cli.configure.invalid_number': 'N\u00famero no v\u00e1lido: {value}',
    'cli.configure.invalid_options': 'Valor no v\u00e1lido. Opciones v\u00e1lidas: {options}',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Imprime el texto especificado',
    'cli.echo.long_description': 'Imprime el texto especificado en la terminal',
    'cli.echo.piping_note': 'Soporta salida de texto y objetos JSON mediante tuber\u00edas',

    // ── Clear ─────────────────────────────────────────────────────────
    'cli.clear.description': 'Limpia la terminal',
    'cli.clear.long_description': 'Limpia todo el contenido de la pantalla de la terminal',
    'cli.clear.shortcut': 'Atajo:',

    // ── Version ───────────────────────────────────────────────────────
    'cli.version.description': 'Muestra informaci\u00f3n de la versi\u00f3n',
    'cli.version.long_description':
        'Muestra la versi\u00f3n actual del CLI y el enlace a la documentaci\u00f3n',

    // ── Uname ─────────────────────────────────────────────────────────
    'cli.uname.long_description':
        'Muestra informaci\u00f3n detallada del sistema y del navegador, incluyendo:',
    'cli.uname.cli_versions': 'Versiones del n\u00facleo y las librer\u00edas del CLI',
    'cli.uname.browser_info':
        'Nombre del navegador, versi\u00f3n, agente de usuario, idioma y plataforma',
    'cli.uname.os': 'Sistema operativo',

    // ── Hash ──────────────────────────────────────────────────────────
    'cli.hash.description': 'Generar res\u00famenes hash de texto',
    'cli.hash.long_description':
        'Generar res\u00famenes hash criptogr\u00e1ficos usando la API Web Crypto',

    // ── Cal ───────────────────────────────────────────────────────────
    'cli.cal.description': 'Mostrar un calendario',
    'cli.cal.long_description': 'Mostrar un calendario mensual',
    'cli.cal.highlight_note': 'El d\u00eda actual est\u00e1 resaltado',
    'cli.cal.current_month': 'Mes actual',
    'cli.cal.specific_month': 'Mes espec\u00edfico',

    // ── Time ──────────────────────────────────────────────────────────
    'cli.time.description': 'Mostrar la hora local y UTC actual',
    'cli.time.long_description': 'Mostrar la hora local y UTC actual',
    'cli.time.show_current': 'Mostrar la hora local y UTC actual',

    // ── Uptime ────────────────────────────────────────────────────────
    'cli.uptime.description': 'Mostrar el tiempo de actividad de la sesi\u00f3n',
    'cli.uptime.long_description':
        'Mostrar cu\u00e1nto tiempo lleva activa la sesi\u00f3n actual de la terminal',

    // ── Convert ───────────────────────────────────────────────────────
    'cli.convert.description': 'Convertir entre unidades (longitud, peso, temperatura, datos)',
    'cli.convert.long_description': 'Convertir entre varias unidades de medida',
    'cli.convert.supported': 'Soportados:',

    // ── Eval ──────────────────────────────────────────────────────────
    'cli.eval.description': 'Evaluar una expresi\u00f3n JavaScript',
    'cli.eval.long_description': 'Evaluar una expresi\u00f3n JavaScript',
    'cli.eval.supports':
        'Soporta aritm\u00e9tica, cadenas, arreglos, objetos y cualquier JS v\u00e1lido',

    // ── Seq ───────────────────────────────────────────────────────────
    'cli.seq.description': 'Imprimir una secuencia de n\u00fameros',
    'cli.seq.long_description': 'Imprimir una secuencia de n\u00fameros',
    'cli.seq.numbers_to_end': 'N\u00fameros del 1 al final',
    'cli.seq.numbers_range': 'N\u00fameros desde inicio hasta final',
    'cli.seq.with_step': 'Con paso personalizado',

    // ── Lorem ─────────────────────────────────────────────────────────
    'cli.lorem.description': 'Generar texto de relleno lorem ipsum',
    'cli.lorem.long_description': 'Generar texto de relleno lorem ipsum',
    'cli.lorem.gen_words': 'Generar palabras',
    'cli.lorem.gen_sentences': 'Generar oraciones',
    'cli.lorem.gen_paragraphs': 'Generar p\u00e1rrafos',

    // ── Alias / Unalias ──────────────────────────────────────────────
    'cli.alias.description': 'Gestionar alias de comandos',
    'cli.alias.long_description': 'Crear atajos de alias para comandos usados frecuentemente',
    'cli.alias.create_new': 'Crear un nuevo alias',
    'cli.alias.list_all': 'Listar todos los alias',
    'cli.alias.remove_hint': 'Use {command} para eliminar un alias',
    'cli.unalias.description': 'Eliminar alias de comandos',
    'cli.unalias.long_description': 'Eliminar un alias de comando previamente definido',

    // ── Open ──────────────────────────────────────────────────────────
    'cli.open.description': 'Abrir una URL en una nueva pesta\u00f1a del navegador',
    'cli.open.long_description': 'Abrir una URL en una nueva pesta\u00f1a del navegador',
    'cli.open.auto_https': 'Agrega autom\u00e1ticamente https:// si no se especifica un protocolo',

    // ── Color ─────────────────────────────────────────────────────────
    'cli.color.description': 'Convertir y previsualizar colores (hex, rgb, hsl)',
    'cli.color.long_description': 'Convertir entre formatos de color y previsualizar colores',
    'cli.color.supported_formats': 'Formatos soportados:',

    // ── History ───────────────────────────────────────────────────────
    'cli.history.long_description': 'Muestra el historial de comandos de la sesi\u00f3n actual',
    'cli.history.show': 'Mostrar el historial de comandos',
    'cli.history.search': 'Buscar en el historial por patr\u00f3n',
    'cli.history.clear': 'Borrar todo el historial',
    'cli.history.arrow_hint':
        'Use las teclas de flecha {keys} para navegar por el historial',
    'cli.history.prefix_hint':
        'Escriba un prefijo y luego {key} para buscar en el historial por prefijo',

    // ── Theme ─────────────────────────────────────────────────────────
    'cli.theme.description': 'Interactuar con el tema',
    'cli.theme.long_description':
        'Personalizar la apariencia de la terminal con temas y colores',

    // ── Hex ───────────────────────────────────────────────────────────
    'cli.hex.description': 'Codificar/decodificar hex y conversiones de base num\u00e9rica',
    'cli.hex.long_description':
        'Codificar/decodificar texto en hexadecimal y convertir n\u00fameros entre bases',
    'cli.hex.text_to_hex': 'Texto a hexadecimal',
    'cli.hex.hex_to_text': 'Hexadecimal a texto',
    'cli.hex.base_conversion': 'Conversi\u00f3n de base',

    // ── Feedback ──────────────────────────────────────────────────────
    'cli.feedback.long_description':
        'Reportar errores, solicitar funcionalidades o sugerir nuevos comandos \u2014 de forma interactiva o en l\u00ednea.',

    // ── JWT ───────────────────────────────────────────────────────────
    'cli.jwt.description': 'Decodificar e inspeccionar tokens JWT',
    'cli.jwt.long_description': 'Decodificar e inspeccionar JSON Web Tokens (JWT)',
    'cli.jwt.decode_display': 'Decodificar y mostrar el contenido del JWT',
    'cli.jwt.shows': 'Muestra: encabezado, carga \u00fatil, estado de expiraci\u00f3n, fecha de emisi\u00f3n',

    // ── Sleep ─────────────────────────────────────────────────────────
    'cli.sleep.description': 'Pausar la ejecuci\u00f3n durante un tiempo especificado',
    'cli.sleep.long_description':
        'Pausa la ejecuci\u00f3n durante la duraci\u00f3n especificada (en milisegundos)',

    // ── Services ──────────────────────────────────────────────────────
    'cli.services.description': 'Gestionar servicios en segundo plano y tareas',
    'cli.services.long_description': 'Gestionar servicios en segundo plano y tareas',
    'cli.services.list_desc': 'Listar todos los servicios',
    'cli.services.start_desc': 'Iniciar un servicio',
    'cli.services.stop_desc': 'Detener un servicio',
    'cli.services.restart_desc': 'Reiniciar un servicio',
    'cli.services.logs_desc': 'Ver registros del servicio',
    'cli.services.info_desc': 'Detalles del servicio',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Repetir una cadena continuamente',
    'cli.yes.long_description': 'Repetir una cadena continuamente',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'Copiar o pegar del portapapeles',
    'cli.clipboard.long_description':
        'Copiar texto al portapapeles del sistema o pegar texto desde \u00e9l',
    'cli.clipboard.copy_desc': 'Copiar texto al portapapeles',
    'cli.clipboard.paste_desc': 'Pegar del portapapeles',

    // ── Hotkeys ───────────────────────────────────────────────────────
    'cli.hotkeys.description': 'Mostrar informaci\u00f3n de las teclas r\u00e1pidas',
    'cli.hotkeys.long_description':
        'Muestra todos los atajos de teclado y teclas r\u00e1pidas disponibles',

    // ── Export / Unset / Env ──────────────────────────────────────────
    'cli.export.description': 'Establecer variables de entorno',
    'cli.export.long_description': 'Establecer o mostrar variables de entorno',
    'cli.export.show_all': 'Mostrar todas las variables',
    'cli.export.set_var': 'Establecer una variable',
    'cli.export.set_spaces': 'Establecer con espacios',
    'cli.unset.description': 'Eliminar variables de entorno',
    'cli.unset.long_description': 'Eliminar una variable de entorno',
    'cli.env.description': 'Mostrar variables de entorno',
    'cli.env.long_description': 'Mostrar variables de entorno',
    'cli.env.show_all': 'Mostrar todas las variables',
    'cli.env.show_single': 'Mostrar una variable',

    // ── URL ───────────────────────────────────────────────────────────
    'cli.url.description': 'Codificar o decodificar URLs',
    'cli.url.long_description': 'Codificar, decodificar y analizar URLs',
    'cli.url.encode_desc': 'Codificar una cadena como URL',
    'cli.url.decode_desc': 'Decodificar una cadena URL',
    'cli.url.parse_desc': 'Analizar los componentes de una URL',

    // ── JSON ──────────────────────────────────────────────────────────
    'cli.json.description': 'Formatear, minificar o validar JSON',
    'cli.json.long_description': 'Formatear, minificar o validar cadenas JSON',
    'cli.json.format_desc': 'Formatear JSON con sangr\u00eda',
    'cli.json.minify_desc': 'Eliminar espacios en blanco',
    'cli.json.validate_desc': 'Verificar si es JSON v\u00e1lido',

    // ── Base64 ────────────────────────────────────────────────────────
    'cli.base64.description': 'Codificar o decodificar cadenas Base64',
    'cli.base64.long_description': 'Codificar y decodificar cadenas Base64',
    'cli.base64.utf8_note': 'Soporta codificaci\u00f3n de texto UTF-8',
    'cli.base64.encode_desc': 'Codificar texto a Base64',
    'cli.base64.decode_desc': 'Decodificar Base64 a texto',

    // ── Timestamp ─────────────────────────────────────────────────────
    'cli.timestamp.description': 'Convertir entre marcas de tiempo Unix y fechas',
    'cli.timestamp.long_description':
        'Convertir entre marcas de tiempo Unix y fechas legibles',
    'cli.timestamp.current': 'Marca de tiempo Unix actual',
    'cli.timestamp.to_date': 'Marca de tiempo a fecha',
    'cli.timestamp.from_date': 'Fecha a marca de tiempo',

    // ── Screen ────────────────────────────────────────────────────────
    'cli.screen.description': 'Mostrar informaci\u00f3n de pantalla y terminal',
    'cli.screen.long_description':
        'Mostrar dimensiones de la pantalla, ventana gr\u00e1fica y terminal',
    'cli.screen.shows':
        'Muestra: resoluci\u00f3n, profundidad de color, proporci\u00f3n de p\u00edxeles, tama\u00f1o de ventana, tama\u00f1o de terminal',

    // ── Random ────────────────────────────────────────────────────────
    'cli.random.description': 'Generar valores aleatorios',
    'cli.random.long_description': 'Generar n\u00fameros, cadenas, UUIDs aleatorios y m\u00e1s',
    'cli.random.number_desc': 'N\u00famero aleatorio (0-100)',
    'cli.random.string_desc': 'Cadena aleatoria (16 caracteres)',
    'cli.random.uuid_desc': 'UUID v4 aleatorio',
    'cli.random.coin_desc': 'Lanzar una moneda',
    'cli.random.dice_desc': 'Lanzar un dado',

    // ── Ping ──────────────────────────────────────────────────────────
    'cli.ping.description': 'Enviar pings tipo ICMP a un host',
    'cli.ping.long_description':
        'Enviar pings HTTP tipo ICMP a un host y mostrar estad\u00edsticas de ida y vuelta',
    'cli.ping.ctrl_c': 'Presione Ctrl+C para detener y mostrar estad\u00edsticas.',

    // ── Nano ──────────────────────────────────────────────────────────
    'cli.nano.description': 'Abrir el editor de texto integrado',
    'cli.nano.long_description': 'Abrir el editor de texto estilo nano integrado',
    'cli.nano.open_empty': 'Abrir un b\u00fafer vac\u00edo',
    'cli.nano.open_file': 'Abrir o crear un archivo',
    'cli.nano.keyboard_shortcuts': 'Atajos de teclado:',

    // ── Debug ─────────────────────────────────────────────────────────
    'cli.debug.description': 'Mostrar diagn\u00f3sticos detallados del sistema e internos del CLI',
    'cli.debug.long_description':
        'Muestra diagn\u00f3sticos detallados del sistema e internos del CLI.',
    'cli.debug.hidden_note':
        'Este comando est\u00e1 oculto en la lista de ayuda pero es accesible directamente.',
    'cli.debug.summary': 'Resumen del sistema',
    'cli.debug.processors': 'Todos los procesadores registrados',
    'cli.debug.modules': 'Todos los m\u00f3dulos cargados',
    'cli.debug.state': 'Inspeccionar almacenes de estado',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Gestionar paquetes en el CLI',
};
