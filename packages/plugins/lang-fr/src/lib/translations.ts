/**
 * French translations for Qodalis CLI.
 *
 * Keys follow the pattern `cli.<command>.<key>` and match the default English
 * strings used in the `t()` calls across all built-in processors.
 */
export const frTranslations: Record<string, string> = {
    // ── Common ───────────────────────────────────────────────────────
    'cli.common.usage': 'Utilisation :',
    'cli.common.examples': 'Exemples :',

    // ── Help ─────────────────────────────────────────────────────────
    'cli.help.description': 'Affiche l\'aide d\'une commande',
    'cli.help.long_description': 'Affiche les informations d\'aide pour les commandes',
    'cli.help.shortcuts': 'Raccourcis',
    'cli.help.type': 'Tapez',
    'cli.help.help_command': 'help <commande>',
    'cli.help.for_details': 'pour des informations détaillées',
    'cli.help.unknown_command': 'Commande inconnue : {command}',
    'cli.help.see_all': 'pour voir toutes les commandes disponibles',
    'cli.help.extension_chain': 'Chaîne d\'extensions',
    'cli.help.subcommands': 'Sous-commandes',
    'cli.help.options': 'Options',
    'cli.help.global_options': 'Options globales',
    'cli.help.requires_server': 'Nécessite un serveur connecté',
    'cli.help.aliases': 'Alias :',
    'cli.help.required': '(obligatoire)',
    'cli.help.show_all': 'Afficher toutes les commandes disponibles',
    'cli.help.show_details': 'Afficher les détails d\'une commande',
    'cli.help.show_sub_details': 'Afficher les détails d\'une sous-commande',
    'cli.help.example_pkg': 'Aide du gestionnaire de paquets',
    'cli.help.example_theme': 'Aide de la sous-commande theme apply',

    // ── Configure ────────────────────────────────────────────────────
    'cli.configure.description': 'Gérer la configuration du système et des plugins',
    'cli.configure.long_description':
        'Gérer la configuration du système et des plugins de manière interactive ou par sous-commandes',
    'cli.configure.open_menu': 'Ouvrir le menu de configuration interactif',
    'cli.configure.list_opts': 'Lister toutes les options de configuration',
    'cli.configure.get_value': 'Obtenir une valeur de configuration',
    'cli.configure.set_value': 'Définir une valeur de configuration',
    'cli.configure.reset_defaults': 'Réinitialiser la configuration aux valeurs par défaut',
    'cli.configure.system': 'Système',
    'cli.configure.exit': 'Quitter',
    'cli.configure.back': 'Retour',
    'cli.configure.current_value': 'Valeur actuelle :',
    'cli.configure.invalid_value': 'Valeur non valide',
    'cli.configure.set_to': '{label} défini à {value}',
    'cli.configure.invalid_format_get': 'Format non valide. Utilisez : configure get <catégorie.clé>',
    'cli.configure.unknown_key': 'Clé de configuration inconnue : {path}',
    'cli.configure.invalid_format_set': 'Format non valide. Utilisez : configure set <catégorie.clé> <valeur>',
    'cli.configure.set_success': '{path} défini à {value}',
    'cli.configure.system_reset': 'Configuration du système réinitialisée aux valeurs par défaut',
    'cli.configure.unknown_category': 'Catégorie inconnue : {category}',
    'cli.configure.category_reset':
        'Configuration de « {category} » réinitialisée aux valeurs par défaut',
    'cli.configure.reset_confirm': 'Réinitialiser toute la configuration aux valeurs par défaut ?',
    'cli.configure.reset_cancelled': 'Réinitialisation annulée',
    'cli.configure.all_reset': 'Toute la configuration réinitialisée aux valeurs par défaut',
    'cli.configure.invalid_number': 'Nombre non valide : {value}',
    'cli.configure.invalid_options': 'Valeur non valide. Options valides : {options}',

    // ── Echo ──────────────────────────────────────────────────────────
    'cli.echo.description': 'Affiche le texte spécifié',
    'cli.echo.long_description': 'Affiche le texte spécifié dans le terminal',
    'cli.echo.piping_note': 'Prend en charge la sortie de texte et d\'objets JSON via les tubes',

    // ── Clear ─────────────────────────────────────────────────────────
    'cli.clear.description': 'Efface le terminal',
    'cli.clear.long_description': 'Efface tout le contenu de l\'écran du terminal',
    'cli.clear.shortcut': 'Raccourci :',

    // ── Version ───────────────────────────────────────────────────────
    'cli.version.description': 'Affiche les informations de version',
    'cli.version.long_description':
        'Affiche la version actuelle du CLI et le lien vers la documentation',

    // ── Uname ─────────────────────────────────────────────────────────
    'cli.uname.long_description':
        'Affiche les informations détaillées du système et du navigateur, notamment :',
    'cli.uname.cli_versions': 'Versions du noyau et des bibliothèques du CLI',
    'cli.uname.browser_info':
        'Nom du navigateur, version, agent utilisateur, langue et plateforme',
    'cli.uname.os': 'Système d\'exploitation',

    // ── Hash ──────────────────────────────────────────────────────────
    'cli.hash.description': 'Générer des empreintes de hachage de texte',
    'cli.hash.long_description':
        'Générer des empreintes de hachage cryptographiques à l\'aide de l\'API Web Crypto',

    // ── Cal ───────────────────────────────────────────────────────────
    'cli.cal.description': 'Afficher un calendrier',
    'cli.cal.long_description': 'Afficher un calendrier mensuel',
    'cli.cal.highlight_note': 'Le jour actuel est mis en surbrillance',
    'cli.cal.current_month': 'Mois actuel',
    'cli.cal.specific_month': 'Mois spécifique',

    // ── Time ──────────────────────────────────────────────────────────
    'cli.time.description': 'Afficher l\'heure locale et UTC actuelle',
    'cli.time.long_description': 'Afficher l\'heure locale et UTC actuelle',
    'cli.time.show_current': 'Afficher l\'heure locale et UTC actuelle',

    // ── Uptime ────────────────────────────────────────────────────────
    'cli.uptime.description': 'Afficher le temps d\'activité de la session',
    'cli.uptime.long_description':
        'Afficher depuis combien de temps la session actuelle du terminal est active',

    // ── Convert ───────────────────────────────────────────────────────
    'cli.convert.description': 'Convertir entre unités (longueur, poids, température, données)',
    'cli.convert.long_description': 'Convertir entre différentes unités de mesure',
    'cli.convert.supported': 'Pris en charge :',

    // ── Eval ──────────────────────────────────────────────────────────
    'cli.eval.description': 'Évaluer une expression JavaScript',
    'cli.eval.long_description': 'Évaluer une expression JavaScript',
    'cli.eval.supports':
        'Prend en charge l\'arithmétique, les chaînes, les tableaux, les objets et tout JS valide',

    // ── Seq ───────────────────────────────────────────────────────────
    'cli.seq.description': 'Afficher une séquence de nombres',
    'cli.seq.long_description': 'Afficher une séquence de nombres',
    'cli.seq.numbers_to_end': 'Nombres de 1 à la fin',
    'cli.seq.numbers_range': 'Nombres du début à la fin',
    'cli.seq.with_step': 'Avec un pas personnalisé',

    // ── Lorem ─────────────────────────────────────────────────────────
    'cli.lorem.description': 'Générer du texte de remplissage lorem ipsum',
    'cli.lorem.long_description': 'Générer du texte de remplissage lorem ipsum',
    'cli.lorem.gen_words': 'Générer des mots',
    'cli.lorem.gen_sentences': 'Générer des phrases',
    'cli.lorem.gen_paragraphs': 'Générer des paragraphes',

    // ── Alias / Unalias ──────────────────────────────────────────────
    'cli.alias.description': 'Gérer les alias de commandes',
    'cli.alias.long_description': 'Créer des raccourcis d\'alias pour les commandes fréquemment utilisées',
    'cli.alias.create_new': 'Créer un nouvel alias',
    'cli.alias.list_all': 'Lister tous les alias',
    'cli.alias.remove_hint': 'Utilisez {command} pour supprimer un alias',
    'cli.unalias.description': 'Supprimer des alias de commandes',
    'cli.unalias.long_description': 'Supprimer un alias de commande précédemment défini',

    // ── Open ──────────────────────────────────────────────────────────
    'cli.open.description': 'Ouvrir une URL dans un nouvel onglet du navigateur',
    'cli.open.long_description': 'Ouvrir une URL dans un nouvel onglet du navigateur',
    'cli.open.auto_https': 'Ajoute automatiquement https:// si aucun protocole n\'est spécifié',

    // ── Color ─────────────────────────────────────────────────────────
    'cli.color.description': 'Convertir et prévisualiser des couleurs (hex, rgb, hsl)',
    'cli.color.long_description': 'Convertir entre les formats de couleur et prévisualiser les couleurs',
    'cli.color.supported_formats': 'Formats pris en charge :',

    // ── History ───────────────────────────────────────────────────────
    'cli.history.long_description': 'Affiche l\'historique des commandes de la session actuelle',
    'cli.history.show': 'Afficher l\'historique des commandes',
    'cli.history.search': 'Rechercher dans l\'historique par motif',
    'cli.history.clear': 'Effacer tout l\'historique',
    'cli.history.arrow_hint':
        'Utilisez les touches fléchées {keys} pour naviguer dans l\'historique',
    'cli.history.prefix_hint':
        'Tapez un préfixe puis {key} pour rechercher dans l\'historique par préfixe',

    // ── Theme ─────────────────────────────────────────────────────────
    'cli.theme.description': 'Interagir avec le thème',
    'cli.theme.long_description':
        'Personnaliser l\'apparence du terminal avec des thèmes et des couleurs',

    // ── Hex ───────────────────────────────────────────────────────────
    'cli.hex.description': 'Encoder/décoder en hexadécimal et conversions de base numérique',
    'cli.hex.long_description':
        'Encoder/décoder du texte en hexadécimal et convertir des nombres entre bases',
    'cli.hex.text_to_hex': 'Texte vers hexadécimal',
    'cli.hex.hex_to_text': 'Hexadécimal vers texte',
    'cli.hex.base_conversion': 'Conversion de base',

    // ── Feedback ──────────────────────────────────────────────────────
    'cli.feedback.long_description':
        'Signaler des bogues, demander des fonctionnalités ou suggérer de nouvelles commandes — de manière interactive ou en ligne.',

    // ── JWT ───────────────────────────────────────────────────────────
    'cli.jwt.description': 'Décoder et inspecter des jetons JWT',
    'cli.jwt.long_description': 'Décoder et inspecter des JSON Web Tokens (JWT)',
    'cli.jwt.decode_display': 'Décoder et afficher le contenu du JWT',
    'cli.jwt.shows': 'Affiche : en-tête, charge utile, état d\'expiration, date d\'émission',

    // ── Sleep ─────────────────────────────────────────────────────────
    'cli.sleep.description': 'Suspendre l\'exécution pendant une durée spécifiée',
    'cli.sleep.long_description':
        'Suspend l\'exécution pendant la durée spécifiée (en millisecondes)',

    // ── Services ──────────────────────────────────────────────────────
    'cli.services.description': 'Gérer les services en arrière-plan et les tâches',
    'cli.services.long_description': 'Gérer les services en arrière-plan et les tâches',
    'cli.services.list_desc': 'Lister tous les services',
    'cli.services.start_desc': 'Démarrer un service',
    'cli.services.stop_desc': 'Arrêter un service',
    'cli.services.restart_desc': 'Redémarrer un service',
    'cli.services.logs_desc': 'Voir les journaux du service',
    'cli.services.info_desc': 'Détails du service',

    // ── Yes ───────────────────────────────────────────────────────────
    'cli.yes.description': 'Répéter une chaîne en continu',
    'cli.yes.long_description': 'Répéter une chaîne en continu',

    // ── Clipboard ─────────────────────────────────────────────────────
    'cli.clipboard.description': 'Copier ou coller depuis le presse-papiers',
    'cli.clipboard.long_description':
        'Copier du texte dans le presse-papiers du système ou coller du texte depuis celui-ci',
    'cli.clipboard.copy_desc': 'Copier du texte dans le presse-papiers',
    'cli.clipboard.paste_desc': 'Coller depuis le presse-papiers',

    // ── Hotkeys ───────────────────────────────────────────────────────
    'cli.hotkeys.description': 'Afficher les informations sur les raccourcis clavier',
    'cli.hotkeys.long_description':
        'Affiche tous les raccourcis clavier et touches rapides disponibles',

    // ── Export / Unset / Env ──────────────────────────────────────────
    'cli.export.description': 'Définir des variables d\'environnement',
    'cli.export.long_description': 'Définir ou afficher les variables d\'environnement',
    'cli.export.show_all': 'Afficher toutes les variables',
    'cli.export.set_var': 'Définir une variable',
    'cli.export.set_spaces': 'Définir avec des espaces',
    'cli.unset.description': 'Supprimer des variables d\'environnement',
    'cli.unset.long_description': 'Supprimer une variable d\'environnement',
    'cli.env.description': 'Afficher les variables d\'environnement',
    'cli.env.long_description': 'Afficher les variables d\'environnement',
    'cli.env.show_all': 'Afficher toutes les variables',
    'cli.env.show_single': 'Afficher une variable',

    // ── URL ───────────────────────────────────────────────────────────
    'cli.url.description': 'Encoder ou décoder des URLs',
    'cli.url.long_description': 'Encoder, décoder et analyser des URLs',
    'cli.url.encode_desc': 'Encoder une chaîne en URL',
    'cli.url.decode_desc': 'Décoder une chaîne URL',
    'cli.url.parse_desc': 'Analyser les composants d\'une URL',

    // ── JSON ──────────────────────────────────────────────────────────
    'cli.json.description': 'Formater, minifier ou valider du JSON',
    'cli.json.long_description': 'Formater, minifier ou valider des chaînes JSON',
    'cli.json.format_desc': 'Formater le JSON avec indentation',
    'cli.json.minify_desc': 'Supprimer les espaces',
    'cli.json.validate_desc': 'Vérifier si le JSON est valide',

    // ── Base64 ────────────────────────────────────────────────────────
    'cli.base64.description': 'Encoder ou décoder des chaînes Base64',
    'cli.base64.long_description': 'Encoder et décoder des chaînes Base64',
    'cli.base64.utf8_note': 'Prend en charge l\'encodage de texte UTF-8',
    'cli.base64.encode_desc': 'Encoder du texte en Base64',
    'cli.base64.decode_desc': 'Décoder du Base64 en texte',

    // ── Timestamp ─────────────────────────────────────────────────────
    'cli.timestamp.description': 'Convertir entre horodatages Unix et dates',
    'cli.timestamp.long_description':
        'Convertir entre horodatages Unix et dates lisibles',
    'cli.timestamp.current': 'Horodatage Unix actuel',
    'cli.timestamp.to_date': 'Horodatage vers date',
    'cli.timestamp.from_date': 'Date vers horodatage',

    // ── Screen ────────────────────────────────────────────────────────
    'cli.screen.description': 'Afficher les informations sur l\'écran et le terminal',
    'cli.screen.long_description':
        'Afficher les dimensions de l\'écran, de la fenêtre d\'affichage et du terminal',
    'cli.screen.shows':
        'Affiche : résolution, profondeur de couleur, ratio de pixels, taille de la fenêtre, taille du terminal',

    // ── Random ────────────────────────────────────────────────────────
    'cli.random.description': 'Générer des valeurs aléatoires',
    'cli.random.long_description': 'Générer des nombres, chaînes, UUIDs aléatoires et plus',
    'cli.random.number_desc': 'Nombre aléatoire (0-100)',
    'cli.random.string_desc': 'Chaîne aléatoire (16 caractères)',
    'cli.random.uuid_desc': 'UUID v4 aléatoire',
    'cli.random.coin_desc': 'Tirer à pile ou face',
    'cli.random.dice_desc': 'Lancer un dé',

    // ── Ping ──────────────────────────────────────────────────────────
    'cli.ping.description': 'Envoyer des pings de type ICMP à un hôte',
    'cli.ping.long_description':
        'Envoyer des pings HTTP de type ICMP à un hôte et afficher les statistiques aller-retour',
    'cli.ping.ctrl_c': 'Appuyez sur Ctrl+C pour arrêter et afficher les statistiques.',

    // ── Nano ──────────────────────────────────────────────────────────
    'cli.nano.description': 'Ouvrir l\'éditeur de texte intégré',
    'cli.nano.long_description': 'Ouvrir l\'éditeur de texte intégré de style nano',
    'cli.nano.open_empty': 'Ouvrir un tampon vide',
    'cli.nano.open_file': 'Ouvrir ou créer un fichier',
    'cli.nano.keyboard_shortcuts': 'Raccourcis clavier :',

    // ── Debug ─────────────────────────────────────────────────────────
    'cli.debug.description': 'Afficher les diagnostics détaillés du système et les composants internes du CLI',
    'cli.debug.long_description':
        'Affiche les diagnostics détaillés du système et les composants internes du CLI.',
    'cli.debug.hidden_note':
        'Cette commande est masquée dans la liste d\'aide mais accessible directement.',
    'cli.debug.summary': 'Résumé du système',
    'cli.debug.processors': 'Tous les processeurs enregistrés',
    'cli.debug.modules': 'Tous les modules chargés',
    'cli.debug.state': 'Inspecter les magasins d\'état',

    // ── Packages ──────────────────────────────────────────────────────
    'cli.packages.description': 'Gérer les paquets dans le CLI',
};
