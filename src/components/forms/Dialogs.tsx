import React, { useState } from 'react';
import {
  KeyboardTypeOptions,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { TextMuted } from '@/components/ui/Text';

/**
 * 数字输入对话框，对应 legacy Dialogs.number()。
 */
export function NumberDialog({
  visible,
  title,
  hint,
  initial,
  min,
  max,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  hint: string;
  initial: number;
  min: number;
  max: number;
  onCancel: () => void;
  onConfirm: (value: number) => void;
}) {
  const [text, setText] = useState(String(initial));

  // 每次打开时重置
  React.useEffect(() => {
    if (visible) setText(String(initial));
  }, [visible, initial]);

  const submit = () => {
    const n = Number(text);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, Math.round(n)));
    onConfirm(clamped);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-[380px] rounded-[24px] bg-card p-5 dark:bg-card-d">
          <Text className="text-[18px] font-bold text-ink dark:text-ink-d">{title}</Text>
          <TextMuted className="mt-2 text-[12.5px] leading-[17px]">{hint}</TextMuted>

          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType={'number-pad' as KeyboardTypeOptions}
            selectTextOnFocus
            className="mt-3 rounded-[14px] border border-line bg-field px-3.5 py-2.5 text-center text-[22px] text-ink dark:border-line-d dark:bg-field-d dark:text-ink-d"
          />

          <View className="mt-4 flex-row justify-end gap-2">
            <Pressable
              onPress={onCancel}
              className="rounded-2xl px-4 py-2.5 active:opacity-70"
            >
              <TextMuted className="text-[14px]">取消</TextMuted>
            </Pressable>
            <Pressable
              onPress={submit}
              className="rounded-2xl bg-primary px-5 py-2.5 active:opacity-80 dark:bg-primary-d"
            >
              <Text className="text-[14px] font-bold text-white dark:text-on-bright-d">确定</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * 二次确认对话框，对应 legacy Dialogs.confirm()。
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  positiveLabel,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  positiveLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-[380px] rounded-[24px] bg-card p-5 dark:bg-card-d">
          <Text className="text-[18px] font-bold text-ink dark:text-ink-d">{title}</Text>
          <TextMuted className="mt-2 text-[12.5px] leading-[17px]">{message}</TextMuted>

          <View className="mt-5 flex-row justify-end gap-2">
            <Pressable onPress={onCancel} className="rounded-2xl px-4 py-2.5 active:opacity-70">
              <TextMuted className="text-[14px]">取消</TextMuted>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="rounded-2xl bg-danger px-5 py-2.5 active:opacity-80 dark:bg-danger-d"
            >
              <Text className="text-[14px] font-bold text-white">{positiveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
