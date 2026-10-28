import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const LOCALE_STORAGE_KEY = '@mobile/locale';

export const locales = {
  en: 'English',
  es: 'Español',
} as const;

export type Locale = keyof typeof locales;

const messages = {
  en: {
    actions: {
      clearImage: 'Clear image',
      selectImageFromCamera: 'Take photo',
      selectImageFromLibrary: 'Choose from photos',
      saveSettings: 'Save Settings',
      signIn: 'Sign In',
      logout: 'Logout',
      signOut: 'Sign Out',
      resetAuthentication: 'Reset authentication',
    },
    account: {
      accountId: 'Account ID',
      audience: 'Access audience',
      custom: 'Custom',
      displayName: 'Display name',
      email: 'Email',
      identityTitle: 'Identity',
      issuer: 'Identity provider',
      profileTitle: 'Profile',
      provider: 'Account provider',
      providerApple: 'Apple',
      providerDiscord: 'Discord',
      providerFacebook: 'Facebook',
      providerGitHub: 'GitHub',
      providerGitLab: 'GitLab',
      providerGoogle: 'Google',
      providerLinkedIn: 'LinkedIn',
      providerMicrosoft: 'Microsoft',
      providerX: 'X',
      signedInMessage: 'Your account is ready to use.',
      signedInStatus: 'Signed in',
      signedOutMessage: 'Sign in to access your account.',
      signedOutStatus: 'Not signed in',
      title: 'Account',
      username: 'Username',
      unavailable: 'Not available',
    },
    app: {
      description:
        'This app is intentionally neutral so you can replace the sample domain with your own product flow.',
      title: 'Blank Expo Starter',
    },
    auth: {
      profileUnavailable: 'The authenticated user profile is unavailable.',
      redirectingHome: 'Redirecting to Home',
      redirectingHomeMessage: 'Your session is ready. Taking you to your home.',
      signedIn: 'You are signed in.',
      signedInAs: 'Signed in as',
      signInWithGoogle: 'Sign in with Google',
      subtitle:
        'Continue with your configured identity provider to access your account.',
      title: 'Welcome back',
    },
    common: {
      loading: 'Loading...',
    },
    datePicker: {
      cancel: 'Cancel',
      clear: 'Clear date',
      confirm: 'Confirm',
      open: 'Open date picker',
      placeholder: 'Select date',
      title: 'Select date',
    },
    errors: {
      apiRequestTimedOut:
        'The API request timed out. Check the API connection.',
      authenticationFailed: 'Sign-in or authenticated request failed.',
      noRefreshToken: 'No refresh token is available.',
      refreshOutcomeUnknown:
        'The token refresh could not be completed safely. Sign in again to continue.',
      tokenEndpointUnavailable:
        'The identity provider configuration does not include a token endpoint.',
      tokenRefreshFailed: 'Token refresh failed. Sign in again if needed.',
      signOutFailed: 'Sign out failed. Please try again.',
      errorBoundaryMessage: 'Message:',
      errorBoundaryStack: 'Stack:',
      errorBoundaryTitle: 'Error encountered',
      imagePermissionDenied:
        'Image access is disabled. Enable camera or photo permissions in your device settings.',
      imageSelectionFailed: 'The image could not be selected.',
      goHome: 'Go to home screen',
      notFoundMessage: "This screen doesn't exist.",
      notFoundTitle: 'Oops!',
    },
    font: {
      label: 'Font',
      codex: 'Codex',
      codexItalic: 'Codex Italic',
      fallingSkySemibold: 'Falling Sky Semibold',
      fallingSkyMediumOblique: 'Falling Sky Medium Oblique',
      fallingSkyLight: 'Falling Sky Light',
      fallingSkyBlack: 'Falling Sky Black',
      fashionvictim: 'Fashionvictim',
      kindred: 'Kindred',
      kindredItalic: 'Kindred Italic',
      nesathoberyl: 'Nesathoberyl',
      timeburnerBold: 'Timeburner Bold',
      spaceMono: 'Space Mono',
      typeLightSans: 'Type Light Sans',
      zomboid: 'Zomboid',
    },
    language: {
      label: 'Language',
    },
    menu: {
      accountAction: 'Open account',
      close: 'Close menu',
      drawerDescription: 'A reusable drawer that adapts to your theme.',
      drawerTitle: 'Explore',
      explore: 'Explore the menu',
      highlightsDescription:
        'Use quick actions for Account and Settings, or close the drawer with the close button or backdrop.',
      highlightsTitle: 'What this menu can do',
      moreActions: 'More menu actions',
      open: 'Open menu',
      quickActionsDescription:
        'Jump directly to Account or Settings from the quick actions.',
      quickActionsTitle: 'Quick actions',
      responsiveDescription:
        'An animated drawer with adjustable width and left or right positioning.',
      responsiveTitle: 'Flexible drawer',
      settingsAction: 'Open settings',
      showcaseDescription:
        'See theme-aware styling, an animated drawer, and quick links to Account and Settings.',
      showcaseTitle: 'Explore the menu',
      themeAwareDescription:
        'Colors follow the app’s current light or dark theme.',
      themeAwareTitle: 'Theme-aware styling',
    },
    sampleContent: {
      communityBoardDescription:
        'Recommendations, announcements, and local stories.',
      communityBoardTitle: 'Community board',
      fieldNotesDescription:
        'Observations and ideas captured throughout the day.',
      fieldNotesTitle: 'Field notes',
      morningBriefDescription:
        "A quick look at today's weather and noteworthy updates.",
      morningBriefTitle: 'Morning brief',
      photoJournalDescription:
        'Moments from recent outings and everyday life.',
      photoJournalTitle: 'Photo journal',
      readingListDescription:
        'Articles and books saved to revisit when you have time.',
      readingListTitle: 'Reading list',
      recentActivityDescription:
        'Updates from projects, shared spaces, and personal tasks.',
      recentActivityTitle: 'Recent activity',
      sectionTitle: 'Everyday examples',
      weeklyPlanDescription:
        'Upcoming events and priorities collected in one place.',
      weeklyPlanTitle: 'Weekly plan',
    },
    scanner: {
      allowCamera: 'Allow camera',
      permissionDenied:
        'Camera access is disabled. Enable it in your device settings.',
      permissionRequired: 'Camera access is required to scan a barcode.',
      scanAgain: 'Scan again',
      scanComplete: 'Barcode captured',
      resultData: 'Data',
      resultType: 'Type',
    },
    settings: {
      darkMode: 'Dark mode',
      manage: 'Manage',
      notifications: 'Notifications',
      privacy: 'Privacy',
      review: 'Review',
      title: 'Settings',
      toggle: 'Toggle',
    },
    status: {
      authenticating: 'Signing in...',
      authenticationCancelled: 'Sign-in was cancelled.',
      loadingAuthenticatedRequest: 'Preparing authenticated request...',
      preparingAuthentication: 'Preparing sign-in...',
      signedOut: 'Signed out.',
    },
    theme: {
      dark: 'Dark',
      label: 'Theme',
      light: 'Light',
      system: 'System',
    },
    tabs: {
      account: 'Account',
      home: 'Home',
      requests: 'Requests',
      settings: 'Settings',
    },
  },
  es: {
    actions: {
      clearImage: 'Borrar imagen',
      selectImageFromCamera: 'Tomar foto',
      selectImageFromLibrary: 'Elegir de las fotos',
      saveSettings: 'Guardar configuración',
      signIn: 'Iniciar sesión',
      logout: 'Cerrar sesión',
      signOut: 'Cerrar sesión',
      resetAuthentication: 'Restablecer autenticación',
    },
    account: {
      accountId: 'ID de la cuenta',
      audience: 'Audiencia de acceso',
      custom: 'Personalizado',
      displayName: 'Nombre visible',
      email: 'Correo electrónico',
      identityTitle: 'Identidad',
      issuer: 'Proveedor de identidad',
      profileTitle: 'Perfil',
      provider: 'Proveedor de la cuenta',
      providerApple: 'Apple',
      providerDiscord: 'Discord',
      providerFacebook: 'Facebook',
      providerGitHub: 'GitHub',
      providerGitLab: 'GitLab',
      providerGoogle: 'Google',
      providerLinkedIn: 'LinkedIn',
      providerMicrosoft: 'Microsoft',
      providerX: 'X',
      signedInMessage: 'Tu cuenta está lista para usarse.',
      signedInStatus: 'Sesión iniciada',
      signedOutMessage: 'Inicia sesión para acceder a tu cuenta.',
      signedOutStatus: 'Sesión no iniciada',
      title: 'Cuenta',
      username: 'Nombre de usuario',
      unavailable: 'No disponible',
    },
    app: {
      description:
        'Esta aplicación es intencionalmente neutral para que puedas reemplazar el dominio de ejemplo con el flujo de tu producto.',
      title: 'Plantilla Expo en blanco',
    },
    auth: {
      profileUnavailable:
        'El perfil del usuario autenticado no está disponible.',
      redirectingHome: 'Redirigiendo al inicio',
      redirectingHomeMessage: 'Tu sesión está lista. Te llevamos a tu inicio.',
      signedIn: 'Has iniciado sesión.',
      signedInAs: 'Sesión iniciada como',
      signInWithGoogle: 'Iniciar sesión con Google',
      subtitle:
        'Continúa con el proveedor de identidad configurado para acceder a tu cuenta.',
      title: 'Te damos la bienvenida',
    },
    common: {
      loading: 'Cargando...',
    },
    datePicker: {
      cancel: 'Cancelar',
      clear: 'Borrar fecha',
      confirm: 'Confirmar',
      open: 'Abrir selector de fecha',
      placeholder: 'Seleccionar fecha',
      title: 'Seleccionar fecha',
    },
    errors: {
      apiRequestTimedOut:
        'La solicitud a la API superó el tiempo de espera. Comprueba la conexión con la API.',
      authenticationFailed:
        'El inicio de sesión o la solicitud autenticada falló.',
      noRefreshToken: 'No hay un token de actualización disponible.',
      refreshOutcomeUnknown:
        'No se pudo completar la renovación del token de forma segura. Inicia sesión de nuevo para continuar.',
      tokenEndpointUnavailable:
        'La configuración del proveedor de identidad no incluye un endpoint de token.',
      tokenRefreshFailed:
        'La renovación del token falló. Inicia sesión de nuevo si es necesario.',
      signOutFailed: 'No se pudo cerrar la sesión. Inténtalo de nuevo.',
      errorBoundaryMessage: 'Mensaje:',
      errorBoundaryStack: 'Pila:',
      errorBoundaryTitle: 'Ocurrió un error',
      imagePermissionDenied:
        'El acceso a las imágenes está desactivado. Activa los permisos de cámara o fotos en los ajustes del dispositivo.',
      imageSelectionFailed: 'No se pudo seleccionar la imagen.',
      goHome: 'Ir a la pantalla de inicio',
      notFoundMessage: 'Esta pantalla no existe.',
      notFoundTitle: '¡Vaya!',
    },
    font: {
      label: 'Fuente',
      codex: 'Codex',
      codexItalic: 'Codex cursiva',
      fallingSkySemibold: 'Falling Sky seminegrita',
      fallingSkyOutline: 'Falling Sky contorno',
      fallingSkyMediumOblique: 'Falling Sky oblicua mediana',
      fallingSkyLight: 'Falling Sky ligera',
      fallingSkyExtendedOutline: 'Falling Sky contorno extendido',
      fallingSkyBlack: 'Falling Sky negra',
      freedom2: 'Freedom 2',
      freedom: 'Freedom',
      forque: 'Forque',
      fashionvictim: 'Fashionvictim',
      kindred: 'Kindred',
      kindredItalic: 'Kindred cursiva',
      nesathoberyl: 'Nesathoberyl',
      roBlueShellBold: 'Ro Blue Shell negrita',
      timeburner: 'Timeburner',
      timeburnerBold: 'Timeburner negrita',
      spaceMono: 'Space Mono',
      typeLightSans: 'Type Light Sans',
      zomboid: 'Zomboid',
    },
    language: {
      label: 'Idioma',
    },
    menu: {
      accountAction: 'Abrir cuenta',
      close: 'Cerrar menú',
      drawerDescription: 'Un panel reutilizable que se adapta al tema.',
      drawerTitle: 'Explorar',
      explore: 'Explorar el menú',
      highlightsDescription:
        'Usa las acciones rápidas para ir a Cuenta o Configuración, o cierra el panel con el botón o tocando el fondo.',
      highlightsTitle: 'Qué puedes hacer con este menú',
      moreActions: 'Más acciones del menú',
      open: 'Abrir menú',
      quickActionsDescription:
        'Ve directamente a Cuenta o Configuración desde las acciones rápidas.',
      quickActionsTitle: 'Acciones rápidas',
      responsiveDescription:
        'Panel animado con ancho ajustable y apertura desde la izquierda o la derecha.',
      responsiveTitle: 'Panel flexible',
      settingsAction: 'Abrir configuración',
      showcaseDescription:
        'Prueba el estilo adaptado al tema, el panel animado y los accesos rápidos a Cuenta y Configuración.',
      showcaseTitle: 'Explora el menú',
      themeAwareDescription:
        'Los colores siguen el tema claro u oscuro actual de la aplicación.',
      themeAwareTitle: 'Estilo adaptado al tema',
    },
    sampleContent: {
      communityBoardDescription:
        'Recomendaciones, anuncios e historias locales.',
      communityBoardTitle: 'Tablón comunitario',
      fieldNotesDescription:
        'Observaciones e ideas registradas a lo largo del día.',
      fieldNotesTitle: 'Notas de campo',
      morningBriefDescription:
        'Un vistazo rápido al clima de hoy y a las novedades destacadas.',
      morningBriefTitle: 'Resumen matutino',
      photoJournalDescription:
        'Momentos de paseos recientes y de la vida cotidiana.',
      photoJournalTitle: 'Diario fotográfico',
      readingListDescription:
        'Artículos y libros guardados para volver a ellos cuando tengas tiempo.',
      readingListTitle: 'Lista de lectura',
      recentActivityDescription:
        'Novedades de proyectos, espacios compartidos y tareas personales.',
      recentActivityTitle: 'Actividad reciente',
      sectionTitle: 'Ejemplos cotidianos',
      weeklyPlanDescription:
        'Próximos eventos y prioridades reunidos en un solo lugar.',
      weeklyPlanTitle: 'Plan semanal',
    },
    scanner: {
      allowCamera: 'Permitir cámara',
      permissionDenied:
        'El acceso a la cámara está desactivado. Actívalo en los ajustes del dispositivo.',
      permissionRequired:
        'Se necesita acceso a la cámara para escanear un código de barras.',
      scanAgain: 'Escanear de nuevo',
      scanComplete: 'Código de barras capturado',
      resultData: 'Datos',
      resultType: 'Tipo',
    },
    settings: {
      darkMode: 'Modo oscuro',
      manage: 'Administrar',
      notifications: 'Notificaciones',
      privacy: 'Privacidad',
      review: 'Revisar',
      title: 'Configuración',
      toggle: 'Cambiar',
    },
    status: {
      authenticating: 'Iniciando sesión...',
      authenticationCancelled: 'El inicio de sesión fue cancelado.',
      loadingAuthenticatedRequest: 'Preparando la solicitud autenticada...',
      preparingAuthentication: 'Preparando el inicio de sesión...',
      signedOut: 'Sesión cerrada.',
    },
    theme: {
      dark: 'Oscuro',
      label: 'Tema',
      light: 'Claro',
      system: 'Sistema',
    },
    tabs: {
      account: 'Cuenta',
      home: 'Inicio',
      requests: 'Solicitudes',
      settings: 'Configuración',
    },
  },
} as const;

export type TranslationKey =
  | `actions.${keyof typeof messages.en.actions}`
  | `account.${keyof typeof messages.en.account}`
  | `app.${keyof typeof messages.en.app}`
  | `auth.${keyof typeof messages.en.auth}`
  | `common.${keyof typeof messages.en.common}`
  | `datePicker.${keyof typeof messages.en.datePicker}`
  | `errors.${keyof typeof messages.en.errors}`
  | `font.${keyof typeof messages.en.font}`
  | `language.${keyof typeof messages.en.language}`
  | `menu.${keyof typeof messages.en.menu}`
  | `sampleContent.${keyof typeof messages.en.sampleContent}`
  | `scanner.${keyof typeof messages.en.scanner}`
  | `settings.${keyof typeof messages.en.settings}`
  | `status.${keyof typeof messages.en.status}`
  | `theme.${keyof typeof messages.en.theme}`
  | `tabs.${keyof typeof messages.en.tabs}`;

type I18nContextValue = {
  locale: Locale;
  locales: typeof locales;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getDeviceLocale(): Locale {
  const languageCode = getLocales()[0]?.languageCode?.toLowerCase();
  return languageCode === 'es' ? 'es' : 'en';
}

export function getMessage(locale: Locale, key: TranslationKey) {
  const [section, messageKey] = key.split('.') as [
    keyof typeof messages.en,
    string,
  ];
  const localizedSection = messages[locale][section] as Record<string, string>;
  const fallbackSection = messages.en[section] as Record<string, string>;

  return localizedSection[messageKey] ?? fallbackSection[messageKey] ?? key;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getDeviceLocale);

  useEffect(() => {
    AsyncStorage.getItem(LOCALE_STORAGE_KEY)
      .then((storedLocale) => {
        if (storedLocale === 'en' || storedLocale === 'es') {
          setLocaleState(storedLocale);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale).catch(() => undefined);
  };

  const value = useMemo(
    () => ({
      locale,
      locales,
      setLocale,
      t: (key: TranslationKey) => getMessage(locale, key),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }

  return context;
}
