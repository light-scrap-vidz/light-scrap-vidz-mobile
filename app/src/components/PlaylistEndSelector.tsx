import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';

interface PlaylistEndSelectorProps {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ n: number; label: string }> = [
  { n: 5, label: '5' },
  { n: 10, label: '10' },
  { n: 25, label: '25' },
  { n: 50, label: '50' },
  { n: 0, label: 'All' },
];

export function PlaylistEndSelector({ value, onChange, disabled }: PlaylistEndSelectorProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Count</Text>
      <View style={[styles.chips, disabled && styles.disabled]}>
        {OPTIONS.map(({ n, label }) => {
          const active = n === value;
          return (
            <TouchableOpacity
              key={n}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => !disabled && onChange(n)}
              disabled={disabled}
              activeOpacity={0.8}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  label: {
    color: colors.textBody,
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 0,
  },
  disabled: { opacity: 0.5 },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceButton,
    borderWidth: 1,
    borderColor: colors.surfaceButtonBorder,
    minWidth: 36,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#B6B0A6',
  },
  chipTextActive: {
    color: colors.accentInk,
  },
});
