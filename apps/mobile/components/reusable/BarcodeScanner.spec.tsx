import React, { type ReactNode } from 'react';
import { act } from 'react-test-renderer';

import { BarcodeScanner } from './BarcodeScanner';

import { renderWithAct } from '@/test-utils/renderWithAct';

let mockPermission: { canAskAgain?: boolean; granted: boolean } | null;
let mockColorScheme = 'light';
const mockRequestPermission = jest.fn();
const mockGetTextColor = jest.fn(() => '#ffffff');

jest.mock('expo-camera', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    CameraView: (props: Record<string, unknown>) =>
      React.createElement('CameraViewHost', props),
    useCameraPermissions: () => [mockPermission, mockRequestPermission],
  };
});

jest.mock('react-native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createHost =
    (name: string) =>
    ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) =>
      React.createElement(name, props, children);

  return {
    Pressable: createHost('PressableHost'),
    StyleSheet: {
      absoluteFill: { position: 'absolute' },
      create: <StyleT,>(styles: StyleT) => styles,
    },
    View: createHost('ViewHost'),
  };
});

jest.mock('@/components/ui/ThemeAwareText', () => {
  const React = jest.requireActual('react') as typeof import('react');

  return {
    ThemeAwareText: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareTextHost', props, children),
  };
});

jest.mock('@/components/ui/useThemeAwareColors', () => ({
  useThemeAwareColors: () => ({
    colorScheme: mockColorScheme,
    getTextColor: mockGetTextColor,
  }),
}));

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

describe('BarcodeScanner', () => {
  beforeEach(() => {
    mockPermission = { canAskAgain: true, granted: true };
    mockColorScheme = 'light';
    mockRequestPermission.mockReset().mockResolvedValue({ granted: true });
    mockGetTextColor.mockClear();
  });

  it('scans once, supports another scan, and resets when its key changes', () => {
    const onScanned = jest.fn();
    const containerStyle = { borderWidth: 1 };
    const scannerStyle = { height: 240 };
    const result = { data: 'https://example.test', type: 'qr' };
    const screen = renderWithAct(
      <BarcodeScanner
        barCodeTypes={['qr', 'code128']}
        containerStyle={containerStyle}
        onScanned={onScanned}
        resetKey={0}
        scannerStyle={scannerStyle}
      />,
    );
    const getCamera = () =>
      screen.root.find((instance) => String(instance.type) === 'CameraViewHost');
    const container = screen.root.find(
      (instance) =>
        String(instance.type) === 'ViewHost' &&
        Array.isArray(instance.props.style) &&
        instance.props.style.includes(containerStyle),
    );

    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(container.props.style).toContain(containerStyle);
    expect(getCamera().props.barcodeScannerSettings).toEqual({
      barcodeTypes: ['qr', 'code128'],
    });
    expect(getCamera().props.style).toContain(scannerStyle);

    const camera = getCamera();
    act(() => {
      camera.props.onBarcodeScanned(result);
      camera.props.onBarcodeScanned(result);
    });

    expect(onScanned).toHaveBeenCalledTimes(1);
    expect(onScanned).toHaveBeenCalledWith(result);
    expect(
      screen.root.findAll(
        (instance) => String(instance.type) === 'CameraViewHost',
      ),
    ).toHaveLength(0);
    expect(getText(screen)).toContain('scanner.scanComplete');

    const scanAgain = screen.root.find(
      (instance) => String(instance.type) === 'PressableHost',
    );
    act(() => scanAgain.props.onPress());
    expect(getCamera()).toBeDefined();

    act(() => getCamera().props.onBarcodeScanned(result));
    expect(onScanned).toHaveBeenCalledTimes(2);

    act(() => {
      screen.update(
        <BarcodeScanner
          barCodeTypes={['qr', 'code128']}
          containerStyle={containerStyle}
          onScanned={onScanned}
          resetKey={1}
          scannerStyle={scannerStyle}
        />,
      );
    });
    expect(getCamera()).toBeDefined();
    act(() => screen.unmount());
  });

  it('uses the default barcode formats and hides the camera when inactive', () => {
    mockColorScheme = 'dark';
    const screen = renderWithAct(<BarcodeScanner onScanned={jest.fn()} />);
    const getCamera = () =>
      screen.root.find((instance) => String(instance.type) === 'CameraViewHost');
    const container = screen.root.find(
      (instance) =>
        String(instance.type) === 'ViewHost' &&
        Array.isArray(instance.props.style),
    );

    expect(getCamera().props.barcodeScannerSettings).toBeUndefined();
    expect(container.props.style[1].backgroundColor).toBe('#111827');

    act(() => {
      screen.update(<BarcodeScanner isActive={false} onScanned={jest.fn()} />);
    });
    expect(
      screen.root.findAll(
        (instance) => String(instance.type) === 'CameraViewHost',
      ),
    ).toHaveLength(0);
    act(() => screen.unmount());
  });

  it('requests camera permission and reports a denied response', async () => {
    mockPermission = { canAskAgain: true, granted: false };
    mockRequestPermission.mockResolvedValue({ granted: false });
    const onPermissionDenied = jest.fn();
    const screen = renderWithAct(
      <BarcodeScanner
        onPermissionDenied={onPermissionDenied}
        onScanned={jest.fn()}
      />,
    );

    expect(getText(screen)).toContain('scanner.permissionRequired');
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);

    const permissionButton = screen.root.find(
      (instance) => String(instance.type) === 'PressableHost',
    );
    await act(async () => {
      await permissionButton.props.onPress();
    });

    expect(mockRequestPermission).toHaveBeenCalledTimes(2);
    expect(onPermissionDenied).toHaveBeenCalledTimes(1);
    act(() => screen.unmount());
  });

  it('shows the permanent-denial message without a permission button', () => {
    mockPermission = { canAskAgain: false, granted: false };
    const screen = renderWithAct(
      <BarcodeScanner
        autoRequestPermission={false}
        onScanned={jest.fn()}
      />,
    );

    expect(getText(screen)).toContain('scanner.permissionDenied');
    expect(
      screen.root.findAll(
        (instance) => String(instance.type) === 'PressableHost',
      ),
    ).toHaveLength(0);
    act(() => screen.unmount());
  });

  it('allows a permission retry when the permission response is not loaded yet', async () => {
    mockPermission = null;
    const screen = renderWithAct(
      <BarcodeScanner
        autoRequestPermission={false}
        onScanned={jest.fn()}
      />,
    );
    const permissionButton = screen.root.find(
      (instance) => String(instance.type) === 'PressableHost',
    );

    expect(getText(screen)).toContain('scanner.permissionRequired');
    mockRequestPermission.mockResolvedValue({ granted: true });
    await act(async () => {
      await permissionButton.props.onPress();
    });
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
    act(() => screen.unmount());
  });
});

function getText(
  screen: ReturnType<typeof renderWithAct>,
): ReactNode[] {
  return screen.root
    .findAll((instance) => String(instance.type) === 'ThemeAwareTextHost')
    .map((instance) => instance.props.children);
}
