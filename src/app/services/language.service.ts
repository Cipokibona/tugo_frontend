import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppLanguage = 'fr' | 'en';

type Dictionary = Record<string, string>;

const TRANSLATIONS: Record<AppLanguage, Dictionary> = {
  en: {
    'language.label': 'Language',
    'language.english': 'English',
    'language.french': 'French',
    'nav.home': 'Home',
    'nav.notifications': 'Notifications',
    'nav.taxi': 'Taxi',
    'nav.contact': 'Contact us',
    'nav.logout': 'Logout',
    'login.welcome': 'Welcome back',
    'login.subtitle': 'Sign in to continue',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.submit': 'Login',
    'login.loading': 'Signing in...',
    'login.no_account': "Don't have an account?",
    'login.signup': 'Sign up',
    'signup.title': 'Create your account',
    'signup.subtitle': 'Join Tugo and start sharing rides',
    'signup.full_name': 'Full name',
    'signup.phone': 'Phone number',
    'signup.username': 'Username',
    'signup.password': 'Password',
    'signup.confirm_password': 'Confirm password',
    'signup.submit': 'Create account',
    'signup.loading': 'Creating account...',
    'signup.cancel': 'Cancel',
    'signup.have_account': 'Already have an account?',
    'signup.login': 'Login',
    'home.available': 'Available rides',
    'home.find_near': 'Find a ride near you',
    'home.from': 'From',
    'home.to': 'To',
    'home.all_itineraries': 'All itineraries',
    'home.user_itineraries': 'Users itineraries',
    'home.proposed_itineraries': 'Proposed itineraries',
    'home.my_bookings': 'My bookings',
    'home.loading_bookings': 'Loading your bookings...',
    'home.no_bookings': 'You do not have a booking yet.',
    'home.unknown_city': 'Unknown city',
    'home.view_trip': 'View trip',
    'home.loading': 'Loading...',
    'home.no_rides': 'No rides available',
    'home.try_adjust': 'Try adjusting your search criteria or check back later.',
    'home.ride_proposal': 'Ride proposal',
    'home.joined_count': 'joined',
    'home.no_existing_ride': 'This is not an existing ride yet.',
    'home.no_driver':
      'No driver has accepted this trip. Joining this proposal significantly increases the chance of finding one.',
    'home.proposed_price': 'Proposed price:',
    'home.joined': 'Joined',
    'home.join_proposal': 'Join proposal',
    'home.book': 'Book',
    'home.your_ride': 'Your ride',
  },
  fr: {
    'language.label': 'Langue',
    'language.english': 'Anglais',
    'language.french': 'Français',
    'nav.home': 'Accueil',
    'nav.notifications': 'Notifications',
    'nav.taxi': 'Taxi',
    'nav.contact': 'Contact',
    'nav.logout': 'Se deconnecter',
    'login.welcome': 'Bon retour',
    'login.subtitle': 'Connectez-vous pour continuer',
    'login.username': "Nom d'utilisateur",
    'login.password': 'Mot de passe',
    'login.submit': 'Connexion',
    'login.loading': 'Connexion...',
    'login.no_account': "Vous n'avez pas de compte ?",
    'login.signup': "S'inscrire",
    'signup.title': 'Creer votre compte',
    'signup.subtitle': 'Rejoignez Tugo et commencez le covoiturage',
    'signup.full_name': 'Nom complet',
    'signup.phone': 'Numero de telephone',
    'signup.username': "Nom d'utilisateur",
    'signup.password': 'Mot de passe',
    'signup.confirm_password': 'Confirmer le mot de passe',
    'signup.submit': 'Creer le compte',
    'signup.loading': 'Creation du compte...',
    'signup.cancel': 'Annuler',
    'signup.have_account': 'Vous avez deja un compte ?',
    'signup.login': 'Connexion',
    'home.available': 'Trajets disponibles',
    'home.find_near': 'Trouvez un trajet pres de vous',
    'home.from': 'Depart',
    'home.to': 'Destination',
    'home.all_itineraries': 'Tous les itineraires',
    'home.user_itineraries': 'Mes itineraires',
    'home.proposed_itineraries': 'Itineraires proposes',
    'home.my_bookings': 'Mes reservations',
    'home.loading_bookings': 'Chargement de vos reservations...',
    'home.no_bookings': "Vous n'avez pas encore de reservation.",
    'home.unknown_city': 'Ville inconnue',
    'home.view_trip': 'Voir le trajet',
    'home.loading': 'Chargement...',
    'home.no_rides': 'Aucun trajet disponible',
    'home.try_adjust': 'Essayez de modifier vos criteres de recherche ou revenez plus tard.',
    'home.ride_proposal': 'Proposition de trajet',
    'home.joined_count': 'participants',
    'home.no_existing_ride': "Ce trajet n'existe pas encore.",
    'home.no_driver':
      "Aucun chauffeur n'a encore accepte ce trajet. Rejoindre cette proposition augmente fortement les chances d'en trouver un.",
    'home.proposed_price': 'Prix propose :',
    'home.joined': 'Rejoint',
    'home.join_proposal': 'Rejoindre',
    'home.book': 'Reserver',
    'home.your_ride': 'Votre trajet',
  },
};

@Injectable({
  providedIn: 'root',
})
export class LanguageService {
  private readonly storageKey = 'app_language';
  private readonly languageSubject = new BehaviorSubject<AppLanguage>(this.resolveInitialLanguage());

  readonly language$ = this.languageSubject.asObservable();

  get currentLanguage(): AppLanguage {
    return this.languageSubject.value;
  }

  setLanguage(language: AppLanguage) {
    this.languageSubject.next(language);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.storageKey, language);
    }
  }

  translate(key: string): string {
    const language = this.currentLanguage;
    return TRANSLATIONS[language][key] ?? TRANSLATIONS.en[key] ?? key;
  }

  private resolveInitialLanguage(): AppLanguage {
    if (typeof window === 'undefined') {
      return 'fr';
    }

    const stored = localStorage.getItem(this.storageKey);
    if (stored === 'fr' || stored === 'en') {
      return stored;
    }

    const browserLanguage = navigator.language?.toLowerCase() || '';
    return browserLanguage.startsWith('fr') ? 'fr' : 'en';
  }
}
