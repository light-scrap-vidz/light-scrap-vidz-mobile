import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { colors, radius } from '@/theme';
import type { DownloadProgress, DownloadStatus } from '@/types';

interface ProgressCardProps {
  status: DownloadStatus;
  progress: DownloadProgress | null;
  error: string | null;
}

export function ProgressCard({ status, progress, error }: ProgressCardProps) {
  if (status === 'idle') return null;

  const percent = Math.max(0, Math.min(100, progress?.percent ?? 0));
  const busy = status === 'downloading' || status === 'saving';

  return (
    <GlassCard style={styles.card}>
      {busy && (
        <>
          {progress?.current_item != null && progress.total_items != null && (
            <Text style={styles.itemCount}>
              Video {progress.current_item} / {progress.total_items}
            </Text>
          )}

          <View style={styles.progressHeader}>
            <View style={styles.percentRow}>
              <Text style={styles.percentBig}>{Math.floor(percent)}</Text>
              <Text style={styles.percentSign}>%</Text>
            </View>
            {status === 'downloading' && progress && (
              <View style={styles.statsCol}>
                {!!progress.speed && progress.speed !== 'Unknown B/s' && (
                  <Text style={styles.speed}>{progress.speed}</Text>
                )}
                {!!progress.eta && progress.eta !== 'Unknown' && (
                  <Text style={styles.eta}>ETA {progress.eta}</Text>
                )}
              </View>
            )}
          </View>

          {status === 'downloading' && (
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${percent}%` }]} />
            </View>
          )}

          {progress?.filename ? (
            <Text style={styles.filename} numberOfLines={1}>
              {status === 'saving' ? 'Saving to device…' : progress.filename}
            </Text>
          ) : null}
        </>
      )}

      {status === 'complete' && (
        <View style={styles.statusRow}>
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>Saved to device</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.statusRow}>
          <Feather name="alert-circle" size={16} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>
            {error ?? 'An error occurred'}
          </Text>
        </View>
      )}

      {status === 'cancelled' && (
        <View style={styles.statusRow}>
          <Feather name="x-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            Download cancelled
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  itemCount: { color: colors.accent, fontSize: 12, fontWeight: '600' },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  percentBig: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    letterSpacing: -1,
  },
  percentSign: {
    color: colors.textFaint,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
    marginBottom: 4,
  },
  statsCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  speed: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  eta: {
    color: colors.textFaint,
    fontSize: 11,
  },
  track: {
    height: 8,
    borderRadius: radius.full,
    backgroundColor: '#26241F',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  filename: {
    color: colors.textFaint,
    fontSize: 11.5,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 14, fontWeight: '500', flex: 1 },
});
