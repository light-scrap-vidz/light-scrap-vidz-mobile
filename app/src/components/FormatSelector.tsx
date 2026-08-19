import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';
import type { Quality } from '@/types';

interface FormatSelectorProps {
  audioOnly: boolean;
  onAudioOnlyChange: (v: boolean) => void;
  quality: Quality;
  onQualityChange: (q: Quality) => void;
  disabled?: boolean;
}

const QUALITY_OPTIONS: Quality[] = ['best', '1080p', '720p', '480p'];

export function FormatSelector({
  audioOnly,
  onAudioOnlyChange,
  quality,
  onQualityChange,
  disabled,
}: FormatSelectorProps) {
  return (
    <View style={styles.wrap}>
      {/* Format segmented control */}
      <View style={styles.row}>
        <Text style={styles.label}>Format</Text>
        <View style={[styles.segment, disabled && styles.disabled]}>
          <TouchableOpacity
            style={[styles.seg, !audioOnly && styles.segActive]}
            onPress={() => onAudioOnlyChange(false)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, !audioOnly && styles.segTextActive]}>
              Video · MP4
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.seg, audioOnly && styles.segActive]}
            onPress={() => onAudioOnlyChange(true)}
            disabled={disabled}
            activeOpacity={0.8}
          >
            <Text style={[styles.segText, audioOnly && styles.segTextActive]}>
              Audio · MP3
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quality chips — only for video */}
      {!audioOnly && (
        <View style={styles.row}>
          <Text style={styles.label}>Quality</Text>
          <View style={[styles.chips, disabled && styles.disabled]}>
            {QUALITY_OPTIONS.map((opt) => {
              const active = opt === quality;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => !disabled && onQualityChange(opt)}
                  disabled={disabled}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt === 'best' ? 'Best' : opt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
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
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceButton,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.sm,
    padding: 3,
  },
  seg: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segActive: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 3,
  },
  segText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9C968C',
  },
  segTextActive: {
    color: colors.accentInk,
  },
  chips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceButton,
    borderWidth: 1,
    borderColor: colors.surfaceButtonBorder,
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
