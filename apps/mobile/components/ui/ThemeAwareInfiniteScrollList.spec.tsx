import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareInfiniteScrollList } from './ThemeAwareInfiniteScrollList';
import type { ThemeAwareScreenProps } from './ThemeAwareScreen';

let mockColorScheme: 'light' | 'dark' = 'light';

jest.mock('@gluestack-ui/themed', () => ({
  VStack: 'VStackHost',
}));

jest.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
}));

jest.mock('@/components/hooks/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

jest.mock('./ThemeAwareScreen', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareScreen: ({
      children,
      flashListProps,
      ...props
    }: {
      children?: React.ReactNode;
      flashListProps?: Record<string, unknown>;
      [key: string]: unknown;
    }) =>
      React.createElement(
        'ThemeAwareScreenHost',
        { ...props, flashListProps },
        React.createElement('FlashListHost', flashListProps),
        children as React.ReactNode,
      ),
  };
});

jest.mock('./ThemeAwareSurface', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareSurface: ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareSurfaceHost', props, children),
  };
});

type TestItem = { id: string };

const items: TestItem[] = [{ id: 'item-1' }];
const renderTestItem = ({ item }: { item: TestItem }) =>
  React.createElement('ItemHost', { id: item.id });

describe('ThemeAwareInfiniteScrollList', () => {
  afterEach(() => {
    mockColorScheme = 'light';
  });

  it('passes list data and item rendering props through to FlashList', () => {
    const tree = renderList();
    const flashListProps = getFlashListProps(tree);

    expect(flashListProps).toEqual(
      expect.objectContaining({
        data: items,
        estimatedItemSize: 64,
        keyExtractor: expect.any(Function),
        renderItem: expect.any(Function),
      }),
    );
    expect(flashListProps.keyExtractor(items[0], 0)).toBe('item-1');
    expect(flashListProps.onEndReachedThreshold).toBe(0.5);
    expect(flashListProps.refreshing).toBe(false);
    expect(flashListProps.stickyHeaderIndices).toBeUndefined();
    act(() => tree.unmount());
  });

  it('applies the shared horizontal gutter to every list item', () => {
    const tree = renderList();
    const renderedItem = getFlashListProps(tree).renderItem({
      item: items[0],
      index: 0,
    });

    expect(renderedItem.type).toBe('VStackHost');
    expect(renderedItem.props.px).toBe('$6');
    expect(renderedItem.props.children).toEqual(
      expect.objectContaining({
        type: 'ItemHost',
        props: { id: 'item-1' },
      }),
    );

    act(() => tree.unmount());
  });

  it('uses explicit screen padding for list items when provided', () => {
    const tree = renderList({ px: '$4' });
    const renderedItem = getFlashListProps(tree).renderItem({
      item: items[0],
      index: 0,
    });

    expect(renderedItem.props.px).toBe('$4');

    act(() => tree.unmount());
  });

  it('passes pull-to-refresh props through to FlashList', () => {
    const onRefresh = jest.fn();
    const tree = renderList({ onRefresh, refreshing: true });
    const flashListProps = getFlashListProps(tree);

    expect(flashListProps.onRefresh).toBe(onRefresh);
    expect(flashListProps.refreshing).toBe(true);

    act(() => {
      flashListProps.onRefresh();
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('enables the back-to-top button by default for infinite scroll lists', () => {
    const tree = renderList();

    expect(getThemeAwareScreen(tree).props.backToTop).toBe(true);

    act(() => tree.unmount());
  });

  it('passes sticky header configuration to ThemeAwareScreen', () => {
    const stickyHeader = ({ scrollToTop }: { scrollToTop: () => void }) =>
      React.createElement('StickyHeaderHost', { onPress: scrollToTop });
    const tree = renderList({ stickyHeader, backToTop: false });

    expect(getThemeAwareScreen(tree).props).toEqual(
      expect.objectContaining({ backToTop: false, stickyHeader }),
    );
    act(() => tree.unmount());
  });

  it('fetches the next page when the list reaches its end', () => {
    const fetchNextPage = jest.fn();
    const tree = renderList({ fetchNextPage });

    act(() => {
      getFlashListProps(tree).onEndReached();
    });

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      hasNextPage: false,
      isFetchNextPageError: false,
      isFetchingNextPage: false,
    },
    {
      hasNextPage: true,
      isFetchNextPageError: false,
      isFetchingNextPage: true,
    },
    {
      hasNextPage: true,
      isFetchNextPageError: true,
      isFetchingNextPage: false,
    },
  ])(
    'does not fetch when pagination is not available or already in progress',
    (paginationState) => {
      const fetchNextPage = jest.fn();
      const tree = renderList({ fetchNextPage, ...paginationState });

      act(() => {
        getFlashListProps(tree).onEndReached();
      });

      expect(fetchNextPage).not.toHaveBeenCalled();
    },
  );

  it('shows the custom spinner in the footer while a page is loading', () => {
    const loadingSpinner = React.createElement('LoadingSpinnerHost');
    const footer = React.createElement('FooterHost');
    const emptyState = React.createElement('EmptyStateHost');
    const loadingTree = renderList({
      isFetchingNextPage: true,
      loadingSpinner,
      ListFooterComponent: footer,
      ListEmptyComponent: emptyState,
    });
    const loadingFooter = getFlashListProps(loadingTree)
      .ListFooterComponent as React.ReactElement<{
      children: React.ReactNode;
      py: string;
    }>;

    expect(loadingFooter.props).toEqual(
      expect.objectContaining({
        alignItems: 'center',
        children: loadingSpinner,
        py: '$3',
      }),
    );
    expect(getFlashListProps(loadingTree).ListEmptyComponent).toBeNull();

    const idleTree = renderList({
      ListEmptyComponent: emptyState,
      ListFooterComponent: footer,
    });
    expect(getFlashListProps(idleTree).ListFooterComponent).toBe(footer);
    expect(getFlashListProps(idleTree).ListEmptyComponent).toBe(emptyState);

    act(() => {
      loadingTree.unmount();
      idleTree.unmount();
    });
  });

  it('uses a spinner color that follows the active theme by default', () => {
    mockColorScheme = 'dark';
    const tree = renderList({ isFetchingNextPage: true });
    const loadingFooter = getFlashListProps(tree)
      .ListFooterComponent as React.ReactElement;
    let renderedFooter: renderer.ReactTestRenderer;

    act(() => {
      renderedFooter = renderer.create(loadingFooter);
    });

    expect(
      renderedFooter!.root.find(
        (instance) => String(instance.type) === 'ActivityIndicator',
      ).props.color,
    ).toBe('#fff');

    act(() => {
      renderedFooter!.unmount();
      tree.unmount();
    });
  });
});

function renderList({
  fetchNextPage = jest.fn(),
  hasNextPage = true,
  isFetchNextPageError = false,
  isFetchingNextPage = false,
  fixedHeader = false,
  backToTop,
  loadingSpinner,
  ListEmptyComponent,
  ListFooterComponent,
  onRefresh,
  refreshing,
  stickyHeader,
  p,
  px,
}: {
  fetchNextPage?: () => void | Promise<unknown>;
  hasNextPage?: boolean;
  isFetchNextPageError?: boolean;
  isFetchingNextPage?: boolean;
  fixedHeader?: boolean;
  backToTop?: boolean;
  loadingSpinner?: React.ReactNode;
  ListEmptyComponent?: React.ReactElement | null;
  ListFooterComponent?: React.ReactElement | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyHeader?:
    | React.ReactNode
    | ((actions: { scrollToTop: () => void }) => React.ReactNode);
  p?: ThemeAwareScreenProps<unknown>['p'];
  px?: ThemeAwareScreenProps<unknown>['px'];
} = {}) {
  let tree: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(
      <ThemeAwareInfiniteScrollList<TestItem>
        data={items}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchNextPageError={isFetchNextPageError}
        isFetchingNextPage={isFetchingNextPage}
        fixedHeader={fixedHeader}
        backToTop={backToTop}
        p={p}
        px={px}
        keyExtractor={(item) => item.id}
        loadingSpinner={loadingSpinner}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        onRefresh={onRefresh}
        refreshing={refreshing}
        stickyHeader={stickyHeader}
        flashListProps={{ estimatedItemSize: 64 }}
        renderItem={renderTestItem}
      >
        {React.createElement('HeaderHost')}
      </ThemeAwareInfiniteScrollList>,
    );
  });

  return tree!;
}

function getFlashListProps(tree: renderer.ReactTestRenderer) {
  return tree.root.find((instance) => String(instance.type) === 'FlashListHost')
    .props;
}

function getThemeAwareScreen(tree: renderer.ReactTestRenderer) {
  return tree.root.find(
    (instance) => String(instance.type) === 'ThemeAwareScreenHost',
  );
}
