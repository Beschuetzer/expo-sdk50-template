import { HeaderBackButton, HeaderTitle } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import type {
  NativeStackHeaderBackProps,
  NativeStackNavigationOptions,
} from 'expo-router';
import type { ColorValue } from 'react-native';

export const MAX_PAGE_TITLE_LENGTH = 30;

const TRUNCATION_SUFFIX = '...';

type NavigationPageTitleProps = {
  children: string;
  tintColor?: ColorValue;
};

function NavigationBackButton({
  label,
  tintColor,
}: Omit<NativeStackHeaderBackProps, 'canGoBack'>) {
  const navigation = useNavigation();

  return (
    <HeaderBackButton
      label={label ? truncatePageTitle(label) : undefined}
      tintColor={typeof tintColor === 'string' ? tintColor : undefined}
      onPress={() => navigation.goBack()}
    />
  );
}

function renderNavigationBackButton({
  canGoBack,
  ...props
}: NativeStackHeaderBackProps) {
  return canGoBack ? <NavigationBackButton {...props} /> : null;
}

export function truncatePageTitle(title: string): string {
  const characters = Array.from(title);

  if (characters.length <= MAX_PAGE_TITLE_LENGTH) {
    return title;
  }

  const visibleCharacterCount =
    MAX_PAGE_TITLE_LENGTH - TRUNCATION_SUFFIX.length;

  return `${characters.slice(0, visibleCharacterCount).join('')}${TRUNCATION_SUFFIX}`;
}

function NavigationPageTitle({ children, tintColor }: NavigationPageTitleProps) {
  return (
    <HeaderTitle
      tintColor={typeof tintColor === 'string' ? tintColor : undefined}
    >
      {truncatePageTitle(children)}
    </HeaderTitle>
  );
}

const nativeStackHeaderTitle =
  NavigationPageTitle satisfies NonNullable<
    NativeStackNavigationOptions['headerTitle']
  >;

export const pageTitleScreenOptions = {
  headerTitle: nativeStackHeaderTitle,
};

export const stackPageTitleScreenOptions = {
  ...pageTitleScreenOptions,
  headerBackVisible: false,
  headerLeft: renderNavigationBackButton,
};
