import type { Messages } from './index';

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
    note: "Socle de la plateforme. Les premiers écrans arrivent avec les modules organisation et employés.",
    signIn: 'Se connecter',
  },
  home: {
    greeting: 'Bienvenue, {name}',
    signedInAs: 'Connecté en tant que {email}',
    tenant: 'Client',
    roles: 'Rôles',
    signOut: 'Se déconnecter',
  },
  signedOut: {
    title: 'Vous êtes déconnecté',
    body: 'Fermez cet onglet, ou reconnectez-vous pour continuer.',
    signInAgain: 'Se reconnecter',
  },
};
