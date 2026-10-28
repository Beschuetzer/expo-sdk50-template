import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as DropdownMenu from 'zeego/dropdown-menu';

import { ThemeAwareIcon } from '@/components/ui/ThemeAwareIcon';
import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { COLORS } from '@/constants/colors';
import { useI18n } from '@/utils/i18n';

const DEFAULT_MENU_WIDTH = 320;
const DEFAULT_ANIMATION_DURATION = 220;
const SWIPE_ACTIVATION_DISTANCE = 12;
const SWIPE_CLOSE_DISTANCE = 64;
const SWIPE_CLOSE_VELOCITY = 0.5;

export type ThemeAwareMenuSide = 'left' | 'right';

export type ThemeAwareMenuAction = {
  disabled?: boolean;
  id: string;
  label: string;
  onSelect: () => void;
};

export type ThemeAwareMenuProps = {
  accessibilityLabel?: string;
  animationDuration?: number;
  children: ReactNode;
  closeAccessibilityLabel?: string;
  closeOnBackdropPress?: boolean;
  darkBackdropColor?: string;
  darkBackground?: string;
  darkBorderColor?: string;
  darkDisabledColor?: string;
  darkIconColor?: string;
  darkTextColor?: string;
  darkTriggerBackground?: string;
  defaultOpen?: boolean;
  header?: ReactNode;
  iconSize?: number;
  lightBackdropColor?: string;
  lightBackground?: string;
  lightBorderColor?: string;
  lightDisabledColor?: string;
  lightIconColor?: string;
  lightTextColor?: string;
  lightTriggerBackground?: string;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  panelStyle?: StyleProp<ViewStyle>;
  quickActions?: readonly ThemeAwareMenuAction[];
  quickActionsAccessibilityLabel?: string;
  quickActionsColorSchemeInversion?: boolean;
  side?: ThemeAwareMenuSide;
  triggerStyle?: StyleProp<ViewStyle>;
  width?: number | `${number}%`;
};

function resolveMenuWidth(
  width: ThemeAwareMenuProps['width'],
  viewportWidth: number,
) {
  const availableWidth = viewportWidth > 0 ? viewportWidth : DEFAULT_MENU_WIDTH;

  if (width === undefined) {
    return Math.min(DEFAULT_MENU_WIDTH, availableWidth);
  }

  if (typeof width === 'number') {
    if (!Number.isFinite(width) || width < 0) {
      throw new RangeError(
        'ThemeAwareMenu width must be a non-negative number.',
      );
    }

    return Math.min(width, availableWidth);
  }

  const percentage = Number.parseFloat(width);
  if (!Number.isFinite(percentage) || percentage < 0) {
    throw new RangeError(
      'ThemeAwareMenu percentage width must be a non-negative percentage.',
    );
  }

  return Math.min((percentage / 100) * availableWidth, availableWidth);
}

export function ThemeAwareMenu({
  accessibilityLabel,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  children,
  closeAccessibilityLabel,
  closeOnBackdropPress = true,
  darkBackdropColor = 'rgba(0, 0, 0, 0.64)',
  darkBackground = COLORS.dark.background,
  darkBorderColor = '#2b2b2b',
  darkDisabledColor = COLORS.dark.disabled,
  darkIconColor = COLORS.dark.tint,
  darkTextColor = COLORS.dark.text,
  darkTriggerBackground = 'transparent',
  defaultOpen = false,
  header,
  iconSize = 24,
  lightBackdropColor = 'rgba(0, 0, 0, 0.48)',
  lightBackground = COLORS.light.background,
  lightBorderColor = '#e5e7eb',
  lightDisabledColor = COLORS.light.disabled,
  lightIconColor = COLORS.light.tint,
  lightTextColor = COLORS.light.text,
  lightTriggerBackground = 'transparent',
  onOpenChange,
  open,
  panelStyle,
  quickActions,
  quickActionsAccessibilityLabel,
  quickActionsColorSchemeInversion = true,
  side = 'left',
  triggerStyle,
  width,
}: ThemeAwareMenuProps) {
  const { colorScheme } = useThemeAwareColors();
  const { t } = useI18n();
  const { width: viewportWidth } = useWindowDimensions();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;
  const [isModalVisible, setIsModalVisible] = useState(isOpen);
  const [isNativeQuickActionsOpen, setIsNativeQuickActionsOpen] =
    useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const menuWidth = resolveMenuWidth(width, viewportWidth);
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? darkBackground : lightBackground;
  const borderColor = isDark ? darkBorderColor : lightBorderColor;
  const backdropColor = isDark ? darkBackdropColor : lightBackdropColor;
  const iconColor = isDark ? darkIconColor : lightIconColor;
  const disabledColor = isDark ? darkDisabledColor : lightDisabledColor;
  const textColor = isDark ? darkTextColor : lightTextColor;
  const quickActionsBackgroundColor = quickActionsColorSchemeInversion
    ? textColor
    : backgroundColor;
  const quickActionsTextColor = quickActionsColorSchemeInversion
    ? backgroundColor
    : textColor;
  const triggerBackground = isDark
    ? darkTriggerBackground
    : lightTriggerBackground;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [side === 'left' ? -menuWidth : menuWidth, 0],
  });
  const openLabel = accessibilityLabel ?? t('menu.open');
  const closeLabel = closeAccessibilityLabel ?? t('menu.close');
  const quickActionsLabel =
    quickActionsAccessibilityLabel ?? t('menu.moreActions');

  const changeOpen = useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );
  const closeMenu = useCallback(() => changeOpen(false), [changeOpen]);
  const swipeResponder = useMemo(() => {
    const closeDirection = side === 'left' ? -1 : 1;

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, { dx, dy }) => {
        const closeDistance = dx * closeDirection;

        return (
          isOpen &&
          closeDistance > SWIPE_ACTIVATION_DISTANCE &&
          closeDistance > Math.abs(dy) * 1.2
        );
      },
      onPanResponderRelease: (_event, { dx, vx }) => {
        const closeDistance = dx * closeDirection;
        const closeVelocity = vx * closeDirection;
        const shouldClose =
          closeDistance >= SWIPE_CLOSE_DISTANCE ||
          (closeDistance > SWIPE_ACTIVATION_DISTANCE &&
            closeVelocity >= SWIPE_CLOSE_VELOCITY);

        if (shouldClose) {
          closeMenu();
        }
      },
    });
  }, [closeMenu, isOpen, side]);

  useEffect(() => {
    if (!isOpen && !isModalVisible) {
      progress.setValue(0);
      return;
    }

    if (isOpen) {
      setIsModalVisible(true);
    }

    const animation = Animated.timing(progress, {
      duration: animationDuration,
      toValue: isOpen ? 1 : 0,
      useNativeDriver: true,
    });

    animation.start(({ finished }) => {
      if (finished && !isOpen) {
        setIsModalVisible(false);
      }
    });

    return () => animation.stop();
  }, [animationDuration, isModalVisible, isOpen, progress]);

  useEffect(() => {
    if (!isOpen) {
      setIsNativeQuickActionsOpen(false);
    }
  }, [isOpen]);

  function toggleNativeQuickActions() {
    setIsNativeQuickActionsOpen((currentValue) => !currentValue);
  }

  function renderQuickActions() {
    if (!quickActions?.length) {
      return null;
    }

    const quickActionsButton = (
      <Pressable
        accessibilityLabel={quickActionsLabel}
        accessibilityRole="button"
        accessibilityState={
          Platform.OS === 'web'
            ? undefined
            : { expanded: isNativeQuickActionsOpen }
        }
        hitSlop={8}
        onPress={Platform.OS === 'web' ? undefined : toggleNativeQuickActions}
        style={[styles.headerButton, { backgroundColor: triggerBackground }]}
      >
        <ThemeAwareIcon color={iconColor} name="ellipsis-v" size={20} />
      </Pressable>
    );

    if (Platform.OS === 'web') {
      return (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            {quickActionsButton}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            align="start"
            side={side === 'left' ? 'right' : 'left'}
            style={{
              backgroundColor: quickActionsBackgroundColor,
              borderColor,
              borderRadius: 8,
              borderWidth: 1,
              padding: 4,
            }}
          >
            {quickActions.map((action) => (
              <DropdownMenu.Item
                key={action.id}
                disabled={action.disabled}
                onSelect={action.onSelect}
              >
                <DropdownMenu.ItemTitle
                  style={{
                    color: action.disabled
                      ? disabledColor
                      : quickActionsTextColor,
                  }}
                >
                  {action.label}
                </DropdownMenu.ItemTitle>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      );
    }

    return (
      <>
        {quickActionsButton}
        {isNativeQuickActionsOpen ? (
          <View
            style={[
              styles.nativeQuickActions,
              {
                backgroundColor: quickActionsBackgroundColor,
                borderColor,
              },
            ]}
          >
            {quickActions.map((action) => (
              <Pressable
                key={action.id}
                accessibilityLabel={action.label}
                accessibilityRole="button"
                accessibilityState={{ disabled: action.disabled }}
                disabled={action.disabled}
                onPress={() => {
                  setIsNativeQuickActionsOpen(false);
                  action.onSelect();
                }}
                style={({ pressed }) => [
                  styles.nativeQuickAction,
                  { opacity: action.disabled ? 0.5 : pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: quickActionsTextColor }}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Pressable
        accessibilityLabel={openLabel}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        hitSlop={8}
        onPress={() => changeOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: triggerBackground },
          triggerStyle,
        ]}
      >
        <ThemeAwareIcon color={iconColor} name="bars" size={iconSize} />
      </Pressable>
      <Modal
        animationType="none"
        onRequestClose={closeMenu}
        transparent
        visible={isModalVisible}
      >
        <View style={styles.modalContent}>
          <Animated.View
            pointerEvents="box-none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: backdropColor, opacity: progress },
            ]}
          >
            <Pressable
              accessible={closeOnBackdropPress}
              accessibilityLabel={closeLabel}
              accessibilityRole={closeOnBackdropPress ? 'button' : undefined}
              disabled={!closeOnBackdropPress}
              onPress={closeMenu}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            {...swipeResponder.panHandlers}
            style={[
              styles.panel,
              side === 'left'
                ? {
                    borderRightColor: borderColor,
                    borderRightWidth: StyleSheet.hairlineWidth,
                    left: 0,
                  }
                : {
                    borderLeftColor: borderColor,
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    right: 0,
                  },
              { backgroundColor, width: menuWidth },
              panelStyle,
              { transform: [{ translateX }] },
            ]}
          >
            <View style={styles.drawerContent}>
              <View
                style={[
                  styles.header,
                  {
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                <View style={styles.headerContent}>{header}</View>
                <View style={styles.headerActions}>
                  <Pressable
                    accessibilityLabel={closeLabel}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={closeMenu}
                    style={[
                      styles.headerButton,
                      { backgroundColor: triggerBackground },
                    ]}
                  >
                    <ThemeAwareIcon color={iconColor} name="close" size={20} />
                  </Pressable>
                  {renderQuickActions()}
                </View>
              </View>
              <ScrollView
                contentContainerStyle={styles.bodyContent}
                keyboardShouldPersistTaps="handled"
                style={styles.body}
              >
                {children}
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  modalContent: {
    flex: 1,
  },
  panel: {
    bottom: 0,
    elevation: 16,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { height: 0, width: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    top: 0,
  },
  drawerContent: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
    position: 'relative',
    // Keep the overflowing quick-actions panel above the drawer body.
    elevation: 1,
    zIndex: 1,
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
  },
  nativeQuickActions: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    minWidth: 180,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 48,
    zIndex: 2,
  },
  nativeQuickAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
