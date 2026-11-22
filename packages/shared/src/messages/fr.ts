import type { Messages } from './index.js';

/**
 * French, written for HR staff in Morocco: the words they use at work, not a
 * dictionary translation of the English (M23).
 */
export const fr: Messages = {
  common: {
    appName: 'CPeople',
    byConsap: 'par ConSAP',
    language: 'Langue',
    english: 'English',
    french: 'Français',
  },
  landing: {
    title: 'Voyez vos équipes. Payez-les justement.',
    note: "Socle de la plateforme. Les premiers écrans arrivent avec les modules organisation et salariés.",
    signIn: 'Se connecter',
  },
  roles: {
    'platform-admin': 'Administrateur de la plateforme',
    'hr-admin': 'Administrateur RH',
    'payroll-manager': 'Responsable paie',
    manager: 'Manager',
    employee: 'Salarié',
  },
  shell: {
    home: 'Accueil CPeople',
    mainNav: 'Navigation principale',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    pin: 'Garder le menu ouvert',
    unpin: 'Laisser le menu se refermer',
    search: 'Rechercher',
    searchPlaceholder: 'Rechercher : salariés, bulletins, demandes',
    languageLabel: 'Langue : {language}',
    notifications: 'Notifications, {count} non lues',
    account: 'Compte : {name}',
    signOut: 'Se déconnecter',
    waiting: '{label}, {count} en attente',
    groups: {
      people: 'Personnel',
      time: 'Temps',
      pay: 'Paie',
      company: 'Entreprise',
    },
    nav: {
      home: 'Accueil',
      employees: 'Salariés',
      onboarding: 'Intégration',
      contracts: 'Contrats',
      orgChart: 'Organigramme',
      attendance: 'Pointage',
      leave: 'Congés',
      payroll: 'Paie',
      payslips: 'Bulletins de paie',
      expenses: 'Notes de frais',
      declarations: 'Déclarations',
      sapPosting: 'Comptabilisation SAP',
      settings: 'Paramètres',
    },
    tenantNote: '{city}, pack {country}',
  },
  welcome: {
    /** Read aloud while the animation plays; nobody has to wait for it. */
    announce: 'Connexion à CPeople',
    skip: 'Passer l’animation d’accueil',
  },
  modules: {
    building: 'Cet écran est en cours de construction pour l’atelier HR-01.',
    hr01: 'Atelier HR-01 · 23 novembre 2026',
    hr02: 'Atelier HR-02 · 24 novembre 2026',
    hr03: 'Atelier HR-03 · 25 novembre 2026',
    later: 'Plus tard dans le MVP',
    attendance:
      'Jours travaillés, heures supplémentaires et jours de week-end, importés des pointeuses par fichier ou par API.',
    leave:
      'Les congés selon la loi marocaine et le contrat, demandés par le salarié puis validés par le N+1 et le N+2.',
    payroll:
      'La paie mensuelle — CNSS, AMO, CIMR et IR — ouverte, calculée, vérifiée, validée puis clôturée.',
    payslips: 'Les bulletins de paie au format marocain, envoyés par e-mail après la validation RH.',
    declarations: 'Les données mensuelles de la déclaration CNSS pour Damancom, et les données de l’IR.',
    sapPosting:
      'Le journal de paie, vérifié débit contre crédit puis comptabilisé dans SAP S/4HANA par centre de coût.',
    expenses:
      'Les notes de frais : le salarié dépose, le manager valide, la paie rembourse.',
    settings: 'L’entreprise, son organisation, les modèles de contrats et de documents, et qui a le droit de voir quoi.',
  },
  home: {
    greeting: {
      // Bonjour covers the morning and the afternoon; "Bienvenue" belongs to the
      // sign-in page and stays there.
      morning: 'Bonjour, {name}',
      afternoon: 'Bonjour, {name}',
      evening: 'Bonsoir, {name}',
    },
    today: '{date}. {status}',
    runStatus: {
      review: 'La paie de {month} est en cours de revue.',
    },
    run: {
      payDate: 'Paiement dans {days} jours, le {date}',
      title: 'Paie de {month}',
      summary:
        'La version {version} a été calculée aujourd’hui à {time} pour {employees} salariés. Vérifiez {points} points, puis envoyez-la en validation RH.',
      seeResults: 'Voir les résultats par salarié',
      continueReview: 'Continuer la revue',
      steps: 'Étapes de la paie',
      figures: {
        gross: 'Salaire brut',
        grossNote: '{change} par rapport à {month}',
        net: 'Net à payer',
        netNote: '{count} bulletins',
        charges: 'Charges patronales',
        chargesNote: 'CNSS, AMO, CIMR',
        tax: 'IR retenu',
        taxNote: 'IR, données mensuelles prêtes après la clôture',
      },
      step: {
        opened: 'Ouverte',
        openedNote: '{date}',
        variables: 'Variables',
        variablesNote: 'Pointage {date}',
        calculated: 'Calculée',
        calculatedNote: 'Version {version}',
        review: 'Revue',
        reviewNote: '{count} points à vérifier',
        hrApproval: 'Validation RH',
        hrApprovalNote: '{name}',
        lock: 'Clôture et bulletins',
        lockNote: '{count} par e-mail',
        post: 'Comptabilisation SAP',
        postNote: 'Pièce comptable S/4HANA',
      },
    },
    kpis: {
      label: 'La journée en bref',
      headcount: 'Effectif',
      headcountNote: '{joined} arrivées et {left} départ en {month}',
      present: 'Présents aujourd’hui',
      presentSuffix: 'sur {expected}',
      presentNote: 'Importé des pointeuses à {time}',
      leave: 'Demandes de congé',
      leaveSuffix: 'en attente',
      leaveNote: '{count} attendent la validation N+2',
      documents: 'Documents qui expirent',
      documentsSuffix: 'sous {days} jours',
      documentsNote: '{permits} cartes de séjour, {certificates} certificats médicaux',
    },
    tasks: {
      title: 'À traiter',
      openInbox: 'Ouvrir la liste',
      holidayReview: {
        title: 'À vérifier : {count} salariés ont travaillé le jour férié du {date}',
        detail: 'La majoration pour jour férié est appliquée aux {count}. À confirmer avant validation.',
        status: 'Revue de paie',
        action: 'Vérifier',
      },
      leaveApproval: {
        title: '{name}, congé annuel',
        detail: 'Du {from} au {to}, {days} jours ouvrés. Validé par son manager.',
        status: 'Votre validation (N+2)',
        action: 'Examiner',
      },
      expenseApproval: {
        title: '{name}, frais de transport',
        detail: '{amount} avec {receipts} justificatifs, pour la paie de {month}',
        status: 'Votre validation',
        action: 'Examiner',
      },
      contractEnding: {
        title: '{name}, fin de contrat à durée déterminée',
        detail: 'Le CDD se termine le {date}. À renouveler ou à clôturer cette semaine.',
        status: 'À faire sous {days} jours',
        action: 'Préparer',
      },
      unmatchedPunches: {
        title: '{count} pointages sans salarié',
        detail: 'Depuis la pointeuse {device}, import du {time}',
        status: 'Import',
        action: 'Corriger',
      },
    },
    away: {
      title: 'Absents cette semaine',
      calendar: 'Calendrier des congés',
      count: '{count} absents',
      holiday: 'Férié',
      holidayNote:
        'Aujourd’hui, c’est {holiday}, un jour férié. {count} personnes sont prévues au travail.',
      range: 'du {from} au {to}',
      types: {
        annual: 'Congé annuel',
        sick: 'Congé maladie',
        training: 'Formation',
      },
      holidays: {
        independence: 'la fête de l’Indépendance',
      },
    },
    cost: {
      title: 'Coût de la paie, 12 derniers mois',
      subtitle: 'Salaire brut et charges patronales, en {currency}',
      gross: 'Salaire brut',
      charges: 'Charges patronales',
      description:
        'Coût de la paie de {from} à {to} : salaire brut entre {grossLow} et {grossHigh}, charges patronales entre {chargesLow} et {chargesHigh}.',
      month: 'Afficher {month}',
    },
    departments: {
      title: 'Effectif par département',
      note: '{count} salariés, {fixedTerm} en contrat à durée déterminée',
      names: {
        kitchen: 'Cuisine',
        outlet: 'Point de vente',
        pastry: 'Pâtisserie',
        administration: 'Administration',
        warehouse: 'Entrepôt',
      },
    },
    connections: {
      title: 'Déclarations et connexions',
      sap: 'SAP S/4HANA',
      sapNote:
        'Paie de {month} comptabilisée par centre de coût le {date}. Pièce comptable {entry}.',
      cnss: 'CNSS Damancom',
      cnssNote:
        'Données de la déclaration de {month} prêtes. {next} après la clôture de la paie.',
      tax: 'Impôt sur le revenu (IR)',
      taxNote: 'Données de {month} prêtes à télécharger.',
      devices: 'Pointeuses',
      devicesNote:
        'Dernier import aujourd’hui à {time}. {count} pointages doivent être rattachés à un salarié.',
    },
  },
  signedOut: {
    title: 'Vous êtes déconnecté',
    body: 'Fermez cet onglet, ou reconnectez-vous pour continuer.',
    signInAgain: 'Se reconnecter',
  },
};
