import type { ReactElement } from 'react';
import renderer, { act } from 'react-test-renderer';

export function renderWithAct(element: ReactElement) {
  let tree!: renderer.ReactTestRenderer;

  act(() => {
    tree = renderer.create(element);
  });

  return tree;
}
