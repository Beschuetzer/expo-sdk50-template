import {
  HStack,
  Box,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@gluestack-ui/themed';
import type { ComponentProps, ReactNode } from 'react';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareHeading } from '@/components/ui/ThemeAwareText';

export type ThemedModalButton = {
  action?: 'primary' | 'secondary' | 'positive' | 'negative' | 'default';
  isEnabled?: boolean;
  isVisible?: boolean;
  onPress?: () => void;
  text: ReactNode;
};

export type ThemedModalProps = {
  children: ReactNode;
  closeOnOverlayClick?: boolean;
  confirmButton?: ThemedModalButton;
  cancelButton?: ThemedModalButton;
  isVisible: boolean;
  onClose?: () => void;
  scrollable?: boolean;
  title?: ReactNode;
  modalProps?: Omit<ComponentProps<typeof Modal>, 'children' | 'isOpen'>;
  contentProps?: ComponentProps<typeof ModalContent>;
  bodyProps?: ComponentProps<typeof ModalBody>;
};

export function ThemedModal({
  bodyProps,
  cancelButton,
  closeOnOverlayClick = true,
  confirmButton,
  contentProps,
  isVisible,
  modalProps,
  onClose,
  scrollable = true,
  title,
  children,
}: ThemedModalProps) {
  const hasHeader = title !== undefined && title !== null;
  const hasFooter = Boolean(
    (confirmButton?.isVisible ?? true) || (cancelButton?.isVisible ?? false),
  );

  return (
    <Modal
      {...modalProps}
      isOpen={isVisible}
      onClose={onClose}
      closeOnOverlayClick={closeOnOverlayClick}
    >
      <ModalBackdrop bg="$black" opacity={0.65} />
      <ModalContent
        {...contentProps}
        maxHeight={contentProps?.maxHeight ?? '90%'}
        width={contentProps?.width ?? '90%'}
      >
        {hasHeader ? (
          <ModalHeader justifyContent="center" alignItems="center">
            {typeof title === 'string' ? (
              <ThemeAwareHeading size="sm" flex={1} textAlign="center">
                {title}
              </ThemeAwareHeading>
            ) : (
              title
            )}
          </ModalHeader>
        ) : null}

        {scrollable ? (
          <ModalBody
            {...bodyProps}
            keyboardShouldPersistTaps={
              bodyProps?.keyboardShouldPersistTaps ?? 'handled'
            }
            showsVerticalScrollIndicator={
              bodyProps?.showsVerticalScrollIndicator ?? true
            }
          >
            {children}
          </ModalBody>
        ) : (
          <Box flexShrink={1}>{children}</Box>
        )}

        {hasFooter ? (
          <ModalFooter>
            <HStack
              space="sm"
              justifyContent="center"
              alignItems="center"
              width="100%"
            >
              {cancelButton?.isVisible !== false ? (
                cancelButton ? (
                  <ThemeAwareButton
                    action={cancelButton.action ?? 'negative'}
                    isDisabled={cancelButton.isEnabled === false}
                    onPress={cancelButton.onPress ?? onClose}
                  >
                    {cancelButton.text}
                  </ThemeAwareButton>
                ) : null
              ) : null}
              {confirmButton?.isVisible !== false ? (
                confirmButton ? (
                  <ThemeAwareButton
                    action={confirmButton.action ?? 'positive'}
                    isDisabled={confirmButton.isEnabled === false}
                    onPress={confirmButton.onPress}
                  >
                    {confirmButton.text}
                  </ThemeAwareButton>
                ) : null
              ) : null}
            </HStack>
          </ModalFooter>
        ) : null}
      </ModalContent>
    </Modal>
  );
}
