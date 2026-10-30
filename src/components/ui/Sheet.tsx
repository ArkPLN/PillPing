import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';

/**
 * 底部弹层容器，复刻 legacy Sheet.java：
 * - 顶部拖拽条
 * - 标题 + 右上关闭按钮
 * - 内容区最大高度约 72%，可滚动
 * - 圆角 26（顶部）、底部贴边
 * - 键盘避让
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/45">
        {/* 点击遮罩关闭 */}
        <Pressable className="flex-1" onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="w-full items-center"
        >
          <View
            className="w-full max-w-[560px] rounded-t-[26px] bg-card px-5 pt-2 dark:bg-card-d"
            style={{ paddingBottom: Math.max(insets.bottom, 8) + 14 }}
          >
            {/* 拖拽条 */}
            <View className="h-1 w-[38px] self-center rounded-full bg-line dark:bg-line-d" />

            {/* 标题行 */}
            <View className="mt-3.5 flex-row items-center">
              <Text className="flex-1 text-[20px] font-bold text-ink dark:text-ink-d">{title}</Text>
              <Pressable
                onPress={onClose}
                className="h-[38px] w-[38px] items-center justify-center rounded-full bg-field active:opacity-70 dark:bg-field-d"
              >
                <Icon name="close" size={22} color="#64746F" />
              </Pressable>
            </View>

            {/* 内容区：限制高度并滚动 */}
            <ScrollView
              className="mt-1"
              style={{ maxHeight: 520 }}
              contentContainerClassName="pb-1"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {footer}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** 弹层内的小节标题（对应 legacy Sheet.section()）。 */
export function SheetSection({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-2 mt-5 text-[12.5px] font-medium tracking-wide text-primary dark:text-primary-d">
      {children}
    </Text>
  );
}

/** 弹层内的字段标签（对应 legacy Sheet.label()）。 */
export function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-1.5 mt-3.5 text-[12.5px] font-medium text-muted dark:text-muted-d">
      {children}
    </Text>
  );
}
