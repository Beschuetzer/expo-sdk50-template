import { HStack, VStack } from '@gluestack-ui/themed';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps } from '@shopify/flash-list';
import { createElement, useCallback, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView } from 'react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView as NativeScrollView,
} from 'react-native';

import { ThemeAwareButton } from './ThemeAwareButton';
import { ThemeAwareButtonPaletteProvider } from './ThemeAwareButtonPalette';
import { ThemeAwareSurface } from './ThemeAwareSurface';

import { useColorScheme } from '@/components/hooks/useColorScheme';
import { COLORS } from '@/constants/colors';
import { THEME_AWARE_CONTENT_HORIZONTAL_GUTTER } from '@/constants/layout';
import { absolutePositioning } from '@/constants/styles';
import { useI18n } from '@/utils/i18n';

const BOTTOM_CONTENT_POSITIONING = {
  position: 'absolute' as const,
  bottom: 0,
  left: 0,
  right: 0,
};

const LIST_OVERLAY_POSITIONING = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1,
};

export type ThemeAwareScreenHeaderActions = {
  scrollToTop: () => void;
};

export type ThemeAwareScreenStickyHeader =
  | ReactNode
  | ((actions: ThemeAwareScreenHeaderActions) => ReactNode);
export type ThemeAwareScreenBottomContent =
  | ReactNode
  | ((actions: ThemeAwareScreenHeaderActions) => ReactNode);

export type ThemeAwareScreenProps<ItemT> = Omit<
  ComponentProps<typeof VStack>,
  'children'
> & {
  backToTop?: boolean;
  bottomContent?: ThemeAwareScreenBottomContent;
  children: ReactNode | ReactNode[];
  contentContainerStyle?: ComponentProps<
    typeof ScrollView
  >['contentContainerStyle'];
  fixedHeader?: boolean;
  fixedHeaderContent?: ReactNode | ReactNode[];
  flashListProps?: FlashListProps<ItemT>;
  stickyHeader?: ThemeAwareScreenStickyHeader;
};

export function ThemeAwareScreen<ItemT = unknown>(
  props: ThemeAwareScreenProps<ItemT>,
) {
  const {
    backToTop = false,
    bottomContent,
    children,
    contentContainerStyle,
    fixedHeader = false,
    fixedHeaderContent,
    flashListProps,
    stickyHeader,
    p,
    px,
    py,
    ...contentProps
  } = props;
  const colorScheme = useColorScheme() ?? 'light';
  const sectionBorderColor = COLORS[colorScheme].border;
  const [bottomContentHeight, setBottomContentHeight] = useState(0);
  const [isStickyHeaderVisible, setIsStickyHeaderVisible] = useState(false);
  const flashListRef = useRef<FlashList<ItemT>>(null);
  const scrollViewRef = useRef<NativeScrollView>(null);
  const scrollOffset = useRef(0);
  const stickyHeaderEndOffset = useRef<number | null>(null);

  const scrollToTop = useCallback(() => {
    if (flashListRef.current) {
      flashListRef.current.scrollToOffset({ animated: true, offset: 0 });
      return;
    }

    scrollViewRef.current?.scrollTo({ animated: true, y: 0 });
  }, []);
  const bottomContentNode =
    typeof bottomContent === 'function'
      ? bottomContent({ scrollToTop })
      : bottomContent;
  const hasBottomContent =
    bottomContentNode !== undefined &&
    bottomContentNode !== null &&
    bottomContentNode !== false;

  const updateStickyHeaderVisibility = useCallback((offset: number) => {
    if (stickyHeaderEndOffset.current === null) {
      return;
    }

    setIsStickyHeaderVisible(offset >= stickyHeaderEndOffset.current);
  }, []);

  const handleStickyHeaderLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      stickyHeaderEndOffset.current = y + height;
      updateStickyHeaderVisibility(scrollOffset.current);
    },
    [updateStickyHeaderVisibility],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      flashListProps?.onScroll?.(event);
      scrollOffset.current = event.nativeEvent.contentOffset.y;
      updateStickyHeaderVisibility(scrollOffset.current);
    },
    [flashListProps?.onScroll, updateStickyHeaderVisibility],
  );

  const stickyHeaderContent =
    stickyHeader !== undefined ? (
      typeof stickyHeader === 'function' ? (
        stickyHeader({ scrollToTop })
      ) : (
        stickyHeader
      )
    ) : backToTop ? (
      <DefaultBackToTopHeader scrollToTop={scrollToTop} />
    ) : null;
  const isDefaultBackToTopHeaderPinned =
    fixedHeader && stickyHeader === undefined && backToTop;
  const hasStickyHeader =
    !isDefaultBackToTopHeaderPinned &&
    stickyHeaderContent !== undefined &&
    stickyHeaderContent !== null &&
    stickyHeaderContent !== false;
  const stickyHeaderComponent = hasStickyHeader ? (
    <ThemeAwareSurface
      borderBottomWidth="$1"
      borderColor={sectionBorderColor}
      onLayout={handleStickyHeaderLayout}
    >
      {renderSectionContent(stickyHeaderContent)}
    </ThemeAwareSurface>
  ) : null;

  function renderStickyHeaderOverlay() {
    if (!hasStickyHeader || !isStickyHeaderVisible) {
      return null;
    }

    return (
      <ThemeAwareSurface
        {...LIST_OVERLAY_POSITIONING}
        borderBottomWidth="$1"
        borderColor={sectionBorderColor}
      >
        {renderSectionContent(stickyHeaderContent)}
      </ThemeAwareSurface>
    );
  }

  function renderContent(content: ReactNode | ReactNode[]) {
    return (
      <ThemeAwareSurface>
        <VStack
          p={p}
          px={
            p === undefined ? px ?? THEME_AWARE_CONTENT_HORIZONTAL_GUTTER : px
          }
          py={p === undefined ? py ?? '$2' : py}
          {...contentProps}
        >
          {content}
        </VStack>
      </ThemeAwareSurface>
    );
  }

  function renderSectionContent(content: ReactNode | ReactNode[]) {
    return (
      <VStack
        p={p}
        px={p === undefined ? px ?? THEME_AWARE_CONTENT_HORIZONTAL_GUTTER : px}
        py={p === undefined ? py ?? '$2' : py}
        {...contentProps}
      >
        {content}
      </VStack>
    );
  }

  function renderListHeader(
    listHeaderComponent: FlashListProps<ItemT>['ListHeaderComponent'],
  ): ReactNode {
    if (typeof listHeaderComponent === 'function') {
      return createElement(listHeaderComponent);
    }

    return listHeaderComponent;
  }

  function renderFlashListArea(
    listProps: FlashListProps<ItemT>,
    listHeaderComponent = listProps.ListHeaderComponent,
  ) {
    const combinedListHeader: FlashListProps<ItemT>['ListHeaderComponent'] =
      hasStickyHeader ? (
        <>
          {stickyHeaderComponent}
          {renderListHeader(listHeaderComponent)}
        </>
      ) : (
        listHeaderComponent
      );
    const list = (
      <FlashList
        {...listProps}
        ref={flashListRef}
        ListHeaderComponent={combinedListHeader}
        keyboardShouldPersistTaps={
          flashListProps?.keyboardShouldPersistTaps ?? 'always'
        }
        estimatedItemSize={flashListProps?.estimatedItemSize ?? 200}
        contentContainerStyle={flashListProps?.contentContainerStyle}
        onScroll={hasStickyHeader ? handleScroll : listProps.onScroll}
      />
    );

    return (
      <ThemeAwareSurface flex={1}>
        {list}
        {renderStickyHeaderOverlay()}
      </ThemeAwareSurface>
    );
  }

  function renderScrollView(content: ReactNode | ReactNode[]) {
    return (
      <ThemeAwareSurface flex={1}>
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={contentContainerStyle}
          onScroll={hasStickyHeader ? handleScroll : undefined}
          scrollEventThrottle={hasStickyHeader ? 16 : undefined}
        >
          {stickyHeaderComponent}
          {content}
        </ScrollView>
        {renderStickyHeaderOverlay()}
      </ThemeAwareSurface>
    );
  }

  function renderList() {
    const contentJSX = renderContent(children);
    const fixedHeaderJSX =
      fixedHeaderContent === undefined ? undefined : (
        <ThemeAwareSurface
          borderBottomWidth="$1"
          borderColor={sectionBorderColor}
        >
          {renderSectionContent(fixedHeaderContent)}
        </ThemeAwareSurface>
      );

    if (flashListProps) {
      if (fixedHeader) {
        return (
          <ThemeAwareSurface flex={1}>
            {fixedHeaderJSX}
            <ThemeAwareSurface
              borderBottomWidth="$1"
              borderColor={sectionBorderColor}
            >
              {renderSectionContent(
                isDefaultBackToTopHeaderPinned ? (
                  <>
                    {stickyHeaderContent}
                    {children}
                  </>
                ) : (
                  children
                ),
              )}
            </ThemeAwareSurface>
            {renderFlashListArea(flashListProps)}
          </ThemeAwareSurface>
        );
      }

      if (fixedHeaderJSX) {
        return (
          <ThemeAwareSurface flex={1}>
            {fixedHeaderJSX}
            {renderFlashListArea(
              flashListProps,
              flashListProps.ListHeaderComponent ?? contentJSX,
            )}
          </ThemeAwareSurface>
        );
      }

      return renderFlashListArea(
        flashListProps,
        flashListProps.ListHeaderComponent ?? contentJSX,
      );
    }

    if (fixedHeaderJSX) {
      return (
        <ThemeAwareSurface flex={1}>
          {fixedHeaderJSX}
          {renderScrollView(contentJSX)}
        </ThemeAwareSurface>
      );
    }

    return renderScrollView(contentJSX);
  }

  return (
    <ThemeAwareButtonPaletteProvider>
      <ThemeAwareSurface {...absolutePositioning}>
        <ThemeAwareSurface
          flex={1}
          style={{ marginBottom: hasBottomContent ? bottomContentHeight : 0 }}
        >
          {renderList()}
        </ThemeAwareSurface>
        {hasBottomContent ? (
          <ThemeAwareSurface
            {...BOTTOM_CONTENT_POSITIONING}
            borderTopWidth="$1"
            borderColor={sectionBorderColor}
            onLayout={(event: LayoutChangeEvent) => {
              setBottomContentHeight(event.nativeEvent.layout.height);
            }}
          >
            {renderSectionContent(bottomContentNode)}
          </ThemeAwareSurface>
        ) : null}
      </ThemeAwareSurface>
    </ThemeAwareButtonPaletteProvider>
  );
}

function DefaultBackToTopHeader({ scrollToTop }: { scrollToTop: () => void }) {
  const { t } = useI18n();
  const label = t('common.backToTop');

  return (
    <HStack justifyContent="flex-end">
      <ThemeAwareButton
        accessibilityLabel={label}
        onPress={scrollToTop}
        variant="outline"
      >
        {label}
      </ThemeAwareButton>
    </HStack>
  );
}
