import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius } from '@/theme';

import type { QueueItem } from '@/types';

interface QueuePanelProps {
  items: QueueItem[];
  onAddUrls: (urls: string[]) => void;
  onRemoveItem: (id: string) => void;
  onClearDone: () => void;
  onClearAll: () => void;
}

function StatusIcon({ status }: { status: QueueItem['status'] }) {
  if (status === 'done')
    return (
      <View style={[styles.iconBox, styles.iconDone]}>
        <Feather name="check" size={11} color="#3FCF8E" />
      </View>
    );
  if (status === 'error')
    return (
      <View style={[styles.iconBox, styles.iconError]}>
        <Text style={styles.iconErrorText}>!</Text>
      </View>
    );
  if (status === 'downloading')
    return (
      <View style={[styles.iconBox, styles.iconSpinner]}>
        <Feather name="loader" size={11} color={colors.accent} />
      </View>
    );
  return <View style={[styles.iconBox, styles.iconPending]} />;
}

export function QueuePanel({
  items,
  onAddUrls,
  onRemoveItem,
  onClearDone,
  onClearAll,
}: QueuePanelProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const add = () => {
    const urls = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http'));
    if (urls.length === 0) return;
    onAddUrls(urls);
    setText('');
  };

  return (
    <View style={styles.wrap}>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        value={text}
        onChangeText={setText}
        placeholder="Paste one or more links, one per line…"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      <TouchableOpacity
        style={[styles.addBtn, !text.trim() && styles.addBtnDisabled]}
        onPress={add}
        disabled={!text.trim()}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={16} color={colors.textBody} />
        <Text style={styles.addText}>Add to queue</Text>
      </TouchableOpacity>

      {items.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity onPress={onClearDone} hitSlop={8}>
            <Text style={styles.actionText}>Clear done</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClearAll} hitSlop={8}>
            <Text style={styles.actionText}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <StatusIcon status={item.status} />
          <View style={styles.itemBody}>
            <Text style={styles.itemUrl} numberOfLines={1}>
              {item.url}
            </Text>
            {item.status === 'downloading' && item.progress != null && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${item.progress}%` }]} />
              </View>
            )}
            {item.status === 'error' && !!item.error && (
              <Text style={styles.itemError} numberOfLines={1}>
                {item.error}
              </Text>
            )}
          </View>
          {item.status === 'pending' && (
            <TouchableOpacity onPress={() => onRemoveItem(item.id)} hitSlop={8}>
              <Feather name="x" size={13} color={colors.textVeryFaint} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {items.length === 0 && (
        <View style={styles.empty}>
          <Feather name="layers" size={24} color={colors.textFaint} />
          <Text style={styles.emptyText}>Queue is empty</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  input: {
    minHeight: 72,
    color: colors.textBody,
    fontSize: 12.5,
    backgroundColor: colors.surface,
    borderColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputFocused: {
    borderColor: colors.accent,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceButton,
    borderWidth: 1,
    borderColor: colors.surfaceButtonBorder,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { color: colors.textBody, fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  actionText: { color: colors.textFaint, fontSize: 11.5, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  iconPending: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconDone: {
    backgroundColor: 'rgba(63,207,142,0.16)',
  },
  iconError: {
    backgroundColor: 'rgba(255,90,90,0.16)',
  },
  iconSpinner: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  iconErrorText: {
    color: '#FF8A8A',
    fontSize: 11,
    fontWeight: '700',
  },
  itemBody: { flex: 1, minWidth: 0, gap: 4 },
  itemUrl: { color: '#A39D93', fontSize: 11.5 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  itemError: { color: '#FF8A8A', fontSize: 11 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyText: { color: colors.textFaint, fontSize: 13 },
});
