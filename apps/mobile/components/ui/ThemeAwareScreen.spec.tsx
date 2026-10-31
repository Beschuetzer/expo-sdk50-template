import React, { type ReactNode } from 'react';
import renderer, { act } from 'react-test-renderer';

import { ThemeAwareScreen } from './ThemeAwareScreen';

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({
      children,
      ...props
    }: Record<string, unknown> & { children?: ReactNode }) =>
      React.createElement(name, props, children);

  return {
    HStack: createComponent('HStack'),
    VStack: createComponent('VStack'),
  };
});

jest.mock('react-native', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const mockScrollTo = jest.fn();
  const ScrollView = React.forwardRef<
    { scrollTo: jest.Mock },
    Record<string, unknown> & { children?: ReactNode }
  >(({ children, ...props }, ref) => {
    React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
    return React.createElement('ScrollView', props, children);
  });

  return {
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    ScrollView,
    __mockScrollTo: mockScrollTo,
  };
});

jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const mockScrollToOffset = jest.fn();
  const FlashList = React.forwardRef<
    { scrollToOffset: jest.Mock },
    Record<string, unknown>
  >((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      scrollToOffset: mockScrollToOffset,
    }));
    const header = props.ListHeaderComponent;
    const renderedHeader =
      typeof header === 'function'
        ? React.createElement(header as React.ComponentType)
        : (header as ReactNode);
    return React.createElement('FlashList', props, renderedHeader);
  });

  return { FlashList, __mockScrollToOffset: mockScrollToOffset };
});

jest.mock('./ThemeAwareButton', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareButton: ({
      children,
      ...props
    }: {
      children?: ReactNode;
    } & Record<string, unknown>) =>
      React.createElement('ThemeAwareButtonHost', props, children),
  };
});

jest.mock('@/utils/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('./ThemeAwareSurface', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareSurface: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ThemeAwareSurface', props, children),
  };
});

const { __mockScrollTo } = jest.requireMock('react-native') as {
  __mockScrollTo: jest.Mock;
};
const { __mockScrollToOffset } = jest.requireMock('@shopify/flash-list') as {
  __mockScrollToOffset: jest.Mock;
};

describe('ThemeAwareScreen', () => {
  it('does not show a back-to-top button by default', () => {
    const tree = renderer.create(
      <ThemeAwareScreen>
        <BodyHost />
      </ThemeAwareScreen>,
    );

    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'ThemeAwareButtonHost',
      ),
    ).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('keeps fixed header content outside the scrollable content', () => {
    const tree = renderer.create(
      <ThemeAwareScreen fixedHeaderContent={<HeaderHost />}>
        <BodyHost />
      </ThemeAwareScreen>,
    );
    const scrollView = tree.root.find(
      (instance) => String(instance.type) === 'ScrollView',
    );

    expect(
      tree.root.findAll((instance) => String(instance.type) === 'HeaderHost'),
    ).toHaveLength(1);
    expect(
      scrollView.findAll((instance) => String(instance.type) === 'HeaderHost'),
    ).toHaveLength(0);
    expect(
      scrollView.findAll((instance) => String(instance.type) === 'BodyHost'),
    ).toHaveLength(1);
    const headerSurface = tree.root.find(
      (instance) =>
        String(instance.type) === 'ThemeAwareSurface' &&
        instance.props.borderBottomWidth === '$1' &&
        instance.findAll((child) => String(child.type) === 'HeaderHost')
          .length > 0,
    );

    expect(
      headerSurface.find((instance) => String(instance.type) === 'VStack')
        .props,
    ).toEqual(expect.objectContaining({ px: '$6', py: '$2' }));
  });

  it('keeps regular content inside the scroll view when there is no fixed header', () => {
    const tree = renderer.create(
      <ThemeAwareScreen>
        <BodyHost />
      </ThemeAwareScreen>,
    );
    const scrollView = tree.root.find(
      (instance) => String(instance.type) === 'ScrollView',
    );

    expect(
      scrollView.findAll((instance) => String(instance.type) === 'BodyHost'),
    ).toHaveLength(1);
    expect(
      scrollView
        .findAll((instance) => String(instance.type) === 'VStack')
        .every(({ props }) => props.px === '$6' && props.py === '$2'),
    ).toBe(true);
  });

  it('sticks the default back-to-top button and scrolls the FlashList to the top', () => {
    __mockScrollToOffset.mockClear();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <ThemeAwareScreen<number>
          backToTop
          flashListProps={{ data: [1], renderItem: () => null }}
        >
          <BodyHost />
        </ThemeAwareScreen>,
      );
    });

    const getBackToTopButtons = () =>
      tree!.root.findAll(
        (instance) => String(instance.type) === 'ThemeAwareButtonHost',
      );
    const headerSurface = tree!.root.find(
      (instance) =>
        String(instance.type) === 'ThemeAwareSurface' &&
        typeof instance.props.onLayout === 'function',
    );
    const flashList = tree!.root.find(
      (instance) => String(instance.type) === 'FlashList',
    );

    expect(getBackToTopButtons()).toHaveLength(1);
    expect(getBackToTopButtons()[0].props.accessibilityLabel).toBe(
      'common.backToTop',
    );

    act(() => {
      headerSurface.props.onLayout({
        nativeEvent: { layout: { height: 40, y: 0 } },
      });
      flashList.props.onScroll({
        nativeEvent: { contentOffset: { y: 40 } },
      });
    });

    expect(getBackToTopButtons()).toHaveLength(2);
    act(() => getBackToTopButtons()[1].props.onPress());
    expect(__mockScrollToOffset).toHaveBeenCalledWith({
      animated: true,
      offset: 0,
    });

    act(() => {
      flashList.props.onScroll({
        nativeEvent: { contentOffset: { y: 0 } },
      });
    });
    expect(getBackToTopButtons()).toHaveLength(1);

    act(() => tree!.unmount());
  });

  it('keeps the default back-to-top button above fixed FlashList content', () => {
    __mockScrollToOffset.mockClear();
    const tree = renderer.create(
      <ThemeAwareScreen<number>
        backToTop
        fixedHeader
        flashListProps={{ data: [1], renderItem: () => null }}
      >
        <FilterHost />
      </ThemeAwareScreen>,
    );
    const order = tree.root
      .findAll(
        (instance) =>
          String(instance.type) === 'ThemeAwareButtonHost' ||
          String(instance.type) === 'FilterHost',
      )
      .map((instance) => String(instance.type));
    const flashList = tree.root.find(
      (instance) => String(instance.type) === 'FlashList',
    );

    expect(order).toEqual(['ThemeAwareButtonHost', 'FilterHost']);
    expect(
      flashList.findAll(
        (instance) => String(instance.type) === 'ThemeAwareButtonHost',
      ),
    ).toHaveLength(0);

    act(() => {
      tree.root
        .find((instance) => String(instance.type) === 'ThemeAwareButtonHost')
        .props.onPress();
    });
    expect(__mockScrollToOffset).toHaveBeenCalledWith({
      animated: true,
      offset: 0,
    });

    act(() => tree.unmount());
  });

  it('scrolls a ScrollView to the top from the default back-to-top button', () => {
    __mockScrollTo.mockClear();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <ThemeAwareScreen backToTop>
          <BodyHost />
        </ThemeAwareScreen>,
      );
    });

    act(() => {
      tree!.root
        .find((instance) => String(instance.type) === 'ThemeAwareButtonHost')
        .props.onPress();
    });

    expect(__mockScrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 0,
    });

    act(() => tree!.unmount());
  });

  it('lets a custom sticky header replace the default back-to-top header', () => {
    const stickyHeader = React.createElement('CustomStickyHeaderHost');
    const tree = renderer.create(
      <ThemeAwareScreen stickyHeader={stickyHeader}>
        <BodyHost />
      </ThemeAwareScreen>,
    );

    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'CustomStickyHeaderHost',
      ),
    ).toHaveLength(1);
    expect(
      tree.root.findAll(
        (instance) => String(instance.type) === 'ThemeAwareButtonHost',
      ),
    ).toHaveLength(0);

    act(() => tree.unmount());
  });

  it('uses the default for padding axes that are not explicitly overridden', () => {
    const tree = renderer.create(
      <ThemeAwareScreen px="$5">
        <BodyHost />
      </ThemeAwareScreen>,
    );

    expect(
      tree.root
        .findAll((instance) => String(instance.type) === 'VStack')
        .every(({ props }) => props.px === '$5' && props.py === '$2'),
    ).toBe(true);

    act(() => tree.unmount());
  });

  it('reserves viewport space for pinned bottom content', () => {
    const tree = renderer.create(
      <ThemeAwareScreen bottomContent={<FooterHost />}>
        <BodyHost />
      </ThemeAwareScreen>,
    );
    const bottomSurface = tree!.root.find(
      (instance) =>
        String(instance.type) === 'ThemeAwareSurface' &&
        instance.props.position === 'absolute' &&
        instance.props.borderTopWidth === '$1' &&
        typeof instance.props.onLayout === 'function',
    );
    const mainSurface = (height: number) =>
      tree.root.find(
        (instance) =>
          String(instance.type) === 'ThemeAwareSurface' &&
          instance.props.style?.marginBottom === height,
      );

    expect(bottomSurface.props.position).toBe('absolute');
    expect(bottomSurface.props.bottom).toBe(0);
    expect(bottomSurface.props.top).toBeUndefined();
    expect(bottomSurface.props.borderTopWidth).toBe('$1');
    expect(
      bottomSurface.find((instance) => String(instance.type) === 'VStack')
        .props,
    ).toEqual(expect.objectContaining({ px: '$6', py: '$2' }));
    expect(mainSurface(0)).toBeDefined();

    act(() => {
      bottomSurface.props.onLayout({
        nativeEvent: { layout: { height: 120 } },
      });
    });

    expect(mainSurface(120)).toBeDefined();
    expect(
      tree.root.find((instance) => String(instance.type) === 'ScrollView').props
        .style,
    ).toEqual({ flex: 1 });
  });

  it('passes scroll actions to render-function bottom content', () => {
    const bottomContent = jest.fn(() => <FooterHost />);
    const tree = renderer.create(
      <ThemeAwareScreen bottomContent={bottomContent}>
        <BodyHost />
      </ThemeAwareScreen>,
    );

    expect(bottomContent).toHaveBeenCalledWith({
      scrollToTop: expect.any(Function),
    });
    expect(
      tree.root.find((instance) => String(instance.type) === 'FooterHost'),
    ).toBeDefined();

    act(() => tree.unmount());
  });
});

function HeaderHost() {
  return React.createElement('HeaderHost');
}

function BodyHost() {
  return React.createElement('BodyHost');
}

function FilterHost() {
  return React.createElement('FilterHost');
}

function FooterHost() {
  return React.createElement('FooterHost');
}
