import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { colors, radii, spacing } from '../theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Lighter background, for inputs placed on a surface card. */
  raised?: boolean;
}

/** Rounded dark input with an optional label and hint/error line. */
export const TextField = forwardRef<TextInputInstance, TextFieldProps>(
  function TextFieldImpl({ label, hint, error, raised, style, ...props }, ref) {
    return (
      <View style={styles.wrap}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          style={[
            styles.input,
            raised ? styles.inputRaised : null,
            error ? styles.inputError : null,
            style,
          ]}
          {...props}
        />
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  input: {
    height: 56,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: spacing.lg + 2,
  },
  inputRaised: { backgroundColor: colors.surfaceHigh },
  inputError: { borderWidth: 1.5, borderColor: colors.error },
  hint: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
