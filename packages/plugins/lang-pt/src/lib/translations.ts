/**
 * Portuguese (Brazilian) translations for Qodalis CLI.
 */
export const ptTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Uso:',
    'cli.common.examples': 'Exemplos:',

    // ── Help ─────────────────────────────────────────────────────────
    'cli.help.description': 'Exibe ajuda para um comando',
    'cli.help.long_description': 'Exibe informações de ajuda para comandos',
    'cli.help.shortcuts': 'Atalhos',
    'cli.help.type': 'Digite',
    'cli.help.help_command': 'help <comando>',
    'cli.help.for_details': 'para informações detalhadas',
    'cli.help.unknown_command': 'Comando desconhecido: {command}',
    'cli.help.see_all': 'para ver todos os comandos disponíveis',
    'cli.help.extension_chain': 'Cadeia de extensões',
    'cli.help.subcommands': 'Subcomandos',
    'cli.help.options': 'Opções',
    'cli.help.global_options': 'Opções globais',
    'cli.help.requires_server': 'Requer um servidor conectado',
    'cli.help.aliases': 'Aliases:',
    'cli.help.required': '(obrigatório)',
    'cli.help.show_all': 'Mostrar todos os comandos disponíveis',
    'cli.help.show_details': 'Mostrar detalhes de um comando',
    'cli.help.show_sub_details': 'Mostrar detalhes de um subcomando',
    'cli.help.example_pkg': 'Ajuda do gerenciador de pacotes',
    'cli.help.example_theme': 'Ajuda do subcomando theme apply',

    // ── Configure ────────────────────────────────────────────────────
    'cli.configure.description': 'Gerenciar configuração do sistema e plugins',
    'cli.configure.long_description':
        'Gerenciar configuração do sistema e plugins interativamente ou via subcomandos',
    'cli.configure.open_menu': 'Abrir menu de configuração interativo',
    'cli.configure.list_opts': 'Listar todas as opções de configuração',
    'cli.configure.get_value': 'Obter um valor de configuração',
    'cli.configure.set_value': 'Definir um valor de configuração',
    'cli.configure.reset_defaults': 'Redefinir configuração para os padrões',
    'cli.configure.system': 'Sistema',
    'cli.configure.exit': 'Sair',
    'cli.configure.back': 'Voltar',
    'cli.configure.current_value': 'Valor atual:',
    'cli.configure.invalid_value': 'Valor inválido',
    'cli.configure.set_to': '{label} definido como {value}',
    'cli.configure.invalid_format_get':
        'Formato inválido. Use: configure get <categoria.chave>',
    'cli.configure.unknown_key': 'Chave de configuração desconhecida: {path}',
    'cli.configure.invalid_format_set':
        'Formato inválido. Use: configure set <categoria.chave> <valor>',
    'cli.configure.set_success': '{path} definido como {value}',
    'cli.configure.system_reset': 'Configuração do sistema redefinida para os padrões',
    'cli.configure.unknown_category': 'Categoria desconhecida: {category}',
    'cli.configure.category_reset':
        'Configuração de "{category}" redefinida para os padrões',
    'cli.configure.reset_confirm': 'Redefinir toda a configuração para os padrões?',
    'cli.configure.reset_cancelled': 'Redefinição cancelada',
    'cli.configure.all_reset': 'Toda a configuração redefinida para os padrões',
    'cli.configure.invalid_number': 'Número inválido: {value}',
    'cli.configure.invalid_options': 'Valor inválido. Opções válidas: {options}',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Imprime o texto especificado',
    'cli.echo.long_description': 'Imprime o texto especificado no terminal',
    'cli.echo.piping_note': 'Suporta saída de texto e objetos JSON via pipes',

    // ── Clear ─────────────────────────────────────────────────────────
    'cli.clear.description': 'Limpar o terminal',
    'cli.clear.long_description': 'Limpa todo o conteúdo da tela do terminal',
    'cli.clear.shortcut': 'Atalho:',

    // ── Version ───────────────────────────────────────────────────────
    'cli.version.description': 'Exibir informações da versão',
    'cli.version.long_description':
        'Exibe a versão atual do CLI e o link para a documentação',

    // ── Uname ─────────────────────────────────────────────────────────
    'cli.uname.long_description':
        'Exibe informações detalhadas do sistema e navegador, incluindo:',
    'cli.uname.cli_versions': 'Versões do núcleo e bibliotecas do CLI',
    'cli.uname.browser_info':
        'Nome do navegador, versão, user agent, idioma e plataforma',
    'cli.uname.os': 'Sistema operacional',

    // ── Hash ──────────────────────────────────────────────────────────
    'cli.hash.description': 'Gerar resumos hash de texto',
    'cli.hash.long_description':
        'Gerar resumos hash criptográficos usando a API Web Crypto',

    // ── Cal ───────────────────────────────────────────────────────────
    'cli.cal.description': 'Exibir um calendário',
    'cli.cal.long_description': 'Exibir um calendário mensal',
    'cli.cal.highlight_note': 'O dia atual está destacado',
    'cli.cal.current_month': 'Mês atual',
    'cli.cal.specific_month': 'Mês específico',

    // ── Time ──────────────────────────────────────────────────────────
    'cli.time.description': 'Exibir hora local e UTC atual',
    'cli.time.long_description': 'Exibir hora local e UTC atual',
    'cli.time.show_current': 'Exibir hora local e UTC atual',

    // ── Uptime ────────────────────────────────────────────────────────
    'cli.uptime.description': 'Exibir tempo de atividade da sessão',
    'cli.uptime.long_description':
        'Exibe há quanto tempo a sessão atual do terminal está ativa',

    // ── Convert ───────────────────────────────────────────────────────
    'cli.convert.description': 'Converter entre unidades (comprimento, peso, temperatura, dados)',
    'cli.convert.long_description': 'Converter entre várias unidades de medida',
    'cli.convert.supported': 'Suportados:',

    // ── Eval ──────────────────────────────────────────────────────────
    'cli.eval.description': 'Avaliar uma expressão JavaScript',
    'cli.eval.long_description': 'Avaliar uma expressão JavaScript',
    'cli.eval.supports':
        'Suporta aritmética, strings, arrays, objetos e qualquer JS válido',

    // ── Seq ───────────────────────────────────────────────────────────
    'cli.seq.description': 'Imprimir uma sequência de números',
    'cli.seq.long_description': 'Imprimir uma sequência de números',
    'cli.seq.numbers_to_end': 'Números de 1 até o final',
    'cli.seq.numbers_range': 'Números do início ao final',
    'cli.seq.with_step': 'Com passo personalizado',

    // ── Lorem ─────────────────────────────────────────────────────────
    'cli.lorem.description': 'Gerar texto de preenchimento lorem ipsum',
    'cli.lorem.long_description': 'Gerar texto de preenchimento lorem ipsum',
    'cli.lorem.gen_words': 'Gerar palavras',
    'cli.lorem.gen_sentences': 'Gerar frases',
    'cli.lorem.gen_paragraphs': 'Gerar parágrafos',

    // ── Alias / Unalias ──────────────────────────────────────────────
    'cli.alias.description': 'Gerenciar aliases de comandos',
    'cli.alias.long_description': 'Criar atalhos de alias para comandos frequentes',
    'cli.alias.create_new': 'Criar um novo alias',
    'cli.alias.list_all': 'Listar todos os aliases',
    'cli.alias.remove_hint': 'Use {command} para remover um alias',
    'cli.unalias.description': 'Remover aliases de comandos',
    'cli.unalias.long_description': 'Remover um alias de comando definido anteriormente',

    // ── Open ──────────────────────────────────────────────────────────
    'cli.open.description': 'Abrir URL em nova aba do navegador',
    'cli.open.long_description': 'Abrir URL em nova aba do navegador',
    'cli.open.auto_https': 'Adiciona automaticamente https:// se nenhum protocolo for especificado',

    // ── Color ─────────────────────────────────────────────────────────
    'cli.color.description': 'Converter e visualizar cores (hex, rgb, hsl)',
    'cli.color.long_description': 'Converter entre formatos de cor e visualizar cores',
    'cli.color.supported_formats': 'Formatos suportados:',

    // ── History ───────────────────────────────────────────────────────
    'cli.history.long_description': 'Exibe o histórico de comandos da sessão atual',
    'cli.history.show': 'Mostrar histórico de comandos',
    'cli.history.search': 'Pesquisar no histórico por padrão',
    'cli.history.clear': 'Limpar todo o histórico',
    'cli.history.arrow_hint':
        'Use as teclas de seta {keys} para navegar pelo histórico',
    'cli.history.prefix_hint':
        'Digite um prefixo e pressione {key} para pesquisar no histórico por prefixo',

    // ── Theme ─────────────────────────────────────────────────────────
    'cli.theme.description': 'Interagir com o tema',
    'cli.theme.long_description':
        'Personalizar a aparência do terminal com temas e cores',

    // ── Hex ───────────────────────────────────────────────────────────
    'cli.hex.description': 'Codificar/decodificar hex e conversões de base numérica',
    'cli.hex.long_description':
        'Codificar/decodificar texto em hexadecimal e converter números entre bases',
    'cli.hex.text_to_hex': 'Texto para hexadecimal',
    'cli.hex.hex_to_text': 'Hexadecimal para texto',
    'cli.hex.base_conversion': 'Conversão de base',

    // ── Feedback ──────────────────────────────────────────────────────
    'cli.feedback.long_description':
        'Reportar bugs, solicitar funcionalidades ou sugerir novos comandos — interativamente ou inline.',

    // ── JWT ───────────────────────────────────────────────────────────
    'cli.jwt.description': 'Decodificar e inspecionar tokens JWT',
    'cli.jwt.long_description': 'Decodificar e inspecionar JSON Web Tokens (JWT)',
    'cli.jwt.decode_display': 'Decodificar e exibir conteúdo do JWT',
    'cli.jwt.shows': 'Mostra: cabeçalho, payload, status de expiração, data de emissão',

    // ── Sleep ─────────────────────────────────────────────────────────
    'cli.sleep.description': 'Pausar execução por um tempo especificado',
    'cli.sleep.long_description':
        'Pausa a execução pela duração especificada (em milissegundos)',

    // ── Services ──────────────────────────────────────────────────────
    'cli.services.description': 'Gerenciar serviços em segundo plano e tarefas',
    'cli.services.long_description': 'Gerenciar serviços em segundo plano e tarefas',
    'cli.services.list_desc': 'Listar todos os serviços',
    'cli.services.start_desc': 'Iniciar um serviço',
    'cli.services.stop_desc': 'Parar um serviço',
    'cli.services.restart_desc': 'Reiniciar um serviço',
    'cli.services.logs_desc': 'Ver logs do serviço',
    'cli.services.info_desc': 'Detalhes do serviço',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Repetir uma string continuamente',
    'cli.yes.long_description': 'Repetir uma string continuamente',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'Copiar ou colar da área de transferência',
    'cli.clipboard.long_description':
        'Copiar texto para a área de transferência do sistema ou colar texto dela',
    'cli.clipboard.copy_desc': 'Copiar texto para a área de transferência',
    'cli.clipboard.paste_desc': 'Colar da área de transferência',

    // ── Hotkeys ───────────────────────────────────────────────────────
    'cli.hotkeys.description': 'Exibir informações de teclas de atalho',
    'cli.hotkeys.long_description':
        'Exibe todos os atalhos de teclado e teclas de atalho disponíveis',

    // ── Export / Unset / Env ──────────────────────────────────────────
    'cli.export.description': 'Definir variáveis de ambiente',
    'cli.export.long_description': 'Definir ou exibir variáveis de ambiente',
    'cli.export.show_all': 'Mostrar todas as variáveis',
    'cli.export.set_var': 'Definir uma variável',
    'cli.export.set_spaces': 'Definir com espaços',
    'cli.unset.description': 'Remover variáveis de ambiente',
    'cli.unset.long_description': 'Remover uma variável de ambiente',
    'cli.env.description': 'Exibir variáveis de ambiente',
    'cli.env.long_description': 'Exibir variáveis de ambiente',
    'cli.env.show_all': 'Mostrar todas as variáveis',
    'cli.env.show_single': 'Mostrar uma variável',

    // ── URL ───────────────────────────────────────────────────────────
    'cli.url.description': 'Codificar ou decodificar URLs',
    'cli.url.long_description': 'Codificar, decodificar e analisar URLs',
    'cli.url.encode_desc': 'Codificar uma string como URL',
    'cli.url.decode_desc': 'Decodificar uma string de URL',
    'cli.url.parse_desc': 'Analisar componentes de uma URL',

    // ── JSON ──────────────────────────────────────────────────────────
    'cli.json.description': 'Formatar, minificar ou validar JSON',
    'cli.json.long_description': 'Formatar, minificar ou validar strings JSON',
    'cli.json.format_desc': 'Formatar JSON com indentação',
    'cli.json.minify_desc': 'Remover espaços em branco',
    'cli.json.validate_desc': 'Verificar se é JSON válido',

    // ── Base64 ────────────────────────────────────────────────────────
    'cli.base64.description': 'Codificar ou decodificar strings Base64',
    'cli.base64.long_description': 'Codificar e decodificar strings Base64',
    'cli.base64.utf8_note': 'Suporta codificação de texto UTF-8',
    'cli.base64.encode_desc': 'Codificar texto para Base64',
    'cli.base64.decode_desc': 'Decodificar Base64 para texto',

    // ── Timestamp ─────────────────────────────────────────────────────
    'cli.timestamp.description': 'Converter entre timestamps Unix e datas',
    'cli.timestamp.long_description':
        'Converter entre timestamps Unix e datas legíveis',
    'cli.timestamp.current': 'Timestamp Unix atual',
    'cli.timestamp.to_date': 'Timestamp para data',
    'cli.timestamp.from_date': 'Data para timestamp',

    // ── Screen ────────────────────────────────────────────────────────
    'cli.screen.description': 'Exibir informações de tela e terminal',
    'cli.screen.long_description':
        'Exibir dimensões da tela, viewport e terminal',
    'cli.screen.shows':
        'Mostra: resolução, profundidade de cor, proporção de pixels, tamanho da janela, tamanho do terminal',

    // ── Random ────────────────────────────────────────────────────────
    'cli.random.description': 'Gerar valores aleatórios',
    'cli.random.long_description': 'Gerar números, strings, UUIDs aleatórios e mais',
    'cli.random.number_desc': 'Número aleatório (0-100)',
    'cli.random.string_desc': 'String aleatória (16 caracteres)',
    'cli.random.uuid_desc': 'UUID v4 aleatório',
    'cli.random.coin_desc': 'Jogar uma moeda',
    'cli.random.dice_desc': 'Jogar um dado',

    // ── Ping ──────────────────────────────────────────────────────────
    'cli.ping.description': 'Enviar pings tipo ICMP para um host',
    'cli.ping.long_description':
        'Enviar pings HTTP tipo ICMP para um host e exibir estatísticas de ida e volta',
    'cli.ping.ctrl_c': 'Pressione Ctrl+C para parar e exibir estatísticas.',

    // ── Nano ──────────────────────────────────────────────────────────
    'cli.nano.description': 'Abrir editor de texto integrado',
    'cli.nano.long_description': 'Abrir editor de texto estilo nano integrado',
    'cli.nano.open_empty': 'Abrir buffer vazio',
    'cli.nano.open_file': 'Abrir ou criar um arquivo',
    'cli.nano.keyboard_shortcuts': 'Atalhos de teclado:',

    // ── Debug ─────────────────────────────────────────────────────────
    'cli.debug.description': 'Exibir diagnósticos detalhados do sistema e internos do CLI',
    'cli.debug.long_description':
        'Exibe diagnósticos detalhados do sistema e internos do CLI.',
    'cli.debug.hidden_note':
        'Este comando está oculto na lista de ajuda mas é acessível diretamente.',
    'cli.debug.summary': 'Resumo do sistema',
    'cli.debug.processors': 'Todos os processadores registrados',
    'cli.debug.modules': 'Todos os módulos carregados',
    'cli.debug.state': 'Inspecionar armazenamentos de estado',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Gerenciar pacotes no CLI',
};
