import { ScrollView, VStack } from '@gluestack-ui/themed';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps } from '@shopify/flash-list';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

import { ThemeAwareSurface } from './ThemeAwareSurface';

import { absolutePositioning } from '@/constants/styles';

const BOTTOM_CONTENT_POSITIONING = {
  position: 'absolute' as const,
  bottom: 0,
  left: 0,
  right: 0,
};

type ThemeAwareScreenProps<ItemT> = Omit<
  ComponentProps<typeof VStack>,
  'children'
> & {
  bottomContent?: ReactNode;
  children: ReactNode | ReactNode[];
  contentContainerStyle?: ComponentProps<
    typeof ScrollView
  >['contentContainerStyle'];
  fixedHeader?: boolean;
  fixedHeaderContent?: ReactNode | ReactNode[];
  flashListProps?: FlashListProps<ItemT>;
};

export function ThemeAwareScreen<ItemT = unknown>(
  props: ThemeAwareScreenProps<ItemT>,
) {
  const {
    bottomContent,
    children,
    contentContainerStyle,
    fixedHeader = false,
    fixedHeaderContent,
    flashListProps,
    p,
    px,
    py,
    ...contentProps
  } = props;
  const hasCustomPadding =
    p !== undefined || px !== undefined || py !== undefined;
  const hasBottomContent =
    bottomContent !== undefined &&
    bottomContent !== null &&
    bottomContent !== false;
  const [bottomContentHeight, setBottomContentHeight] = useState(0);

  function renderContent(content: ReactNode | ReactNode[]) {
    return (
      <ThemeAwareSurface>
        <VStack
          p={p}
          px={hasCustomPadding ? px : '$4'}
          py={hasCustomPadding ? py : '$3'}
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
        px={p === undefined ? px ?? '$4' : px}
        py={p === undefined ? py ?? '$3' : py}
        {...contentProps}
      >
        {content}
      </VStack>
    );
  }

  function renderList() {
    const contentJSX = renderContent(children);
    const fixedHeaderJSX =
      fixedHeaderContent === undefined ? undefined : (
        <ThemeAwareSurface borderBottomWidth="$1">
          {renderSectionContent(fixedHeaderContent)}
        </ThemeAwareSurface>
      );

    if (flashListProps) {
      if (fixedHeader) {
        return (
          <ThemeAwareSurface flex={1}>
            {fixedHeaderJSX}
            <ThemeAwareSurface borderBottomWidth="$1">
              {renderSectionContent(children)}
            </ThemeAwareSurface>
            <FlashList
              {...flashListProps}
              keyboardShouldPersistTaps={
                flashListProps.keyboardShouldPersistTaps ?? 'always'
              }
              estimatedItemSize={flashListProps.estimatedItemSize ?? 200}
              contentContainerStyle={flashListProps.contentContainerStyle}
            />
          </ThemeAwareSurface>
        );
      }

      if (fixedHeaderJSX) {
        return (
          <ThemeAwareSurface flex={1}>
            {fixedHeaderJSX}
            <FlashList
              {...flashListProps}
              ListHeaderComponent={
                flashListProps.ListHeaderComponent ?? contentJSX
              }
              keyboardShouldPersistTaps={
                flashListProps.keyboardShouldPersistTaps ?? 'always'
              }
              estimatedItemSize={flashListProps.estimatedItemSize ?? 200}
              contentContainerStyle={flashListProps.contentContainerStyle}
            />
          </ThemeAwareSurface>
        );
      }

      return (
        <FlashList
          {...flashListProps}
          ListHeaderComponent={flashListProps.ListHeaderComponent ?? contentJSX}
          keyboardShouldPersistTaps={
            flashListProps.keyboardShouldPersistTaps ?? 'always'
          }
          estimatedItemSize={flashListProps.estimatedItemSize ?? 200}
          contentContainerStyle={flashListProps.contentContainerStyle}
        />
      );
    }

    if (fixedHeaderJSX) {
      return (
        <ThemeAwareSurface flex={1}>
          {fixedHeaderJSX}
          <ScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={contentContainerStyle}
          >
            {contentJSX}
          </ScrollView>
        </ThemeAwareSurface>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={contentContainerStyle}
      >
        {contentJSX}
      </ScrollView>
    );
  }

  return (
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
          onLayout={(event: LayoutChangeEvent) => {
            setBottomContentHeight(event.nativeEvent.layout.height);
          }}
        >
          {renderSectionContent(bottomContent)}
        </ThemeAwareSurface>
      ) : null}
    </ThemeAwareSurface>
  );
}
