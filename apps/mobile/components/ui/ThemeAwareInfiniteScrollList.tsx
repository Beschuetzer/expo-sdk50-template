import type { FlashListProps } from '@shopify/flash-list';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';

import { ThemeAwareScreen } from './ThemeAwareScreen';
import type {
  ThemeAwareScreenHeaderActions,
  ThemeAwareScreenProps,
  ThemeAwareScreenStickyHeader,
} from './ThemeAwareScreen';
import { ThemeAwareSurface } from './ThemeAwareSurface';

import { useColorScheme } from '@/components/hooks/useColorScheme';
import { COLORS } from '@/constants/colors';

type InfiniteScrollFlashListProps<ItemT> = Omit<
  FlashListProps<ItemT>,
  | 'data'
  | 'renderItem'
  | 'keyExtractor'
  | 'onEndReached'
  | 'onEndReachedThreshold'
  | 'ListEmptyComponent'
  | 'ListFooterComponent'
  | 'ListHeaderComponent'
  | 'stickyHeaderIndices'
>;

export type ThemeAwareInfiniteScrollListHeaderActions =
  ThemeAwareScreenHeaderActions;

type ThemeAwareInfiniteScrollListHeader = ThemeAwareScreenStickyHeader;

export type ThemeAwareInfiniteScrollListProps<ItemT> = Omit<
  ThemeAwareScreenProps<ItemT>,
  'children' | 'contentContainerStyle' | 'flashListProps' | 'stickyHeader'
> & {
  children?: ReactNode;
  data: NonNullable<FlashListProps<ItemT>['data']>;
  fetchNextPage: () => void | Promise<unknown>;
  hasNextPage: boolean;
  isFetchNextPageError?: boolean;
  isFetchingNextPage: boolean;
  keyExtractor: NonNullable<FlashListProps<ItemT>['keyExtractor']>;
  ListEmptyComponent?: FlashListProps<ItemT>['ListEmptyComponent'];
  ListFooterComponent?: FlashListProps<ItemT>['ListFooterComponent'];
  loadingSpinner?: ReactNode;
  onEndReachedThreshold?: number;
  renderItem: NonNullable<FlashListProps<ItemT>['renderItem']>;
  stickyHeader?: ThemeAwareInfiniteScrollListHeader;
  flashListProps?: InfiniteScrollFlashListProps<ItemT>;
};

export function ThemeAwareInfiniteScrollList<ItemT>(
  props: ThemeAwareInfiniteScrollListProps<ItemT>,
) {
  const {
    children,
    data,
    fetchNextPage,
    hasNextPage,
    isFetchNextPageError = false,
    isFetchingNextPage,
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
    loadingSpinner,
    onEndReachedThreshold = 0.5,
    renderItem,
    stickyHeader,
    backToTop = true,
    flashListProps,
    ...screenProps
  } = props;
  const handleEndReached = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) {
      return;
    }

    fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchNextPageError, isFetchingNextPage]);
  const listFooterComponent = isFetchingNextPage ? (
    <ThemeAwareSurface alignItems="center" py="$3">
      {loadingSpinner ?? <DefaultLoadingSpinner />}
    </ThemeAwareSurface>
  ) : (
    ListFooterComponent
  );
  const listEmptyComponent = isFetchingNextPage ? null : ListEmptyComponent;

  return (
    <ThemeAwareScreen
      {...screenProps}
      backToTop={backToTop}
      stickyHeader={stickyHeader}
      flashListProps={{
        ...flashListProps,
        data,
        keyExtractor,
        ListEmptyComponent: listEmptyComponent,
        ListFooterComponent: listFooterComponent,
        onEndReached: handleEndReached,
        onEndReachedThreshold,
        renderItem,
      }}
    >
      {children}
    </ThemeAwareScreen>
  );
}

function DefaultLoadingSpinner() {
  const colorScheme = useColorScheme() ?? 'light';

  return <ActivityIndicator color={COLORS[colorScheme].tint} size="small" />;
}
