import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { GlassCard } from '@/components/GlassCard';
import { UrlInput } from '@/components/UrlInput';
import { VideoPreview } from '@/components/VideoPreview';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import { FormatSelector } from '@/components/FormatSelector';
import { PlaylistEndSelector } from '@/components/PlaylistEndSelector';
import { ProgressCard } from '@/components/ProgressCard';
import { DownloadButton } from '@/components/DownloadButton';
import { HistoryList } from '@/components/HistoryList';
import { QueuePanel } from '@/components/QueuePanel';
import { SettingsModal } from '@/components/SettingsModal';

import { useVideoInfo } from '@/hooks/useVideoInfo';
import { usePlaylistInfo } from '@/hooks/usePlaylistInfo';
import { useDownload } from '@/hooks/useDownload';
import { useHistory } from '@/hooks/useHistory';
import { useQueue } from '@/hooks/useQueue';
import { isPlaylistUrl } from '@/lib/url-validator';
import { getServerUrl } from '@/lib/config';
import { colors, radius, spacing } from '@/theme';
import type { Quality, UrlKind } from '@/types';

function AppInner() {
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('best');
  const [urlKind, setUrlKind] = useState<UrlKind>('single');
  const [playlistEnd, setPlaylistEnd] = useState(10);
  const [audioOnly, setAudioOnly] = useState(false);
  const [selectedPlaylistUrls, setSelectedPlaylistUrls] = useState<string[]>([]);
  const [tab, setTab] = useState<'recent' | 'queue'>('recent');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [serverUrl, setServerUrlState] = useState<string | null>(null);

  useEffect(() => {
    void getServerUrl().then(setServerUrlState);
  }, []);

  const { entries, addEntry, clearHistory } = useHistory();
  const {
    info,
    status: infoStatus,
    error: infoError,
    fetchInfo,
    reset: resetInfo,
  } = useVideoInfo();
  const {
    info: plInfo,
    status: plStatus,
    error: plError,
    fetchInfo: fetchPlInfo,
    reset: resetPlInfo,
  } = usePlaylistInfo();
  const {
    status,
    progress,
    error: dlError,
    download,
    cancel,
    reset: resetDownload,
  } = useDownload(addEntry);
  const {
    items: queueItems,
    isActive: queueActive,
    addItems: addToQueue,
    removeItem: removeQueueItem,
    clearDone: clearQueueDone,
    clearAll: clearQueueAll,
  } = useQueue();

  const activeInfoStatus = urlKind === 'single' ? infoStatus : plStatus;
  const activeError = urlKind === 'single' ? infoError : plError;
  const isBusy = activeInfoStatus === 'loading' || status === 'downloading' || status === 'saving';
  const isActive =
    status === 'downloading' ||
    status === 'saving' ||
    status === 'complete' ||
    status === 'error' ||
    status === 'cancelled';
  const showContent = (urlKind === 'single' && !!info) || (urlKind === 'playlist' && !!plInfo);

  const handleFetchInfo = useCallback(
    async (submittedUrl: string) => {
      setUrl(submittedUrl);
      setSelectedPlaylistUrls([]);
      resetDownload();
      resetInfo();
      resetPlInfo();
      if (isPlaylistUrl(submittedUrl)) {
        setUrlKind('playlist');
        await fetchPlInfo(submittedUrl);
      } else {
        setUrlKind('single');
        await fetchInfo(submittedUrl);
      }
    },
    [fetchInfo, fetchPlInfo, resetDownload, resetInfo, resetPlInfo],
  );

  const handleDownload = useCallback(() => {
    if (urlKind === 'playlist' && selectedPlaylistUrls.length > 0) {
      // Queue each selected entry as an individual download
      addToQueue(
        selectedPlaylistUrls.map((u) => ({
          url: u,
          quality,
          audioOnly,
          playlistEnd: null,
        })),
      );
      setTab('queue');
      return;
    }
    if (urlKind === 'playlist' && plInfo) {
      void download({ url, quality, info: null, playlistInfo: plInfo, playlistEnd, audioOnly });
    } else if (info) {
      void download({ url, quality, info, playlistInfo: null, playlistEnd: null, audioOnly });
    }
  }, [
    info,
    plInfo,
    url,
    quality,
    urlKind,
    playlistEnd,
    audioOnly,
    selectedPlaylistUrls,
    download,
    addToQueue,
  ]);

  const handleAddToQueue = useCallback(
    (urls: string[]) => {
      addToQueue(
        urls.map((u) => ({
          url: u,
          quality,
          audioOnly,
          playlistEnd: isPlaylistUrl(u) ? playlistEnd : null,
        })),
      );
      setTab('queue');
    },
    [addToQueue, quality, audioOnly, playlistEnd],
  );

  const handleReset = useCallback(() => {
    setUrl('');
    setUrlKind('single');
    setSelectedPlaylistUrls([]);
    resetInfo();
    resetPlInfo();
    resetDownload();
  }, [resetInfo, resetPlInfo, resetDownload]);

  useEffect(() => {
    if (queueActive) setTab('queue');
  }, [queueActive]);

  const pendingCount = queueItems.filter((i) => i.status === 'pending').length;
  const needsServer = serverUrl !== null && serverUrl === '';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            {showContent || isActive ? (
              <TouchableOpacity
                onPress={handleReset}
                disabled={isBusy}
                hitSlop={10}
                activeOpacity={0.7}
                style={styles.backBtn}
              >
                <Feather
                  name="arrow-left"
                  size={16}
                  color={isBusy ? colors.textFaint : colors.textSecondary}
                />
              </TouchableOpacity>
            ) : (
              <View style={styles.logoWrap}>
                <Feather name="download" size={12} color={colors.accentInk} />
              </View>
            )}
            <Text style={styles.appTitle}>light-scrap-vidz</Text>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => setSettingsOpen(true)}
              hitSlop={10}
              activeOpacity={0.7}
            >
              <Feather name="sliders" size={17} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Server banner */}
            {needsServer && (
              <TouchableOpacity onPress={() => setSettingsOpen(true)} activeOpacity={0.85}>
                <View style={styles.banner}>
                  <Feather name="alert-triangle" size={15} color={colors.accent} />
                  <Text style={styles.bannerText}>
                    No server configured. Tap to enter your server address.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* URL input */}
            <GlassCard>
              <UrlInput
                onSubmit={handleFetchInfo}
                isLoading={activeInfoStatus === 'loading'}
                disabled={isBusy}
              />
              {activeInfoStatus === 'error' && (
                <Text style={styles.error}>{activeError}</Text>
              )}
            </GlassCard>

            {/* Content (preview + options + download) */}
            {showContent && (
              <View style={styles.section}>
                {urlKind === 'single' && info && <VideoPreview info={info} url={url} />}
                {urlKind === 'playlist' && plInfo && (
                  <PlaylistPreview
                    info={plInfo}
                    url={url}
                    selectedUrls={selectedPlaylistUrls}
                    onSelectionChange={setSelectedPlaylistUrls}
                    disabled={isBusy || isActive}
                  />
                )}

                <GlassCard style={styles.optionsCard}>
                  <FormatSelector
                    audioOnly={audioOnly}
                    onAudioOnlyChange={setAudioOnly}
                    quality={quality}
                    onQualityChange={setQuality}
                    disabled={isBusy || isActive}
                  />
                  {urlKind === 'playlist' && selectedPlaylistUrls.length === 0 && (
                    <>
                      <View style={styles.sep} />
                      <PlaylistEndSelector
                        value={playlistEnd}
                        onChange={setPlaylistEnd}
                        disabled={isBusy || isActive}
                      />
                    </>
                  )}
                </GlassCard>

                <ProgressCard status={status} progress={progress} error={dlError} />

                <DownloadButton
                  status={status}
                  disabled={needsServer || isBusy}
                  audioOnly={audioOnly}
                  isPlaylist={urlKind === 'playlist'}
                  playlistCount={plInfo?.playlist_count ?? plInfo?.entries?.length}
                  selectedCount={selectedPlaylistUrls.length}
                  onDownload={handleDownload}
                  onCancel={cancel}
                  onReset={handleReset}
                />
              </View>
            )}

            {/* Tabs */}
            <View style={styles.tabBar}>
              <View style={styles.tabGroup}>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === 'recent' && styles.tabBtnActive]}
                  onPress={() => setTab('recent')}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="clock"
                    size={13}
                    color={tab === 'recent' ? colors.textPrimary : colors.textMuted}
                  />
                  <Text style={[styles.tabText, tab === 'recent' && styles.tabTextActive]}>
                    Recent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tabBtn, tab === 'queue' && styles.tabBtnActive]}
                  onPress={() => setTab('queue')}
                  activeOpacity={0.8}
                >
                  <Feather
                    name="layers"
                    size={13}
                    color={tab === 'queue' ? colors.textPrimary : colors.textMuted}
                  />
                  <Text style={[styles.tabText, tab === 'queue' && styles.tabTextActive]}>
                    Queue
                  </Text>
                  {pendingCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{pendingCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Tab content */}
            <GlassCard>
              {tab === 'recent' ? (
                <HistoryList
                  entries={entries}
                  onClear={clearHistory}
                  onSelect={handleFetchInfo}
                />
              ) : (
                <QueuePanel
                  items={queueItems}
                  onAddUrls={handleAddToQueue}
                  onRemoveItem={removeQueueItem}
                  onClearDone={clearQueueDone}
                  onClearAll={clearQueueAll}
                />
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={setServerUrlState}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: spacing.xl,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logoWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    flex: 1,
    color: '#EFEBE4',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.15,
  },
  settingsBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: '#1C1B17',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll */
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  /* Banner */
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(201,242,94,0.25)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  bannerText: { color: colors.accent, fontSize: 13, flex: 1 },

  /* Error */
  error: { color: '#FF8A8A', fontSize: 12, marginTop: 10 },

  /* Section */
  section: { gap: spacing.md },
  optionsCard: { gap: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Tab bar */
  tabBar: { flexDirection: 'row', alignItems: 'center' },
  tabGroup: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 11,
    padding: 4,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#2A2823',
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: '#F0ECE4',
  },

  /* Queue badge */
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.accentInk,
    fontSize: 10,
    fontWeight: '800',
  },
});
