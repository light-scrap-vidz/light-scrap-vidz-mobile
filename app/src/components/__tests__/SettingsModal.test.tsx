import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SettingsModal } from '@/components/SettingsModal';
import { setServerUrl } from '@/lib/config';

const fetchMock = jest.fn();

function setup(props: Partial<Parameters<typeof SettingsModal>[0]> = {}) {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const view = render(
    <SettingsModal visible onClose={onClose} onSaved={onSaved} {...props} />,
  );
  return { onClose, onSaved, ...view };
}

const field = () => screen.getByPlaceholderText('http://192.168.1.20:8787');

beforeEach(async () => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  await setServerUrl('');
});

describe('SettingsModal — server address', () => {
  it('prefills the stored address when opened', async () => {
    await setServerUrl('http://stored:8787');
    setup();

    await waitFor(() => expect(field().props.value).toBe('http://stored:8787'));
  });

  it('saves a normalised address and closes', async () => {
    const { onSaved, onClose } = setup();
    await act(async () => {});

    fireEvent.changeText(field(), '192.168.1.20:8787/');
    await act(async () => {
      fireEvent.press(screen.getByText('Save'));
    });

    expect(onSaved).toHaveBeenCalledWith('http://192.168.1.20:8787');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('SettingsModal — connection test', () => {
  it('reports a reachable server', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    setup();
    await act(async () => {});
    fireEvent.changeText(field(), 'http://server:8787');

    await act(async () => {
      fireEvent.press(screen.getByText('Test connection'));
    });

    expect(fetchMock).toHaveBeenCalledWith('http://server:8787/api/health');
    await waitFor(() => expect(screen.getByText('Reachable ✓')).toBeTruthy());
  });

  it('reports an unreachable server', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    setup();
    await act(async () => {});
    fireEvent.changeText(field(), 'http://server:8787');

    await act(async () => {
      fireEvent.press(screen.getByText('Test connection'));
    });

    await waitFor(() => expect(screen.getByText('Unreachable ✗')).toBeTruthy());
  });

  it('treats a non-OK response as unreachable', async () => {
    fetchMock.mockResolvedValue({ ok: false });
    setup();
    await act(async () => {});
    fireEvent.changeText(field(), 'http://server:8787');

    await act(async () => {
      fireEvent.press(screen.getByText('Test connection'));
    });

    await waitFor(() => expect(screen.getByText('Unreachable ✗')).toBeTruthy());
  });

  it('does nothing when the address is empty', async () => {
    setup();
    await act(async () => {});
    fireEvent.changeText(field(), '   ');

    await act(async () => {
      fireEvent.press(screen.getByText('Test connection'));
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clears a previous result when the address is edited', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    setup();
    await act(async () => {});
    fireEvent.changeText(field(), 'http://server:8787');
    await act(async () => {
      fireEvent.press(screen.getByText('Test connection'));
    });
    await waitFor(() => expect(screen.getByText('Reachable ✓')).toBeTruthy());

    fireEvent.changeText(field(), 'http://other:8787');

    expect(screen.queryByText('Reachable ✓')).toBeNull();
  });
});

describe('SettingsModal — visibility', () => {
  it('re-reads the stored address each time it opens', async () => {
    const { rerender } = setup({ visible: false });
    await setServerUrl('http://fresh:8787');

    rerender(<SettingsModal visible onClose={jest.fn()} onSaved={jest.fn()} />);

    await waitFor(() => expect(field().props.value).toBe('http://fresh:8787'));
  });
});
