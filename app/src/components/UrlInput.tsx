import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '@/theme';
import { isValidUrl } from '@/lib/url-validator';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function UrlInput({ onSubmit, isLoading, disabled }: UrlInputProps) {
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const trimmed = value.trim();
  const valid = isValidUrl(trimmed);

  const submit = () => {
    if (valid && !disabled && !isLoading) onSubmit(trimmed);
  };

  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text?.trim()) setValue(text.trim());
    } catch {
      // clipboard access denied
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <Feather name="link" size={16} color={colors.textFaint} style={styles.icon} />
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="Paste a video link…"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            editable={!disabled && !isLoading}
            onSubmitEditing={submit}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {value.length > 0 && (
            <TouchableOpacity onPress={() => setValue('')} hitSlop={8}>
              <Feather name="x" size={15} color={colors.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.button, (!valid || disabled || isLoading) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!valid || disabled || isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.accentInk} />
          ) : (
            <Feather name="arrow-right" size={18} color={colors.accentInk} />
          )}
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.pasteBtn}
        onPress={handlePaste}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
        hitSlop={6}
      >
        <Feather name="clipboard" size={12} color={colors.textFaint} />
        <Text style={styles.pasteLabel}>Paste</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInput,
    borderColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapFocused: {
    borderColor: colors.accent,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  pasteLabel: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '600',
  },
});
