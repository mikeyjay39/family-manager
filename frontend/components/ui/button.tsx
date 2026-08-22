import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import { mixTowardBlack, withAlpha } from '@/lib/tenant/theme/color-utils';

const DESTRUCTIVE_COLOR = '#ff3b30';
const HOVER_DARKEN = 0.12;
const PRESS_DARKEN = 0.18;
const SECONDARY_BASE_ALPHA = 0.2;
const SECONDARY_HOVER_ALPHA = 0.28;
const SECONDARY_PRESS_ALPHA = 0.35;
const OUTLINE_HOVER_ALPHA = 0.08;
const OUTLINE_PRESS_ALPHA = 0.15;

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline';

export type ButtonProps = {
  variant?: ButtonVariant;
  onPress?: PressableProps['onPress'];
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  children?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

type InteractionState = {
  hovered?: boolean;
  pressed: boolean;
};

export function Button({
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  label,
  children,
  accessibilityLabel,
  accessibilityHint,
  style,
  labelStyle,
}: ButtonProps) {
  const palette = useColorPalette();
  const isDisabled = disabled || loading;

  const colors = useMemo(() => {
    switch (variant) {
      case 'secondary':
        return {
          base: withAlpha(palette.icon, SECONDARY_BASE_ALPHA),
          hover: withAlpha(palette.icon, SECONDARY_HOVER_ALPHA),
          press: withAlpha(palette.icon, SECONDARY_PRESS_ALPHA),
          label: palette.text,
          borderColor: undefined as string | undefined,
          spinner: palette.text,
        };
      case 'destructive':
        return {
          base: DESTRUCTIVE_COLOR,
          hover: mixTowardBlack(DESTRUCTIVE_COLOR, HOVER_DARKEN),
          press: mixTowardBlack(DESTRUCTIVE_COLOR, PRESS_DARKEN),
          label: '#ffffff',
          borderColor: undefined as string | undefined,
          spinner: '#ffffff',
        };
      case 'outline':
        return {
          base: 'transparent',
          hover: withAlpha(palette.icon, OUTLINE_HOVER_ALPHA),
          press: withAlpha(palette.icon, OUTLINE_PRESS_ALPHA),
          label: palette.text,
          borderColor: palette.icon,
          spinner: palette.text,
        };
      case 'primary':
      default:
        return {
          base: palette.tint,
          hover: mixTowardBlack(palette.tint, HOVER_DARKEN),
          press: mixTowardBlack(palette.tint, PRESS_DARKEN),
          label: palette.onTint,
          borderColor: undefined as string | undefined,
          spinner: palette.onTint,
        };
    }
  }, [palette, variant]);

  const resolveBackground = ({ hovered, pressed }: InteractionState): string => {
    if (isDisabled) {
      return colors.base;
    }
    if (pressed) {
      return colors.press;
    }
    if (hovered) {
      return colors.hover;
    }
    return colors.base;
  };

  const content =
    children ??
    (label != null ? (
      <Text style={[styles.label, { color: colors.label }, labelStyle]}>{label}</Text>
    ) : null);

  const webCursorStyle: ViewStyle | null =
    Platform.OS === 'web'
      ? ({ cursor: isDisabled ? 'default' : 'pointer' } as ViewStyle)
      : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed, hovered }) => [
        styles.base,
        variant === 'outline' && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.borderColor,
        },
        {
          backgroundColor: resolveBackground({ pressed, hovered }),
          opacity: isDisabled ? 0.6 : 1,
        },
        webCursorStyle,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.spinner} /> : content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
