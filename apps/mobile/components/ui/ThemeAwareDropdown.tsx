import {
  ChevronDownIcon,
  Select,
  SelectBackdrop,
  SelectContent,
  SelectIcon,
  SelectInput,
  SelectItem,
  SelectPortal,
  SelectTrigger,
} from '@gluestack-ui/themed';

import { useThemeAwareColors } from '@/components/ui/useThemeAwareColors';
import { useThemeAwareTypography } from '@/components/ui/useThemeAwareTypography';

export type ThemeAwareDropdownOption = {
  label: string;
  value: string;
};

type ThemeAwareDropdownProps = {
  onValueChange: (value: string) => void;
  options: readonly ThemeAwareDropdownOption[];
  placeholder: string;
  selectedValue: string;
};

export function ThemeAwareDropdown({
  onValueChange,
  options,
  placeholder,
  selectedValue,
}: ThemeAwareDropdownProps) {
  const { textColor } = useThemeAwareColors();
  const { fontFamily } = useThemeAwareTypography();
  const selectedLabel =
    options.find((option) => option.value === selectedValue)?.label ?? '';

  return (
    <Select selectedValue={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger variant="outline" size="md">
        <SelectInput
          editable={false}
          fontFamily={fontFamily}
          placeholder={placeholder}
          value={selectedLabel}
          color={textColor}
        />
        <SelectIcon as={ChevronDownIcon} color={textColor} mr="$3" />
      </SelectTrigger>
      <SelectPortal>
        <SelectBackdrop />
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              label={option.label}
              value={option.value}
            />
          ))}
        </SelectContent>
      </SelectPortal>
    </Select>
  );
}
