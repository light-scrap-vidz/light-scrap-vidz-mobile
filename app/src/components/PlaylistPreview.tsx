import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { Badge } from './Badge';
import { PLATFORM_META } from '@/lib/platform';
import { getPlatform } from '@/lib/url-validator';
import { colors, radius, spacing } from '@/theme';
import type { PlaylistInfo } from '@/types';

interface PlaylistPreviewProps {
  info: PlaylistInfo;
  url: string;
  selectedUrls: string[];
  onSelectionChange: (urls: string[]) => void;
  disabled?: boolean;
}

export function PlaylistPreview({
  info,
  url,
  selectedUrls,
  onSelectionChange,
  disabled,
}: PlaylistPreviewProps) {
  const meta = PLATFORM_META[getPlatform(url)];
  const count = info.playlist_count ?? info.entries?.length ?? null;
  const entries = info.entries ?? [];
  const selectedSet = new Set(selectedUrls);
  const allSelected = entries.length > 0 && entries.every((e) => selectedSet.has(e.url));

  const toggleEntry = (entryUrl: string) => {
    if (disabled) return;
    if (selectedSet.has(entryUrl)) {
      onSelectionChange(selectedUrls.filter((u) => u !== entryUrl));
    } else {
      onSelectionChange([...selectedUrls, entryUrl]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header card */}
      <GlassCard style={styles.card}>
        <View style={styles.thumb}>
          <View style={styles.thumbPlaceholder} />
        </View>
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Badge {...meta} />
            <Text style={styles.kindLabel}>PLAYLIST</Text>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {info.title || 'Untitled Playlist'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[info.uploader, count != null ? `${count} videos` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </GlassCard>

      {/* Entry selection */}
      {entries.length > 0 && (
        <GlassCard style={styles.entriesCard}>
          {/* Selection header */}
          <View style={styles.entriesHeader}>
            <Text style={styles.selectedLabel}>
              {selectedUrls.length > 0
                ? `${selectedUrls.length} selected`
                : `${entries.length} videos`}
            </Text>
            <View style={styles.selActions}>
              {!allSelected && (
                <TouchableOpacity
                  onPress={() => onSelectionChange(entries.map((e) => e.url))}
                  disabled={disabled}
                  hitSlop={8}
                >
                  <Text style={styles.selAction}>All</Text>
                </TouchableOpacity>
              )}
              {selectedUrls.length > 0 && (
                <TouchableOpacity
                  onPress={() => onSelectionChange([])}
                  disabled={disabled}
                  hitSlop={8}
                >
                  <Text style={styles.selAction}>None</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Separator */}
          <View style={styles.sep} />

          {/* Entry rows */}
          {entries.map((entry, i) => {
            const sel = selectedSet.has(entry.url);
            return (
              <TouchableOpacity
                key={entry.id || entry.url}
                style={[styles.entry, sel && styles.entrySelected]}
                onPress={() => toggleEntry(entry.url)}
                activeOpacity={0.75}
                disabled={disabled}
              >
                <View style={[styles.checkbox, sel && styles.checkboxSelected]}>
                  {sel && <Feather name="check" size={10} color={colors.accentInk} />}
                </View>
                <Text
                  style={[styles.entryTitle, sel && styles.entryTitleSelected]}
                  numberOfLines={1}
                >
                  {entry.title || `Video ${i + 1}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },

  /* Header */
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumb: {
    width: 100,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#211F1A',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1A1815',
  },
  body: {
    flex: 1,
    gap: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  kindLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 11.5,
  },

  /* Entries */
  entriesCard: { gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
  entriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  selectedLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  selActions: {
    flexDirection: 'row',
    gap: 12,
  },
  selAction: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  entrySelected: {
    backgroundColor: 'rgba(201,242,94,0.06)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  entryTitle: {
    flex: 1,
    color: colors.textBody,
    fontSize: 12.5,
    fontWeight: '500',
  },
  entryTitleSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
