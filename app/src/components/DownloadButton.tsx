import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '@/theme';
import type { DownloadStatus } from '@/types';

interface DownloadButtonProps {
  status: DownloadStatus;
  disabled?: boolean;
  audioOnly: boolean;
  isPlaylist?: boolean;
  playlistCount?: number | null;
  selectedCount?: number;
  onDownload: () => void;
  onCancel: () => void;
  onReset: () => void;
}

export function DownloadButton({
  status,
  disabled,
  audioOnly,
  isPlaylist,
  playlistCount,
  selectedCount,
  onDownload,
  onCancel,
  onReset,
}: DownloadButtonProps) {
  if (status === 'downloading' || status === 'saving') {
    return (
      <TouchableOpacity
        style={[styles.button, styles.cancel]}
        onPress={onCancel}
        activeOpacity={0.85}
        disabled={status === 'saving'}
      >
        <Feather name="x" size={18} color={colors.error} />
        <Text style={[styles.label, { color: colors.error }]}>
          {status === 'saving' ? 'Saving…' : 'Cancel'}
        </Text>
      </TouchableOpacity>
    );
  }

  if (status === 'complete' || status === 'error' || status === 'cancelled') {
    return (
      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={onReset}
        activeOpacity={0.85}
      >
        <Feather name="rotate-ccw" size={16} color={colors.textPrimary} />
        <Text style={styles.label}>Download another</Text>
      </TouchableOpacity>
    );
  }

  let label: string;
  if (isPlaylist && selectedCount && selectedCount > 0) {
    label = audioOnly ? `Extract ${selectedCount} selected` : `Download ${selectedCount} selected`;
  } else if (isPlaylist && playlistCount) {
    label = audioOnly ? `Extract ${playlistCount} MP3s` : `Download ${playlistCount} videos`;
  } else {
    label = audioOnly ? 'Extract MP3' : 'Download MP4';
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.primary, disabled && styles.disabled]}
      onPress={onDownload}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Feather name="download" size={18} color={colors.accentInk} />
      <Text style={[styles.label, { color: colors.accentInk }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radius.lg,
  },
  primary: {
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 5,
  },
  cancel: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.errorBorder,
  },
  secondary: {
    backgroundColor: colors.surfaceButton,
    borderWidth: 1,
    borderColor: colors.surfaceButtonBorder,
  },
  disabled: { opacity: 0.4 },
  label: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
});
