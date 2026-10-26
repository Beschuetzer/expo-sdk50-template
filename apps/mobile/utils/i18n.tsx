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
      clearBackendCache: 'Clear Backend Cache',
      decreaseErrorCount: 'Decrease error count',
      increaseErrorCount: 'Increase error count',
      clearImage: 'Clear image',
      selectImageFromCamera: 'Take photo',
      selectImageFromLibrary: 'Choose from photos',
      testImageSelector: 'Test image selector',
      readBackendCache: 'Read Cached Health',
      saveSettings: 'Save Settings',
      testAnonymousEndpoint: 'Verify Anonymous Access Is Rejected',
      testAuthenticatedEndpoint: 'Call Authenticated Endpoint',
      testBarcodeScanner: 'Test Barcode Scanner',
      testBackendConnection: 'Test Backend Connection',
      testErrorCount: 'Error count',
      testErrorModal: 'Test ErrorModal',
      testTokenRefresh: 'Test Token Refresh',
      signIn: 'Sign In',
      logout: 'Logout',
      signOut: 'Sign Out',
      addRandomExample: 'Add Random Example',
      resetAuthentication: 'Reset authentication',
      hideBarcodeScanner: 'Hide Barcode Scanner',
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
      signedOutMessage: 'Sign in to access your relationships and requests.',
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
        'Use your Google or GitHub account to access your relationship space.',
      title: 'Welcome back',
    },
    checklist: {
      addRedux: 'Add your own Redux slices and state patterns',
      addScreens: 'Add screens, modals, and routes for your product domain',
      replaceContent:
        'Replace the home screen content with your app landing view',
      title: 'Starter checklist',
    },
    common: {
      loading: 'Loading...',
    },
    home: {
      eyebrow: 'YOUR SHARED SPACE',
      title: 'A little more us, every day.',
      description: 'One calm place for the plans, asks, and moments you share.',
      spaceLabel: 'Your relationship space',
      connectedStatus: 'Ready for both of you',
      connectedMessage:
        'Your account is connected. Keep your shared plans moving.',
      createSpaceTitle: 'Create your first space',
      createSpace: 'Create space',
      noSpacesMessage:
        'Give your shared space a name, then invite someone to join you.',
      spaceLoadFailed: 'Your relationship spaces could not be loaded.',
      retry: 'Try again',
      spaceNamePlaceholder: 'Space name',
      members: 'members',
      relationshipsTitle: 'Your relationships',
      createAnotherSpace: 'Create another space',
      noRelationships: 'You are not part of any relationship spaces yet.',
      openDetails: 'Open relationship details',
      relationshipNotFound: 'This relationship space could not be found.',
      detailsDescription: 'The people and shared plans in this space.',
      membersTitle: 'Members',
      owner: 'Owner',
      member: 'Member',
      findRelationship: 'Find a relationship',
      searchRelationshipsTitle: 'Find a relationship',
      searchRelationshipsDescription:
        'Search by relationship name or share code.',
      searchRelationshipsPlaceholder: 'Name or share code',
      searchRelationshipsMinimum: 'Enter at least 2 characters to search.',
      searchRelationshipsEmpty: 'No relationships matched your search.',
      searchRelationshipsError: 'Relationships could not be searched.',
      relationshipShareCode: 'Share code',
      relationshipMemberCount: 'members',
      requestToJoin: 'Request to join',
      requestPending: 'Request pending',
      alreadyMember: 'Already a member',
      pendingJoinRequestsTitle: 'Join requests',
      noPendingJoinRequests: 'No pending join requests.',
      approveJoinRequest: 'Approve',
      rejectJoinRequest: 'Decline',
      joinRequestError: 'The join request could not be updated.',
      viewRequests: 'View shared requests',
      signedOutStatus: 'Start with a sign-in',
      signedOutMessage:
        'Sign in to create and manage the things you share together.',
      openRequests: 'View shared requests',
      inviteMember: 'Invite someone',
      signIn: 'Sign in',
      quickActions: 'Quick actions',
      requestsAction: 'Shared requests',
      settingsAction: 'Settings',
      accessTokenTtl: 'Access token TTL',
      accessTokenTtlUnavailable: 'Unavailable',
      accessTokenTtlWebUnavailable: 'Unavailable for web sessions',
      accessTokenExpired: 'Expired',
      ttlDayShort: 'd',
      ttlHourShort: 'h',
      ttlMinuteShort: 'm',
      ttlSecondShort: 's',
      noteTitle: 'A small reminder',
      noteMessage: 'The best relationships are built in the small moments.',
    },
    errors: {
      anonymousRequestAccepted:
        'Security check failed: the endpoint accepted an anonymous request.',
      anonymousRequestFailed: 'Anonymous endpoint security check failed.',
      apiRequestTimedOut:
        'The API request timed out. Check the API connection.',
      backendRequestFailed: 'Backend request failed',
      backendUnavailable: 'Backend connection failed. Is the API running?',
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
      testErrorModalMessage:
        'This is a test error generated by the ErrorModal demo.',
      testErrorModalStack: 'Triggered from the starter home screen.',
      unexpectedBackendStatus: 'Backend responded with an unexpected status.',
      exampleCreationFailed: 'The example could not be added.',
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
      anonymousRequestRejected:
        'Security check passed: anonymous access was rejected with HTTP 401.',
      backendCached: 'Backend response cached.',
      backendSuccess: 'Backend connection successful.',
      creatingExample: 'Adding example...',
      exampleCreated: 'Example added to the database.',
      cacheCleared: 'Backend cache cleared.',
      cacheHit: 'Cache hit: no network request was made.',
      cacheMiss: 'Cache miss: fetch the backend first.',
      checkingAnonymousAccess: 'Checking anonymous access...',
      checkingBackend: 'Checking backend...',
      authenticatedRequestSuccess: 'Authenticated endpoint succeeded.',
      authenticating: 'Signing in...',
      authenticationCancelled: 'Sign-in was cancelled.',
      loadingAuthenticatedRequest: 'Preparing authenticated request...',
      preparingAuthentication: 'Preparing sign-in...',
      refreshingToken: 'Refreshing token...',
      tokenRefreshSuccess: 'Token refresh succeeded.',
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
      clearBackendCache: 'Limpiar caché del backend',
      decreaseErrorCount: 'Disminuir cantidad de errores',
      increaseErrorCount: 'Aumentar cantidad de errores',
      clearImage: 'Borrar imagen',
      selectImageFromCamera: 'Tomar foto',
      selectImageFromLibrary: 'Elegir de las fotos',
      testImageSelector: 'Probar selector de imágenes',
      readBackendCache: 'Leer salud en caché',
      saveSettings: 'Guardar configuración',
      testAnonymousEndpoint: 'Verificar rechazo del acceso anónimo',
      testAuthenticatedEndpoint: 'Llamar al endpoint autenticado',
      testBarcodeScanner: 'Probar escáner de códigos de barras',
      testBackendConnection: 'Probar conexión con el backend',
      testErrorCount: 'Cantidad de errores',
      testErrorModal: 'Probar ErrorModal',
      testTokenRefresh: 'Probar renovación del token',
      signIn: 'Iniciar sesión',
      logout: 'Cerrar sesión',
      signOut: 'Cerrar sesión',
      addRandomExample: 'Añadir ejemplo aleatorio',
      resetAuthentication: 'Restablecer autenticación',
      hideBarcodeScanner: 'Ocultar escáner de códigos de barras',
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
      signedOutMessage:
        'Inicia sesión para acceder a tus relaciones y solicitudes.',
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
        'Usa tu cuenta de Google o GitHub para acceder a tu espacio compartido.',
      title: 'Te damos la bienvenida',
    },
    checklist: {
      addRedux: 'Añade tus propios slices y patrones de estado de Redux',
      addScreens:
        'Añade pantallas, modales y rutas para el dominio de tu producto',
      replaceContent:
        'Reemplaza el contenido de inicio con la pantalla principal de tu aplicación',
      title: 'Lista inicial',
    },
    common: {
      loading: 'Cargando...',
    },
    home: {
      eyebrow: 'VUESTRO ESPACIO COMPARTIDO',
      title: 'Un poco más de nosotros, cada día.',
      description:
        'Un lugar tranquilo para los planes, las peticiones y los momentos que compartís.',
      spaceLabel: 'Vuestro espacio de relación',
      connectedStatus: 'Listo para los dos',
      connectedMessage:
        'Tu cuenta está conectada. Seguid avanzando con vuestros planes compartidos.',
      createSpaceTitle: 'Crea vuestro primer espacio',
      createSpace: 'Crear espacio',
      noSpacesMessage:
        'Ponle un nombre a vuestro espacio y después invita a alguien a unirse.',
      spaceLoadFailed: 'No se pudieron cargar vuestros espacios de relación.',
      retry: 'Intentar de nuevo',
      spaceNamePlaceholder: 'Nombre del espacio',
      members: 'miembros',
      relationshipsTitle: 'Vuestras relaciones',
      createAnotherSpace: 'Crear otro espacio',
      noRelationships: 'Todavía no formas parte de ningún espacio.',
      openDetails: 'Abrir detalles de la relación',
      relationshipNotFound: 'No se encontró este espacio de relación.',
      detailsDescription:
        'Las personas y los planes compartidos en este espacio.',
      membersTitle: 'Miembros',
      owner: 'Propietario',
      member: 'Miembro',
      findRelationship: 'Buscar una relación',
      searchRelationshipsTitle: 'Buscar una relación',
      searchRelationshipsDescription:
        'Busca por nombre de relación o código para compartir.',
      searchRelationshipsPlaceholder: 'Nombre o código para compartir',
      searchRelationshipsMinimum: 'Escribe al menos 2 caracteres para buscar.',
      searchRelationshipsEmpty: 'No se encontraron relaciones.',
      searchRelationshipsError: 'No se pudieron buscar relaciones.',
      relationshipShareCode: 'Código para compartir',
      relationshipMemberCount: 'miembros',
      requestToJoin: 'Solicitar unirse',
      requestPending: 'Solicitud pendiente',
      alreadyMember: 'Ya eres miembro',
      pendingJoinRequestsTitle: 'Solicitudes para unirse',
      noPendingJoinRequests: 'No hay solicitudes pendientes.',
      approveJoinRequest: 'Aprobar',
      rejectJoinRequest: 'Rechazar',
      joinRequestError: 'No se pudo actualizar la solicitud.',
      viewRequests: 'Ver peticiones compartidas',
      signedOutStatus: 'Empieza iniciando sesión',
      signedOutMessage:
        'Inicia sesión para crear y gestionar lo que compartís.',
      openRequests: 'Ver peticiones compartidas',
      inviteMember: 'Invitar a alguien',
      signIn: 'Iniciar sesión',
      quickActions: 'Acciones rápidas',
      requestsAction: 'Peticiones compartidas',
      settingsAction: 'Configuración',
      accessTokenTtl: 'TTL del token de acceso',
      accessTokenTtlUnavailable: 'No disponible',
      accessTokenTtlWebUnavailable: 'No disponible en sesiones web',
      accessTokenExpired: 'Caducado',
      ttlDayShort: 'd',
      ttlHourShort: 'h',
      ttlMinuteShort: 'min',
      ttlSecondShort: 's',
      noteTitle: 'Un pequeño recordatorio',
      noteMessage:
        'Las mejores relaciones se construyen en los pequeños momentos.',
    },
    errors: {
      anonymousRequestAccepted:
        'Comprobación de seguridad fallida: el endpoint aceptó una solicitud anónima.',
      anonymousRequestFailed:
        'Falló la comprobación de seguridad del endpoint anónimo.',
      apiRequestTimedOut:
        'La solicitud a la API superó el tiempo de espera. Comprueba la conexión con la API.',
      backendRequestFailed: 'La solicitud al backend falló',
      backendUnavailable:
        'La conexión con el backend falló. ¿Está ejecutándose la API?',
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
      testErrorModalMessage:
        'Este es un error de prueba generado por la demostración de ErrorModal.',
      testErrorModalStack:
        'Activado desde la pantalla de inicio de la plantilla.',
      unexpectedBackendStatus: 'El backend respondió con un estado inesperado.',
      exampleCreationFailed: 'No se pudo añadir el ejemplo.',
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
      anonymousRequestRejected:
        'Comprobación correcta: el acceso anónimo fue rechazado con HTTP 401.',
      backendCached: 'Respuesta del backend guardada en caché.',
      backendSuccess: 'Conexión con el backend exitosa.',
      creatingExample: 'Añadiendo ejemplo...',
      exampleCreated: 'Ejemplo añadido a la base de datos.',
      cacheCleared: 'Caché del backend limpiada.',
      cacheHit: 'Caché encontrada: no se realizó ninguna solicitud de red.',
      cacheMiss: 'Caché vacía: primero consulta el backend.',
      checkingAnonymousAccess: 'Comprobando el acceso anónimo...',
      checkingBackend: 'Comprobando el backend...',
      authenticatedRequestSuccess:
        'El endpoint autenticado respondió correctamente.',
      authenticating: 'Iniciando sesión...',
      authenticationCancelled: 'El inicio de sesión fue cancelado.',
      loadingAuthenticatedRequest: 'Preparando la solicitud autenticada...',
      preparingAuthentication: 'Preparando el inicio de sesión...',
      refreshingToken: 'Renovando el token...',
      tokenRefreshSuccess: 'El token se renovó correctamente.',
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
  | `checklist.${keyof typeof messages.en.checklist}`
  | `common.${keyof typeof messages.en.common}`
  | `errors.${keyof typeof messages.en.errors}`
  | `font.${keyof typeof messages.en.font}`
  | `home.${keyof typeof messages.en.home}`
  | `language.${keyof typeof messages.en.language}`
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
