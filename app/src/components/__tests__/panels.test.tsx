import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { HistoryList } from '@/components/HistoryList';
import { VideoPreview } from '@/components/VideoPreview';
import { ProgressCard } from '@/components/ProgressCard';
import { QueuePanel } from '@/components/QueuePanel';
import { PlaylistPreview } from '@/components/PlaylistPreview';
import type { HistoryEntry, QueueItem } from '@/types';

const NOW = new Date('2026-08-17T12:00:00Z').getTime();

const entry = (over: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({
    id: '1',
    url: 'https://www.youtube.com/watch?v=abc',
    title: 'A clip',
    thumbnail: '',
    platform: 'youtube',
    filename: 'clip.mp4',
    downloaded_at: NOW,
    quality: 'best',
    ...over,
  }) as HistoryEntry;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('HistoryList', () => {
  function setup(entries: HistoryEntry[]) {
    const onClear = jest.fn();
    const onSelect = jest.fn();
    render(<HistoryList entries={entries} onClear={onClear} onSelect={onSelect} />);
    return { onClear, onSelect };
  }

  it('says so when there is nothing yet', () => {
    setup([]);
    expect(screen.getByText('No downloads yet')).toBeTruthy();
  });

  it('lists the entries with a clear-all action', () => {
    setup([entry(), entry({ id: '2', title: 'Another clip' })]);
    expect(screen.getByText('A clip')).toBeTruthy();
    expect(screen.getByText('Another clip')).toBeTruthy();
    expect(screen.getByText('Clear all')).toBeTruthy();
  });

  it('clears the whole list on demand', () => {
    const { onClear } = setup([entry()]);

    fireEvent.press(screen.getByText('Clear all'));

    expect(onClear).toHaveBeenCalled();
  });

  it.each([
    [0, 'just now'],
    [30_000, 'just now'],
    [5 * 60_000, '5m ago'],
    [2 * 3_600_000, '2h ago'],
    [3 * 86_400_000, '3d ago'],
  ])('renders an age of %ims as "%s"', (age, expected) => {
    setup([entry({ downloaded_at: NOW - age })]);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('reports the chosen URL and marks the row as pending', () => {
    const { onSelect } = setup([entry()]);

    fireEvent.press(screen.getByText('A clip'));

    expect(onSelect).toHaveBeenCalledWith('https://www.youtube.com/watch?v=abc');
    expect(screen.getByText('Fetching info…')).toBeTruthy();
  });

  it('drops the pending mark after a few seconds', () => {
    setup([entry()]);
    fireEvent.press(screen.getByText('A clip'));

    act(() => {
      jest.advanceTimersByTime(3100);
    });

    expect(screen.getByText('A clip')).toBeTruthy();
  });
});

describe('VideoPreview', () => {
  const info = {
    id: 'abc',
    title: 'Never Gonna Give You Up',
    thumbnail: 'https://img/t.jpg',
    duration: 212,
    uploader: 'Rick Astley',
  } as never;

  it('shows the title, uploader and duration', () => {
    render(<VideoPreview info={info} url="https://youtu.be/abc" />);

    expect(screen.getByText('Never Gonna Give You Up')).toBeTruthy();
    expect(screen.getByText('Rick Astley · 3:32')).toBeTruthy();
    expect(screen.getByText('SINGLE VIDEO')).toBeTruthy();
  });

  it('hides the duration badge for a zero-length video', () => {
    render(<VideoPreview info={{ ...(info as object), duration: 0 } as never} url="https://youtu.be/abc" />);
    expect(screen.queryByText('3:32')).toBeNull();
  });

  it('copes with a missing thumbnail', () => {
    render(<VideoPreview info={{ ...(info as object), thumbnail: '' } as never} url="https://youtu.be/abc" />);
    expect(screen.getByText('Never Gonna Give You Up')).toBeTruthy();
  });
});

describe('ProgressCard', () => {
  it('shows the rounded percentage while downloading', () => {
    render(
      <ProgressCard status="downloading" progress={{ percent: 42.7 } as never} error={null} />,
    );
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('treats a missing percentage as zero', () => {
    render(<ProgressCard status="downloading" progress={null} error={null} />);
    expect(screen.getByText('0')).toBeTruthy();
  });

  it('shows the speed and eta when the server reports them', () => {
    render(
      <ProgressCard
        status="downloading"
        progress={{ percent: 10, speed: '1MiB/s', eta: '10s' } as never}
        error={null}
      />,
    );
    expect(screen.getByText('1MiB/s')).toBeTruthy();
    expect(screen.getByText('ETA 10s')).toBeTruthy();
  });

  it('counts the items of a playlist download', () => {
    render(
      <ProgressCard
        status="downloading"
        progress={{ percent: 10, current_item: 2, total_items: 5 } as never}
        error={null}
      />,
    );
    expect(screen.getByText(/2/)).toBeTruthy();
  });

  it('says it is saving rather than showing the file name', () => {
    render(
      <ProgressCard
        status="saving"
        progress={{ percent: 100, filename: 'clip.mp4' } as never}
        error={null}
      />,
    );
    expect(screen.getByText('Saving to device…')).toBeTruthy();
  });

  it('confirms once the file is on the device', () => {
    render(<ProgressCard status="complete" progress={null} error={null} />);
    expect(screen.getByText('Saved to device')).toBeTruthy();
  });

  it('shows the reason for a failure', () => {
    render(<ProgressCard status="error" progress={null} error="This video is private" />);
    expect(screen.getByText('This video is private')).toBeTruthy();
  });

  it('falls back to a generic failure message', () => {
    render(<ProgressCard status="error" progress={null} error={null} />);
    expect(screen.getByText('An error occurred')).toBeTruthy();
  });
});

describe('QueuePanel', () => {
  const item = (over: Partial<QueueItem> = {}): QueueItem =>
    ({ id: '1', url: 'https://youtu.be/a', status: 'pending', ...over }) as QueueItem;

  function setup(items: QueueItem[] = []) {
    const handlers = {
      onAddUrls: jest.fn(),
      onRemoveItem: jest.fn(),
      onClearDone: jest.fn(),
      onClearAll: jest.fn(),
    };
    render(<QueuePanel items={items} {...handlers} />);
    return handlers;
  }

  const box = () => screen.getByPlaceholderText('Paste one or more links, one per line…');

  it('splits pasted links one per line', () => {
    const { onAddUrls } = setup();

    fireEvent.changeText(box(), 'https://a\nhttps://b');
    fireEvent.press(screen.getByText('Add to queue'));

    expect(onAddUrls).toHaveBeenCalledWith(['https://a', 'https://b']);
  });

  it('drops lines that are not links', () => {
    const { onAddUrls } = setup();

    fireEvent.changeText(box(), 'nonsense\nhttps://good');
    fireEvent.press(screen.getByText('Add to queue'));

    expect(onAddUrls).toHaveBeenCalledWith(['https://good']);
  });

  it('lists each queued URL', () => {
    setup([item(), item({ id: '2', url: 'https://youtu.be/b' })]);
    expect(screen.getByText('https://youtu.be/a')).toBeTruthy();
    expect(screen.getByText('https://youtu.be/b')).toBeTruthy();
  });

  it('shows the reason on a failed row', () => {
    setup([item({ status: 'error', error: 'This video is private' })]);
    expect(screen.getByText('This video is private')).toBeTruthy();
  });

  it('offers the clearing actions once there are rows', () => {
    const { onClearDone, onClearAll } = setup([item()]);

    fireEvent.press(screen.getByText('Clear done'));
    fireEvent.press(screen.getByText('Clear all'));

    expect(onClearDone).toHaveBeenCalled();
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('PlaylistPreview', () => {
  const entries = [
    { url: 'https://youtu.be/a', title: 'First' },
    { url: 'https://youtu.be/b', title: 'Second' },
  ];
  const info = { title: 'A playlist', playlist_count: 2, entries } as never;

  function setup(props: Partial<Parameters<typeof PlaylistPreview>[0]> = {}) {
    const onSelectionChange = jest.fn();
    render(
      <PlaylistPreview
        info={info}
        url="https://www.youtube.com/playlist?list=PL1"
        selectedUrls={[]}
        onSelectionChange={onSelectionChange}
        {...props}
      />,
    );
    return { onSelectionChange };
  }

  it('lists the entries and their count', () => {
    setup();
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    // The count appears both in the header card and above the entry list.
    expect(screen.getAllByText('2 videos').length).toBeGreaterThan(0);
  });

  it('counts the selection instead once something is picked', () => {
    setup({ selectedUrls: ['https://youtu.be/a'] });
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('adds an entry to the selection', () => {
    const { onSelectionChange } = setup();

    fireEvent.press(screen.getByText('First'));

    expect(onSelectionChange).toHaveBeenCalledWith(['https://youtu.be/a']);
  });

  it('removes an entry already selected', () => {
    const { onSelectionChange } = setup({
      selectedUrls: ['https://youtu.be/a', 'https://youtu.be/b'],
    });

    fireEvent.press(screen.getByText('First'));

    expect(onSelectionChange).toHaveBeenCalledWith(['https://youtu.be/b']);
  });

  it('selects everything from the header', () => {
    const { onSelectionChange } = setup();

    fireEvent.press(screen.getByText('All'));

    expect(onSelectionChange).toHaveBeenCalledWith(['https://youtu.be/a', 'https://youtu.be/b']);
  });

  it('hides the select-all action once everything is picked', () => {
    setup({ selectedUrls: ['https://youtu.be/a', 'https://youtu.be/b'] });
    expect(screen.queryByText('All')).toBeNull();
  });

  it('reports nothing while disabled', () => {
    const { onSelectionChange } = setup({ disabled: true });

    fireEvent.press(screen.getByText('First'));

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it('copes with a playlist that carries no entries', () => {
    setup({ info: { title: 'Empty', playlist_count: null, entries: undefined } as never });
    expect(screen.queryByText('First')).toBeNull();
  });
});
