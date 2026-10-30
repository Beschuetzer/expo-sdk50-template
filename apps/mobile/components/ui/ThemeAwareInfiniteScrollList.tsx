import { VStack } from '@gluestack-ui/themed';
import type { FlashListProps } from '@shopify/flash-list';
import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { ActivityIndicator } from 'react-native';

import {
  ThemeAwareScreen,
  type ThemeAwareScreenHeaderActions,
  type ThemeAwareScreenProps,
  type ThemeAwareScreenStickyHeader,
} from './ThemeAwareScreen';
import { ThemeAwareSurface } from './ThemeAwareSurface';

import { useColorScheme } from '@/components/hooks/useColorScheme';
import { COLORS } from '@/constants/colors';
import { THEME_AWARE_CONTENT_HORIZONTAL_GUTTER } from '@/constants/layout';

type InfiniteScrollFlashListProps<ItemT> = Omit<
  FlashListProps<ItemT>,
  | 'data'
  | 'renderItem'
  | 'keyExtractor'
  | 'onEndReached'
  | 'onEndReachedThreshold'
  | 'onRefresh'
  | 'ListEmptyComponent'
  | 'ListFooterComponent'
  | 'ListHeaderComponent'
  | 'refreshing'
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
  onRefresh?: FlashListProps<ItemT>['onRefresh'];
  onEndReachedThreshold?: number;
  refreshing?: FlashListProps<ItemT>['refreshing'];
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
    onRefresh,
    onEndReachedThreshold = 0.5,
    refreshing = false,
    renderItem,
    stickyHeader,
    backToTop = false,
    p,
    px,
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
  const itemHorizontalGutter =
    p === undefined ? px ?? THEME_AWARE_CONTENT_HORIZONTAL_GUTTER : p;
  const renderGutteredItem = useCallback<
    NonNullable<FlashListProps<ItemT>['renderItem']>
  >(
    (info) => <VStack px={itemHorizontalGutter}>{renderItem(info)}</VStack>,
    [itemHorizontalGutter, renderItem],
  );

  return (
    <ThemeAwareScreen
      {...screenProps}
      p={p}
      px={px}
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
        onRefresh,
        refreshing,
        renderItem: renderGutteredItem,
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
