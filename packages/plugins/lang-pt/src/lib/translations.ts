/**
 * Portuguese (Brazilian) translations for Qodalis CLI.
 */
export const ptTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Uso:',
    'cli.common.examples': 'Exemplos:',
    'cli.common.use_hint': 'Use {command} {action}',

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
    'cli.configure.invalid_boolean': 'Valor booleano inválido: "{value}". Use true ou false.',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Imprime o texto especificado',
    'cli.echo.long_description': 'Imprime o texto especificado no terminal',
    'cli.echo.piping_note': 'Suporta saída de texto e objetos JSON via pipes',
    'cli.echo.help.print_text_terminal_add':
        'Exibe texto no terminal. Adicione > file para salvá-lo em um arquivo (substituindo-o) ou >> file para adicioná-lo ao final.',
    'cli.echo.help.print_text': 'Exibir texto',
    'cli.echo.help.write_text_file': 'Gravar texto em um arquivo',
    'cli.echo.help.append_text_file': 'Acrescentar texto a um arquivo',
    'cli.echo.help.print_greeting': 'Exibir uma saudação',
    'cli.echo.help.create_replace_notes_txt': 'Criar ou substituir notes.txt',
    'cli.echo.help.add_line': 'Adicionar uma linha a ele',

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
    'cli.uname.description': 'Exibe informações detalhadas do sistema e do navegador',

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
    'cli.time.now.description': 'Exibe a hora atual',

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
    'cli.lorem.words.description': 'Gera um número de palavras',
    'cli.lorem.sentences.description': 'Gera um número de frases',
    'cli.lorem.paragraphs.description': 'Gera um número de parágrafos',

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
    'cli.history.description': 'Exibe o histórico de comandos da sessão atual',
    'cli.history.clear.description': 'Limpa o histórico de comandos',
    'cli.history.search.description': 'Pesquisa um padrão no histórico de comandos',

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
    'cli.feedback.report-bug.description': 'Relata um bug no GitHub',
    'cli.feedback.request-feature.description': 'Solicita um novo recurso no GitHub',
    'cli.feedback.request-command.description': 'Solicita um novo comando no GitHub',
    'cli.feedback.description': 'Permite que os usuários relatem bugs ou solicitem recursos',

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
    'cli.services.list.description': 'Lista todos os serviços em segundo plano registrados',
    'cli.services.start.description': 'Inicia um serviço em segundo plano',
    'cli.services.stop.description': 'Interrompe um serviço em segundo plano em execução',
    'cli.services.restart.description': 'Reinicia um serviço em segundo plano',
    'cli.services.logs.description': 'Mostra os logs de um serviço em segundo plano',
    'cli.services.info.description': 'Mostra informações detalhadas sobre um serviço',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Repetir uma string continuamente',
    'cli.yes.long_description': 'Repetir uma string continuamente',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'Copiar ou colar da área de transferência',
    'cli.clipboard.long_description':
        'Copiar texto para a área de transferência do sistema ou colar texto dela',
    'cli.clipboard.copy_desc': 'Copiar texto para a área de transferência',
    'cli.clipboard.paste_desc': 'Colar da área de transferência',
    'cli.clipboard.copy.description': 'Copiar texto para a área de transferência',
    'cli.clipboard.paste.description': 'Colar texto da área de transferência',

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
    'cli.export.set_many': 'Definir várias de uma vez',
    'cli.export.set_global': 'Definir para todos os usuários',
    'cli.export.set_session': 'Somente este terminal, não salvo',
    'cli.export.scopes':
        'Use variáveis como $VAR ou ${VAR}. Um valor definido neste terminal tem prioridade sobre o seu valor salvo, que tem prioridade sobre um compartilhado. env mostra a origem de cada um.',
    'cli.unset.description': 'Remover variáveis de ambiente',
    'cli.unset.long_description': 'Remover uma variável de ambiente',
    'cli.unset.own':
        'Remover para este terminal e para você (um valor compartilhado fica oculto para você)',
    'cli.unset.global': 'Remover o valor compartilhado',
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
    'cli.json.format.description': 'Formata JSON com indentação',
    'cli.json.minify.description': 'Minifica JSON removendo espaços em branco',
    'cli.json.validate.description': 'Valida se uma string é um JSON válido',

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
    'cli.timestamp.now.description': 'Mostra o timestamp Unix atual',
    'cli.timestamp.to-date.description': 'Converte um timestamp Unix em uma data',
    'cli.timestamp.from-date.description': 'Converte uma string de data em um timestamp Unix',

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
    'cli.random.number.description': 'Gera um número aleatório',
    'cli.random.string.description': 'Gera uma string aleatória',
    'cli.random.uuid.description': 'Gera um UUID v4 aleatório',
    'cli.random.coin.description': 'Joga uma moeda',
    'cli.random.dice.description': 'Joga um dado',

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
    'cli.debug.processors.description': 'Lista todos os processadores de comando registrados',
    'cli.debug.modules.description': 'Lista todos os módulos CLI carregados',
    'cli.debug.state.description': 'Inspeciona todos os stores de estado e seus valores',
    'cli.debug.services.description': 'Lista todos os serviços registrados no contêiner de DI',
    'cli.debug.environment.description':
        'Mostra informações do navegador, do terminal e do framework',
    'cli.debug.history.description': 'Mostra estatísticas do histórico de comandos',
    'cli.debug.health.description':
        'Verifica a saúde do sistema: armazenamento, conectividade, status dos processadores',
    'cli.debug.export.description': 'Exporta todas as informações de depuração como JSON',
    'cli.debug.servers.description': 'Lista os servidores configurados e o status da conexão',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Gerenciar pacotes no CLI',

    // ── Servers and events ───────────────────────────────────────────
    'cli.server.description': 'Gerenciar conexões com servidores CLI remotos',
    'cli.server.list.description': 'Mostrar os servidores com status, versão e comandos',
    'cli.server.status.description': 'Verificar se os servidores respondem (todos, ou um em detalhe)',
    'cli.server.commands.description': 'Mostrar os comandos de cada servidor',
    'cli.server.reconnect.description': 'Reconectar aos servidores e recarregar seus comandos',
    'cli.server.default.description': 'Mostrar ou definir o servidor que executa comandos compartilhados',
    'cli.server.jobs.description': 'Gerencia jobs em segundo plano nos servidores conectados',
    'cli.server.jobs.list.description': 'Lista todos os jobs nos servidores conectados',
    'cli.server.jobs.info.description': 'Mostra informações detalhadas sobre um job',
    'cli.server.jobs.trigger.description': 'Dispara a execução imediata de um job',
    'cli.server.jobs.pause.description': 'Pausa a execução agendada de um job',
    'cli.server.jobs.resume.description': 'Retoma um job pausado',
    'cli.server.jobs.stop.description':
        'Interrompe um job e cancela a execução atual, se estiver em andamento',
    'cli.server.jobs.cancel.description': 'Cancela a execução atual de um job',
    'cli.server.jobs.history.description': 'Mostra o histórico de execuções de um job',
    'cli.server.jobs.logs.description':
        'Mostra os logs da última execução ou de uma execução específica',
    'cli.server.jobs.edit.description': 'Edita interativamente as configurações de um job',
    'cli.server.jobs.watch.description': 'Visualização ao vivo de eventos de jobs via WebSocket',
    'cli.server.help.see_everything_you_can': 'para ver tudo o que você pode fazer',
    'cli.server.help.connect_terminal_remote_cli':
        'Conecta o terminal a servidores CLI remotos (.NET, Node.js, Python) e executa seus comandos.',
    'cli.server.help.by_name_or_prefix':
        'Os comandos de cada servidor estão disponíveis pelo nome ({byName}) e com o servidor como prefixo ({prefixed}). Quando vários servidores têm o mesmo comando, o servidor padrão o executa; sem um padrão, pergunta-se qual servidor usar. Um comando local com o mesmo nome tem prioridade: use o nome com prefixo. Um servidor que cai é tentado de novo a cada 30 segundos, e seus comandos voltam quando ele voltar.',
    'cli.server.help.overview_servers': 'Visão geral dos servidores',
    'cli.server.help.servers_status_version_commands': 'Servidores com status, versão e comandos',
    'cli.server.help.check_servers_reachable_all':
        'Verificar se os servidores respondem (todos, ou um em detalhe)',
    'cli.server.help.commands_each_server_provides': 'Comandos que cada servidor oferece',
    'cli.server.help.connect_again_unreachable_servers':
        'Conectar de novo (servidores inacessíveis, ou um)',
    'cli.server.help.show_set_server_shared':
        'Mostrar ou definir o servidor dos comandos compartilhados',
    'cli.server.help.open_shell_server_run':
        'Abrir um shell em um servidor, ou executar um comando',
    'cli.server.help.ping_node_show_details': 'Pingar node e mostrar seus detalhes',
    'cli.server.help.what_node_can_do': 'O que node pode fazer',
    'cli.server.help.run_echo_node_explicitly': 'Executar echo em node explicitamente',
    'cli.server.help.shared_commands_run_node': 'Comandos compartilhados são executados em node',
    'cli.server.help.retry_every_unreachable_server':
        'Tentar de novo todos os servidores inacessíveis',
    'cli.server.list.help.list_configured_servers_connection':
        'Lista os servidores configurados: status da conexão, URL, versão do servidor e da API, número de comandos e acesso ao shell.',
    'cli.server.list.help.see_why_server_unreachable':
        'para ver por que um servidor está inacessível, server reconnect para tentar de novo',
    'cli.server.status.help.details_server': 'para detalhes de um servidor',
    'cli.server.status.help.try_again': 'para tentar de novo',
    'cli.server.status.help.load_commands': 'para carregar seus comandos',
    'cli.server.status.help.see_commands': 'para ver seus comandos',
    'cli.server.status.help.ping_servers_without_name':
        'Faz ping nos servidores. Sem um nome, todos os servidores são verificados de uma vez com o tempo de resposta; com um nome, esse servidor é mostrado em detalhe (versões, SO, shell, streaming) com dicas quando não pode ser alcançado.',
    'cli.server.status.help.check_every_server': 'Verificar todos os servidores',
    'cli.server.status.help.details_one_server': 'Detalhes de um servidor',
    'cli.server.status.help.same_server_status': 'Igual a server status',
    'cli.server.status.help.details_node': 'Detalhes de node',
    'cli.server.commands.help.shared_marker':
        'em vários servidores: executa no servidor padrão (server use <name>), ou pergunta',
    'cli.server.commands.help.local_marker':
        'um comando local tem o mesmo nome: execute-o com o prefixo do servidor',
    'cli.server.commands.help.intro':
        'Lista os comandos que um servidor oferece (todos os servidores, ou um). Execute-os pelo nome, ou com o servidor como prefixo: {example} sempre executa em node, mesmo quando outro servidor ou um comando local se chama echo.',
    'cli.server.commands.help.commands_every_server': 'Comandos de todos os servidores',
    'cli.server.commands.help.commands_one_server': 'Comandos de um servidor',
    'cli.server.commands.help.what_node_can_do': 'O que node pode fazer',
    'cli.server.reconnect.help.reconnect_them_anyway': 'para reconectá-los mesmo assim',
    'cli.server.reconnect.help.see_why': 'para ver o motivo',
    'cli.server.reconnect.help.connect_servers_again_reload':
        'Conecta-se de novo aos servidores e recarrega seus comandos, por exemplo depois que um servidor foi reiniciado ou atualizado. Sem um nome, todos os servidores inacessíveis são tentados de novo.',
    'cli.server.reconnect.help.retry_unreachable_servers':
        'Tentar de novo os servidores inacessíveis',
    'cli.server.reconnect.help.reconnect_one_server': 'Reconectar um servidor',
    'cli.server.reconnect.help.reconnect_every_server': 'Reconectar todos os servidores',
    'cli.server.reconnect.help.same_server_reconnect': 'Igual a server reconnect',
    'cli.server.reconnect.help.reload_commands_node': 'Recarregar os comandos de node',
    'cli.server.default.help.to_remove': 'para removê-lo',
    'cli.server.default.help.to_set_one': 'para definir um',
    'cli.server.default.help.default_server_runs_commands':
        'O servidor padrão executa comandos que vários servidores têm (caso contrário pergunta-se qual usar) e comandos que precisam de um servidor, como server logs. Ele é lembrado entre recarregamentos.',
    'cli.server.default.help.show_default_server': 'Mostrar o servidor padrão',
    'cli.server.default.help.set': 'Defini-lo',
    'cli.server.default.help.remove': 'Removê-lo',
    'cli.server.default.help.same_server_default_node': 'Igual a server default node',
    'cli.server.jobs.help.see_control_background_jobs':
        'Veja e controle os jobs em segundo plano que rodam em servidores conectados: liste-os, execute um agora, pause ou interrompa, leia seu histórico e logs, altere suas configurações ou acompanhe eventos ao vivo. Um job é escolhido pelo nome (qualquer caixa) ou ID e procurado em todos os servidores conectados; as ações se aplicam a cada servidor que tem o job, e --server limita um comando a um servidor.',
    'cli.server.jobs.help.same_server_jobs_list': 'Igual a server jobs list',
    'cli.server.jobs.help.live_job_events': 'Eventos de jobs ao vivo',
    'cli.server.jobs.help.all_jobs': 'Todos os jobs',
    'cli.server.jobs.help.run_cleanup_job_now': 'Executar o job cleanup agora',
    'cli.server.jobs.help.failed_runs': 'Suas execuções com falha',
    'cli.server.jobs.help.last_run_output_node': 'Saída da última execução, em node',
    'cli.server.jobs.list.help.list_jobs_every_connected':
        'Lista os jobs de todos os servidores conectados: grupo, status, agenda, última e próxima execução e quanto tempo a última levou. Com vários servidores, cada um tem sua própria tabela.',
    'cli.server.jobs.list.help.jobs_all_connected_servers':
        'Jobs de todos os servidores conectados',
    'cli.server.jobs.list.help.only_one_group': 'Somente um grupo',
    'cli.server.jobs.list.help.jobs_node_server': 'Jobs do servidor node',
    'cli.server.jobs.list.help.jobs_reports_group': 'Jobs do grupo reports',
    'cli.server.jobs.info.help.show_everything_about_one':
        'Mostra tudo sobre um job: agenda, novas tentativas, tempo limite, política de sobreposição, a execução em andamento e o resultado da última execução. O job é encontrado pelo nome (qualquer caixa) ou ID.',
    'cli.server.jobs.info.help.details_cleanup_job': 'Detalhes do job cleanup',
    'cli.server.jobs.trigger.help.run_job_now_without':
        'Executa um job agora, sem esperar o próximo horário agendado. Sua agenda não muda.',
    'cli.server.jobs.trigger.help.run_cleanup_now': 'Executar cleanup agora',
    'cli.server.jobs.trigger.help.then_read_output': 'Depois ler sua saída',
    'cli.server.jobs.pause.help.stop_running_job_schedule':
        'Para de executar um job na agenda até ser retomado. Use cancel ou stop para uma execução que já está em andamento.',
    'cli.server.jobs.pause.help.hold_cleanup': 'Suspender cleanup',
    'cli.server.jobs.pause.help.put_back_schedule': 'Voltar à agenda',
    'cli.server.jobs.resume.help.put_paused_job_back':
        'Coloca um job pausado de volta na sua agenda.',
    'cli.server.jobs.resume.help.run_cleanup_schedule_again': 'Executar cleanup na agenda de novo',
    'cli.server.jobs.stop.help.take_job_off_schedule':
        'Tira um job da agenda e cancela a execução em andamento, se houver.',
    'cli.server.jobs.stop.help.stop_cleanup_completely': 'Interromper cleanup completamente',
    'cli.server.jobs.cancel.help.cancel_run_progress_job':
        'Cancela a execução em andamento de um job. O job continua na agenda e executa de novo no próximo horário.',
    'cli.server.jobs.cancel.help.abort_current_cleanup_run': 'Abortar a execução atual de cleanup',
    'cli.server.jobs.history.help.list_past_runs_job':
        'Lista as execuções passadas de um job: status, hora de início, duração, tentativa e o início da mensagem de erro. Use o ID curto com logs --exec para ler a saída de uma execução.',
    'cli.server.jobs.history.help.last_20_runs': 'As últimas 20 execuções',
    'cli.server.jobs.history.help.page_through_older_runs': 'Navegar por execuções mais antigas',
    'cli.server.jobs.history.help.only_failed_runs': 'Somente execuções com falha',
    'cli.server.jobs.history.help.last_5_runs': 'As últimas 5 execuções',
    'cli.server.jobs.logs.help.print_log_entries_latest':
        'Exibe as entradas de log da última execução de um job, ou de uma execução escolhida pelo ID de execução (do histórico).',
    'cli.server.jobs.logs.help.logs_latest_run': 'Logs da última execução',
    'cli.server.jobs.logs.help.logs_one_run': 'Logs de uma execução',
    'cli.server.jobs.logs.help.what_last_cleanup_run': 'O que a última execução de cleanup exibiu',
    'cli.server.jobs.edit.help.change_job_step_step':
        'Altera um job passo a passo: descrição, grupo, agenda cron ou intervalo, máximo de novas tentativas, tempo limite e política de sobreposição (skip, queue ou cancel). Pressione Enter para manter um valor e Ctrl+C ou Escape para cancelar; nada muda até você confirmar. Um job em vários servidores precisa de --server.',
    'cli.server.jobs.edit.help.edit_cleanup_server_has': 'Editar cleanup no servidor que o tem',
    'cli.server.jobs.watch.help.follow_job_events_they':
        'Acompanha eventos de jobs conforme acontecem (iniciado, concluído, com falha e assim por diante) em todos os servidores conectados, uma linha por evento. Pressione Ctrl+C para parar.',
    'cli.server.jobs.watch.help.events_all_connected_servers':
        'Eventos de todos os servidores conectados',
    'cli.server.jobs.watch.help.only_events_node': 'Somente eventos de node',
    'cli.ssh.description': 'Abrir uma sessão de shell remota em um servidor',
    'cli.ssh.help.open_interactive_shell_server':
        'Abre um shell interativo em um servidor, neste terminal, ou executa um comando nele e exibe a saída. Somente servidores que habilitam o shell podem ser usados; com o plugin users é necessária a permissão shell:execute. Sem um nome, ssh usa o único servidor com shell, senão o servidor padrão, senão pergunta qual usar.',
    'cli.ssh.help.shell_default_only_server': 'Shell no servidor padrão (ou único)',
    'cli.ssh.help.shell_server_exit_ctrl': 'Shell em um servidor (exit ou Ctrl+D para sair)',
    'cli.ssh.help.run_one_command_print': 'Executar um comando e exibir sua saída',
    'cli.ssh.help.same_ssh': 'Igual a ssh <name>',
    'cli.ssh.help.interactive_shell_node': 'Shell interativo em node',
    'cli.ssh.help.one_command_node': 'Um comando em node',
    'cli.ssh.help.same_ssh_2': 'Igual a ssh',
    'cli.events.description': 'Observar, listar e emitir eventos do barramento de eventos',
    'cli.events.watch.description': 'Mostrar os eventos assim que acontecem (Ctrl+C para parar)',
    'cli.events.log.description': 'Mostrar eventos recentes (em memória, não salvos)',
    'cli.events.emit.description': 'Emitir um evento: events emit <tipo> [json]',
    'cli.events.watch.help.intro': 'Exibe eventos conforme acontecem, até Ctrl+C',
    'cli.events.watch.help.every_event': 'Todos os eventos',
    'cli.events.watch.help.namespace': 'Um namespace',
    'cli.events.watch.help.one_type': 'Um tipo',
    'cli.events.log.help.intro': 'Mostra os eventos mais recentes, do mais antigo ao mais novo',
    'cli.events.log.help.last_20': 'Últimos 20 eventos',
    'cli.events.log.help.last_50_server': 'Últimos 50 eventos do servidor',
    'cli.events.emit.help.intro': 'Emite um evento, por exemplo para testar um plugin que o escuta',
    'cli.events.help.commands': 'Comandos:',
    'cli.events.help.print_live': 'Exibir eventos ao vivo',
    'cli.events.help.recent': 'Eventos recentes',
    'cli.events.help.emit': 'Emitir um evento',
    'cli.events.help.patterns':
        'Padrões: um tipo exato (package:installed), um namespace (package:*) ou * para todos.',
    'cli.events.help.in_memory':
        'Os eventos ficam na memória somente deste terminal; nada é persistido.',

    // ── Capture ──────────────────────────────────────────────────────
    'cli.capture.description': 'Exporta a saída do terminal para um arquivo para download',
    'cli.capture.help.save_what_terminal_including':
        'Salva o que está no terminal, incluindo o histórico de rolagem, como um arquivo baixado pelo navegador. HTML mantém o fundo do tema e a cor do texto; txt é texto simples. As cores de cada linha não são mantidas.',
    'cli.capture.help.everything_terminal_html': 'Tudo como terminal-<timestamp>.html',
    'cli.capture.help.plain_text_file': 'Arquivo de texto simples',
    'cli.capture.help.only_last_n_lines': 'Somente as últimas n linhas',
    'cli.capture.help.downloads_session_txt': 'Baixa session.txt',
    'cli.capture.help.last_50_lines_html': 'As últimas 50 linhas como HTML',
    'cli.capture.help.same_capture': 'Igual a capture',

    // ── Diff ─────────────────────────────────────────────────────────
    'cli.diff.description': 'Compara arquivos linha a linha',
    'cli.diff.help.compare_two_texts_line':
        'Compara dois textos linha a linha: linhas adicionadas aparecem em verde com +, linhas removidas em vermelho com -, com algumas linhas inalteradas ao redor de cada alteração para dar contexto.',
    'cli.diff.help.compare_two_texts': 'Comparar dois textos',
    'cli.diff.help.only_changed_lines': 'Somente as linhas alteradas',
    'cli.diff.help.one_line_changed': 'Uma linha alterada',
    'cli.diff.help.prints_no_differences_found': 'Exibe: No differences found',
    'cli.diff.help.compare_two_files_line':
        'Compara dois arquivos linha a linha e mostra o que mudou: linhas que começam com < (ou -) existem só no primeiro arquivo, linhas que começam com > (ou +) só no segundo.',
    'cli.diff.help.show_differences': 'Mostrar as diferenças',
    'cli.diff.help.unified_format_context': 'Formato unificado com contexto',
    'cli.diff.help.what_changed_between_versions': 'O que mudou entre as versões',
    'cli.diff.help.review_edits_git_style': 'Revisar edições, no estilo git',
    'cli.diff.help.ignore_upper_lower_case': 'Ignorar maiúsculas/minúsculas',

    // ── Font Size ────────────────────────────────────────────────────
    'cli.font-size.description': 'Ajusta o tamanho da fonte do terminal',
    'cli.font-size.reset.description': 'Redefine o tamanho da fonte para o padrão',
    'cli.font-size.set.description': 'Define o tamanho da fonte para um valor específico',
    'cli.font-size.help.intro':
        'Aumenta ou diminui o texto do terminal, de {min}px a {max}px. O tamanho escolhido é salvo e restaurado na próxima vez que o terminal for aberto; reset volta ao tamanho com que a página começou.',
    'cli.font-size.help.show_current_size': 'Mostrar o tamanho atual',
    'cli.font-size.help.bigger_smaller_by': 'Maior ou menor em {step}px',
    'cli.font-size.help.exact_size': 'Tamanho exato em pixels ({min}-{max})',
    'cli.font-size.help.back_default_size': 'Voltar ao tamanho padrão',
    'cli.font-size.help.use_16px_text': 'Usar texto de 16px',
    'cli.font-size.help.grow_by': 'Aumentar em {step}px',
    'cli.font-size.help.forget_saved_size': 'Esquecer o tamanho salvo',

    // ── Snippet ──────────────────────────────────────────────────────
    'cli.snippet.description': 'Salva e reutiliza modelos de comando parametrizados',
    'cli.snippet.list.description': 'Lista todos os snippets salvos',
    'cli.snippet.save.description': 'Salva um novo snippet: snippet save <name> "<template>"',
    'cli.snippet.show.description': 'Mostra o modelo de um snippet: snippet show <name>',
    'cli.snippet.delete.description': 'Exclui um snippet: snippet delete <name>',
    'cli.snippet.run.description':
        'Executa um snippet com valores de variáveis: snippet run <name> var1=val1 var2=val2',
    'cli.snippet.help.save_command_lines_you':
        'Salva linhas de comando usadas com frequência como modelos nomeados, com {{placeholders}} preenchidos ao executá-los. Os snippets são salvos no navegador e compartilhados por todos os seus terminais e abas.',
    'cli.snippet.help.save_replace_snippet': 'Salvar (ou substituir) um snippet',
    'cli.snippet.help.fill_placeholders_run': 'Preencher os placeholders e executar',
    'cli.snippet.help.all_saved_snippets': 'Todos os snippets salvos',
    'cli.snippet.help.print_snippet': 'Exibir um snippet',
    'cli.snippet.help.delete_snippet_rm_remove': 'Excluir um snippet (rm, remove)',
    'cli.snippet.help.template_placeholder': 'Um modelo com um placeholder',
    'cli.snippet.help.runs_echo_hello_ada': 'Executa: echo Hello Ada',
    'cli.snippet.help.quote_values_spaces': 'Use aspas em valores com espaços',

    // ── Test ─────────────────────────────────────────────────────────
    'cli.test.description': 'Avalia uma condição (status de saída 0 quando verdadeira)',
    'cli.test.help.expressions': 'Expressões:',
    'cli.test.help.empty_not_empty': 'vazio / não vazio',
    'cli.test.help.equal_not_equal': 'igual / diferente',
    'cli.test.help.integer_comparison': 'comparação de inteiros',
    'cli.test.help.exists_file_directory': 'existe / arquivo / diretório',

    // ── Kill ─────────────────────────────────────────────────────────
    'cli.kill.description': 'Encerra um processo em execução pelo PID',
    'cli.kill.help.stop_running_process_pid':
        'Interrompe um processo em execução pelo PID, como mostrado por ps. Um comando é cancelado, um serviço em segundo plano é interrompido. Somente processos em execução podem ser encerrados; depois aparecem como killed com código de saída -9.',
    'cli.kill.help.stop_process_pid': 'Interromper o processo com esse PID',
    'cli.kill.help.find_pid': 'Encontrar o PID',
    'cli.kill.help.stop_process_3': 'Interromper o processo 3',

    // ── Pkg ──────────────────────────────────────────────────────────
    'cli.pkg.description': 'Gerencia pacotes na CLI',
    'cli.pkg.ls.description': 'Lista todos os pacotes na CLI',
    'cli.pkg.browse.description':
        'Lista todos os pacotes disponíveis de todas as origens configuradas',
    'cli.pkg.add.description': 'Adiciona um pacote à CLI, por exemplo pkg add guid.',
    'cli.pkg.remove.description': 'Remove um pacote da CLI',
    'cli.pkg.versions.description': 'Mostra todas as versões publicadas de um pacote',
    'cli.pkg.check.description': 'Verifica atualizações disponíveis para os pacotes instalados',
    'cli.pkg.update.description':
        'Atualiza um pacote da CLI para a última versão ou atualiza todos os pacotes',
    'cli.pkg.source.description': 'Obtém ou define a origem dos pacotes para downloads',
    'cli.pkg.source.get.description': 'Mostra a origem CDN atual',
    'cli.pkg.source.set.description':
        'Define a origem de pacotes preferida (interativo se nenhum nome for informado)',
    'cli.pkg.help.list_installed_packages': 'Listar os pacotes instalados',
    'cli.pkg.help.browse_all_available_packages': 'Explorar todos os pacotes disponíveis',
    'cli.pkg.help.install_package': 'Instalar um pacote',
    'cli.pkg.help.remove_package': 'Remover um pacote',
    'cli.pkg.help.show_all_published_versions': 'Mostrar todas as versões publicadas',
    'cli.pkg.help.check_available_updates': 'Verificar atualizações disponíveis',
    'cli.pkg.help.update_one_all_packages': 'Atualizar um ou todos os pacotes',
    'cli.pkg.help.get_set_package_source': 'Obter ou definir a origem dos pacotes',
    'cli.pkg.help.install_qodalis_cli_guid': 'Instalar @qodalis/cli-guid',
    'cli.pkg.help.install_multiple_packages': 'Instalar vários pacotes',
    'cli.pkg.help.update_all_packages': 'Atualizar todos os pacotes',
    'cli.pkg.browse.help.install_package': 'para instalar um pacote',
    'cli.pkg.add.help.short_name': 'Nome curto',
    'cli.pkg.add.help.full_name': 'Nome completo',
    'cli.pkg.add.help.multiple_packages': 'Vários pacotes',
    'cli.pkg.add.help.specific_version': 'Versão específica',
    'cli.pkg.remove.help.remove_one_package': 'Remover um pacote',
    'cli.pkg.remove.help.remove_multiple': 'Remover vários',
    'cli.pkg.remove.help.short_alias': 'Alias curto',
    'cli.pkg.versions.help.short_name': 'Nome curto',
    'cli.pkg.versions.help.full_name': 'Nome completo',
    'cli.pkg.check.help.apply_updates': 'para aplicar as atualizações',
    'cli.pkg.update.help.update_latest': 'Atualizar para a última versão',
    'cli.pkg.update.help.update_specific_version': 'Atualizar para uma versão específica',
    'cli.pkg.update.help.update_all_packages': 'Atualizar todos os pacotes',
    'cli.pkg.update.help.install_specific_version': 'Instalar uma versão específica',
    'cli.pkg.source.help.change': 'para alterar',
    'cli.pkg.source.help.show_current_source': 'Mostrar a origem atual',
    'cli.pkg.source.help.set_preferred_source': 'Definir a origem preferida',
    'cli.pkg.help.install_package_2': 'para instalar um pacote',

    // ── Ps ───────────────────────────────────────────────────────────
    'cli.ps.description': 'Lista os processos em execução e recentes',
    'cli.ps.help.list_processes_terminal_commands':
        'Lista os processos deste terminal: comandos, serviços em segundo plano, daemons e jobs. Os em execução aparecem junto com os concluídos, com falha e encerrados recentemente (os últimos 50), com o código de saída e há quanto tempo começaram.',
    'cli.ps.help.all_processes_oldest_first': 'Todos os processos, do mais antigo ao mais novo',
    'cli.ps.help.what_running_now': 'O que está em execução agora',
    'cli.ps.help.stop_process_12_pid': 'Interromper o processo 12 da coluna PID',

    // ── Cron ─────────────────────────────────────────────────────────
    'cli.cron.description': 'Agenda comandos para executar em um intervalo repetido',
    'cli.cron.add.description': 'Adiciona um job cron: cron add <name> <interval> <command>',
    'cli.cron.list.description': 'Lista todos os jobs cron',
    'cli.cron.remove.description': 'Remove um job cron: cron remove <name>',
    'cli.cron.enable.description': 'Ativa um job cron pausado',
    'cli.cron.disable.description': 'Pausa um job cron sem removê-lo',
    'cli.cron.help.run_command_again_again':
        'Executa um comando repetidamente em um intervalo fixo enquanto o terminal estiver aberto. Os jobs são salvos: começam de novo quando o terminal inicia e podem ser pausados sem removê-los.',
    'cli.cron.help.add_job': 'Adicionar um job',
    'cli.cron.help.jobs_interval_status_run':
        'Jobs com intervalo, status e número de execuções (ls)',
    'cli.cron.help.pause_job': 'Pausar um job',
    'cli.cron.help.resume_paused_job': 'Retomar um job pausado',
    'cli.cron.help.remove_job_rm_delete': 'Remover um job (rm, delete)',
    'cli.cron.help.intervals_seconds_30_hours':
        'Intervalos: segundos (30), ou horas, minutos e segundos (1h, 5m, 1h30m, 90s); no mínimo 10 segundos.',
    'cli.cron.help.every_5_minutes': 'A cada 5 minutos',
    'cli.cron.help.every_hour_half': 'A cada hora e meia',
    'cli.cron.help.pause': 'Pausá-lo',

    // ── Binary ───────────────────────────────────────────────────────
    'cli.binary.long_description': 'Codifica e decodifica strings binárias',
    'cli.binary.utf8_note': 'Suporta codificação de texto UTF-8',
    'cli.binary.encode_desc': 'Texto para binário',
    'cli.binary.decode_desc': 'Binário para texto',

    // ── Morse ────────────────────────────────────────────────────────
    'cli.morse.long_description': 'Codifica e decodifica código Morse',
    'cli.morse.note': 'Suporta letras, números e pontuação comum',
    'cli.morse.encode_desc': 'Texto para Morse',
    'cli.morse.decode_desc': 'Morse para texto',

    // ── Rot ──────────────────────────────────────────────────────────
    'cli.rot.long_description': 'Aplica a cifra ROT (rotação) ao texto',
    'cli.rot.note': 'O padrão é ROT13 (autoinversa: aplicar duas vezes retorna o original)',
    'cli.rot.default_desc': 'Aplicar ROT13',
    'cli.rot.shift_desc': 'Aplicar ROT-N',

    // ── Awk ──────────────────────────────────────────────────────────
    'cli.awk.description': 'Busca de padrões e processamento de texto',
    'cli.awk.help.process_text_records_fields':
        'Processa texto como registros e campos: cada linha é dividida em campos $1, $2, ... ($0 é a linha inteira), e cada regra executa sua { action } nas linhas correspondentes. Suporta blocos BEGIN e END, padrões /regex/ e de comparação de campos, print, variáveis, NR e NF. Coloque o programa entre aspas; um simples também funciona sem aspas (awk {print $1} file).',
    'cli.awk.help.run_program_over_file': 'Executar um programa sobre um arquivo',
    'cli.awk.help.split_fields_instead_spaces': 'Dividir campos por <sep> em vez de espaços',
    'cli.awk.help.run_program_over_piped': 'Executar um programa sobre a entrada via pipe',
    'cli.awk.help.print_first_column': 'Exibir a primeira coluna',
    'cli.awk.help.second_column_csv': 'Segunda coluna de um CSV',
    'cli.awk.help.filter_rows_field': 'Filtrar linhas por um campo',
    'cli.awk.help.sum_second_column': 'Somar a segunda coluna',

    // ── Basename ─────────────────────────────────────────────────────
    'cli.basename.description': 'Remove o diretório de um caminho',
    'cli.basename.help.print_last_part_path':
        'Exibe a última parte de um caminho, o nome do arquivo ou diretório, sem os diretórios anteriores. Se um sufixo for informado, ele também é removido do final.',
    'cli.basename.help.name_without_directories': 'Nome sem os diretórios',
    'cli.basename.help.also_remove_trailing_suffix': 'Também remover um sufixo final',
    'cli.basename.help.prints_notes_txt': 'Exibe notes.txt',
    'cli.basename.help.prints_notes': 'Exibe notes',
    'cli.basename.help.prints_user': 'Exibe user',

    // ── Cat ──────────────────────────────────────────────────────────
    'cli.cat.description': 'Exibe o conteúdo de arquivos',
    'cli.cat.help.print_contents_one_more':
        'Exibe o conteúdo de um ou mais arquivos, concatenados em ordem, ou da entrada via pipe. Direcione a saída para outros comandos para pesquisar, ordenar ou contar.',
    'cli.cat.help.print_files_one_after': 'Exibir arquivos um após o outro',
    'cli.cat.help.send_file_another_command': 'Enviar um arquivo para outro comando',
    'cli.cat.help.show_whole_file': 'Mostrar o arquivo inteiro',
    'cli.cat.help.show_only_lines_error': 'Mostrar somente linhas com error',
    'cli.cat.help.print_lines_sorted': 'Exibir as linhas ordenadas',

    // ── Cd ───────────────────────────────────────────────────────────
    'cli.cd.description': 'Altera o diretório de trabalho atual',
    'cli.cd.help.change_current_directory_without':
        'Altera o diretório atual. Sem um caminho, vai para o seu diretório pessoal. Os caminhos podem ser absolutos (/...), relativos ao local atual, ou começar com ~ para o diretório pessoal.',
    'cli.cd.help.go_home_directory': 'Ir para o seu diretório pessoal',
    'cli.cd.help.go_directory': 'Entrar em um diretório',
    'cli.cd.help.go_up_one_level': 'Subir um nível',
    'cli.cd.help.go_docs_home': 'Ir para docs no seu diretório pessoal',
    'cli.cd.help.go_sibling_directory': 'Ir para um diretório irmão',
    'cli.cd.help.go_root': 'Ir para a raiz',

    // ── Chmod ────────────────────────────────────────────────────────
    'cli.chmod.description': 'Altera as permissões de arquivos',
    'cli.chmod.help.change_who_can_read':
        'Altera quem pode ler (r), escrever (w) e executar (x) um arquivo. Use um modo octal como 755 ou um simbólico: quem (u usuário, g grupo, o outros, a todos), depois + para adicionar, - para remover ou = para definir, depois as permissões.',
    'cli.chmod.help.set_permissions': 'Definir permissões',
    'cli.chmod.help.apply_directory_everything': 'Aplicar a um diretório e a tudo dentro dele',
    'cli.chmod.help.rw_r_r_owner': 'rw-r--r--: o dono escreve, os outros leem',
    'cli.chmod.help.let_owner_execute': 'Permitir que o dono o execute',
    'cli.chmod.help.take_away_write_group': 'Remover a escrita para grupo e outros',
    'cli.chmod.help.set_whole_directory_tree': 'Definir uma árvore de diretórios inteira',

    // ── Chown ────────────────────────────────────────────────────────
    'cli.chown.description': 'Altera o dono e o grupo de arquivos',
    'cli.chown.help.change_owner_group_files':
        'Altera o dono e/ou o grupo de arquivos. Informe user, user:group, user: (somente o dono) ou :group (somente o grupo).',
    'cli.chown.help.change_owner_group_if': 'Alterar o dono, e o grupo se informado',
    'cli.chown.help.change_only_group': 'Alterar somente o grupo',
    'cli.chown.help.apply_directory_everything': 'Aplicar a um diretório e a tudo dentro dele',
    'cli.chown.help.make_alice_owner': 'Tornar alice a dona',
    'cli.chown.help.set_owner_group': 'Definir dono e grupo',
    'cli.chown.help.give_bob_whole_directory': 'Dar a bob um diretório inteiro',

    // ── Cp ───────────────────────────────────────────────────────────
    'cli.cp.description': 'Copia arquivos e diretórios',
    'cli.cp.help.copy_file_new_path':
        'Copia um arquivo para um novo caminho, ou para dentro de um diretório existente. Copiar um diretório exige -r, que copia tudo o que há dentro dele. Um arquivo já existente no destino é substituído.',
    'cli.cp.help.copy_file_new_name': 'Copiar um arquivo para um novo nome',
    'cli.cp.help.copy_files_directory': 'Copiar arquivos para um diretório',
    'cli.cp.help.copy_directory_contents': 'Copiar um diretório e seu conteúdo',
    'cli.cp.help.make_backup_copy': 'Fazer uma cópia de backup',
    'cli.cp.help.copy_docs': 'Copiar para ~/docs',
    'cli.cp.help.duplicate_whole_directory': 'Duplicar um diretório inteiro',

    // ── Cut ──────────────────────────────────────────────────────────
    'cli.cut.description': 'Extrai colunas ou campos de cada linha de um arquivo',
    'cli.cut.help.print_selected_parts_each':
        'Exibe partes selecionadas de cada linha: campos separados por um delimitador (-f, tabulação por padrão) ou posições de caracteres (-c). Uma lista pode ter números isolados, intervalos ou ambos, como 1,3 ou 2-4 ou 3-.',
    'cli.cut.help.select_fields': 'Selecionar campos',
    'cli.cut.help.select_character_positions': 'Selecionar posições de caracteres',
    'cli.cut.help.cut_piped_input': 'Cortar a entrada via pipe',
    'cli.cut.help.first_third_csv_column': 'Primeira e terceira coluna de um CSV',
    'cli.cut.help.first_10_characters_each': 'Primeiros 10 caracteres de cada linha',
    'cli.cut.help.first_two_fields_split': 'Dois primeiros campos separados por :',

    // ── Dirname ──────────────────────────────────────────────────────
    'cli.dirname.description': 'Remove o último componente de um caminho',
    'cli.dirname.help.print_directory_part_path':
        'Exibe a parte de diretório de um caminho, tudo antes da última /. Um nome simples sem / resulta em . (o diretório atual).',
    'cli.dirname.help.path_without_last_part': 'Caminho sem a última parte',
    'cli.dirname.help.prints_home_user': 'Exibe /home/user',
    'cli.dirname.help.prints': 'Exibe .',
    'cli.dirname.help.prints_2': 'Exibe /',

    // ── Du ───────────────────────────────────────────────────────────
    'cli.du.description': 'Estima o uso de espaço dos arquivos',
    'cli.du.help.show_how_much_space':
        'Mostra quanto espaço arquivos e diretórios usam, em bytes. Para um diretório, cada subdiretório é listado com seu tamanho total; use -s só para o total ou -d para limitar a profundidade.',
    'cli.du.help.sizes_path_default_current':
        'Tamanhos de um caminho (padrão: o diretório atual) e de seus subdiretórios',
    'cli.du.help.only_total': 'Somente o total',
    'cli.du.help.only_levels_deep': 'Somente <n> níveis de profundidade',
    'cli.du.help.size_each_directory_docs': 'Tamanho de cada diretório em ~/docs',
    'cli.du.help.total_home_k_m': 'Total do seu diretório pessoal em K/M/G',
    'cli.du.help.size_each_top_level': 'Tamanho de cada pasta de nível superior',

    // ── Find ─────────────────────────────────────────────────────────
    'cli.find.description': 'Procura arquivos e diretórios por nome ou tipo',
    'cli.find.help.list_files_directories_under':
        'Lista arquivos e diretórios sob um caminho (o diretório atual por padrão), pesquisando em todos os subdiretórios. O próprio caminho inicial é listado primeiro. Filtre por nome com um padrão glob (* e ?; --name diferencia maiúsculas de minúsculas, --iname não) ou por tipo.',
    'cli.find.help.list_everything_under_path': 'Listar tudo sob um caminho',
    'cli.find.help.match_names_against_glob': 'Comparar nomes com um glob',
    'cli.find.help.same_ignoring_case': 'Igual, ignorando maiúsculas/minúsculas',
    'cli.find.help.only_files_f_directories': 'Somente arquivos (f) ou diretórios (d)',
    'cli.find.help.list_everything_docs': 'Listar tudo em ~/docs',
    'cli.find.help.find_all_txt_files': 'Encontrar todos os arquivos .txt',
    'cli.find.help.directories_near_top': 'Diretórios próximos ao topo',
    'cli.find.help.delete_all_tmp_files': 'Excluir todos os arquivos .tmp',

    // ── Grep ─────────────────────────────────────────────────────────
    'cli.grep.description': 'Procura um padrão no conteúdo de arquivos',
    'cli.grep.help.print_lines_match_pattern':
        'Exibe as linhas que correspondem a um padrão. O padrão é uma expressão regular, as correspondências são destacadas, e a entrada pode ser arquivos, diretórios (com -r) ou texto via pipe.',
    'cli.grep.help.search_one_more_files': 'Pesquisar em um ou mais arquivos',
    'cli.grep.help.search_every_file_under': 'Pesquisar todos os arquivos de um diretório',
    'cli.grep.help.filter_piped_input': 'Filtrar a entrada via pipe',
    'cli.grep.help.case_insensitive_search': 'Pesquisa sem diferenciar maiúsculas de minúsculas',
    'cli.grep.help.find_todos_line_numbers': 'Encontrar TODOs com números de linha',
    'cli.grep.help.hide_comment_lines': 'Ocultar linhas de comentário',
    'cli.grep.help.count_matching_lines': 'Contar linhas correspondentes',

    // ── Head ─────────────────────────────────────────────────────────
    'cli.head.description': 'Exibe as primeiras linhas de um arquivo',
    'cli.head.help.print_first_lines_file':
        'Exibe as primeiras linhas de um arquivo, 10 por padrão. Funciona também com entrada via pipe. Com vários arquivos, cada um recebe um cabeçalho ==> name <==.',
    'cli.head.help.first_10_lines': 'Primeiras 10 linhas',
    'cli.head.help.first_lines': 'Primeiras <count> linhas',
    'cli.head.help.first_lines_piped_input': 'Primeiras linhas da entrada via pipe',
    'cli.head.help.show_start_file': 'Mostrar o início de um arquivo',
    'cli.head.help.first_3_lines_each': 'Primeiras 3 linhas de cada arquivo',
    'cli.head.help.first_20_lines_log': 'Primeiras 20 linhas do log',

    // ── Ln ───────────────────────────────────────────────────────────
    'cli.ln.description': 'Cria links simbólicos',
    'cli.ln.help.create_symbolic_link_new':
        'Cria um link simbólico: um novo caminho que aponta para outro arquivo ou diretório. Somente links simbólicos (-s) são suportados, e o destino não precisa existir ainda.',
    'cli.ln.help.create_pointing': 'Criar <link> apontando para <target>',
    'cli.ln.help.shortcut_file': 'Atalho para um arquivo',
    'cli.ln.help.shortcut_directory': 'Atalho para um diretório',

    // ── Mkdir ────────────────────────────────────────────────────────
    'cli.mkdir.description': 'Cria diretórios',
    'cli.mkdir.help.create_new_directory_p':
        'Cria um novo diretório. Com -p, os diretórios pai ausentes também são criados.',
    'cli.mkdir.help.create_one_more_directories': 'Criar um ou mais diretórios',
    'cli.mkdir.help.create_directory_missing_parents': 'Criar um diretório e seus pais ausentes',
    'cli.mkdir.help.create_projects_current_directory': 'Criar projects no diretório atual',
    'cli.mkdir.help.create_whole_path_once': 'Criar o caminho inteiro de uma vez',

    // ── Mv ───────────────────────────────────────────────────────────
    'cli.mv.description': 'Move ou renomeia arquivos e diretórios',
    'cli.mv.help.move_rename_file_directory':
        'Move ou renomeia um arquivo ou diretório. Se o destino for um diretório existente, a origem é movida para dentro dele; caso contrário, é renomeada. Um arquivo já existente no destino é substituído.',
    'cli.mv.help.rename_file_directory': 'Renomear um arquivo ou diretório',
    'cli.mv.help.move_them_directory': 'Movê-los para um diretório',
    'cli.mv.help.rename_file': 'Renomear um arquivo',
    'cli.mv.help.move_docs': 'Movê-lo para ~/docs',
    'cli.mv.help.rename_directory': 'Renomear um diretório',

    // ── Paste ────────────────────────────────────────────────────────
    'cli.paste.description': 'Mescla linhas de arquivos lado a lado',
    'cli.paste.help.join_files_side_side':
        'Junta arquivos lado a lado: a linha 1 de cada arquivo vai em uma linha de saída, separada por tabulação, depois a linha 2, e assim por diante. Com -s, cada arquivo é unido em uma única linha. A entrada via pipe é lida como o arquivo - (ou como única entrada quando nenhum arquivo é informado); -d aceita uma lista de delimitadores usados em sequência.',
    'cli.paste.help.merge_files_line_line': 'Mesclar arquivos linha a linha',
    'cli.paste.help.join_all_lines_file': 'Juntar todas as linhas de um arquivo em uma',
    'cli.paste.help.merge_piped_input_file': 'Mesclar a entrada via pipe com um arquivo',
    'cli.paste.help.two_columns_tab_separated': 'Duas colunas, separadas por tabulação',
    'cli.paste.help.merge_comma_separated': 'Mesclar separando por vírgulas',
    'cli.paste.help.turn_list_one_csv': 'Transformar uma lista em uma linha CSV',

    // ── Pwd ──────────────────────────────────────────────────────────
    'cli.pwd.description': 'Exibe o diretório de trabalho atual',
    'cli.pwd.help.print_full_path_directory':
        'Exibe o caminho completo do diretório em que você está. Caminhos relativos em outros comandos começam a partir daqui.',
    'cli.pwd.help.show_current_directory': 'Mostrar o diretório atual',
    'cli.pwd.help.example_home_user': 'Por exemplo /home/user',
    'cli.pwd.help.prints_home_user_docs': 'Exibe /home/user/docs',

    // ── Rm ───────────────────────────────────────────────────────────
    'cli.rm.description': 'Remove arquivos ou diretórios',
    'cli.rm.help.delete_file_directories_only':
        'Exclui um arquivo. Diretórios só são removidos com -r, que exclui tudo dentro deles. Arquivos excluídos não podem ser recuperados.',
    'cli.rm.help.delete_one_more_files': 'Excluir um ou mais arquivos',
    'cli.rm.help.delete_directory_contents': 'Excluir um diretório e seu conteúdo',
    'cli.rm.help.delete_without_error_if': 'Excluir sem erro se estiver ausente',
    'cli.rm.help.delete_one_file': 'Excluir um arquivo',
    'cli.rm.help.delete_whole_directory': 'Excluir um diretório inteiro',
    'cli.rm.help.quiet_if_file_does': 'Silencioso se o arquivo não existir',

    // ── Rmdir ────────────────────────────────────────────────────────
    'cli.rmdir.description': 'Remove diretórios vazios',
    'cli.rmdir.help.remove_empty_directory_refuses':
        'Remove um diretório vazio. Recusa remover um diretório que ainda contém arquivos; use rm -r para isso.',
    'cli.rmdir.help.remove_empty_directories': 'Remover diretórios vazios',
    'cli.rmdir.help.remove_directory_current_one': 'Remover um diretório dentro do atual',
    'cli.rmdir.help.remove_full_path': 'Remover pelo caminho completo',

    // ── Sed ──────────────────────────────────────────────────────────
    'cli.sed.description': 'Editor de fluxo para filtrar e transformar texto',
    'cli.sed.help.edit_text_line_line':
        'Edita texto linha a linha com um script: substituir (s/old/new/), excluir (d), exibir (p) ou sair (q), opcionalmente limitado a um número de linha, um intervalo (1,5, 3,$ ou /start/,/end/) ou linhas que correspondem a /regex/; ! após um endereço o inverte e ; separa comandos. A substituição pode usar & (a correspondência) e \\1 a \\9 (grupos, escritos \\(...\\) ou, com -E, (...)). Lê arquivos ou entrada via pipe e exibe o resultado, ou reescreve os arquivos com -i.',
    'cli.sed.help.print_edited_file': 'Exibir o arquivo editado',
    'cli.sed.help.save_edits_file': 'Salvar as edições no arquivo',
    'cli.sed.help.print_only_selected_lines': 'Exibir somente linhas selecionadas',
    'cli.sed.help.edit_piped_input': 'Editar a entrada via pipe',
    'cli.sed.help.replace_every_cat_dog': 'Substituir todo cat por dog',
    'cli.sed.help.edit_file_place': 'Editar o arquivo no local',
    'cli.sed.help.drop_comment_lines': 'Descartar linhas de comentário',
    'cli.sed.help.print_lines_1_5': 'Exibir as linhas 1 a 5',
    'cli.sed.help.swap_two_words': 'Trocar duas palavras',

    // ── Sh ───────────────────────────────────────────────────────────
    'cli.sh.description': 'Executa um arquivo de script',
    'cli.sh.help.requires_execute': '(requer permissão de execução)',
    'cli.sh.help.script_syntax': 'Sintaxe de script:',
    'cli.sh.help.comments': 'Linhas que começam com # são comentários',
    'cli.sh.help.several_commands': 'Vários comandos em uma linha',
    'cli.sh.help.assignment': 'Atribuição de variável',
    'cli.sh.help.substitution': 'Substituição de variável',
    'cli.sh.help.stop_on_error': 'Parar em caso de erro (padrão)',
    'cli.sh.help.continue_on_errors': 'Continuar em caso de erros',
    'cli.sh.help.exit': 'Interrompe o script com status n',
    'cli.sh.help.control_flow': 'Controle de fluxo:',
    'cli.sh.help.until': '(until cmd: o oposto)',
    'cli.sh.help.break_continue': 'Sair de / pular em um laço',
    'cli.sh.help.negate': 'Negar o status de saída',
    'cli.sh.help.conditions': 'Condições são comandos:',
    'cli.sh.help.conditions_status':
        '(status 0 = verdadeiro; veja help test). Os laços param após 10000 iterações',
    'cli.sh.help.conditions_loops': 'de while/until; Ctrl+C interrompe o script.',
    'cli.sh.help.example_script': 'Script de exemplo:',

    // ── Sort ─────────────────────────────────────────────────────────
    'cli.sort.description': 'Ordena linhas de arquivos de texto',
    'cli.sort.help.sort_lines_file_piped':
        'Ordena as linhas de um arquivo ou da entrada via pipe, em ordem alfabética por padrão. Ordene numericamente, em ordem inversa, por um campo, ou descarte duplicatas. Vários arquivos são ordenados juntos em uma única lista.',
    'cli.sort.help.sort_lines_alphabetically': 'Ordenar linhas alfabeticamente',
    'cli.sort.help.sort_field_split': 'Ordenar pelo campo <n>, separado por <sep>',
    'cli.sort.help.sort_piped_input': 'Ordenar a entrada via pipe',
    'cli.sort.help.z': 'De A a Z',
    'cli.sort.help.largest_number_first': 'Maior número primeiro',
    'cli.sort.help.sort_csv_second_column': 'Ordenar um CSV pela segunda coluna',
    'cli.sort.help.sorted_without_duplicates': 'Ordenado, sem duplicatas',

    // ── Stat ─────────────────────────────────────────────────────────
    'cli.stat.description': 'Exibe os metadados de arquivo/diretório',
    'cli.stat.help.show_details_about_files':
        'Mostra detalhes sobre arquivos ou diretórios: caminho completo, tamanho, tipo, permissões, dono, grupo, e quando foi criado e modificado pela última vez.',
    'cli.stat.help.show_details_each_path': 'Mostrar detalhes de cada caminho',
    'cli.stat.help.details_one_file': 'Detalhes de um arquivo',
    'cli.stat.help.several_paths_once': 'Vários caminhos de uma vez',

    // ── Tac ──────────────────────────────────────────────────────────
    'cli.tac.description': 'Exibe um arquivo em ordem inversa de linhas',
    'cli.tac.help.print_file_lines_reverse':
        'Exibe um arquivo com as linhas em ordem inversa, última linha primeiro. Funciona também com entrada via pipe.',
    'cli.tac.help.print_file_bottom_top': 'Exibir um arquivo de baixo para cima',
    'cli.tac.help.reverse_piped_input': 'Inverter a entrada via pipe',
    'cli.tac.help.newest_log_lines_first': 'Linhas mais recentes do log primeiro',
    'cli.tac.help.reverse_list': 'Inverter uma lista',

    // ── Tail ─────────────────────────────────────────────────────────
    'cli.tail.description': 'Exibe as últimas linhas de um arquivo',
    'cli.tail.help.print_last_lines_file':
        'Exibe as últimas linhas de um arquivo, 10 por padrão. Funciona também com entrada via pipe. Com vários arquivos, cada um recebe um cabeçalho ==> name <==.',
    'cli.tail.help.last_10_lines': 'Últimas 10 linhas',
    'cli.tail.help.last_lines': 'Últimas <count> linhas',
    'cli.tail.help.last_lines_piped_input': 'Últimas linhas da entrada via pipe',
    'cli.tail.help.show_end_log': 'Mostrar o final de um log',
    'cli.tail.help.last_5_lines': 'Últimas 5 linhas',
    'cli.tail.help.last_20_lines_log': 'Últimas 20 linhas do log',

    // ── Tee ──────────────────────────────────────────────────────────
    'cli.tee.description': 'Copia a entrada via pipe para arquivos e para a saída',
    'cli.tee.help.pass_piped_input_through':
        'Repassa a entrada via pipe sem alterações e salva uma cópia dela em cada arquivo informado, sobrescrevendo-os ou acrescentando com -a. Como o tee do Unix, lê somente entrada via pipe: para copiar um arquivo, envie-o com cat.',
    'cli.tee.help.show_piped_output_save': 'Mostrar a saída do pipe e salvá-la',
    'cli.tee.help.append_instead_overwriting': 'Acrescentar em vez de sobrescrever',
    'cli.tee.help.show_save_copy': 'Mostrar e salvar uma cópia',
    'cli.tee.help.add_line_log': 'Adicionar uma linha a um log',
    'cli.tee.help.copy_source_txt_txt': 'Copiar source.txt para a.txt e b.txt',

    // ── Touch ────────────────────────────────────────────────────────
    'cli.touch.description': 'Cria um arquivo vazio ou atualiza seu carimbo de data/hora',
    'cli.touch.help.create_empty_file_update':
        'Cria um arquivo vazio, ou atualiza a data de modificação de um arquivo que já existe. O diretório pai já deve existir.',
    'cli.touch.help.create_files_refresh_their':
        'Criar os arquivos, ou atualizar seus carimbos de data/hora',
    'cli.touch.help.create_empty_notes_txt': 'Criar um notes.txt vazio',
    'cli.touch.help.create_file_docs': 'Criar um arquivo em ~/docs',

    // ── Tr ───────────────────────────────────────────────────────────
    'cli.tr.description': 'Converte ou exclui caracteres na entrada via pipe',
    'cli.tr.help.translate_characters_set1_matching':
        'Converte caracteres de SET1 nos caracteres correspondentes de SET2, exclui-os (-d) ou comprime repetições em um só (-s). Os conjuntos podem usar intervalos como a-z e classes como [:upper:], [:lower:], [:digit:], [:alpha:], [:alnum:] e [:space:]. As sequências \\n, \\t e \\\\ são reconhecidas. Como o tr do Unix, lê somente entrada via pipe e não aceita arquivos: para transformar um arquivo, envie-o com cat.',
    'cli.tr.help.replace_characters': 'Substituir caracteres',
    'cli.tr.help.delete_characters': 'Excluir caracteres',
    'cli.tr.help.squeeze_repeated_characters': 'Comprimir caracteres repetidos',
    'cli.tr.help.convert_file_upper_case': 'Converter um arquivo para maiúsculas',
    'cli.tr.help.upper_case_piped_text': 'Texto via pipe em maiúsculas',
    'cli.tr.help.remove_all_digits': 'Remover todos os dígitos',
    'cli.tr.help.collapse_runs_spaces': 'Reduzir sequências de espaços',

    // ── Tree ─────────────────────────────────────────────────────────
    'cli.tree.description': 'Exibe a estrutura de diretórios em árvore',
    'cli.tree.help.draw_directory_everything_below':
        'Desenha um diretório e tudo abaixo dele como uma árvore, diretórios primeiro, seguida da contagem de diretórios e arquivos. O padrão é o diretório atual.',
    'cli.tree.help.show_whole_tree': 'Mostrar a árvore inteira',
    'cli.tree.help.only_levels_deep': 'Somente <n> níveis de profundidade',
    'cli.tree.help.tree_current_directory': 'Árvore do diretório atual',
    'cli.tree.help.tree_docs': 'Árvore de ~/docs',
    'cli.tree.help.top_two_levels_only': 'Somente os dois níveis superiores',

    // ── Uniq ─────────────────────────────────────────────────────────
    'cli.uniq.description': 'Filtra linhas duplicadas adjacentes de um arquivo',
    'cli.uniq.help.collapse_repeated_lines_next':
        'Reduz linhas repetidas que estão lado a lado em uma só. Somente duplicatas adjacentes são mescladas, então ordene a entrada antes para pegar todas.',
    'cli.uniq.help.drop_adjacent_duplicate_lines': 'Descartar linhas duplicadas adjacentes',
    'cli.uniq.help.filter_piped_input': 'Filtrar a entrada via pipe',
    'cli.uniq.help.collapse_repeated_lines': 'Reduzir linhas repetidas',
    'cli.uniq.help.count_how_often_each': 'Contar quantas vezes cada linha aparece',
    'cli.uniq.help.show_only_duplicated_lines': 'Mostrar somente as linhas duplicadas',

    // ── Wc ───────────────────────────────────────────────────────────
    'cli.wc.description': 'Exibe a contagem de linhas, palavras e caracteres',
    'cli.wc.help.count_lines_words_characters':
        'Conta linhas, palavras e caracteres em arquivos ou na entrada via pipe. Com vários arquivos, uma linha de total é exibida no final.',
    'cli.wc.help.lines_words_characters': 'Linhas, palavras e caracteres',
    'cli.wc.help.only_line_count': 'Somente a contagem de linhas',
    'cli.wc.help.count_piped_input': 'Contar a entrada via pipe',
    'cli.wc.help.all_three_counts': 'As três contagens',
    'cli.wc.help.line_counts_total': 'Contagens de linhas com um total',
    'cli.wc.help.how_many_lines_mention': 'Quantas linhas mencionam error',

    // ── Xargs ────────────────────────────────────────────────────────
    'cli.xargs.description': 'Monta e executa comandos a partir da entrada de um arquivo',
    'cli.xargs.help.run_command_arguments_taken':
        'Executa um comando com argumentos obtidos da entrada, separados por espaços ou quebras de linha. Por padrão todos são anexados a um único comando; -n o executa em lotes e -I o executa uma vez por linha, substituindo um placeholder. As opções de xargs vão antes do comando; tudo depois dele, inclusive flags, pertence ao comando. A entrada é texto via pipe ou, sem pipe, o último arquivo informado.',
    'cli.xargs.help.append_input_lines': 'Anexar as linhas de entrada a <cmd>',
    'cli.xargs.help.run_once_per_line': 'Executar <cmd> uma vez por linha',
    'cli.xargs.help.read_arguments_file': 'Ler os argumentos de um arquivo',
    'cli.xargs.help.delete_every_tmp_file': 'Excluir todos os arquivos .tmp',
    'cli.xargs.help.copy_each_listed_file': 'Copiar cada arquivo listado',
    'cli.xargs.help.one_mkdir_per_line': 'Um mkdir por linha',
    'cli.xargs.help.inner_command_keeps_flags': 'O comando interno mantém suas flags',

    // ── Markdown ─────────────────────────────────────────────────────
    'cli.md.description': 'Renderiza Markdown no terminal',
    'cli.md.help.show_markdown_formatted_terminal':
        'Mostra Markdown formatado no terminal: títulos, texto em negrito e itálico, listas, citações, código e links. Passe o texto diretamente (com ou sem aspas, \\n inicia uma nova linha) ou envie-o por pipe de outro comando.',
    'cli.md.help.render_inline_text': 'Renderizar texto direto',
    'cli.md.help.same_optional_render_verb':
        'Igual, com o verbo opcional render (também preview, view)',
    'cli.md.help.render_output_command': 'Renderizar a saída de um comando',
    'cli.md.help.heading': 'Um título',
    'cli.md.help.several_lines': 'Várias linhas',
    'cli.md.help.piped_text': 'Texto via pipe',
    'cli.md.help.same_using_aliases': 'Igual, usando aliases',

    // ── Todo ─────────────────────────────────────────────────────────
    'cli.todo.description':
        'Gerencie suas tarefas pelo terminal. Adicione, liste, edite, conclua e remova itens TODO.',
    'cli.todo.ls.description': 'Lista itens TODO',
    'cli.todo.add.description': 'Adiciona uma nova tarefa',
    'cli.todo.edit.description': 'Edita o texto ou a data de vencimento de uma tarefa',
    'cli.todo.done.description': 'Marca uma tarefa como concluída',
    'cli.todo.toggle.description': 'Alterna uma tarefa entre concluída e não concluída',
    'cli.todo.rm.description': 'Remove uma tarefa pelo ID',
    'cli.todo.help.commands': 'Comandos:',
    'cli.todo.help.list_all': 'Listar todas as tarefas',
    'cli.todo.help.list_pending': 'Listar somente tarefas pendentes',
    'cli.todo.help.list_completed': 'Listar somente tarefas concluídas',
    'cli.todo.help.list_overdue': 'Listar somente tarefas atrasadas',
    'cli.todo.help.add': 'Adicionar uma nova tarefa',
    'cli.todo.help.add_due': 'Adicionar com data de vencimento',
    'cli.todo.help.edit': 'Editar uma tarefa',
    'cli.todo.help.done': 'Marcar uma tarefa como concluída',
    'cli.todo.help.toggle': 'Alternar entre concluída/não concluída',
    'cli.todo.help.remove': 'Remover uma tarefa',
    'cli.todo.help.remove_all': 'Remover todas as tarefas',
    'cli.todo.help.due_formats': 'Formatos de data de vencimento:',

    // ── True ─────────────────────────────────────────────────────────
    'cli.true.description': 'Não faz nada, com sucesso (status de saída 0)',

    // ── False ────────────────────────────────────────────────────────
    'cli.false.description': 'Não faz nada, sem sucesso (status de saída 1)',

    // ── Htop ─────────────────────────────────────────────────────────
    'cli.htop.description': 'Monitor interativo de processos e serviços',
};
