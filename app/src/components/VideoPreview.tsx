import { View, Text, Image, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Badge } from './Badge';
import { PLATFORM_META } from '@/lib/platform';
import { formatDuration } from '@/lib/utils';
import { getPlatform } from '@/lib/url-validator';
import { colors, radius } from '@/theme';
import type { VideoInfo } from '@/types';

interface VideoPreviewProps {
  info: VideoInfo;
  url: string;
}

export function VideoPreview({ info, url }: VideoPreviewProps) {
  const meta = PLATFORM_META[getPlatform(url)];

  return (
    <GlassCard style={styles.card}>
      <View style={styles.thumb}>
        {info.thumbnail ? (
          <Image source={{ uri: info.thumbnail }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder} />
        )}
        {info.duration > 0 && (
          <View style={styles.durationTag}>
            <Text style={styles.durationText}>{formatDuration(info.duration)}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Badge {...meta} />
          <Text style={styles.kindLabel}>SINGLE VIDEO</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {info.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[info.uploader, info.duration > 0 ? formatDuration(info.duration) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
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
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    flex: 1,
    backgroundColor: '#1A1815',
  },
  durationTag: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
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
});
