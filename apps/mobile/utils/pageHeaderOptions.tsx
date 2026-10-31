import { HeaderBackButton, HeaderTitle } from '@react-navigation/elements';
import type { HeaderTitleProps } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';

export const MAX_PAGE_TITLE_LENGTH = 30;

const TRUNCATION_SUFFIX = '...';

type StackHeaderLeftProps = {
  canGoBack: boolean;
  label?: string;
  tintColor?: string;
};

function NavigationBackButton({
  label,
  tintColor,
}: Omit<StackHeaderLeftProps, 'canGoBack'>) {
  const navigation = useNavigation();

  return (
    <HeaderBackButton
      label={label ? truncatePageTitle(label) : undefined}
      tintColor={tintColor}
      onPress={() => navigation.goBack()}
    />
  );
}

function renderNavigationBackButton({
  canGoBack,
  ...props
}: StackHeaderLeftProps) {
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

function NavigationPageTitle(props: HeaderTitleProps) {
  const { children, ...headerTitleProps } = props;

  return (
    <HeaderTitle {...headerTitleProps}>
      {truncatePageTitle(children)}
    </HeaderTitle>
  );
}

export const pageTitleScreenOptions = {
  headerTitle: NavigationPageTitle,
};

export const stackPageTitleScreenOptions = {
  ...pageTitleScreenOptions,
  headerBackVisible: false,
  headerLeft: renderNavigationBackButton,
};
