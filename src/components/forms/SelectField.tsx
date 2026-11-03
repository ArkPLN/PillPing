import React, { useMemo, useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useTheme } from '@/lib/theme';

export type SelectOption = { value: string; label: string };

/**
 * 固定枚举下拉。
 *
 * 触发器是自绘的 Pressable，不再使用原生 Picker：
 * - Android Picker 条目自带 16dp 内边距，固定高度会裁切文字；
 * - 26 个单位用原生下拉会铺满屏幕，这里改为底部弹层 + 可滚动网格。
 */
export function SelectField({
  value,
  options,
  onChange,
  enabled = true,
  placeholder,
  title,
  variant = 'md',
  columns = 1,
  testID,
  accessibilityLabel,
  displayValue,
  className = '',
}: {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  enabled?: boolean;
  placeholder?: string;
  title?: string;
  variant?: 'md' | 'compact';
  /** 弹层内每行选项数；1 为列表，单位等短文案可传 4。 */
  columns?: number;
  testID?: string;
  accessibilityLabel?: string;
  /** 仅覆盖触发器上显示的文字；无障碍标签仍使用完整选项文案。 */
  displayValue?: string;
  className?: string;
}) {
  const { color } = useTheme();
  const [open, setOpen] = useState(false);

  const current = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const display = current?.label ?? (value || placeholder || '');
  const triggerText = displayValue ?? display;
  const compact = variant === 'compact';
  const columnCount = Math.max(1, columns);
  const sheetTitle = title ?? '请选择';

  // 兼容历史/模板写入的自定义值（如「早 · 饭后」）：把它作为临时选项放在最前面，
  // 否则触发器会显示为空，且用户无法在弹层里看到当前值。
  const sheetOptions = useMemo(() => {
    if (!value || options.some((o) => o.value === value)) return options;
    return [{ value, label: value }, ...options];
  }, [options, value]);

  const openSheet = () => {
    if (!enabled) return;
    Keyboard.dismiss();
    setOpen(true);
  };

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={openSheet}
        disabled={!enabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? `${sheetTitle}：${display || '未选择'}`}
        accessibilityState={{ disabled: !enabled }}
        className={`flex-row items-center border border-line bg-field dark:border-line-d dark:bg-field-d ${
          compact
            ? 'min-h-[34px] rounded-[9px] px-1.5 py-1.5'
            : 'min-h-[46px] rounded-[14px] px-3.5 py-3'
        } ${enabled ? 'active:opacity-70' : 'opacity-50'} ${className}`}
      >
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={compact ? 1.2 : 1.3}
          className={`flex-1 ${compact ? 'text-[12.5px]' : 'text-[15px]'} ${
            current ? 'text-ink dark:text-ink-d' : 'text-muted dark:text-muted-d'
          }`}
        >
          {triggerText}
        </Text>
        <Icon name="chevronDown" size={compact ? 12 : 16} color={color('muted')} />
      </Pressable>

      <Sheet visible={open} title={sheetTitle} onClose={() => setOpen(false)}>
        {columnCount > 1 ? (
          <View className="flex-row flex-wrap pb-2">
            {sheetOptions.map((o) => {
              const selected = o.value === value;
              return (
                <View key={o.value} style={{ width: `${100 / columnCount}%` }} className="p-0.5">
                  <Pressable
                    onPress={() => select(o.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`items-center justify-center rounded-[10px] border py-2.5 ${
                      selected
                        ? 'border-primary/35 bg-mint dark:border-primary/35 dark:bg-mint-d'
                        : 'border-line bg-field dark:border-line-d dark:bg-field-d'
                    }`}
                  >
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.3}
                      className={`text-[13.5px] font-medium ${
                        selected
                          ? 'text-primary dark:text-primary-d'
                          : 'text-ink-soft dark:text-ink-soft-d'
                      }`}
                    >
                      {o.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="pb-2">
            {sheetOptions.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => select(o.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`flex-row items-center rounded-[12px] px-3.5 py-3 active:opacity-70 ${
                    selected ? 'bg-mint dark:bg-mint-d' : ''
                  }`}
                >
                  <Text
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.5}
                    className={`flex-1 text-[15px] ${
                      selected
                        ? 'font-semibold text-primary dark:text-primary-d'
                        : 'text-ink dark:text-ink-d'
                    }`}
                  >
                    {o.label}
                  </Text>
                  {selected ? <Icon name="check" size={18} color={color('primary')} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}
      </Sheet>
    </>
  );
}
