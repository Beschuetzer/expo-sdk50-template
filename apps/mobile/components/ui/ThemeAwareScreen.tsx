import { ScrollView, VStack } from '@gluestack-ui/themed';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps } from '@shopify/flash-list';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

import { ThemeAwareSurface } from './ThemeAwareSurface';

import { FORM_INTER_ITEM_SPACING } from '@/constants/general';
import { absolutePositioning } from '@/constants/styles';

type ThemeAwareScreenProps<ItemT> = Omit<
  ComponentProps<typeof VStack>,
  'children'
> & {
  absolutelyPositionedJsx?: ReactNode | ReactNode[];
  children: ReactNode | ReactNode[];
  contentContainerStyle?: ComponentProps<
    typeof ScrollView
  >['contentContainerStyle'];
  fixedHeader?: boolean;
  flashListProps?: FlashListProps<ItemT>;
};

const CONTAINER_HEIGHT_DEFAULT = 0;
export function ThemeAwareScreen<ItemT = unknown>(
  props: ThemeAwareScreenProps<ItemT>,
) {
  const {
    absolutelyPositionedJsx,
    children,
    contentContainerStyle,
    fixedHeader = false,
    flashListProps,
    p,
    px,
    py,
    ...contentProps
  } = props;
  const hasCustomPadding =
    p !== undefined || px !== undefined || py !== undefined;
  const [containerHeight, setContainerHeight] = useState(
    CONTAINER_HEIGHT_DEFAULT,
  );

  function renderList() {
    const contentJSX = (
      <ThemeAwareSurface>
        <VStack
          p={p}
          px={hasCustomPadding ? px : '$4'}
          py={hasCustomPadding ? py : '$0'}
          {...contentProps}
        >
          {children}
        </VStack>
      </ThemeAwareSurface>
    );

    if (flashListProps) {
      if (fixedHeader) {
        return (
          <ThemeAwareSurface flex={1}>
            {contentJSX}
            <FlashList
              {...flashListProps}
              keyboardShouldPersistTaps={
                flashListProps.keyboardShouldPersistTaps ?? 'always'
              }
              estimatedItemSize={flashListProps.estimatedItemSize ?? 200}
              contentContainerStyle={{
                ...flashListProps.contentContainerStyle,
                paddingBottom: containerHeight,
              }}
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
          contentContainerStyle={{
            ...flashListProps.contentContainerStyle,
            paddingBottom: containerHeight,
          }}
        />
      );
    }
    return (
      <ScrollView
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[
          { paddingBottom: containerHeight },
          contentContainerStyle,
        ]}
      >
        {contentJSX}
      </ScrollView>
    );
  }

  return (
    <ThemeAwareSurface {...absolutePositioning}>
      {renderList()}
      <ThemeAwareSurface
        {...absolutePositioning}
        top="auto"
        p="$1"
        py={FORM_INTER_ITEM_SPACING}
        onLayout={(event: any) => {
          const height = event.nativeEvent?.layout?.height;
          setContainerHeight(height || CONTAINER_HEIGHT_DEFAULT);
        }}
      >
        {absolutelyPositionedJsx}
      </ThemeAwareSurface>
    </ThemeAwareSurface>
  );
}
