import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { GlassCard } from '@/components/GlassCard';
import { Badge } from '@/components/Badge';
import { PlaylistEndSelector } from '@/components/PlaylistEndSelector';
import { FormatSelector } from '@/components/FormatSelector';
import { DownloadButton } from '@/components/DownloadButton';
import { UrlInput } from '@/components/UrlInput';

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));

const mockClipboard = Clipboard as jest.Mocked<typeof Clipboard>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GlassCard', () => {
  it('renders whatever it is given', () => {
    render(
      <GlassCard>
        <Text>inside</Text>
      </GlassCard>,
    );
    expect(screen.getByText('inside')).toBeTruthy();
  });

  it('passes extra props through to the view', () => {
    render(
      <GlassCard testID="card" accessibilityLabel="a card">
        <Text>inside</Text>
      </GlassCard>,
    );
    expect(screen.getByTestId('card').props.accessibilityLabel).toBe('a card');
  });
});

describe('Badge', () => {
  it('shows its label', () => {
    render(<Badge label="YouTube" color="#f00" bgColor="#100" borderColor="#200" />);
    expect(screen.getByText('YouTube')).toBeTruthy();
  });

  it('tints the label with the given colour', () => {
    render(<Badge label="TikTok" color="#0ff" bgColor="#011" borderColor="#022" />);
    const label = screen.getByText('TikTok');
    expect(JSON.stringify(label.props.style)).toContain('#0ff');
  });
});

describe('PlaylistEndSelector', () => {
  it('offers every preset', () => {
    render(<PlaylistEndSelector value={10} onChange={jest.fn()} />);
    for (const label of ['5', '10', '25', '50', 'All']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('reports the picked count', () => {
    const onChange = jest.fn();
    render(<PlaylistEndSelector value={10} onChange={onChange} />);

    fireEvent.press(screen.getByText('50'));

    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('maps All to zero', () => {
    const onChange = jest.fn();
    render(<PlaylistEndSelector value={10} onChange={onChange} />);

    fireEvent.press(screen.getByText('All'));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('reports nothing while disabled', () => {
    const onChange = jest.fn();
    render(<PlaylistEndSelector value={10} onChange={onChange} disabled />);

    fireEvent.press(screen.getByText('50'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('FormatSelector', () => {
  function setup(props: Partial<Parameters<typeof FormatSelector>[0]> = {}) {
    const onAudioOnlyChange = jest.fn();
    const onQualityChange = jest.fn();
    render(
      <FormatSelector
        audioOnly={false}
        onAudioOnlyChange={onAudioOnlyChange}
        quality="best"
        onQualityChange={onQualityChange}
        {...props}
      />,
    );
    return { onAudioOnlyChange, onQualityChange };
  }

  it('offers both formats', () => {
    setup();
    expect(screen.getByText('Video · MP4')).toBeTruthy();
    expect(screen.getByText('Audio · MP3')).toBeTruthy();
  });

  it('switches to audio and back', () => {
    const { onAudioOnlyChange } = setup();

    fireEvent.press(screen.getByText('Audio · MP3'));
    fireEvent.press(screen.getByText('Video · MP4'));

    expect(onAudioOnlyChange).toHaveBeenNthCalledWith(1, true);
    expect(onAudioOnlyChange).toHaveBeenNthCalledWith(2, false);
  });

  it('shows the quality choices for video', () => {
    setup({ audioOnly: false });
    expect(screen.getByText('Best')).toBeTruthy();
    expect(screen.getByText('1080p')).toBeTruthy();
  });

  it('hides the quality choices for audio-only', () => {
    setup({ audioOnly: true });
    expect(screen.queryByText('1080p')).toBeNull();
  });

  it('reports the picked quality', () => {
    const { onQualityChange } = setup();

    fireEvent.press(screen.getByText('720p'));

    expect(onQualityChange).toHaveBeenCalledWith('720p');
  });
});

describe('DownloadButton', () => {
  function setup(props: Partial<Parameters<typeof DownloadButton>[0]> = {}) {
    const handlers = { onDownload: jest.fn(), onCancel: jest.fn(), onReset: jest.fn() };
    render(<DownloadButton status="idle" audioOnly={false} {...handlers} {...props} />);
    return handlers;
  }

  it.each([
    [{}, 'Download MP4'],
    [{ audioOnly: true }, 'Extract MP3'],
    [{ isPlaylist: true, playlistCount: 12 }, 'Download 12 videos'],
    [{ isPlaylist: true, playlistCount: 12, audioOnly: true }, 'Extract 12 MP3s'],
    [{ isPlaylist: true, selectedCount: 3 }, 'Download 3 selected'],
    [{ isPlaylist: true, selectedCount: 3, audioOnly: true }, 'Extract 3 selected'],
  ])('labels itself %j as "%s"', (props, expected) => {
    setup(props);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('falls back to the single-video label when the playlist count is unknown', () => {
    setup({ isPlaylist: true, playlistCount: null });
    expect(screen.getByText('Download MP4')).toBeTruthy();
  });

  it('starts the download on press', () => {
    const { onDownload } = setup();

    fireEvent.press(screen.getByText('Download MP4'));

    expect(onDownload).toHaveBeenCalled();
  });

  it('ignores presses while disabled', () => {
    const { onDownload } = setup({ disabled: true });

    fireEvent.press(screen.getByText('Download MP4'));

    expect(onDownload).not.toHaveBeenCalled();
  });

  it('offers to cancel while downloading', () => {
    const { onCancel } = setup({ status: 'downloading' });

    fireEvent.press(screen.getByText('Cancel'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('shows a non-cancellable saving state', () => {
    const { onCancel } = setup({ status: 'saving' });

    expect(screen.getByText('Saving…')).toBeTruthy();
    fireEvent.press(screen.getByText('Saving…'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each(['complete', 'error', 'cancelled'] as const)(
    'offers another download once %s',
    (status) => {
      const { onReset } = setup({ status });

      fireEvent.press(screen.getByText('Download another'));

      expect(onReset).toHaveBeenCalled();
    },
  );
});

describe('UrlInput', () => {
  const field = () => screen.getByPlaceholderText('Paste a video link…');

  it('submits a supported URL', () => {
    const onSubmit = jest.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} />);

    fireEvent.changeText(field(), '  https://youtu.be/abc  ');
    fireEvent(field(), 'submitEditing');

    expect(onSubmit).toHaveBeenCalledWith('https://youtu.be/abc');
  });

  it('refuses an unsupported URL', () => {
    const onSubmit = jest.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} />);

    fireEvent.changeText(field(), 'https://example.com/video');
    fireEvent(field(), 'submitEditing');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to submit while loading', () => {
    const onSubmit = jest.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading />);

    fireEvent.changeText(field(), 'https://youtu.be/abc');
    fireEvent(field(), 'submitEditing');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses to submit while disabled', () => {
    const onSubmit = jest.fn();
    render(<UrlInput onSubmit={onSubmit} isLoading={false} disabled />);

    fireEvent.changeText(field(), 'https://youtu.be/abc');
    fireEvent(field(), 'submitEditing');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('fills the field from the clipboard', async () => {
    mockClipboard.getStringAsync.mockResolvedValue('  https://youtu.be/pasted  ');
    render(<UrlInput onSubmit={jest.fn()} isLoading={false} />);

    fireEvent.press(screen.getByText('Paste'));

    await waitFor(() => expect(field().props.value).toBe('https://youtu.be/pasted'));
  });

  it('leaves the field alone when the clipboard is empty', async () => {
    mockClipboard.getStringAsync.mockResolvedValue('   ');
    render(<UrlInput onSubmit={jest.fn()} isLoading={false} />);

    fireEvent.press(screen.getByText('Paste'));

    await waitFor(() => expect(mockClipboard.getStringAsync).toHaveBeenCalled());
    expect(field().props.value).toBe('');
  });

  it('stays quiet when clipboard access is refused', async () => {
    mockClipboard.getStringAsync.mockRejectedValue(new Error('denied'));
    render(<UrlInput onSubmit={jest.fn()} isLoading={false} />);

    fireEvent.press(screen.getByText('Paste'));

    await waitFor(() => expect(mockClipboard.getStringAsync).toHaveBeenCalled());
    expect(field().props.value).toBe('');
  });

  it('locks the field while a lookup runs', () => {
    render(<UrlInput onSubmit={jest.fn()} isLoading />);
    expect(field().props.editable).toBe(false);
  });
});
