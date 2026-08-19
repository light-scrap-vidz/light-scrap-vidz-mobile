import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { colors, radius, spacing } from '@/theme';
import { getServerUrl, setServerUrl, normalizeServerUrl } from '@/lib/config';

const APP_VERSION = Constants.expoConfig?.version ?? '?';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved: (url: string) => void;
}

type TestState = 'idle' | 'testing' | 'ok' | 'fail';

export function SettingsModal({ visible, onClose, onSaved }: SettingsModalProps) {
  const [value, setValue] = useState('');
  const [test, setTest] = useState<TestState>('idle');

  useEffect(() => {
    if (visible) {
      void getServerUrl().then(setValue);
      setTest('idle');
    }
  }, [visible]);

  const runTest = async () => {
    const base = normalizeServerUrl(value);
    if (!base) return;
    setTest('testing');
    try {
      const res = await fetch(`${base}/api/health`);
      setTest(res.ok ? 'ok' : 'fail');
    } catch {
      setTest('fail');
    }
  };

  const save = async () => {
    const saved = await setServerUrl(value);
    onSaved(saved);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Feather name="download" size={11} color={colors.accentInk} />
              </View>
              <Text style={styles.appName}>light-scrap-vidz</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Feather name="x" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>SERVER</Text>

          <View style={styles.card}>
            <Text style={styles.hint}>
              Address of your light-scrap-vidz server (the machine running yt-dlp).
            </Text>
            <TextInput
              style={styles.input}
              value={value}
              onChangeText={(t) => {
                setValue(t);
                setTest('idle');
              }}
              placeholder="http://192.168.1.20:8787"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <View style={styles.testRow}>
              <TouchableOpacity style={styles.testBtn} onPress={runTest} activeOpacity={0.85}>
                {test === 'testing' ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Feather name="wifi" size={14} color={colors.accent} />
                )}
                <Text style={styles.testText}>Test connection</Text>
              </TouchableOpacity>
              {test === 'ok' && (
                <Text style={[styles.testResult, { color: colors.success }]}>Reachable ✓</Text>
              )}
              {test === 'fail' && (
                <Text style={[styles.testResult, { color: colors.error }]}>Unreachable ✗</Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={save} activeOpacity={0.85}>
            <Text style={styles.saveText}>Save</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>light-scrap-vidz · v{APP_VERSION} · yt-dlp powered</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#161512',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    padding: spacing.xl,
    paddingTop: 12,
    gap: spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    backgroundColor: colors.surfaceButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.md,
    padding: 13,
    gap: 10,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  input: {
    color: colors.textPrimary,
    fontSize: 13,
    backgroundColor: colors.surfaceButton,
    borderColor: colors.surfaceButtonBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testText: { color: colors.accent, fontSize: 13, fontWeight: '500' },
  testResult: { fontSize: 13, fontWeight: '500' },
  saveBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  saveText: { color: colors.accentInk, fontSize: 15, fontWeight: '700' },
  footer: {
    color: colors.textFaint,
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 4,
  },
});
