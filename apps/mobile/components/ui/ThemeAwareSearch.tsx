import { HStack, VStack } from '@gluestack-ui/themed';
import type { ComponentProps, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

import { ThemeAwareButton } from '@/components/ui/ThemeAwareButton';
import { ThemeAwareDatePicker } from '@/components/ui/ThemeAwareDatePicker';
import type { ThemeAwareDatePickerProps } from '@/components/ui/ThemeAwareDatePicker';
import { ThemeAwareDropdown } from '@/components/ui/ThemeAwareDropdown';
import type { ThemeAwareDropdownOption } from '@/components/ui/ThemeAwareDropdown';
import { ThemeAwareInput } from '@/components/ui/ThemeAwareInput';
import type { ThemeAwareInputProps } from '@/components/ui/ThemeAwareInput';
import { ThemeAwareText } from '@/components/ui/ThemeAwareText';

export type ThemeAwareSearchInputConfig = Omit<
  ThemeAwareInputProps,
  'defaultValue' | 'onChangeText' | 'value'
> & {
  label: string;
  placeholder?: string;
};

export type ThemeAwareSearchFilterValue = string | Date | null;

type ThemeAwareSearchStringKey<FilterValuesT extends object> = {
  [Key in keyof FilterValuesT]-?: FilterValuesT[Key] extends string
    ? Key
    : never;
}[keyof FilterValuesT] &
  string;

type ThemeAwareSearchTextKey<FilterValuesT extends object> = {
  [Key in keyof FilterValuesT]-?: FilterValuesT[Key] extends string
    ? string extends FilterValuesT[Key]
      ? Key
      : never
    : never;
}[keyof FilterValuesT] &
  string;

type ThemeAwareSearchDateKey<FilterValuesT extends object> = {
  [Key in keyof FilterValuesT]-?: FilterValuesT[Key] extends Date | null
    ? Key
    : never;
}[keyof FilterValuesT] &
  string;

export type ThemeAwareSearchDropdownField<FilterValuesT extends object> = {
  [Key in ThemeAwareSearchStringKey<FilterValuesT>]: {
    filterKey: Key;
    label: string;
    options: readonly (ThemeAwareDropdownOption & {
      value: Extract<FilterValuesT[Key], string>;
    })[];
    placeholder: string;
    type: 'dropdown';
  };
}[ThemeAwareSearchStringKey<FilterValuesT>];

export type ThemeAwareSearchTextField<FilterValuesT extends object> = {
  [Key in ThemeAwareSearchTextKey<FilterValuesT>]: Omit<
    ThemeAwareSearchInputConfig,
    'label'
  > & {
    filterKey: Key;
    label: string;
    type: 'input';
  };
}[ThemeAwareSearchTextKey<FilterValuesT>];

export type ThemeAwareSearchDateFieldConfig = Omit<
  ThemeAwareDatePickerProps,
  'onChange' | 'onClear' | 'value'
> & {
  label: string;
};

export type ThemeAwareSearchDateField<FilterValuesT extends object> = {
  [Key in ThemeAwareSearchDateKey<FilterValuesT>]: ThemeAwareSearchDateFieldConfig & {
    filterKey: Key;
    type: 'date';
  };
}[ThemeAwareSearchDateKey<FilterValuesT>];

export type ThemeAwareSearchField<FilterValuesT extends object> =
  | ThemeAwareSearchTextField<FilterValuesT>
  | ThemeAwareSearchDropdownField<FilterValuesT>
  | ThemeAwareSearchDateField<FilterValuesT>;

export type ThemeAwareSearchFilterState<FilterValuesT extends object> = {
  filters: FilterValuesT;
  search: string;
};

export type ThemeAwareSearchFilterRow<FilterValuesT extends object> = {
  fields: readonly ThemeAwareSearchField<FilterValuesT>[];
  id: string;
  keyboardGroup?: string;
};

export type ThemeAwareSearchMessageRow<FilterValuesT extends object> = {
  id: string;
  keyboardGroup?: string;
  message: string;
  showWhen?: (state: ThemeAwareSearchFilterState<FilterValuesT>) => boolean;
  textProps?: Omit<ComponentProps<typeof ThemeAwareText>, 'children'>;
};

export type ThemeAwareSearchRow<FilterValuesT extends object> =
  | ThemeAwareSearchFilterRow<FilterValuesT>
  | ThemeAwareSearchMessageRow<FilterValuesT>;

export type ThemeAwareSearchSortOrder = 'ascending' | 'descending';

export type ThemeAwareSearchSortValue =
  | string
  | number
  | Date
  | null
  | undefined;

export type ThemeAwareSearchSortOption<ItemT> = ThemeAwareDropdownOption & {
  compareValues?: (
    left: ThemeAwareSearchSortValue,
    right: ThemeAwareSearchSortValue,
  ) => number;
  getValue: (item: ItemT) => ThemeAwareSearchSortValue;
};

export type ThemeAwareSearchSortConfig<ItemT = unknown> = {
  field: {
    initialValue: string;
    label: string;
    options: readonly ThemeAwareSearchSortOption<ItemT>[];
    placeholder: string;
  };
  keyboardGroup?: string;
  order: {
    initialValue: ThemeAwareSearchSortOrder;
    label: string;
    options: readonly (ThemeAwareDropdownOption & {
      value: ThemeAwareSearchSortOrder;
    })[];
    placeholder: string;
  };
  tieBreaker?: (left: ItemT, right: ItemT) => number;
};

export type ThemeAwareSearchClearFiltersConfig = {
  label: string;
  variant?: ComponentProps<typeof ThemeAwareButton>['variant'];
};

export type ThemeAwareSearchLoadMoreConfig = {
  fetchNextPage: () => void | Promise<unknown>;
  hasNextPage: boolean;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
};

export type ThemeAwareSearchRenderState<ItemT> = {
  hasActiveFilters: boolean;
  isFilterStateValid: boolean;
  items: ItemT[];
  searchControls: ReactNode;
};

export type ThemeAwareSearchProps<ItemT, FilterValuesT extends object> = {
  children: (state: ThemeAwareSearchRenderState<ItemT>) => ReactNode;
  clearFilters?: ThemeAwareSearchClearFiltersConfig;
  compactOnKeyboard?: boolean;
  filterItems: (
    items: readonly ItemT[],
    state: ThemeAwareSearchFilterState<FilterValuesT>,
  ) => readonly ItemT[];
  filterRows?: readonly ThemeAwareSearchRow<FilterValuesT>[];
  initialFilters: FilterValuesT;
  isFilterStateValid?: (
    state: ThemeAwareSearchFilterState<FilterValuesT>,
  ) => boolean;
  items: readonly ItemT[];
  loadMoreWhileFiltered?: ThemeAwareSearchLoadMoreConfig;
  search: ThemeAwareSearchInputConfig & { placeholder: string };
  sort?: ThemeAwareSearchSortConfig<ItemT>;
  space?: ComponentProps<typeof VStack>['space'];
};

type RenderedSearchField =
  | (ThemeAwareSearchInputConfig & {
      onChangeText: (value: string) => void;
      type: 'input';
      value: string;
    })
  | {
      label: string;
      onValueChange: (value: string) => void;
      options: readonly ThemeAwareDropdownOption[];
      placeholder: string;
      selectedValue: string;
      type: 'dropdown';
    }
  | (ThemeAwareSearchDateFieldConfig & {
      onChange: NonNullable<ThemeAwareDatePickerProps['onChange']>;
      onClear?: () => void;
      type: 'date';
      value: Date | null;
    });

function compareSortValues(
  left: ThemeAwareSearchSortValue,
  right: ThemeAwareSearchSortValue,
) {
  if (left == null || right == null) {
    if (left == null && right == null) return 0;
    return left == null ? 1 : -1;
  }

  if (left instanceof Date && right instanceof Date) {
    const leftTime = left.getTime();
    const rightTime = right.getTime();
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
      throw new RangeError('ThemeAwareSearch sort values must be valid dates.');
    }

    return leftTime < rightTime ? -1 : leftTime > rightTime ? 1 : 0;
  }

  if (typeof left === 'number' && typeof right === 'number') {
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      throw new RangeError('ThemeAwareSearch sort values must be finite.');
    }

    return left < right ? -1 : left > right ? 1 : 0;
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left.toLocaleLowerCase().localeCompare(right.toLocaleLowerCase());
  }

  throw new TypeError(
    'ThemeAwareSearch sort values must use a consistent supported type.',
  );
}

export function sortThemeAwareSearchItems<ItemT>(
  items: readonly ItemT[],
  sort: ThemeAwareSearchSortConfig<ItemT>,
  selectedField = sort.field.initialValue,
  selectedOrder = sort.order.initialValue,
): ItemT[] {
  const sortOption = sort.field.options.find(
    ({ value }) => value === selectedField,
  );
  if (!sortOption) {
    throw new Error(
      `ThemeAwareSearch has no sort option for "${selectedField}".`,
    );
  }

  if (!sort.order.options.some(({ value }) => value === selectedOrder)) {
    throw new Error(
      `ThemeAwareSearch has no sort order for "${selectedOrder}".`,
    );
  }

  const direction = selectedOrder === 'ascending' ? 1 : -1;

  return items
    .map((item, index) => ({
      item,
      index,
      value: sortOption.getValue(item),
    }))
    .sort((left, right) => {
      const comparison =
        sortOption.compareValues?.(left.value, right.value) ??
        compareSortValues(left.value, right.value);
      if (!Number.isFinite(comparison)) {
        throw new RangeError(
          'ThemeAwareSearch sort comparators must return finite numbers.',
        );
      }
      if (comparison !== 0) return comparison * direction;

      const tieComparison = sort.tieBreaker?.(left.item, right.item);
      if (tieComparison !== undefined) {
        if (!Number.isFinite(tieComparison)) {
          throw new RangeError(
            'ThemeAwareSearch sort tie-breakers must return finite numbers.',
          );
        }
        if (tieComparison !== 0) return tieComparison;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

function FormField({
  children,
  label,
}: {
  children: ComponentProps<typeof VStack>['children'];
  label: string;
}) {
  return (
    <VStack space="xs">
      <ThemeAwareText fontWeight="$semibold">{label}</ThemeAwareText>
      {children}
    </VStack>
  );
}

function SearchField({
  field,
  keyboardGroup,
  onKeyboardGroupFocus,
}: {
  field: RenderedSearchField;
  keyboardGroup?: string;
  onKeyboardGroupFocus: (group?: string) => void;
}) {
  if (field.type === 'input') {
    const {
      inputFieldProps,
      label,
      onChangeText,
      placeholder,
      type: _type,
      value,
      ...inputProps
    } = field;
    const handleFocus = (
      event: NativeSyntheticEvent<TextInputFocusEventData>,
    ) => {
      inputFieldProps?.onFocus?.(event);
      onKeyboardGroupFocus(keyboardGroup);
    };

    return (
      <FormField label={label}>
        <ThemeAwareInput
          {...inputProps}
          onChangeText={onChangeText}
          value={value}
          inputFieldProps={{
            ...inputFieldProps,
            ...(placeholder === undefined ? {} : { placeholder }),
            onFocus: handleFocus,
          }}
        />
      </FormField>
    );
  }

  if (field.type === 'dropdown') {
    const { label, type: _type, ...dropdownProps } = field;

    return (
      <FormField label={label}>
        <ThemeAwareDropdown {...dropdownProps} />
      </FormField>
    );
  }

  const { accessibilityLabel, label, type: _type, ...datePickerProps } = field;

  return (
    <FormField label={label}>
      <ThemeAwareDatePicker
        {...datePickerProps}
        accessibilityLabel={accessibilityLabel ?? label}
      />
    </FormField>
  );
}

function areFilterValuesEqual(left: unknown, right: unknown) {
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  return Object.is(left, right);
}

function haveFiltersChanged<FilterValuesT extends object>(
  filters: FilterValuesT,
  initialFilters: FilterValuesT,
) {
  return Object.keys(initialFilters).some((key) => {
    const filterKey = key as keyof FilterValuesT;
    return !areFilterValuesEqual(filters[filterKey], initialFilters[filterKey]);
  });
}

export function ThemeAwareSearch<ItemT, FilterValuesT extends object>({
  children,
  clearFilters,
  compactOnKeyboard = false,
  filterItems,
  filterRows = [],
  initialFilters,
  isFilterStateValid,
  items,
  loadMoreWhileFiltered,
  search,
  sort,
  space = 'md',
}: ThemeAwareSearchProps<ItemT, FilterValuesT>) {
  const [activeKeyboardGroup, setActiveKeyboardGroup] = useState<string | null>(
    null,
  );
  const [searchValue, setSearchValue] = useState('');
  const [filterValues, setFilterValues] = useState(initialFilters);
  const [sortField, setSortField] = useState(sort?.field.initialValue ?? '');
  const [sortOrder, setSortOrder] = useState<ThemeAwareSearchSortOrder>(
    sort?.order.initialValue ?? 'ascending',
  );
  const filterState = { search: searchValue, filters: filterValues };
  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    haveFiltersChanged(filterValues, initialFilters);
  const filterStateIsValid = isFilterStateValid?.(filterState) ?? true;
  const filteredItems = filterItems(items, filterState);
  const sortedItems = sort
    ? sortThemeAwareSearchItems(filteredItems, sort, sortField, sortOrder)
    : [...filteredItems];
  const fetchNextPage = loadMoreWhileFiltered?.fetchNextPage;
  const hasNextPage = loadMoreWhileFiltered?.hasNextPage ?? false;
  const isFetchingNextPage = loadMoreWhileFiltered?.isFetchingNextPage ?? false;
  const isFetchNextPageError =
    loadMoreWhileFiltered?.isFetchNextPageError ?? false;

  useEffect(() => {
    if (!compactOnKeyboard) {
      setActiveKeyboardGroup(null);
      return;
    }

    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setActiveKeyboardGroup(null);
    });

    return () => keyboardDidHide.remove();
  }, [compactOnKeyboard]);

  useEffect(() => {
    if (
      hasActiveFilters &&
      filterStateIsValid &&
      fetchNextPage &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isFetchNextPageError
    ) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    filterStateIsValid,
    hasActiveFilters,
    hasNextPage,
    isFetchNextPageError,
    isFetchingNextPage,
  ]);

  const onKeyboardGroupFocus = (group?: string) => {
    if (compactOnKeyboard && group) {
      setActiveKeyboardGroup(group);
    }
  };
  const isVisible = (keyboardGroup?: string) =>
    !compactOnKeyboard ||
    activeKeyboardGroup === null ||
    keyboardGroup === activeKeyboardGroup;
  const updateFilterValue = <Key extends keyof FilterValuesT>(
    key: Key,
    value: FilterValuesT[Key],
  ) => {
    setFilterValues((current) => {
      const updated: FilterValuesT = { ...current };
      updated[key] = value;
      return updated;
    });
  };
  const renderFilterField = (
    field: ThemeAwareSearchField<FilterValuesT>,
  ): RenderedSearchField => {
    if (field.type === 'input') {
      const { filterKey, ...fieldProps } = field;
      const value = filterValues[filterKey];
      if (typeof value !== 'string') {
        throw new TypeError(
          `ThemeAwareSearch text filter "${filterKey}" must be a string.`,
        );
      }

      return {
        ...fieldProps,
        type: 'input',
        value,
        onChangeText: (nextValue) =>
          updateFilterValue(
            filterKey,
            nextValue as FilterValuesT[typeof filterKey],
          ),
      };
    }

    if (field.type === 'dropdown') {
      const { filterKey, ...fieldProps } = field;
      const value = filterValues[filterKey];
      if (typeof value !== 'string') {
        throw new TypeError(
          `ThemeAwareSearch dropdown filter "${filterKey}" must be a string.`,
        );
      }

      return {
        ...fieldProps,
        type: 'dropdown',
        selectedValue: value,
        onValueChange: (value) => {
          const option = field.options.find(
            ({ value: optionValue }) => optionValue === value,
          );
          if (option) {
            updateFilterValue(
              filterKey,
              option.value as FilterValuesT[typeof filterKey],
            );
          }
        },
      };
    }

    const { filterKey, ...fieldProps } = field;
    const value = filterValues[filterKey];
    let selectedDate: Date | null;
    if (value === null) {
      selectedDate = null;
    } else if (value instanceof Date) {
      selectedDate = value;
    } else {
      throw new TypeError(
        `ThemeAwareSearch date filter "${filterKey}" must be a date or null.`,
      );
    }

    return {
      ...fieldProps,
      type: 'date',
      value: selectedDate,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          updateFilterValue(filterKey, date as FilterValuesT[typeof filterKey]);
        }
      },
      onClear: () =>
        updateFilterValue(filterKey, null as FilterValuesT[typeof filterKey]),
    };
  };
  const searchField: RenderedSearchField = {
    ...search,
    type: 'input',
    value: searchValue,
    onChangeText: setSearchValue,
  };
  const searchControls = (
    <VStack space={space}>
      {isVisible('search') ? (
        <SearchField
          field={searchField}
          keyboardGroup="search"
          onKeyboardGroupFocus={onKeyboardGroupFocus}
        />
      ) : null}
      {filterRows.map((row) => {
        if (!isVisible(row.keyboardGroup)) return null;

        if ('message' in row) {
          if (row.showWhen && !row.showWhen(filterState)) return null;

          return (
            <ThemeAwareText key={row.id} {...row.textProps}>
              {row.message}
            </ThemeAwareText>
          );
        }

        if (row.fields.length === 1) {
          return (
            <SearchField
              key={row.id}
              field={renderFilterField(row.fields[0])}
              keyboardGroup={row.keyboardGroup}
              onKeyboardGroupFocus={onKeyboardGroupFocus}
            />
          );
        }

        return (
          <HStack key={row.id} alignItems="flex-start" space="sm">
            {row.fields.map((field, index) => (
              <VStack key={`${row.id}-${index}`} flex={1}>
                <SearchField
                  field={renderFilterField(field)}
                  keyboardGroup={row.keyboardGroup}
                  onKeyboardGroupFocus={onKeyboardGroupFocus}
                />
              </VStack>
            ))}
          </HStack>
        );
      })}
      {sort && isVisible(sort.keyboardGroup) ? (
        <HStack alignItems="flex-start" space="sm">
          <VStack flex={1}>
            <SearchField
              field={{
                label: sort.field.label,
                options: sort.field.options,
                placeholder: sort.field.placeholder,
                selectedValue: sortField,
                type: 'dropdown',
                onValueChange: (value) => {
                  if (
                    sort.field.options.some((option) => option.value === value)
                  ) {
                    setSortField(value);
                  }
                },
              }}
              keyboardGroup={sort.keyboardGroup}
              onKeyboardGroupFocus={onKeyboardGroupFocus}
            />
          </VStack>
          <VStack flex={1}>
            <SearchField
              field={{
                label: sort.order.label,
                options: sort.order.options,
                placeholder: sort.order.placeholder,
                selectedValue: sortOrder,
                type: 'dropdown',
                onValueChange: (value) => {
                  const option = sort.order.options.find(
                    ({ value: optionValue }) => optionValue === value,
                  );
                  if (option) {
                    setSortOrder(option.value);
                  }
                },
              }}
              keyboardGroup={sort.keyboardGroup}
              onKeyboardGroupFocus={onKeyboardGroupFocus}
            />
          </VStack>
        </HStack>
      ) : null}
      {clearFilters && hasActiveFilters && isVisible() ? (
        <ThemeAwareButton
          variant={clearFilters.variant}
          onPress={() => {
            setSearchValue('');
            setFilterValues(initialFilters);
          }}
        >
          {clearFilters.label}
        </ThemeAwareButton>
      ) : null}
    </VStack>
  );

  return children({
    hasActiveFilters,
    isFilterStateValid: filterStateIsValid,
    items: sortedItems,
    searchControls,
  });
}
