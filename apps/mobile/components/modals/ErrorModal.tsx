import { FlatList, HStack } from '@gluestack-ui/themed';
import { useCallback, useMemo } from 'react';
import { Dimensions } from 'react-native';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemedModal } from '@/components/ui/ThemedModal';
import {
  ERRORS_INITIAL,
  errorSelector,
  setErrors,
} from '@/state/slices/generalSlice';
import { useAppDispatch, useAppSelector } from '@/state/store';
import { Error } from '@/types/errors';

export type ErrorModalProps = object;

export const ErrorModal = (props: ErrorModalProps) => {
  const errors = useAppSelector(errorSelector) ?? [];
  const dispatch = useAppDispatch();

  // Filter to unique errors by message using useMemo
  const uniqueErrors = useMemo(() => {
    if (!Array.isArray(errors)) {
      return [];
    }

    return errors.filter(
      (error, index, self) =>
        index === self.findIndex((e) => e.message === error.message),
    );
  }, [errors]);

  const onButtonPress = useCallback((error: Error) => {
    const errorMessage = error.message ?? error.error?.message;
    const stackTrace = error.stack ?? error.error?.stack;
    const statusCode = error.statusCode ?? undefined;

    console.info('Error details:', {
      message: errorMessage,
      stackTrace,
      statusCode,
      name: error.name ?? error.error?.name,
      code: error.code ?? error.error?.code,
    });
  }, []);

  const onConfirmPress = useCallback(() => {
    dispatch(setErrors(ERRORS_INITIAL));
  }, [dispatch]);

  return (
    <ThemedModal
      confirmButton={{ text: 'Ok', onPress: onConfirmPress }}
      title="Errors Encountered"
      isVisible={uniqueErrors.some((error) => Boolean(error.message))}
      onClose={onConfirmPress}
      scrollable={false}
    >
      <FlatList
        data={uniqueErrors}
        keyExtractor={(item, index) => {
          const error = item as Error;
          return error.message ?? String(index);
        }}
        renderItem={({ item, index }) => {
          const error = item as Error;
          if (!error.message) return null;
          return (
            <HStack
              justifyContent="space-between"
              alignItems="center"
              px="$4"
              py="$2"
            >
              <ThemeAwareButton
                variant="link"
                onPress={() => onButtonPress(error)}
              >
                {`${index + 1}). ${error.message}`}
              </ThemeAwareButton>
            </HStack>
          );
        }}
      />
    </ThemedModal>
  );
};
