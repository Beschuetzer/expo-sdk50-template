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
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) =>
      React.createElement(name, props, children);

  return {
    ScrollView: createComponent('ScrollView'),
    VStack: createComponent('VStack'),
  };
});

jest.mock('@shopify/flash-list', () => ({
  FlashList: 'FlashList',
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

describe('ThemeAwareScreen', () => {
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
        instance.props.borderBottomWidth === '$1',
    );

    expect(
      headerSurface.find((instance) => String(instance.type) === 'VStack')
        .props,
    ).toEqual(expect.objectContaining({ px: '$4', py: '$3' }));
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
      scrollView.find((instance) => String(instance.type) === 'VStack').props,
    ).toEqual(expect.objectContaining({ px: '$4', py: '$3' }));
  });

  it('reserves viewport space for pinned bottom content', () => {
    const tree = renderer.create(
      <ThemeAwareScreen bottomContent={<FooterHost />}>
        <BodyHost />
      </ThemeAwareScreen>,
    );
    const bottomSurface = tree.root.find(
      (instance) =>
        String(instance.type) === 'ThemeAwareSurface' &&
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
    ).toEqual(expect.objectContaining({ px: '$4', py: '$3' }));
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
});

function HeaderHost() {
  return React.createElement('HeaderHost');
}

function BodyHost() {
  return React.createElement('BodyHost');
}

function FooterHost() {
  return React.createElement('FooterHost');
}
