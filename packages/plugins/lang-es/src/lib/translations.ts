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
    'cli.common.use_hint': 'Use {command} {action}',

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
    'cli.configure.invalid_boolean': 'Valor booleano no válido: "{value}". Use true o false.',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Imprime el texto especificado',
    'cli.echo.long_description': 'Imprime el texto especificado en la terminal',
    'cli.echo.piping_note': 'Soporta salida de texto y objetos JSON mediante tuber\u00edas',
    'cli.echo.help.print_text_terminal_add':
        'Muestra texto en el terminal. Añada > file para guardarlo en un archivo (reemplazándolo) o >> file para añadirlo al final.',
    'cli.echo.help.print_text': 'Mostrar texto',
    'cli.echo.help.write_text_file': 'Escribir texto en un archivo',
    'cli.echo.help.append_text_file': 'Añadir texto a un archivo',
    'cli.echo.help.print_greeting': 'Mostrar un saludo',
    'cli.echo.help.create_replace_notes_txt': 'Crear o reemplazar notes.txt',
    'cli.echo.help.add_line': 'Añadirle una línea',

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
    'cli.uname.description': 'Muestra información detallada del sistema y del navegador',

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
    'cli.time.now.description': 'Mostrar la hora actual',

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
    'cli.lorem.words.description': 'Generar un número de palabras',
    'cli.lorem.sentences.description': 'Generar un número de frases',
    'cli.lorem.paragraphs.description': 'Generar un número de párrafos',

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
    'cli.history.description': 'Muestra el historial de comandos de la sesión actual',
    'cli.history.clear.description': 'Borra el historial de comandos',
    'cli.history.search.description': 'Buscar un patrón en el historial de comandos',

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
    'cli.feedback.report-bug.description': 'Informa de un error en GitHub',
    'cli.feedback.request-feature.description': 'Solicita una nueva función en GitHub',
    'cli.feedback.request-command.description': 'Solicita un nuevo comando en GitHub',
    'cli.feedback.description': 'Permite a los usuarios informar de errores o solicitar funciones',

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
    'cli.services.list.description': 'Listar todos los servicios en segundo plano registrados',
    'cli.services.start.description': 'Iniciar un servicio en segundo plano',
    'cli.services.stop.description': 'Detener un servicio en segundo plano en ejecución',
    'cli.services.restart.description': 'Reiniciar un servicio en segundo plano',
    'cli.services.logs.description': 'Mostrar los registros de un servicio en segundo plano',
    'cli.services.info.description': 'Mostrar información detallada de un servicio',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Repetir una cadena continuamente',
    'cli.yes.long_description': 'Repetir una cadena continuamente',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'Copiar o pegar del portapapeles',
    'cli.clipboard.long_description':
        'Copiar texto al portapapeles del sistema o pegar texto desde \u00e9l',
    'cli.clipboard.copy_desc': 'Copiar texto al portapapeles',
    'cli.clipboard.paste_desc': 'Pegar del portapapeles',
    'cli.clipboard.copy.description': 'Copiar texto al portapapeles',
    'cli.clipboard.paste.description': 'Pegar texto del portapapeles',

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
    'cli.export.set_many': 'Definir varias a la vez',
    'cli.export.set_global': 'Definir para todos los usuarios',
    'cli.export.set_session': 'Solo este terminal, sin guardar',
    'cli.export.scopes':
        'Use las variables como $VAR o ${VAR}. Un valor definido en este terminal prevalece sobre el suyo guardado, que prevalece sobre uno compartido. env muestra de dónde viene cada una.',
    'cli.unset.description': 'Eliminar variables de entorno',
    'cli.unset.long_description': 'Eliminar una variable de entorno',
    'cli.unset.own':
        'Eliminar para este terminal y para usted (un valor compartido se oculta para usted)',
    'cli.unset.global': 'Eliminar el valor compartido',
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
    'cli.json.format.description': 'Formatear JSON con sangría',
    'cli.json.minify.description': 'Minificar JSON quitando los espacios en blanco',
    'cli.json.validate.description': 'Validar si una cadena es JSON válido',

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
    'cli.timestamp.now.description': 'Mostrar la marca de tiempo Unix actual',
    'cli.timestamp.to-date.description': 'Convertir una marca de tiempo Unix en una fecha',
    'cli.timestamp.from-date.description':
        'Convertir una cadena de fecha en una marca de tiempo Unix',

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
    'cli.random.number.description': 'Generar un número aleatorio',
    'cli.random.string.description': 'Generar una cadena aleatoria',
    'cli.random.uuid.description': 'Generar un UUID v4 aleatorio',
    'cli.random.coin.description': 'Lanzar una moneda',
    'cli.random.dice.description': 'Lanzar un dado',

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
    'cli.debug.processors.description': 'Listar todos los procesadores de comandos registrados',
    'cli.debug.modules.description': 'Listar todos los módulos CLI cargados',
    'cli.debug.state.description': 'Inspeccionar todos los almacenes de estado y sus valores',
    'cli.debug.services.description': 'Listar todos los servicios registrados en el contenedor DI',
    'cli.debug.environment.description':
        'Mostrar información del navegador, el terminal y el framework',
    'cli.debug.history.description': 'Mostrar estadísticas del historial de comandos',
    'cli.debug.health.description':
        'Comprobar el estado del sistema: almacenamiento, conectividad, estado de los procesadores',
    'cli.debug.export.description': 'Exportar toda la información de depuración como JSON',
    'cli.debug.servers.description': 'Listar los servidores configurados y su estado de conexión',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Gestionar paquetes en el CLI',

    // ── Servers and events ───────────────────────────────────────────
    'cli.server.description': 'Gestionar las conexiones a servidores CLI remotos',
    'cli.server.list.description': 'Mostrar los servidores con su estado, versión y comandos',
    'cli.server.status.description': 'Comprobar que los servidores responden (todos, o uno en detalle)',
    'cli.server.commands.description': 'Mostrar los comandos de cada servidor',
    'cli.server.reconnect.description': 'Volver a conectar con los servidores y recargar sus comandos',
    'cli.server.default.description': 'Mostrar o fijar el servidor que ejecuta los comandos compartidos',
    'cli.server.jobs.description': 'Gestionar tareas en segundo plano en los servidores conectados',
    'cli.server.jobs.list.description': 'Listar todas las tareas de los servidores conectados',
    'cli.server.jobs.info.description': 'Mostrar información detallada de una tarea',
    'cli.server.jobs.trigger.description': 'Iniciar la ejecución inmediata de una tarea',
    'cli.server.jobs.pause.description': 'Pausar la ejecución programada de una tarea',
    'cli.server.jobs.resume.description': 'Reanudar una tarea pausada',
    'cli.server.jobs.stop.description':
        'Detener una tarea y cancelar la ejecución actual si la hay',
    'cli.server.jobs.cancel.description': 'Cancelar la ejecución actual de una tarea',
    'cli.server.jobs.history.description': 'Mostrar el historial de ejecuciones de una tarea',
    'cli.server.jobs.logs.description':
        'Mostrar los registros de la última ejecución o de una concreta',
    'cli.server.jobs.edit.description': 'Editar interactivamente la configuración de una tarea',
    'cli.server.jobs.watch.description': 'Vista en directo de los eventos de tareas por WebSocket',
    'cli.server.help.see_everything_you_can': 'para ver todo lo que puede hacer',
    'cli.server.help.connect_terminal_remote_cli':
        'Conecta el terminal con servidores CLI remotos (.NET, Node.js, Python) y ejecuta sus comandos.',
    'cli.server.help.by_name_or_prefix':
        'Los comandos de cada servidor están disponibles por nombre ({byName}) y con el servidor como prefijo ({prefixed}). Cuando varios servidores tienen el mismo comando, lo ejecuta el servidor predeterminado; si no hay uno, se le pregunta qué servidor usar. Un comando local con el mismo nombre tiene prioridad: use el nombre con prefijo. Un servidor que se cae se reintenta cada 30 segundos y sus comandos vuelven cuando se recupera.',
    'cli.server.help.overview_servers': 'Resumen de los servidores',
    'cli.server.help.servers_status_version_commands': 'Servidores con estado, versión y comandos',
    'cli.server.help.check_servers_reachable_all':
        'Comprobar que los servidores responden (todos, o uno en detalle)',
    'cli.server.help.commands_each_server_provides': 'Comandos que ofrece cada servidor',
    'cli.server.help.connect_again_unreachable_servers':
        'Volver a conectar (servidores inaccesibles, o uno)',
    'cli.server.help.show_set_server_shared':
        'Mostrar o fijar el servidor para los comandos compartidos',
    'cli.server.help.open_shell_server_run': 'Abrir un shell en un servidor, o ejecutar un comando',
    'cli.server.help.ping_node_show_details': 'Hacer ping a node y mostrar sus detalles',
    'cli.server.help.what_node_can_do': 'Qué puede hacer node',
    'cli.server.help.run_echo_node_explicitly': 'Ejecutar echo en node de forma explícita',
    'cli.server.help.shared_commands_run_node': 'Los comandos compartidos se ejecutan en node',
    'cli.server.help.retry_every_unreachable_server':
        'Reintentar todos los servidores inaccesibles',
    'cli.server.list.help.list_configured_servers_connection':
        'Lista los servidores configurados: estado de conexión, URL, versión del servidor y de la API, número de comandos y acceso al shell.',
    'cli.server.list.help.see_why_server_unreachable':
        'para ver por qué un servidor no responde, server reconnect para reintentar',
    'cli.server.status.help.details_server': 'para ver los detalles de un servidor',
    'cli.server.status.help.try_again': 'para volver a intentarlo',
    'cli.server.status.help.load_commands': 'para cargar sus comandos',
    'cli.server.status.help.see_commands': 'para ver sus comandos',
    'cli.server.status.help.ping_servers_without_name':
        'Hace ping a los servidores. Sin nombre, se comprueban todos a la vez con su tiempo de ida y vuelta; con nombre, se muestra ese servidor en detalle (versiones, SO, shell, streaming) con sugerencias cuando no se puede alcanzar.',
    'cli.server.status.help.check_every_server': 'Comprobar todos los servidores',
    'cli.server.status.help.details_one_server': 'Detalles de un servidor',
    'cli.server.status.help.same_server_status': 'Igual que server status',
    'cli.server.status.help.details_node': 'Detalles de node',
    'cli.server.commands.help.shared_marker':
        'en varios servidores: se ejecuta en el servidor predeterminado (server use <name>), o pregunta',
    'cli.server.commands.help.local_marker':
        'un comando local tiene el mismo nombre: ejecútelo con el prefijo del servidor',
    'cli.server.commands.help.intro':
        'Lista los comandos que ofrece un servidor (todos los servidores, o uno). Ejecútelos por nombre, o con el servidor como prefijo: {example} siempre se ejecuta en node, también cuando otro servidor o un comando local se llama echo.',
    'cli.server.commands.help.commands_every_server': 'Comandos de cada servidor',
    'cli.server.commands.help.commands_one_server': 'Comandos de un servidor',
    'cli.server.commands.help.what_node_can_do': 'Qué puede hacer node',
    'cli.server.reconnect.help.reconnect_them_anyway': 'para volver a conectarlos de todos modos',
    'cli.server.reconnect.help.see_why': 'para ver por qué',
    'cli.server.reconnect.help.connect_servers_again_reload':
        'Vuelve a conectar con los servidores y recarga sus comandos, p. ej. después de reiniciar o actualizar un servidor. Sin nombre, se reintentan todos los servidores inaccesibles.',
    'cli.server.reconnect.help.retry_unreachable_servers': 'Reintentar los servidores inaccesibles',
    'cli.server.reconnect.help.reconnect_one_server': 'Volver a conectar un servidor',
    'cli.server.reconnect.help.reconnect_every_server': 'Volver a conectar todos los servidores',
    'cli.server.reconnect.help.same_server_reconnect': 'Igual que server reconnect',
    'cli.server.reconnect.help.reload_commands_node': 'Recargar los comandos de node',
    'cli.server.default.help.to_remove': 'para quitarlo',
    'cli.server.default.help.to_set_one': 'para fijar uno',
    'cli.server.default.help.default_server_runs_commands':
        'El servidor predeterminado ejecuta los comandos que tienen varios servidores (si no, se le pregunta cuál) y los comandos que necesitan un solo servidor, como server logs. Se recuerda entre recargas.',
    'cli.server.default.help.show_default_server': 'Mostrar el servidor predeterminado',
    'cli.server.default.help.set': 'Fijarlo',
    'cli.server.default.help.remove': 'Quitarlo',
    'cli.server.default.help.same_server_default_node': 'Igual que server default node',
    'cli.server.jobs.help.see_control_background_jobs':
        'Consulta y controla las tareas en segundo plano que se ejecutan en los servidores conectados: listarlas, ejecutar una ahora, pausarla o detenerla, leer su historial y registros, cambiar su configuración o ver los eventos en directo. Una tarea se elige por nombre (sin distinguir mayúsculas) o ID y se busca en todos los servidores conectados; las acciones se aplican a cada servidor que tiene la tarea, y --server limita un comando a uno.',
    'cli.server.jobs.help.same_server_jobs_list': 'Igual que server jobs list',
    'cli.server.jobs.help.live_job_events': 'Eventos de tareas en directo',
    'cli.server.jobs.help.all_jobs': 'Todas las tareas',
    'cli.server.jobs.help.run_cleanup_job_now': 'Ejecutar ahora la tarea cleanup',
    'cli.server.jobs.help.failed_runs': 'Sus ejecuciones fallidas',
    'cli.server.jobs.help.last_run_output_node': 'Salida de la última ejecución, en node',
    'cli.server.jobs.list.help.list_jobs_every_connected':
        'Lista las tareas de todos los servidores conectados: grupo, estado, programación, última y próxima ejecución, y cuánto duró la última. Con varios servidores, cada uno tiene su propia tabla.',
    'cli.server.jobs.list.help.jobs_all_connected_servers':
        'Tareas de todos los servidores conectados',
    'cli.server.jobs.list.help.only_one_group': 'Solo un grupo',
    'cli.server.jobs.list.help.jobs_node_server': 'Tareas del servidor node',
    'cli.server.jobs.list.help.jobs_reports_group': 'Tareas del grupo reports',
    'cli.server.jobs.info.help.show_everything_about_one':
        'Muestra todo sobre una tarea: programación, reintentos, tiempo límite, política de solapamiento, la ejecución en curso y el resultado de la última. La tarea se encuentra por nombre (sin distinguir mayúsculas) o ID.',
    'cli.server.jobs.info.help.details_cleanup_job': 'Detalles de la tarea cleanup',
    'cli.server.jobs.trigger.help.run_job_now_without':
        'Ejecuta una tarea ahora, sin esperar a su próxima hora programada. Su programación no cambia.',
    'cli.server.jobs.trigger.help.run_cleanup_now': 'Ejecutar cleanup ahora',
    'cli.server.jobs.trigger.help.then_read_output': 'Luego leer su salida',
    'cli.server.jobs.pause.help.stop_running_job_schedule':
        'Deja de ejecutar una tarea según su programación hasta que se reanude. Use cancel o stop para una ejecución que ya está en curso.',
    'cli.server.jobs.pause.help.hold_cleanup': 'Retener cleanup',
    'cli.server.jobs.pause.help.put_back_schedule': 'Volver a programarla',
    'cli.server.jobs.resume.help.put_paused_job_back':
        'Vuelve a poner una tarea pausada en su programación.',
    'cli.server.jobs.resume.help.run_cleanup_schedule_again':
        'Volver a ejecutar cleanup según su programación',
    'cli.server.jobs.stop.help.take_job_off_schedule':
        'Quita una tarea de su programación y cancela la ejecución en curso, si la hay.',
    'cli.server.jobs.stop.help.stop_cleanup_completely': 'Detener cleanup por completo',
    'cli.server.jobs.cancel.help.cancel_run_progress_job':
        'Cancela la ejecución en curso de una tarea. La tarea sigue programada y se ejecuta de nuevo la próxima vez.',
    'cli.server.jobs.cancel.help.abort_current_cleanup_run':
        'Abortar la ejecución actual de cleanup',
    'cli.server.jobs.history.help.list_past_runs_job':
        'Lista las ejecuciones pasadas de una tarea: estado, hora de inicio, duración, intento de reintento y el comienzo del mensaje de error. Use el ID corto con logs --exec para leer la salida de una ejecución.',
    'cli.server.jobs.history.help.last_20_runs': 'Las últimas 20 ejecuciones',
    'cli.server.jobs.history.help.page_through_older_runs': 'Recorrer las ejecuciones anteriores',
    'cli.server.jobs.history.help.only_failed_runs': 'Solo las ejecuciones fallidas',
    'cli.server.jobs.history.help.last_5_runs': 'Las últimas 5 ejecuciones',
    'cli.server.jobs.logs.help.print_log_entries_latest':
        'Muestra las entradas de registro de la última ejecución de una tarea, o de una ejecución elegida por su ID de ejecución (del historial).',
    'cli.server.jobs.logs.help.logs_latest_run': 'Registros de la última ejecución',
    'cli.server.jobs.logs.help.logs_one_run': 'Registros de una ejecución',
    'cli.server.jobs.logs.help.what_last_cleanup_run':
        'Lo que mostró la última ejecución de cleanup',
    'cli.server.jobs.edit.help.change_job_step_step':
        'Cambia una tarea paso a paso: descripción, grupo, programación cron o intervalo, reintentos máximos, tiempo límite y política de solapamiento (skip, queue o cancel). Pulse Enter para conservar un valor y Ctrl+C o Escape para cancelar; no cambia nada hasta que confirme. Una tarea en varios servidores necesita --server.',
    'cli.server.jobs.edit.help.edit_cleanup_server_has':
        'Editar cleanup en el servidor que la tiene',
    'cli.server.jobs.watch.help.follow_job_events_they':
        'Sigue los eventos de tareas a medida que ocurren (iniciada, completada, fallida, etc.) en todos los servidores conectados, una línea por evento. Pulse Ctrl+C para detener.',
    'cli.server.jobs.watch.help.events_all_connected_servers':
        'Eventos de todos los servidores conectados',
    'cli.server.jobs.watch.help.only_events_node': 'Solo eventos de node',
    'cli.ssh.description': 'Abrir una sesión de shell remota en un servidor',
    'cli.ssh.help.open_interactive_shell_server':
        'Abre un shell interactivo en un servidor, en este terminal, o ejecuta allí un comando y muestra su salida. Solo se pueden usar servidores que habilitan su shell; con el plugin users se necesita el permiso shell:execute. Sin nombre, ssh usa el único servidor con shell, si no el servidor predeterminado, si no pregunta cuál.',
    'cli.ssh.help.shell_default_only_server': 'Shell en el servidor predeterminado (o único)',
    'cli.ssh.help.shell_server_exit_ctrl': 'Shell en un servidor (exit o Ctrl+D para salir)',
    'cli.ssh.help.run_one_command_print': 'Ejecutar un comando y mostrar su salida',
    'cli.ssh.help.same_ssh': 'Igual que ssh <name>',
    'cli.ssh.help.interactive_shell_node': 'Shell interactivo en node',
    'cli.ssh.help.one_command_node': 'Un comando en node',
    'cli.ssh.help.same_ssh_2': 'Igual que ssh',
    'cli.events.description': 'Ver, listar y emitir eventos del bus de eventos',
    'cli.events.watch.description': 'Mostrar los eventos en cuanto ocurren (Ctrl+C para parar)',
    'cli.events.log.description': 'Mostrar los eventos recientes (en memoria, no se guardan)',
    'cli.events.emit.description': 'Emitir un evento: events emit <tipo> [json]',
    'cli.events.watch.help.intro': 'Muestra los eventos a medida que ocurren, hasta Ctrl+C',
    'cli.events.watch.help.every_event': 'Todos los eventos',
    'cli.events.watch.help.namespace': 'Un espacio de nombres',
    'cli.events.watch.help.one_type': 'Un tipo',
    'cli.events.log.help.intro': 'Muestra los eventos más recientes, del más antiguo al más nuevo',
    'cli.events.log.help.last_20': 'Últimos 20 eventos',
    'cli.events.log.help.last_50_server': 'Últimos 50 eventos del servidor',
    'cli.events.emit.help.intro': 'Emite un evento, p. ej. para probar un plugin que lo escucha',
    'cli.events.help.commands': 'Comandos:',
    'cli.events.help.print_live': 'Mostrar eventos en directo',
    'cli.events.help.recent': 'Eventos recientes',
    'cli.events.help.emit': 'Emitir un evento',
    'cli.events.help.patterns':
        'Patrones: un tipo exacto (package:installed), un espacio de nombres (package:*) o * para todos.',
    'cli.events.help.in_memory':
        'Los eventos se guardan en memoria solo para este terminal; no se conserva nada.',

    // ── Capture ──────────────────────────────────────────────────────
    'cli.capture.description': 'Exportar la salida del terminal a un archivo descargable',
    'cli.capture.help.save_what_terminal_including':
        'Guarda lo que hay en el terminal, incluido el historial de desplazamiento, como un archivo que descarga el navegador. HTML conserva el fondo y el color de texto del tema; txt es texto plano. Los colores de cada línea no se conservan.',
    'cli.capture.help.everything_terminal_html': 'Todo como terminal-<timestamp>.html',
    'cli.capture.help.plain_text_file': 'Archivo de texto plano',
    'cli.capture.help.only_last_n_lines': 'Solo las últimas n líneas',
    'cli.capture.help.downloads_session_txt': 'Descarga session.txt',
    'cli.capture.help.last_50_lines_html': 'Las últimas 50 líneas como HTML',
    'cli.capture.help.same_capture': 'Igual que capture',

    // ── Diff ─────────────────────────────────────────────────────────
    'cli.diff.description': 'Comparar archivos línea por línea',
    'cli.diff.help.compare_two_texts_line':
        'Compara dos textos línea por línea: las líneas añadidas se muestran en verde con +, las eliminadas en rojo con -, con algunas líneas sin cambios alrededor de cada cambio como contexto.',
    'cli.diff.help.compare_two_texts': 'Comparar dos textos',
    'cli.diff.help.only_changed_lines': 'Solo las líneas modificadas',
    'cli.diff.help.one_line_changed': 'Una línea modificada',
    'cli.diff.help.prints_no_differences_found': 'Muestra: No differences found',
    'cli.diff.help.compare_two_files_line':
        'Compara dos archivos línea por línea y muestra qué cambió: las líneas que empiezan por < (o -) están solo en el primer archivo, las que empiezan por > (o +) solo en el segundo.',
    'cli.diff.help.show_differences': 'Mostrar las diferencias',
    'cli.diff.help.unified_format_context': 'Formato unificado con contexto',
    'cli.diff.help.what_changed_between_versions': 'Qué cambió entre versiones',
    'cli.diff.help.review_edits_git_style': 'Revisar ediciones, al estilo git',
    'cli.diff.help.ignore_upper_lower_case': 'Ignorar mayúsculas y minúsculas',

    // ── Font Size ────────────────────────────────────────────────────
    'cli.font-size.description': 'Ajustar el tamaño de fuente del terminal',
    'cli.font-size.reset.description': 'Restablecer el tamaño de fuente predeterminado',
    'cli.font-size.set.description': 'Establecer un tamaño de fuente concreto',
    'cli.font-size.help.intro':
        'Aumenta o reduce el texto del terminal, de {min}px a {max}px. El tamaño elegido se guarda y se restaura la próxima vez que se abra el terminal; reset vuelve al tamaño con el que empezó la página.',
    'cli.font-size.help.show_current_size': 'Mostrar el tamaño actual',
    'cli.font-size.help.bigger_smaller_by': 'Más grande o más pequeño en {step}px',
    'cli.font-size.help.exact_size': 'Tamaño exacto en píxeles ({min}-{max})',
    'cli.font-size.help.back_default_size': 'Volver al tamaño predeterminado',
    'cli.font-size.help.use_16px_text': 'Usar texto de 16px',
    'cli.font-size.help.grow_by': 'Aumentar en {step}px',
    'cli.font-size.help.forget_saved_size': 'Olvidar el tamaño guardado',

    // ── Snippet ──────────────────────────────────────────────────────
    'cli.snippet.description': 'Guardar y reutilizar plantillas de comandos con parámetros',
    'cli.snippet.list.description': 'Listar todos los snippets guardados',
    'cli.snippet.save.description': 'Guardar un nuevo snippet: snippet save <name> "<template>"',
    'cli.snippet.show.description': 'Mostrar la plantilla de un snippet: snippet show <name>',
    'cli.snippet.delete.description': 'Eliminar un snippet: snippet delete <name>',
    'cli.snippet.run.description':
        'Ejecutar un snippet con valores de variables: snippet run <name> var1=val1 var2=val2',
    'cli.snippet.help.save_command_lines_you':
        'Guarda como plantillas con nombre las líneas de comandos que usa a menudo, con {{placeholders}} que se rellenan al ejecutarlas. Los snippets se guardan en el navegador y los comparten todos sus terminales y pestañas.',
    'cli.snippet.help.save_replace_snippet': 'Guardar (o reemplazar) un snippet',
    'cli.snippet.help.fill_placeholders_run': 'Rellenar los marcadores y ejecutarlo',
    'cli.snippet.help.all_saved_snippets': 'Todos los snippets guardados',
    'cli.snippet.help.print_snippet': 'Mostrar un snippet',
    'cli.snippet.help.delete_snippet_rm_remove': 'Eliminar un snippet (rm, remove)',
    'cli.snippet.help.template_placeholder': 'Una plantilla con un marcador',
    'cli.snippet.help.runs_echo_hello_ada': 'Ejecuta: echo Hello Ada',
    'cli.snippet.help.quote_values_spaces': 'Entrecomillar valores con espacios',

    // ── Test ─────────────────────────────────────────────────────────
    'cli.test.description': 'Evaluar una condición (estado de salida 0 si es verdadera)',
    'cli.test.help.expressions': 'Expresiones:',
    'cli.test.help.empty_not_empty': 'vacío / no vacío',
    'cli.test.help.equal_not_equal': 'igual / distinto',
    'cli.test.help.integer_comparison': 'comparación de enteros',
    'cli.test.help.exists_file_directory': 'existe / archivo / directorio',

    // ── Kill ─────────────────────────────────────────────────────────
    'cli.kill.description': 'Terminar un proceso en ejecución por PID',
    'cli.kill.help.stop_running_process_pid':
        'Detiene un proceso en ejecución por su PID, tal como lo muestra ps. Un comando se cancela, un servicio en segundo plano se detiene. Solo se pueden terminar procesos en ejecución; después aparecen como killed con código de salida -9.',
    'cli.kill.help.stop_process_pid': 'Detener el proceso con ese PID',
    'cli.kill.help.find_pid': 'Buscar el PID',
    'cli.kill.help.stop_process_3': 'Detener el proceso 3',

    // ── Pkg ──────────────────────────────────────────────────────────
    'cli.pkg.description': 'Gestionar paquetes en la CLI',
    'cli.pkg.ls.description': 'Listar todos los paquetes de la CLI',
    'cli.pkg.browse.description':
        'Listar todos los paquetes disponibles de todos los orígenes configurados',
    'cli.pkg.add.description': 'Añadir un paquete a la CLI, p. ej. pkg add guid.',
    'cli.pkg.remove.description': 'Eliminar un paquete de la CLI',
    'cli.pkg.versions.description': 'Mostrar todas las versiones publicadas de un paquete',
    'cli.pkg.check.description': 'Buscar actualizaciones de los paquetes instalados',
    'cli.pkg.update.description':
        'Actualizar un paquete de la CLI a la última versión o actualizar todos los paquetes',
    'cli.pkg.source.description': 'Consultar o definir el origen de paquetes para las descargas',
    'cli.pkg.source.get.description': 'Mostrar el CDN actual',
    'cli.pkg.source.set.description':
        'Definir el origen de paquetes preferido (interactivo si no se indica nombre)',
    'cli.pkg.help.list_installed_packages': 'Listar los paquetes instalados',
    'cli.pkg.help.browse_all_available_packages': 'Explorar todos los paquetes disponibles',
    'cli.pkg.help.install_package': 'Instalar un paquete',
    'cli.pkg.help.remove_package': 'Eliminar un paquete',
    'cli.pkg.help.show_all_published_versions': 'Mostrar todas las versiones publicadas',
    'cli.pkg.help.check_available_updates': 'Buscar actualizaciones disponibles',
    'cli.pkg.help.update_one_all_packages': 'Actualizar uno o todos los paquetes',
    'cli.pkg.help.get_set_package_source': 'Consultar o definir el origen de paquetes',
    'cli.pkg.help.install_qodalis_cli_guid': 'Instalar @qodalis/cli-guid',
    'cli.pkg.help.install_multiple_packages': 'Instalar varios paquetes',
    'cli.pkg.help.update_all_packages': 'Actualizar todos los paquetes',
    'cli.pkg.browse.help.install_package': 'para instalar un paquete',
    'cli.pkg.add.help.short_name': 'Nombre corto',
    'cli.pkg.add.help.full_name': 'Nombre completo',
    'cli.pkg.add.help.multiple_packages': 'Varios paquetes',
    'cli.pkg.add.help.specific_version': 'Versión concreta',
    'cli.pkg.remove.help.remove_one_package': 'Eliminar un paquete',
    'cli.pkg.remove.help.remove_multiple': 'Eliminar varios',
    'cli.pkg.remove.help.short_alias': 'Alias corto',
    'cli.pkg.versions.help.short_name': 'Nombre corto',
    'cli.pkg.versions.help.full_name': 'Nombre completo',
    'cli.pkg.check.help.apply_updates': 'para aplicar las actualizaciones',
    'cli.pkg.update.help.update_latest': 'Actualizar a la última versión',
    'cli.pkg.update.help.update_specific_version': 'Actualizar a una versión concreta',
    'cli.pkg.update.help.update_all_packages': 'Actualizar todos los paquetes',
    'cli.pkg.update.help.install_specific_version': 'Instalar una versión concreta',
    'cli.pkg.source.help.change': 'para cambiarlo',
    'cli.pkg.source.help.show_current_source': 'Mostrar el origen actual',
    'cli.pkg.source.help.set_preferred_source': 'Definir el origen preferido',
    'cli.pkg.help.install_package_2': 'para instalar un paquete',

    // ── Ps ───────────────────────────────────────────────────────────
    'cli.ps.description': 'Listar procesos en ejecución y recientes',
    'cli.ps.help.list_processes_terminal_commands':
        'Lista los procesos de este terminal: comandos, servicios en segundo plano, daemons y tareas. Los que están en ejecución se muestran junto con los terminados, fallidos y detenidos recientemente (los últimos 50), con su código de salida y hace cuánto empezaron.',
    'cli.ps.help.all_processes_oldest_first': 'Todos los procesos, del más antiguo al más nuevo',
    'cli.ps.help.what_running_now': 'Qué se está ejecutando ahora',
    'cli.ps.help.stop_process_12_pid': 'Detener el proceso 12 de la columna PID',

    // ── Cron ─────────────────────────────────────────────────────────
    'cli.cron.description': 'Programar comandos para ejecutarse a intervalos repetidos',
    'cli.cron.add.description': 'Añadir una tarea cron: cron add <name> <interval> <command>',
    'cli.cron.list.description': 'Listar todas las tareas cron',
    'cli.cron.remove.description': 'Eliminar una tarea cron: cron remove <name>',
    'cli.cron.enable.description': 'Activar una tarea cron pausada',
    'cli.cron.disable.description': 'Pausar una tarea cron sin eliminarla',
    'cli.cron.help.run_command_again_again':
        'Ejecuta un comando una y otra vez a intervalos fijos mientras el terminal está abierto. Las tareas se guardan: vuelven a iniciarse al arrancar el terminal y se pueden pausar sin eliminarlas.',
    'cli.cron.help.add_job': 'Añadir una tarea',
    'cli.cron.help.jobs_interval_status_run':
        'Tareas con intervalo, estado y número de ejecuciones (ls)',
    'cli.cron.help.pause_job': 'Pausar una tarea',
    'cli.cron.help.resume_paused_job': 'Reanudar una tarea pausada',
    'cli.cron.help.remove_job_rm_delete': 'Eliminar una tarea (rm, delete)',
    'cli.cron.help.intervals_seconds_30_hours':
        'Intervalos: segundos (30), u horas, minutos y segundos (1h, 5m, 1h30m, 90s); mínimo 10 segundos.',
    'cli.cron.help.every_5_minutes': 'Cada 5 minutos',
    'cli.cron.help.every_hour_half': 'Cada hora y media',
    'cli.cron.help.pause': 'Pausarla',

    // ── Binary ───────────────────────────────────────────────────────
    'cli.binary.long_description': 'Codificar y decodificar cadenas binarias',
    'cli.binary.utf8_note': 'Admite codificación de texto UTF-8',
    'cli.binary.encode_desc': 'Texto a binario',
    'cli.binary.decode_desc': 'Binario a texto',

    // ── Morse ────────────────────────────────────────────────────────
    'cli.morse.long_description': 'Codificar y decodificar código Morse',
    'cli.morse.note': 'Admite letras, números y signos de puntuación comunes',
    'cli.morse.encode_desc': 'Texto a Morse',
    'cli.morse.decode_desc': 'Morse a texto',

    // ── Rot ──────────────────────────────────────────────────────────
    'cli.rot.long_description': 'Aplicar el cifrado ROT (rotación) a un texto',
    'cli.rot.note': 'Por defecto es ROT13 (autoinverso: aplicarlo dos veces devuelve el original)',
    'cli.rot.default_desc': 'Aplicar ROT13',
    'cli.rot.shift_desc': 'Aplicar ROT-N',

    // ── Awk ──────────────────────────────────────────────────────────
    'cli.awk.description': 'Búsqueda de patrones y procesamiento de texto',
    'cli.awk.help.process_text_records_fields':
        'Procesa texto como registros y campos: cada línea se divide en campos $1, $2, ... ($0 es la línea completa) y cada regla ejecuta su { action } en las líneas que coinciden. Admite bloques BEGIN y END, patrones /regex/ y de comparación de campos, print, variables, NR y NF. Ponga el programa entre comillas; uno sencillo también funciona sin ellas (awk {print $1} file).',
    'cli.awk.help.run_program_over_file': 'Ejecutar un programa sobre un archivo',
    'cli.awk.help.split_fields_instead_spaces': 'Separar campos por <sep> en lugar de por espacios',
    'cli.awk.help.run_program_over_piped': 'Ejecutar un programa sobre la entrada canalizada',
    'cli.awk.help.print_first_column': 'Mostrar la primera columna',
    'cli.awk.help.second_column_csv': 'Segunda columna de un CSV',
    'cli.awk.help.filter_rows_field': 'Filtrar filas por un campo',
    'cli.awk.help.sum_second_column': 'Sumar la segunda columna',

    // ── Basename ─────────────────────────────────────────────────────
    'cli.basename.description': 'Quitar el directorio de una ruta',
    'cli.basename.help.print_last_part_path':
        'Muestra la última parte de una ruta, el nombre del archivo o directorio, sin los directorios anteriores. Si se indica un sufijo, también se quita del final.',
    'cli.basename.help.name_without_directories': 'Nombre sin los directorios',
    'cli.basename.help.also_remove_trailing_suffix': 'Quitar también un sufijo final',
    'cli.basename.help.prints_notes_txt': 'Muestra notes.txt',
    'cli.basename.help.prints_notes': 'Muestra notes',
    'cli.basename.help.prints_user': 'Muestra user',

    // ── Cat ──────────────────────────────────────────────────────────
    'cli.cat.description': 'Mostrar el contenido de archivos',
    'cli.cat.help.print_contents_one_more':
        'Muestra el contenido de uno o más archivos, unidos en orden, o de la entrada canalizada. Canalice la salida a otros comandos para buscar, ordenar o contar.',
    'cli.cat.help.print_files_one_after': 'Mostrar archivos uno tras otro',
    'cli.cat.help.send_file_another_command': 'Enviar un archivo a otro comando',
    'cli.cat.help.show_whole_file': 'Mostrar el archivo completo',
    'cli.cat.help.show_only_lines_error': 'Mostrar solo las líneas con error',
    'cli.cat.help.print_lines_sorted': 'Mostrar las líneas ordenadas',

    // ── Cd ───────────────────────────────────────────────────────────
    'cli.cd.description': 'Cambiar el directorio de trabajo actual',
    'cli.cd.help.change_current_directory_without':
        'Cambia el directorio actual. Sin ruta, va a su directorio personal. Las rutas pueden ser absolutas (/...), relativas a donde está, o empezar por ~ para el directorio personal.',
    'cli.cd.help.go_home_directory': 'Ir a su directorio personal',
    'cli.cd.help.go_directory': 'Entrar en un directorio',
    'cli.cd.help.go_up_one_level': 'Subir un nivel',
    'cli.cd.help.go_docs_home': 'Ir a docs en su directorio personal',
    'cli.cd.help.go_sibling_directory': 'Ir a un directorio hermano',
    'cli.cd.help.go_root': 'Ir a la raíz',

    // ── Chmod ────────────────────────────────────────────────────────
    'cli.chmod.description': 'Cambiar los permisos de archivos',
    'cli.chmod.help.change_who_can_read':
        'Cambia quién puede leer (r), escribir (w) y ejecutar (x) un archivo. Use un modo octal como 755 o uno simbólico: quién (u usuario, g grupo, o otros, a todos), luego + para añadir, - para quitar o = para fijar, y después los permisos.',
    'cli.chmod.help.set_permissions': 'Establecer permisos',
    'cli.chmod.help.apply_directory_everything': 'Aplicar a un directorio y a todo su contenido',
    'cli.chmod.help.rw_r_r_owner': 'rw-r--r--: el propietario escribe, los demás leen',
    'cli.chmod.help.let_owner_execute': 'Permitir que el propietario lo ejecute',
    'cli.chmod.help.take_away_write_group': 'Quitar la escritura al grupo y a otros',
    'cli.chmod.help.set_whole_directory_tree': 'Establecer un árbol de directorios completo',

    // ── Chown ────────────────────────────────────────────────────────
    'cli.chown.description': 'Cambiar el propietario y el grupo de archivos',
    'cli.chown.help.change_owner_group_files':
        'Cambia el propietario y/o el grupo de los archivos. Indique usuario, usuario:grupo, usuario: (solo propietario) o :grupo (solo grupo).',
    'cli.chown.help.change_owner_group_if': 'Cambiar el propietario y, si se indica, el grupo',
    'cli.chown.help.change_only_group': 'Cambiar solo el grupo',
    'cli.chown.help.apply_directory_everything': 'Aplicar a un directorio y a todo su contenido',
    'cli.chown.help.make_alice_owner': 'Hacer a alice propietaria',
    'cli.chown.help.set_owner_group': 'Establecer propietario y grupo',
    'cli.chown.help.give_bob_whole_directory': 'Dar a bob un directorio completo',

    // ── Cp ───────────────────────────────────────────────────────────
    'cli.cp.description': 'Copiar archivos y directorios',
    'cli.cp.help.copy_file_new_path':
        'Copia un archivo a una nueva ruta, o dentro de un directorio existente. Copiar un directorio requiere -r, que copia todo su contenido. Un archivo que ya exista en el destino se reemplaza.',
    'cli.cp.help.copy_file_new_name': 'Copiar un archivo con un nombre nuevo',
    'cli.cp.help.copy_files_directory': 'Copiar archivos a un directorio',
    'cli.cp.help.copy_directory_contents': 'Copiar un directorio y su contenido',
    'cli.cp.help.make_backup_copy': 'Hacer una copia de seguridad',
    'cli.cp.help.copy_docs': 'Copiar a ~/docs',
    'cli.cp.help.duplicate_whole_directory': 'Duplicar un directorio completo',

    // ── Cut ──────────────────────────────────────────────────────────
    'cli.cut.description': 'Extraer columnas o campos de cada línea de un archivo',
    'cli.cut.help.print_selected_parts_each':
        'Muestra partes seleccionadas de cada línea: campos separados por un delimitador (-f, tabulador por defecto) o posiciones de caracteres (-c). Una lista puede ser de números sueltos, rangos o ambos, como 1,3 o 2-4 o 3-.',
    'cli.cut.help.select_fields': 'Seleccionar campos',
    'cli.cut.help.select_character_positions': 'Seleccionar posiciones de caracteres',
    'cli.cut.help.cut_piped_input': 'Cortar la entrada canalizada',
    'cli.cut.help.first_third_csv_column': 'Primera y tercera columna de un CSV',
    'cli.cut.help.first_10_characters_each': 'Los primeros 10 caracteres de cada línea',
    'cli.cut.help.first_two_fields_split': 'Los dos primeros campos separados por :',

    // ── Dirname ──────────────────────────────────────────────────────
    'cli.dirname.description': 'Quitar el último componente de una ruta',
    'cli.dirname.help.print_directory_part_path':
        'Muestra la parte de directorio de una ruta, todo lo anterior a la última /. Un nombre simple sin / da . (el directorio actual).',
    'cli.dirname.help.path_without_last_part': 'La ruta sin su última parte',
    'cli.dirname.help.prints_home_user': 'Muestra /home/user',
    'cli.dirname.help.prints': 'Muestra .',
    'cli.dirname.help.prints_2': 'Muestra /',

    // ── Du ───────────────────────────────────────────────────────────
    'cli.du.description': 'Estimar el espacio usado por archivos',
    'cli.du.help.show_how_much_space':
        'Muestra cuánto espacio usan los archivos y directorios, en bytes. Para un directorio, se lista cada subdirectorio con su tamaño total; use -s para ver solo el total o -d para limitar la profundidad.',
    'cli.du.help.sizes_path_default_current':
        'Tamaños de una ruta (por defecto: el directorio actual) y sus subdirectorios',
    'cli.du.help.only_total': 'Solo el total',
    'cli.du.help.only_levels_deep': 'Solo <n> niveles de profundidad',
    'cli.du.help.size_each_directory_docs': 'Tamaño de cada directorio en ~/docs',
    'cli.du.help.total_home_k_m': 'Total de su directorio personal en K/M/G',
    'cli.du.help.size_each_top_level': 'Tamaño de cada carpeta de primer nivel',

    // ── Find ─────────────────────────────────────────────────────────
    'cli.find.description': 'Buscar archivos y directorios por nombre o tipo',
    'cli.find.help.list_files_directories_under':
        'Lista archivos y directorios bajo una ruta (el directorio actual por defecto), buscando en todos los subdirectorios. La propia ruta de inicio se lista primero. Filtre por nombre con un patrón glob (* y ?; --name distingue mayúsculas, --iname no) o por tipo.',
    'cli.find.help.list_everything_under_path': 'Listar todo bajo una ruta',
    'cli.find.help.match_names_against_glob': 'Filtrar nombres con un patrón glob',
    'cli.find.help.same_ignoring_case': 'Igual, sin distinguir mayúsculas',
    'cli.find.help.only_files_f_directories': 'Solo archivos (f) o directorios (d)',
    'cli.find.help.list_everything_docs': 'Listar todo en ~/docs',
    'cli.find.help.find_all_txt_files': 'Buscar todos los archivos .txt',
    'cli.find.help.directories_near_top': 'Directorios cercanos a la raíz',
    'cli.find.help.delete_all_tmp_files': 'Eliminar todos los archivos .tmp',

    // ── Grep ─────────────────────────────────────────────────────────
    'cli.grep.description': 'Buscar un patrón en el contenido de archivos',
    'cli.grep.help.print_lines_match_pattern':
        'Muestra las líneas que coinciden con un patrón. El patrón es una expresión regular, las coincidencias se resaltan y la entrada puede ser archivos, directorios (con -r) o texto canalizado.',
    'cli.grep.help.search_one_more_files': 'Buscar en uno o más archivos',
    'cli.grep.help.search_every_file_under': 'Buscar en todos los archivos de un directorio',
    'cli.grep.help.filter_piped_input': 'Filtrar la entrada canalizada',
    'cli.grep.help.case_insensitive_search': 'Búsqueda sin distinguir mayúsculas',
    'cli.grep.help.find_todos_line_numbers': 'Buscar TODO con números de línea',
    'cli.grep.help.hide_comment_lines': 'Ocultar las líneas de comentario',
    'cli.grep.help.count_matching_lines': 'Contar las líneas que coinciden',

    // ── Head ─────────────────────────────────────────────────────────
    'cli.head.description': 'Mostrar las primeras líneas de un archivo',
    'cli.head.help.print_first_lines_file':
        'Muestra las primeras líneas de un archivo, 10 por defecto. También funciona con entrada canalizada. Con varios archivos, cada uno lleva un encabezado ==> name <==.',
    'cli.head.help.first_10_lines': 'Las primeras 10 líneas',
    'cli.head.help.first_lines': 'Las primeras <count> líneas',
    'cli.head.help.first_lines_piped_input': 'Las primeras líneas de la entrada canalizada',
    'cli.head.help.show_start_file': 'Mostrar el inicio de un archivo',
    'cli.head.help.first_3_lines_each': 'Las primeras 3 líneas de cada archivo',
    'cli.head.help.first_20_lines_log': 'Las primeras 20 líneas del registro',

    // ── Ln ───────────────────────────────────────────────────────────
    'cli.ln.description': 'Crear enlaces simbólicos',
    'cli.ln.help.create_symbolic_link_new':
        'Crea un enlace simbólico: una nueva ruta que apunta a otro archivo o directorio. Solo se admiten enlaces simbólicos (-s) y el destino no tiene que existir todavía.',
    'cli.ln.help.create_pointing': 'Crear <link> apuntando a <target>',
    'cli.ln.help.shortcut_file': 'Acceso directo a un archivo',
    'cli.ln.help.shortcut_directory': 'Acceso directo a un directorio',

    // ── Mkdir ────────────────────────────────────────────────────────
    'cli.mkdir.description': 'Crear directorios',
    'cli.mkdir.help.create_new_directory_p':
        'Crea un nuevo directorio. Con -p, también se crean los directorios padre que falten.',
    'cli.mkdir.help.create_one_more_directories': 'Crear uno o más directorios',
    'cli.mkdir.help.create_directory_missing_parents':
        'Crear un directorio y sus padres que falten',
    'cli.mkdir.help.create_projects_current_directory': 'Crear projects en el directorio actual',
    'cli.mkdir.help.create_whole_path_once': 'Crear toda la ruta de una vez',

    // ── Mv ───────────────────────────────────────────────────────────
    'cli.mv.description': 'Mover o renombrar archivos y directorios',
    'cli.mv.help.move_rename_file_directory':
        'Mueve o renombra un archivo o directorio. Si el destino es un directorio existente, el origen se mueve dentro de él; si no, se renombra. Un archivo que ya exista en el destino se reemplaza.',
    'cli.mv.help.rename_file_directory': 'Renombrar un archivo o directorio',
    'cli.mv.help.move_them_directory': 'Moverlos a un directorio',
    'cli.mv.help.rename_file': 'Renombrar un archivo',
    'cli.mv.help.move_docs': 'Moverlo a ~/docs',
    'cli.mv.help.rename_directory': 'Renombrar un directorio',

    // ── Paste ────────────────────────────────────────────────────────
    'cli.paste.description': 'Combinar líneas de archivos en paralelo',
    'cli.paste.help.join_files_side_side':
        'Une archivos en paralelo: la línea 1 de cada archivo va en una línea de salida, separadas por un tabulador, luego la línea 2, y así sucesivamente. Con -s, cada archivo se une en una sola línea. La entrada canalizada se lee como el archivo - (o como única entrada si no se indica ningún archivo); -d toma una lista de delimitadores que se usan por turnos.',
    'cli.paste.help.merge_files_line_line': 'Combinar archivos línea a línea',
    'cli.paste.help.join_all_lines_file': 'Unir todas las líneas de un archivo en una',
    'cli.paste.help.merge_piped_input_file': 'Combinar la entrada canalizada con un archivo',
    'cli.paste.help.two_columns_tab_separated': 'Dos columnas separadas por tabulador',
    'cli.paste.help.merge_comma_separated': 'Combinar separando por comas',
    'cli.paste.help.turn_list_one_csv': 'Convertir una lista en una línea CSV',

    // ── Pwd ──────────────────────────────────────────────────────────
    'cli.pwd.description': 'Mostrar el directorio de trabajo actual',
    'cli.pwd.help.print_full_path_directory':
        'Muestra la ruta completa del directorio en el que está. Las rutas relativas de otros comandos parten de aquí.',
    'cli.pwd.help.show_current_directory': 'Mostrar el directorio actual',
    'cli.pwd.help.example_home_user': 'Por ejemplo /home/user',
    'cli.pwd.help.prints_home_user_docs': 'Muestra /home/user/docs',

    // ── Rm ───────────────────────────────────────────────────────────
    'cli.rm.description': 'Eliminar archivos o directorios',
    'cli.rm.help.delete_file_directories_only':
        'Elimina un archivo. Los directorios solo se eliminan con -r, que borra todo su contenido. Los archivos eliminados no se pueden recuperar.',
    'cli.rm.help.delete_one_more_files': 'Eliminar uno o más archivos',
    'cli.rm.help.delete_directory_contents': 'Eliminar un directorio y su contenido',
    'cli.rm.help.delete_without_error_if': 'Eliminar sin error si no existe',
    'cli.rm.help.delete_one_file': 'Eliminar un archivo',
    'cli.rm.help.delete_whole_directory': 'Eliminar un directorio completo',
    'cli.rm.help.quiet_if_file_does': 'Sin avisos si el archivo no existe',

    // ── Rmdir ────────────────────────────────────────────────────────
    'cli.rmdir.description': 'Eliminar directorios vacíos',
    'cli.rmdir.help.remove_empty_directory_refuses':
        'Elimina un directorio vacío. Se niega a eliminar un directorio que aún contiene archivos; use rm -r para eso.',
    'cli.rmdir.help.remove_empty_directories': 'Eliminar directorios vacíos',
    'cli.rmdir.help.remove_directory_current_one': 'Eliminar un directorio dentro del actual',
    'cli.rmdir.help.remove_full_path': 'Eliminar por ruta completa',

    // ── Sed ──────────────────────────────────────────────────────────
    'cli.sed.description': 'Editor de flujo para filtrar y transformar texto',
    'cli.sed.help.edit_text_line_line':
        'Edita texto línea a línea con un script: sustituir (s/old/new/), eliminar (d), mostrar (p) o salir (q), opcionalmente limitado a un número de línea, un rango (1,5, 3,$ o /start/,/end/) o las líneas que coinciden con /regex/; ! después de una dirección la invierte y ; separa comandos. El reemplazo puede usar & (la coincidencia) y \\1 a \\9 (grupos, escritos \\(...\\) o, con -E, (...)). Lee archivos o entrada canalizada y muestra el resultado, o reescribe los archivos con -i.',
    'cli.sed.help.print_edited_file': 'Mostrar el archivo editado',
    'cli.sed.help.save_edits_file': 'Guardar las ediciones en el archivo',
    'cli.sed.help.print_only_selected_lines': 'Mostrar solo las líneas seleccionadas',
    'cli.sed.help.edit_piped_input': 'Editar la entrada canalizada',
    'cli.sed.help.replace_every_cat_dog': 'Sustituir cada cat por dog',
    'cli.sed.help.edit_file_place': 'Editar el archivo en su sitio',
    'cli.sed.help.drop_comment_lines': 'Descartar las líneas de comentario',
    'cli.sed.help.print_lines_1_5': 'Mostrar las líneas 1 a 5',
    'cli.sed.help.swap_two_words': 'Intercambiar dos palabras',

    // ── Sh ───────────────────────────────────────────────────────────
    'cli.sh.description': 'Ejecutar un archivo de script',
    'cli.sh.help.requires_execute': '(requiere permiso de ejecución)',
    'cli.sh.help.script_syntax': 'Sintaxis de scripts:',
    'cli.sh.help.comments': 'Las líneas que empiezan por # son comentarios',
    'cli.sh.help.several_commands': 'Varios comandos en una línea',
    'cli.sh.help.assignment': 'Asignación de variables',
    'cli.sh.help.substitution': 'Sustitución de variables',
    'cli.sh.help.stop_on_error': 'Detener en caso de error (por defecto)',
    'cli.sh.help.continue_on_errors': 'Continuar en caso de errores',
    'cli.sh.help.exit': 'Detener el script con estado n',
    'cli.sh.help.control_flow': 'Control de flujo:',
    'cli.sh.help.until': '(until cmd: lo contrario)',
    'cli.sh.help.break_continue': 'Salir / saltar en un bucle',
    'cli.sh.help.negate': 'Negar el estado de salida',
    'cli.sh.help.conditions': 'Las condiciones son comandos:',
    'cli.sh.help.conditions_status':
        '(estado 0 = verdadero; véase help test). Los bucles se detienen tras 10000 iteraciones',
    'cli.sh.help.conditions_loops': 'de while/until; Ctrl+C detiene el script.',
    'cli.sh.help.example_script': 'Script de ejemplo:',

    // ── Sort ─────────────────────────────────────────────────────────
    'cli.sort.description': 'Ordenar las líneas de archivos de texto',
    'cli.sort.help.sort_lines_file_piped':
        'Ordena las líneas de un archivo o de la entrada canalizada, alfabéticamente por defecto. Ordene numéricamente, a la inversa, por un campo, o descarte duplicados. Varios archivos se ordenan juntos en una sola lista.',
    'cli.sort.help.sort_lines_alphabetically': 'Ordenar líneas alfabéticamente',
    'cli.sort.help.sort_field_split': 'Ordenar por el campo <n>, separado por <sep>',
    'cli.sort.help.sort_piped_input': 'Ordenar la entrada canalizada',
    'cli.sort.help.z': 'De la A a la Z',
    'cli.sort.help.largest_number_first': 'El número mayor primero',
    'cli.sort.help.sort_csv_second_column': 'Ordenar un CSV por su segunda columna',
    'cli.sort.help.sorted_without_duplicates': 'Ordenado, sin duplicados',

    // ── Stat ─────────────────────────────────────────────────────────
    'cli.stat.description': 'Mostrar los metadatos de un archivo o directorio',
    'cli.stat.help.show_details_about_files':
        'Muestra detalles de archivos o directorios: ruta completa, tamaño, tipo, permisos, propietario, grupo, y cuándo se creó y se modificó por última vez.',
    'cli.stat.help.show_details_each_path': 'Mostrar los detalles de cada ruta',
    'cli.stat.help.details_one_file': 'Detalles de un archivo',
    'cli.stat.help.several_paths_once': 'Varias rutas a la vez',

    // ── Tac ──────────────────────────────────────────────────────────
    'cli.tac.description': 'Mostrar un archivo con las líneas en orden inverso',
    'cli.tac.help.print_file_lines_reverse':
        'Muestra un archivo con sus líneas en orden inverso, la última primero. También funciona con entrada canalizada.',
    'cli.tac.help.print_file_bottom_top': 'Mostrar un archivo de abajo arriba',
    'cli.tac.help.reverse_piped_input': 'Invertir la entrada canalizada',
    'cli.tac.help.newest_log_lines_first': 'Las líneas más recientes del registro primero',
    'cli.tac.help.reverse_list': 'Invertir una lista',

    // ── Tail ─────────────────────────────────────────────────────────
    'cli.tail.description': 'Mostrar las últimas líneas de un archivo',
    'cli.tail.help.print_last_lines_file':
        'Muestra las últimas líneas de un archivo, 10 por defecto. También funciona con entrada canalizada. Con varios archivos, cada uno lleva un encabezado ==> name <==.',
    'cli.tail.help.last_10_lines': 'Las últimas 10 líneas',
    'cli.tail.help.last_lines': 'Las últimas <count> líneas',
    'cli.tail.help.last_lines_piped_input': 'Las últimas líneas de la entrada canalizada',
    'cli.tail.help.show_end_log': 'Mostrar el final de un registro',
    'cli.tail.help.last_5_lines': 'Las últimas 5 líneas',
    'cli.tail.help.last_20_lines_log': 'Las últimas 20 líneas del registro',

    // ── Tee ──────────────────────────────────────────────────────────
    'cli.tee.description': 'Copiar la entrada canalizada a archivos y a la salida',
    'cli.tee.help.pass_piped_input_through':
        'Deja pasar la entrada canalizada sin cambios y guarda una copia en cada archivo indicado, sobrescribiéndolos o añadiendo con -a. Como el tee de Unix, solo lee entrada canalizada: para copiar un archivo, canalícelo con cat.',
    'cli.tee.help.show_piped_output_save': 'Mostrar la salida canalizada y guardarla',
    'cli.tee.help.append_instead_overwriting': 'Añadir en lugar de sobrescribir',
    'cli.tee.help.show_save_copy': 'Mostrar y guardar una copia',
    'cli.tee.help.add_line_log': 'Añadir una línea a un registro',
    'cli.tee.help.copy_source_txt_txt': 'Copiar source.txt a a.txt y b.txt',

    // ── Touch ────────────────────────────────────────────────────────
    'cli.touch.description': 'Crear un archivo vacío o actualizar su marca de tiempo',
    'cli.touch.help.create_empty_file_update':
        'Crea un archivo vacío, o actualiza la fecha de modificación de un archivo que ya existe. El directorio padre debe existir.',
    'cli.touch.help.create_files_refresh_their':
        'Crear los archivos, o actualizar sus marcas de tiempo',
    'cli.touch.help.create_empty_notes_txt': 'Crear un notes.txt vacío',
    'cli.touch.help.create_file_docs': 'Crear un archivo en ~/docs',

    // ── Tr ───────────────────────────────────────────────────────────
    'cli.tr.description': 'Traducir o eliminar caracteres de la entrada canalizada',
    'cli.tr.help.translate_characters_set1_matching':
        'Traduce caracteres de SET1 a los caracteres correspondientes de SET2, los elimina (-d) o reduce las repeticiones a uno (-s). Los conjuntos pueden usar rangos como a-z y clases como [:upper:], [:lower:], [:digit:], [:alpha:], [:alnum:] y [:space:]. Se entienden las secuencias de escape \\n, \\t y \\\\. Como el tr de Unix, solo lee entrada canalizada y no admite archivos como operandos: para transformar un archivo, canalícelo con cat.',
    'cli.tr.help.replace_characters': 'Reemplazar caracteres',
    'cli.tr.help.delete_characters': 'Eliminar caracteres',
    'cli.tr.help.squeeze_repeated_characters': 'Reducir caracteres repetidos',
    'cli.tr.help.convert_file_upper_case': 'Convertir un archivo a mayúsculas',
    'cli.tr.help.upper_case_piped_text': 'Pasar a mayúsculas el texto canalizado',
    'cli.tr.help.remove_all_digits': 'Eliminar todos los dígitos',
    'cli.tr.help.collapse_runs_spaces': 'Reducir series de espacios',

    // ── Tree ─────────────────────────────────────────────────────────
    'cli.tree.description': 'Mostrar la estructura de directorios en árbol',
    'cli.tree.help.draw_directory_everything_below':
        'Dibuja un directorio y todo lo que contiene como un árbol, con los directorios primero, seguido del número de directorios y archivos. Por defecto, el directorio actual.',
    'cli.tree.help.show_whole_tree': 'Mostrar el árbol completo',
    'cli.tree.help.only_levels_deep': 'Solo <n> niveles de profundidad',
    'cli.tree.help.tree_current_directory': 'Árbol del directorio actual',
    'cli.tree.help.tree_docs': 'Árbol de ~/docs',
    'cli.tree.help.top_two_levels_only': 'Solo los dos primeros niveles',

    // ── Uniq ─────────────────────────────────────────────────────────
    'cli.uniq.description': 'Filtrar las líneas duplicadas adyacentes de un archivo',
    'cli.uniq.help.collapse_repeated_lines_next':
        'Reduce a una las líneas repetidas que están contiguas. Solo se fusionan los duplicados adyacentes, así que ordene antes la entrada para detectarlos todos.',
    'cli.uniq.help.drop_adjacent_duplicate_lines': 'Descartar las líneas duplicadas adyacentes',
    'cli.uniq.help.filter_piped_input': 'Filtrar la entrada canalizada',
    'cli.uniq.help.collapse_repeated_lines': 'Reducir las líneas repetidas',
    'cli.uniq.help.count_how_often_each': 'Contar cuántas veces aparece cada línea',
    'cli.uniq.help.show_only_duplicated_lines': 'Mostrar solo las líneas duplicadas',

    // ── Wc ───────────────────────────────────────────────────────────
    'cli.wc.description': 'Mostrar el número de líneas, palabras y caracteres',
    'cli.wc.help.count_lines_words_characters':
        'Cuenta líneas, palabras y caracteres en archivos o en la entrada canalizada. Con varios archivos, al final se muestra una línea de total.',
    'cli.wc.help.lines_words_characters': 'Líneas, palabras y caracteres',
    'cli.wc.help.only_line_count': 'Solo el número de líneas',
    'cli.wc.help.count_piped_input': 'Contar la entrada canalizada',
    'cli.wc.help.all_three_counts': 'Los tres recuentos',
    'cli.wc.help.line_counts_total': 'Recuento de líneas con un total',
    'cli.wc.help.how_many_lines_mention': 'Cuántas líneas mencionan error',

    // ── Xargs ────────────────────────────────────────────────────────
    'cli.xargs.description': 'Construir y ejecutar comandos a partir de la entrada de un archivo',
    'cli.xargs.help.run_command_arguments_taken':
        'Ejecuta un comando con argumentos tomados de la entrada, separados por espacios o saltos de línea. Por defecto todos se añaden a un solo comando; -n lo ejecuta por lotes y -I lo ejecuta una vez por línea, sustituyendo un marcador. Las opciones de xargs van antes del comando; todo lo que sigue, incluidos los flags, pertenece al comando. La entrada es texto canalizado o, sin canalización, el último archivo indicado.',
    'cli.xargs.help.append_input_lines': 'Añadir las líneas de entrada a <cmd>',
    'cli.xargs.help.run_once_per_line': 'Ejecutar <cmd> una vez por línea',
    'cli.xargs.help.read_arguments_file': 'Leer los argumentos de un archivo',
    'cli.xargs.help.delete_every_tmp_file': 'Eliminar todos los archivos .tmp',
    'cli.xargs.help.copy_each_listed_file': 'Copiar cada archivo listado',
    'cli.xargs.help.one_mkdir_per_line': 'Un mkdir por línea',
    'cli.xargs.help.inner_command_keeps_flags': 'El comando interno conserva sus flags',

    // ── Markdown ─────────────────────────────────────────────────────
    'cli.md.description': 'Mostrar Markdown en el terminal',
    'cli.md.help.show_markdown_formatted_terminal':
        'Muestra Markdown con formato en el terminal: encabezados, negrita y cursiva, listas, citas, código y enlaces. Pase el texto en línea (con o sin comillas, \\n inicia una nueva línea) o canalícelo desde otro comando.',
    'cli.md.help.render_inline_text': 'Mostrar texto en línea',
    'cli.md.help.same_optional_render_verb':
        'Igual, con el verbo opcional render (también preview, view)',
    'cli.md.help.render_output_command': 'Mostrar la salida de un comando',
    'cli.md.help.heading': 'Un encabezado',
    'cli.md.help.several_lines': 'Varias líneas',
    'cli.md.help.piped_text': 'Texto canalizado',
    'cli.md.help.same_using_aliases': 'Igual, usando alias',

    // ── Todo ─────────────────────────────────────────────────────────
    'cli.todo.description':
        'Gestione sus tareas desde el terminal. Añada, liste, edite, complete y elimine elementos TODO.',
    'cli.todo.ls.description': 'Listar los elementos TODO',
    'cli.todo.add.description': 'Añadir una nueva tarea',
    'cli.todo.edit.description': 'Editar el texto o la fecha de vencimiento de una tarea',
    'cli.todo.done.description': 'Marcar una tarea como hecha',
    'cli.todo.toggle.description': 'Alternar una tarea entre hecha y pendiente',
    'cli.todo.rm.description': 'Eliminar una tarea por ID',
    'cli.todo.help.commands': 'Comandos:',
    'cli.todo.help.list_all': 'Listar todas las tareas',
    'cli.todo.help.list_pending': 'Listar solo las tareas pendientes',
    'cli.todo.help.list_completed': 'Listar solo las tareas completadas',
    'cli.todo.help.list_overdue': 'Listar solo las tareas vencidas',
    'cli.todo.help.add': 'Añadir una nueva tarea',
    'cli.todo.help.add_due': 'Añadir con fecha de vencimiento',
    'cli.todo.help.edit': 'Editar una tarea',
    'cli.todo.help.done': 'Marcar una tarea como hecha',
    'cli.todo.help.toggle': 'Alternar hecha/pendiente',
    'cli.todo.help.remove': 'Eliminar una tarea',
    'cli.todo.help.remove_all': 'Eliminar todas las tareas',
    'cli.todo.help.due_formats': 'Formatos de fecha de vencimiento:',

    // ── True ─────────────────────────────────────────────────────────
    'cli.true.description': 'No hacer nada, con éxito (estado de salida 0)',

    // ── False ────────────────────────────────────────────────────────
    'cli.false.description': 'No hacer nada, sin éxito (estado de salida 1)',

    // ── Htop ─────────────────────────────────────────────────────────
    'cli.htop.description': 'Monitor interactivo de procesos y servicios',
};
