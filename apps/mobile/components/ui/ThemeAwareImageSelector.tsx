import { HStack, VStack } from '@gluestack-ui/themed';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareSurface } from '@/components/ui/ThemeAwareSurface';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';

export type ThemeAwareImageSelectorProps = {
  cameraButtonLabel: ReactNode;
  clearButtonLabel?: ReactNode;
  disabled?: boolean;
  initialImage?: ImagePicker.ImagePickerAsset | null;
  libraryButtonLabel: ReactNode;
  onError?: (error: unknown) => void;
  onImageSelected?: (image: ImagePicker.ImagePickerAsset | null) => void;
  onPermissionDenied?: () => void;
  pickerOptions?: ImagePicker.ImagePickerOptions;
  previewProps?: ComponentProps<typeof Image>;
  previewPlaceholder?: ReactNode;
};

export function ThemeAwareImageSelector({
  cameraButtonLabel,
  clearButtonLabel,
  disabled = false,
  initialImage = null,
  libraryButtonLabel,
  onError,
  onImageSelected,
  onPermissionDenied,
  pickerOptions,
  previewPlaceholder,
  previewProps,
}: ThemeAwareImageSelectorProps) {
  const [selectedImage, setSelectedImage] =
    useState<ImagePicker.ImagePickerAsset | null>(initialImage);
  const [isPicking, setIsPicking] = useState(false);

  const selectImage = async (source: 'camera' | 'library') => {
    setIsPicking(true);

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        onPermissionDenied?.();
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              ...pickerOptions,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              ...pickerOptions,
            });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedImage(result.assets[0]);
        onImageSelected?.(result.assets[0]);
      }
    } catch (error) {
      onError?.(error);
    } finally {
      setIsPicking(false);
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    onImageSelected?.(null);
  };

  return (
    <VStack space="sm">
      <HStack space="sm">
        <ThemeAwareButton
          disabled={disabled || isPicking}
          flex={1}
          onPress={() => selectImage('camera')}
          variant="outline"
        >
          {cameraButtonLabel}
        </ThemeAwareButton>
        <ThemeAwareButton
          disabled={disabled || isPicking}
          flex={1}
          onPress={() => selectImage('library')}
          variant="outline"
        >
          {libraryButtonLabel}
        </ThemeAwareButton>
      </HStack>
      {selectedImage ? (
        <VStack space="sm">
          <ThemeAwareSurface borderRadius="$lg" overflow="hidden">
            <Image
              {...previewProps}
              contentFit={previewProps?.contentFit ?? 'cover'}
              source={selectedImage.uri}
              style={[{ height: 220, width: '100%' }, previewProps?.style]}
            />
          </ThemeAwareSurface>
          {clearButtonLabel ? (
            <ThemeAwareButton disabled={disabled} onPress={clearImage}>
              {clearButtonLabel}
            </ThemeAwareButton>
          ) : null}
        </VStack>
      ) : previewPlaceholder ? (
        <ThemeAwareText>{previewPlaceholder}</ThemeAwareText>
      ) : null}
    </VStack>
  );
}
