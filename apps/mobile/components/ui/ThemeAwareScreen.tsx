import { ScrollView } from '@gluestack-ui/themed';
import { FlashList } from '@shopify/flash-list';
import type { FlashListProps } from '@shopify/flash-list';
import { ReactNode, useState } from 'react';

import { ThemeAwareSurface } from './ThemeAwareSurface';

import { FORM_INTER_ITEM_SPACING } from '@/constants/general';
import { absolutePositioning } from '@/constants/styles';

type ThemeAwareScreenProps<ItemT> = {
  absolutelyPositionedJsx?: ReactNode | ReactNode[];
  children: ReactNode | ReactNode[];
  flashListProps?: FlashListProps<ItemT>;
};

const CONTAINER_HEIGHT_DEFAULT = 0;
export function ThemeAwareScreen<ItemT = unknown>(
  props: ThemeAwareScreenProps<ItemT>,
) {
  const { absolutelyPositionedJsx, children, flashListProps } = props;
  const [containerHeight, setContainerHeight] = useState(
    CONTAINER_HEIGHT_DEFAULT,
  );

  function renderList() {
    const contentJSX = (
      <ThemeAwareSurface py="$0" px="$2">
        {children}
      </ThemeAwareSurface>
    );

    if (flashListProps) {
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
        contentContainerStyle={{ paddingBottom: containerHeight }}
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
