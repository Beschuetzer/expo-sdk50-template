import React from 'react';
import renderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import {
  sortThemeAwareSearchItems,
  ThemeAwareSearch,
} from './ThemeAwareSearch';
import type {
  ThemeAwareSearchLoadMoreConfig,
  ThemeAwareSearchSortConfig,
} from './ThemeAwareSearch';

let mockKeyboardDidHide: (() => void) | undefined;

type SearchTestItem = {
  amount: number;
  date: Date;
  id: string;
  name: string;
};

type SearchTestFilters = {
  fromDate: Date | null;
  maximumAmount: string;
  minimumAmount: string;
  toDate: Date | null;
};

const searchTestItems: SearchTestItem[] = [
  {
    amount: 300,
    date: new Date('2025-01-03T00:00:00.000Z'),
    id: 'alpha',
    name: 'Alpha',
  },
  {
    amount: 100,
    date: new Date('2025-02-01T00:00:00.000Z'),
    id: 'beta',
    name: 'Beta',
  },
  {
    amount: 200,
    date: new Date('2025-03-01T00:00:00.000Z'),
    id: 'gamma',
    name: 'Gamma',
  },
];

const initialSearchTestFilters: SearchTestFilters = {
  fromDate: null,
  maximumAmount: '',
  minimumAmount: '',
  toDate: null,
};

jest.mock('react-native', () => ({
  Keyboard: {
    addListener: jest.fn((event: string, listener: () => void) => {
      if (event === 'keyboardDidHide') {
        mockKeyboardDidHide = listener;
      }
      return { remove: jest.fn() };
    }),
  },
}));

jest.mock('@gluestack-ui/themed', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const createComponent =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(name, props, children as React.ReactNode);

  return {
    HStack: createComponent('HStackHost'),
    VStack: createComponent('VStackHost'),
  };
});

jest.mock('@/components/ui/ThemeAwareButton', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareButton: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('ButtonHost', props, children),
  };
});

jest.mock('@/components/ui/ThemeAwareDatePicker', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareDatePicker: (props: Record<string, unknown>) =>
      React.createElement('DatePickerHost', props),
  };
});

jest.mock('@/components/ui/ThemeAwareDropdown', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareDropdown: (props: Record<string, unknown>) =>
      React.createElement('DropdownHost', props),
  };
});

jest.mock('@/components/ui/ThemeAwareInput', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareInput: ({
      inputFieldProps,
      ...props
    }: {
      inputFieldProps?: Record<string, unknown>;
      [key: string]: unknown;
    }) => React.createElement('InputHost', { ...inputFieldProps, ...props }),
  };
});

jest.mock('@/components/ui/ThemeAwareText', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    ThemeAwareText: ({
      children,
      ...props
    }: {
      children: React.ReactNode;
      [key: string]: unknown;
    }) => React.createElement('TextHost', props, children),
  };
});

function createSearch(
  compactOnKeyboard = false,
  loadMoreWhileFiltered?: ThemeAwareSearchLoadMoreConfig,
) {
  return (
    <ThemeAwareSearch<SearchTestItem, SearchTestFilters>
      items={searchTestItems}
      initialFilters={initialSearchTestFilters}
      loadMoreWhileFiltered={loadMoreWhileFiltered}
      filterItems={(items, { filters, search }) => {
        const normalizedSearch = search.trim().toLocaleLowerCase();
        const minimumAmount = filters.minimumAmount.trim()
          ? Number(filters.minimumAmount)
          : undefined;
        const maximumAmount = filters.maximumAmount.trim()
          ? Number(filters.maximumAmount)
          : undefined;

        if (
          (minimumAmount !== undefined && !Number.isFinite(minimumAmount)) ||
          (maximumAmount !== undefined && !Number.isFinite(maximumAmount))
        ) {
          return [];
        }

        return items.filter((item) => {
          const date = item.date.getTime();
          return (
            (!normalizedSearch ||
              item.name.toLocaleLowerCase().includes(normalizedSearch)) &&
            (minimumAmount === undefined || item.amount >= minimumAmount) &&
            (maximumAmount === undefined || item.amount <= maximumAmount) &&
            (filters.fromDate === null || date >= filters.fromDate.getTime()) &&
            (filters.toDate === null || date <= filters.toDate.getTime())
          );
        });
      }}
      isFilterStateValid={({ filters }) =>
        (!filters.minimumAmount.trim() ||
          Number.isFinite(Number(filters.minimumAmount))) &&
        (!filters.maximumAmount.trim() ||
          Number.isFinite(Number(filters.maximumAmount)))
      }
      compactOnKeyboard={compactOnKeyboard}
      search={{
        label: 'Search',
        placeholder: 'Search by name',
        inputFieldProps: {
          autoCapitalize: 'none',
          returnKeyType: 'search',
        },
      }}
      filterRows={[
        {
          id: 'dates',
          fields: [
            {
              type: 'date',
              filterKey: 'fromDate',
              label: 'From date',
              accessibilityLabel: 'From date',
              clearable: true,
            },
            {
              type: 'date',
              filterKey: 'toDate',
              label: 'To date',
              accessibilityLabel: 'To date',
              clearable: true,
            },
          ],
        },
        {
          id: 'amount',
          keyboardGroup: 'amount',
          fields: [
            {
              type: 'input',
              filterKey: 'minimumAmount',
              label: 'Minimum amount',
              inputFieldProps: {
                keyboardType: 'decimal-pad',
                placeholder: 'Amount',
              },
            },
            {
              type: 'input',
              filterKey: 'maximumAmount',
              label: 'Maximum amount',
              inputFieldProps: {
                keyboardType: 'decimal-pad',
                placeholder: 'Amount',
              },
            },
          ],
        },
        {
          id: 'amount-error',
          keyboardGroup: 'amount',
          message: 'Invalid amount',
          showWhen: ({ filters }) =>
            Boolean(
              filters.minimumAmount &&
                !Number.isFinite(Number(filters.minimumAmount)),
            ) ||
            Boolean(
              filters.maximumAmount &&
                !Number.isFinite(Number(filters.maximumAmount)),
            ),
          textProps: { color: '$error600', size: 'sm' },
        },
      ]}
      sort={{
        field: {
          label: 'Sort by',
          initialValue: 'name',
          placeholder: 'Sort by',
          options: [
            {
              label: 'Name',
              value: 'name',
              getValue: (item) => item.name,
            },
            {
              label: 'Date',
              value: 'date',
              getValue: (item) => item.date,
            },
            {
              label: 'Amount',
              value: 'amount',
              getValue: (item) => item.amount,
            },
          ],
        },
        order: {
          label: 'Sort order',
          initialValue: 'ascending',
          placeholder: 'Sort order',
          options: [
            { label: 'Ascending', value: 'ascending' },
            { label: 'Descending', value: 'descending' },
          ],
        },
        tieBreaker: (left, right) => left.id.localeCompare(right.id),
      }}
      clearFilters={{
        label: 'Clear filters',
        variant: 'outline',
      }}
    >
      {({ items, searchControls, hasActiveFilters, isFilterStateValid }) => (
        <>
          {searchControls}
          {React.createElement('ResultsHost', {
            hasActiveFilters,
            isFilterStateValid,
            ids: items.map(({ id }) => id),
          })}
        </>
      )}
    </ThemeAwareSearch>
  );
}

describe('ThemeAwareSearch', () => {
  afterEach(() => {
    mockKeyboardDidHide = undefined;
    jest.clearAllMocks();
  });

  it('owns search, filter, sort, and clear state and returns sorted matches', () => {
    let screen: ReactTestRenderer;
    act(() => {
      screen = renderer.create(createSearch());
    });

    const getResults = () =>
      screen!.root.find((instance) => String(instance.type) === 'ResultsHost')
        .props;
    const searchInput = screen!.root.find(
      (instance) =>
        String(instance.type) === 'InputHost' &&
        instance.props.placeholder === 'Search by name',
    );
    expect(searchInput.props.value).toBe('');
    expect(getResults().ids).toEqual(['alpha', 'beta', 'gamma']);
    act(() => searchInput.props.onChangeText('beta'));
    expect(getResults().ids).toEqual(['beta']);
    expect(
      screen!.root.find(
        (instance) =>
          String(instance.type) === 'InputHost' &&
          instance.props.placeholder === 'Search by name',
      ).props.value,
    ).toBe('beta');
    act(() =>
      screen!.root
        .find(
          (instance) =>
            String(instance.type) === 'InputHost' &&
            instance.props.placeholder === 'Search by name',
        )
        .props.onChangeText(''),
    );

    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DatePickerHost',
      ),
    ).toHaveLength(2);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DropdownHost',
      ),
    ).toHaveLength(2);
    expect(
      screen!.root.findAll((instance) => String(instance.type) === 'InputHost'),
    ).toHaveLength(3);

    const minimumAmountInput = screen!.root.findAll(
      (instance) =>
        String(instance.type) === 'InputHost' &&
        instance.props.keyboardType === 'decimal-pad',
    )[0];
    act(() => minimumAmountInput.props.onChangeText('200'));
    expect(getResults().ids).toEqual(['alpha', 'gamma']);

    const sortField = screen!.root.find(
      (instance) =>
        String(instance.type) === 'DropdownHost' &&
        instance.props.placeholder === 'Sort by',
    );
    act(() => sortField.props.onValueChange('amount'));
    expect(getResults().ids).toEqual(['gamma', 'alpha']);

    const sortOrder = screen!.root.find(
      (instance) =>
        String(instance.type) === 'DropdownHost' &&
        instance.props.placeholder === 'Sort order',
    );
    act(() => sortOrder.props.onValueChange('descending'));
    expect(getResults().ids).toEqual(['alpha', 'gamma']);

    const fromDate = screen!.root.find(
      (instance) =>
        String(instance.type) === 'DatePickerHost' &&
        instance.props.accessibilityLabel === 'From date',
    );
    act(() =>
      fromDate.props.onChange(
        { type: 'set' },
        new Date('2025-02-01T00:00:00.000Z'),
      ),
    );
    expect(getResults().ids).toEqual(['gamma']);
    expect(getResults().hasActiveFilters).toBe(true);

    const clearButton = screen!.root.find(
      (instance) =>
        String(instance.type) === 'ButtonHost' &&
        instance.props.children === 'Clear filters',
    );
    act(() => clearButton.props.onPress());
    expect(getResults().ids).toEqual(['alpha', 'gamma', 'beta']);
    expect(getResults().hasActiveFilters).toBe(false);
    expect(
      screen!.root.find(
        (instance) =>
          String(instance.type) === 'DropdownHost' &&
          instance.props.placeholder === 'Sort by',
      ).props.selectedValue,
    ).toBe('amount');
    expect(
      screen!.root.find(
        (instance) =>
          String(instance.type) === 'DropdownHost' &&
          instance.props.placeholder === 'Sort order',
      ).props.selectedValue,
    ).toBe('descending');
    expect(
      screen!.root.find(
        (instance) =>
          String(instance.type) === 'DatePickerHost' &&
          instance.props.accessibilityLabel === 'From date',
      ).props.value,
    ).toBeNull();
    expect(
      screen!.root.findAll(
        (instance) =>
          String(instance.type) === 'ButtonHost' &&
          instance.props.children === 'Clear filters',
      ),
    ).toHaveLength(0);

    act(() => screen!.unmount());
  });

  it('loads more pages for valid active filters but not invalid filters', () => {
    const fetchNextPage = jest.fn();
    let screen: ReactTestRenderer;
    act(() => {
      screen = renderer.create(
        createSearch(false, {
          fetchNextPage,
          hasNextPage: true,
          isFetchingNextPage: false,
          isFetchNextPageError: false,
        }),
      );
    });

    const getMinimumAmountInput = () =>
      screen!.root.findAll(
        (instance) =>
          String(instance.type) === 'InputHost' &&
          instance.props.keyboardType === 'decimal-pad',
      )[0];

    act(() => getMinimumAmountInput().props.onChangeText('invalid'));
    expect(fetchNextPage).not.toHaveBeenCalled();

    act(() => getMinimumAmountInput().props.onChangeText('200'));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);

    act(() => screen!.unmount());
  });

  it('shows only the active filter group while the keyboard is open', () => {
    let screen: ReactTestRenderer;
    act(() => {
      screen = renderer.create(createSearch(true));
    });

    expect(
      screen!.root.findAll((instance) => String(instance.type) === 'InputHost'),
    ).toHaveLength(3);

    const searchInput = screen!.root.find(
      (instance) =>
        String(instance.type) === 'InputHost' &&
        instance.props.placeholder === 'Search by name',
    );
    act(() => searchInput.props.onFocus());

    expect(
      screen!.root.findAll((instance) => String(instance.type) === 'InputHost'),
    ).toHaveLength(1);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DatePickerHost',
      ),
    ).toHaveLength(0);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DropdownHost',
      ),
    ).toHaveLength(0);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'ButtonHost',
      ),
    ).toHaveLength(0);

    act(() => mockKeyboardDidHide?.());
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DatePickerHost',
      ),
    ).toHaveLength(2);

    const minimumAmountInput = screen!.root.findAll(
      (instance) =>
        String(instance.type) === 'InputHost' &&
        instance.props.keyboardType === 'decimal-pad',
    )[0];
    act(() => minimumAmountInput.props.onChangeText('invalid'));

    const amountInput = screen!.root.findAll(
      (instance) =>
        String(instance.type) === 'InputHost' &&
        instance.props.keyboardType === 'decimal-pad',
    )[0];
    act(() => amountInput.props.onFocus());

    expect(
      screen!.root
        .findAll((instance) => String(instance.type) === 'InputHost')
        .map((input) => input.props.placeholder),
    ).toEqual(['Amount', 'Amount']);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DatePickerHost',
      ),
    ).toHaveLength(0);
    expect(
      screen!.root.findAll(
        (instance) =>
          String(instance.type) === 'TextHost' &&
          instance.props.children === 'Invalid amount',
      ),
    ).toHaveLength(1);
    expect(
      screen!.root.findAll(
        (instance) => String(instance.type) === 'DropdownHost',
      ),
    ).toHaveLength(0);

    act(() => mockKeyboardDidHide?.());
    expect(
      screen!.root.findAll((instance) => String(instance.type) === 'InputHost'),
    ).toHaveLength(3);

    act(() => screen!.unmount());
  });

  it('sorts configured properties in ascending and descending order', () => {
    type SortableItem = {
      amount: number;
      id: string;
      name: string;
      purchaseDate: Date;
    };

    const items: SortableItem[] = [
      {
        id: 'request-3',
        name: 'Beta',
        purchaseDate: new Date('2025-03-01T00:00:00.000Z'),
        amount: 200,
      },
      {
        id: 'request-2',
        name: 'alpha',
        purchaseDate: new Date('2025-02-01T00:00:00.000Z'),
        amount: 100,
      },
      {
        id: 'request-1',
        name: 'Alpha',
        purchaseDate: new Date('2025-01-01T00:00:00.000Z'),
        amount: 100,
      },
    ];
    const sortConfig: ThemeAwareSearchSortConfig<SortableItem> = {
      field: {
        label: 'Sort by',
        initialValue: 'amount',
        placeholder: 'Sort by',
        options: [
          {
            label: 'Purchase date',
            value: 'date',
            getValue: (item) => item.purchaseDate,
          },
          {
            label: 'Name',
            value: 'name',
            getValue: (item) => item.name,
          },
          {
            label: 'Amount',
            value: 'amount',
            getValue: (item) => item.amount,
          },
        ],
      },
      order: {
        label: 'Sort order',
        initialValue: 'ascending',
        placeholder: 'Sort order',
        options: [
          { label: 'Ascending', value: 'ascending' },
          { label: 'Descending', value: 'descending' },
        ],
      },
      tieBreaker: (left, right) => left.id.localeCompare(right.id),
    };

    expect(
      sortThemeAwareSearchItems(items, sortConfig).map(({ id }) => id),
    ).toEqual(['request-1', 'request-2', 'request-3']);
    expect(
      sortThemeAwareSearchItems(items, sortConfig, 'amount', 'descending').map(
        ({ id }) => id,
      ),
    ).toEqual(['request-3', 'request-1', 'request-2']);
    expect(
      sortThemeAwareSearchItems(items, sortConfig, 'name', 'ascending').map(
        ({ id }) => id,
      ),
    ).toEqual(['request-1', 'request-2', 'request-3']);
    expect(
      sortThemeAwareSearchItems(items, sortConfig, 'date', 'ascending').map(
        ({ id }) => id,
      ),
    ).toEqual(['request-1', 'request-2', 'request-3']);
    expect(items.map(({ id }) => id)).toEqual([
      'request-3',
      'request-2',
      'request-1',
    ]);
  });
});
