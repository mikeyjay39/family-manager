import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform } from 'react-native';
import DocumentList, { parseDocumentDto } from './document-list';
import { useAuth } from '@/contexts/AuthContext';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { apiFetch, authenticatedFetch } from '@/lib/api/client';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';
import * as loadProton from '@/lib/proton-drive/load-proton.web';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/contexts/ProtonConnectContext', () => ({
  useProtonConnect: vi.fn(),
}));

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    authenticatedFetch: vi.fn(),
    apiFetch: vi.fn(),
  };
});

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

vi.mock('@/lib/proton-drive/load-proton.web', () => ({
  resolveProtonPreview: vi.fn(),
  downloadProtonFile: vi.fn(),
  triggerBrowserDownload: vi.fn(),
  uploadToLifeManagerFolder: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUseProtonConnect = vi.mocked(useProtonConnect);
const mockAuthenticatedFetch = vi.mocked(authenticatedFetch);
const mockApiFetch = vi.mocked(apiFetch);
const mockResolveProtonPreview = vi.mocked(loadProton.resolveProtonPreview);
const mockDownloadProtonFile = vi.mocked(loadProton.downloadProtonFile);
const mockTriggerBrowserDownload = vi.mocked(loadProton.triggerBrowserDownload);

const protonDoc = {
  id: 'doc-proton',
  title: 'Proton Doc',
  content: 'Body text',
  tags: [],
  created_at: '2026-07-11T00:00:00',
  issued_date: null,
  expire_date: null,
  storage: {
    provider: 'proton_drive',
    share_id: 'share-1',
    node_id: 'node-1',
    filename: 'scan.png',
    mime_type: 'image/png',
  },
};

function renderDocumentList(props: { refreshKey?: number } = {}) {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <DocumentList {...props} />
    </TenantThemeTestProvider>
  );
}

function defaultAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    token: 'tok',
    handleUnauthorized: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

function mockWebPlatform() {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => 'web',
  });
}

describe('DocumentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuth());
    mockUseProtonConnect.mockReturnValue({
      session: null,
      isSupported: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    if (typeof URL !== 'undefined') {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    } else {
      // @ts-expect-error test polyfill for node env
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-preview'),
        revokeObjectURL: vi.fn(),
      };
    }
  });

  it('shows sign in message when there is no token', () => {
    mockUseAuth.mockReturnValue(defaultAuth({ token: null, isAuthenticated: false }));
    renderDocumentList();
    expect(screen.getByText('Sign in to see your documents.')).toBeTruthy();
  });

  it('loads and lists document titles in the spreadsheet grid', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: '1', title: 'Alpha', content: 'c1', created_at: '2026-07-11T00:00:00' },
          { id: '2', title: 'Beta', content: 'c2', created_at: '2026-07-11T00:00:00' },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeTruthy();
    });
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getByText('Issued')).toBeTruthy();
    expect(screen.getByText('Expires')).toBeTruthy();
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      '/documents',
      expect.objectContaining({ method: 'GET', token: 'tok' })
    );
  });

  it('formats tags and nullable dates in grid cells', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: '1',
            title: 'Tagged Doc',
            content: 'Body',
            tags: ['tax', '2024'],
            created_at: '2026-07-11T00:00:00',
            issued_date: '2024-06-01T00:00:00',
            expire_date: null,
          },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('tax, 2024')).toBeTruthy();
    });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error when fetch fails', async () => {
    mockAuthenticatedFetch.mockResolvedValue(new Response('oops', { status: 500 }));
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeTruthy();
    });
  });

  it('wraps toolbar and grid in a shared horizontal scroll when documents exist', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: '1', title: 'Alpha', content: 'c1', created_at: '2026-07-11T00:00:00' },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByTestId('documents-table-scroll')).toBeTruthy();
    });
    expect(screen.getByTestId('documents-table-block')).toBeTruthy();
    expect(screen.getByText('Your documents')).toBeTruthy();
    expect(screen.getByLabelText('Refresh documents')).toBeTruthy();
  });

  it('shows toolbar outside the table scroll when there are no documents', async () => {
    mockAuthenticatedFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('No documents yet.')).toBeTruthy();
    });
    expect(screen.queryByTestId('documents-table-scroll')).toBeNull();
    expect(screen.getByText('Your documents')).toBeTruthy();
    expect(screen.getByLabelText('Refresh documents')).toBeTruthy();
  });

  it('opens modal with title and content when a row is pressed', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', title: 'Doc A', content: 'Body text', created_at: '2026-07-11T00:00:00' }]), { status: 200 })
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    expect(screen.getAllByText('Body text').length).toBeGreaterThanOrEqual(1);
    fireEvent.press(screen.getByText('Close'));
  });

  it('given open modal when edit is pressed then fields become editable with save and cancel', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'doc-1',
            title: 'Doc A',
            content: 'Body text',
            tags: ['tax'],
            created_at: '2026-07-11T00:00:00',
            issued_date: '2024-06-01T00:00:00',
            expire_date: null,
          },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    fireEvent.press(screen.getByLabelText('Edit document'));

    expect(screen.getByDisplayValue('Doc A')).toBeTruthy();
    expect(screen.getByDisplayValue('Body text')).toBeTruthy();
    expect(screen.getByDisplayValue('tax')).toBeTruthy();
    expect(screen.getByLabelText('Save document')).toBeTruthy();
    expect(screen.getByLabelText('Cancel edit')).toBeTruthy();
    expect(screen.queryByLabelText('Edit document')).toBeNull();
  });

  it('given edit mode when save is pressed then sends PUT with updated metadata', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'doc-1',
            title: 'Doc A',
            content: 'Body text',
            tags: [],
            created_at: '2026-07-11T00:00:00',
          },
        ]),
        { status: 200 }
      )
    );
    mockApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'doc-1',
          title: 'Doc Updated',
          content: 'New body',
          tags: ['finance'],
          created_at: '2026-07-11T00:00:00',
        }),
        { status: 200 }
      )
    );

    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    fireEvent.press(screen.getByLabelText('Edit document'));
    fireEvent.changeText(screen.getByDisplayValue('Doc A'), 'Doc Updated');
    fireEvent.changeText(screen.getByDisplayValue('Body text'), 'New body');
    fireEvent.changeText(screen.getByPlaceholderText('e.g. work, notes'), 'finance');
    fireEvent.press(screen.getByLabelText('Save document'));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = mockApiFetch.mock.calls[0];
    expect(url).toBe('/documents/json/doc-1');
    expect(options?.method).toBe('PUT');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer tok',
      'Content-Type': 'application/json',
    });
    const body = JSON.parse(String(options?.body));
    expect(body.title).toBe('Doc Updated');
    expect(body.content).toBe('New body');
    expect(body.tags).toEqual(['finance']);
    expect(body.storage).toBeNull();

    await waitFor(() => {
      expect(screen.getByLabelText('Edit document')).toBeTruthy();
    });
    expect(screen.getAllByText('Doc Updated').length).toBeGreaterThanOrEqual(1);
  });

  it('given edit mode when cancel is pressed then reverts to view mode without PUT', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'doc-1',
            title: 'Doc A',
            content: 'Body text',
            tags: [],
            created_at: '2026-07-11T00:00:00',
          },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    fireEvent.press(screen.getByLabelText('Edit document'));
    fireEvent.changeText(screen.getByDisplayValue('Doc A'), 'Changed title');
    fireEvent.press(screen.getByLabelText('Cancel edit'));

    expect(screen.getByLabelText('Edit document')).toBeTruthy();
    expect(screen.queryByDisplayValue('Changed title')).toBeNull();
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('given save failure then keeps edit mode and shows error', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: 'doc-1',
            title: 'Doc A',
            content: 'Body text',
            tags: [],
            created_at: '2026-07-11T00:00:00',
          },
        ]),
        { status: 200 }
      )
    );
    mockApiFetch.mockResolvedValue(new Response('not found', { status: 404 }));

    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    fireEvent.press(screen.getByLabelText('Edit document'));
    fireEvent.press(screen.getByLabelText('Save document'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', expect.stringContaining('404'));
    });
    expect(screen.getByLabelText('Save document')).toBeTruthy();
  });

  it('reloads when refreshKey changes', async () => {
    const { rerender } = renderDocumentList({ refreshKey: 0 });
    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(1);
    });

    rerender(
      <TenantThemeTestProvider theme={defaultResolvedTheme}>
        <DocumentList refreshKey={1} />
      </TenantThemeTestProvider>
    );

    await waitFor(() => {
      expect(mockAuthenticatedFetch).toHaveBeenCalledTimes(2);
    });
  });
});

describe('parseDocumentDto', () => {
  it('defaults tags to an empty array when missing', () => {
    expect(parseDocumentDto({ id: '1', title: 'Alpha', content: 'c1', created_at: '2026-07-11T00:00:00' }).tags).toEqual([]);
  });

  it('maps tags when present', () => {
    expect(
      parseDocumentDto({
        id: '1',
        title: 'Alpha',
        content: 'c1',
        tags: ['tax', '2024'],
        created_at: '2026-07-11T00:00:00',
      }).tags
    ).toEqual(['tax', '2024']);
  });

  it('defaults tags to an empty array when tags is not an array', () => {
    expect(
      parseDocumentDto({
        id: '1',
        title: 'Alpha',
        content: 'c1',
        tags: 'not-an-array',
        created_at: '2026-07-11T00:00:00',
      }).tags
    ).toEqual([]);
  });

  it('maps created_at when present', () => {
    expect(
      parseDocumentDto({
        id: '1',
        title: 'Alpha',
        content: 'c1',
        created_at: '2026-07-11T12:34:56',
      }).created_at
    ).toBe('2026-07-11T12:34:56');
  });

  it('maps nullable issued_date and expire_date', () => {
    const parsed = parseDocumentDto({
      id: '1',
      title: 'Alpha',
      content: 'c1',
      created_at: '2026-07-11T00:00:00',
      issued_date: '2024-06-01T00:00:00',
      expire_date: '2026-06-01T00:00:00',
    });
    expect(parsed.issued_date).toBe('2024-06-01T00:00:00');
    expect(parsed.expire_date).toBe('2026-06-01T00:00:00');
  });

  it('defaults issued_date and expire_date to null when missing', () => {
    const parsed = parseDocumentDto({
      id: '1',
      title: 'Alpha',
      content: 'c1',
      created_at: '2026-07-11T00:00:00',
    });
    expect(parsed.issued_date).toBeNull();
    expect(parsed.expire_date).toBeNull();
  });
});

describe('DocumentList Proton preview and download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuth());
    mockUseProtonConnect.mockReturnValue({
      session: null,
      isSupported: false,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockWebPlatform();
    if (typeof URL !== 'undefined') {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-preview');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    } else {
      // @ts-expect-error test polyfill for node env
      global.URL = {
        createObjectURL: vi.fn(() => 'blob:mock-preview'),
        revokeObjectURL: vi.fn(),
      };
    }
  });

  it('given proton-backed document without session when modal opens then shows connect hint and disables download', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: null,
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([protonDoc]), { status: 200 })
    );

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Proton Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Proton Doc'));

    // Then
    expect(screen.getByTestId('proton-preview-connect-hint')).toBeTruthy();
    expect(
      screen.getByText('Connect Proton Drive above to preview and download this file.')
    ).toBeTruthy();
    const download = screen.getByLabelText('Download document from Proton Drive');
    expect(download).toBeTruthy();
    expect(download.props.accessibilityState?.disabled ?? download.props.disabled).toBeTruthy();
    expect(mockResolveProtonPreview).not.toHaveBeenCalled();
  });

  it('given proton thumbnail when modal opens then shows image preview', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: { email: 'user@proton.me' },
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([protonDoc]), { status: 200 })
    );
    const thumbBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    mockResolveProtonPreview.mockResolvedValue({
      kind: 'image',
      blob: thumbBlob,
      source: 'thumbnail',
      filename: 'scan.png',
      mimeType: 'image/png',
    });

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Proton Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Proton Doc'));

    // Then
    await waitFor(() => {
      expect(mockResolveProtonPreview).toHaveBeenCalledWith(
        'share-1',
        'node-1',
        'image/png',
        'scan.png'
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('proton-preview-image')).toBeTruthy();
    });
  });

  it('given no thumbnail when preview falls back to downloaded image then shows image preview', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: { email: 'user@proton.me' },
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([protonDoc]), { status: 200 })
    );
    const fileBlob = new Blob([new Uint8Array([9, 9, 9])], { type: 'image/png' });
    mockResolveProtonPreview.mockResolvedValue({
      kind: 'image',
      blob: fileBlob,
      source: 'file',
      filename: 'scan.png',
      mimeType: 'image/png',
    });

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Proton Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Proton Doc'));

    // Then
    await waitFor(() => {
      expect(screen.getByTestId('proton-preview-image')).toBeTruthy();
    });
  });

  it('given proton preview loaded when download is pressed then saves the file via Proton', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: { email: 'user@proton.me' },
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([protonDoc]), { status: 200 })
    );
    const fileBlob = new Blob([new Uint8Array([4, 5, 6])], { type: 'image/png' });
    mockResolveProtonPreview.mockResolvedValue({
      kind: 'image',
      blob: fileBlob,
      source: 'file',
      filename: 'scan.png',
      mimeType: 'image/png',
    });
    mockTriggerBrowserDownload.mockResolvedValue(undefined);

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Proton Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Proton Doc'));
    await waitFor(() => {
      expect(screen.getByTestId('proton-preview-image')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Download document from Proton Drive'));

    // Then
    await waitFor(() => {
      expect(mockTriggerBrowserDownload).toHaveBeenCalledWith(fileBlob, 'scan.png');
    });
    expect(mockDownloadProtonFile).not.toHaveBeenCalled();
  });

  it('given thumbnail-only preview when download is pressed then downloads the full file', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: { email: 'user@proton.me' },
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([protonDoc]), { status: 200 })
    );
    const thumbBlob = new Blob([new Uint8Array([1])], { type: 'image/jpeg' });
    const fullBlob = new Blob([new Uint8Array([2, 3])], { type: 'image/png' });
    mockResolveProtonPreview.mockResolvedValue({
      kind: 'image',
      blob: thumbBlob,
      source: 'thumbnail',
      filename: 'scan.png',
      mimeType: 'image/png',
    });
    mockDownloadProtonFile.mockResolvedValue(fullBlob);
    mockTriggerBrowserDownload.mockResolvedValue(undefined);

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Proton Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Proton Doc'));
    await waitFor(() => {
      expect(screen.getByTestId('proton-preview-image')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Download document from Proton Drive'));

    // Then
    await waitFor(() => {
      expect(mockDownloadProtonFile).toHaveBeenCalledWith('share-1', 'node-1', 'image/png');
      expect(mockTriggerBrowserDownload).toHaveBeenCalledWith(fullBlob, 'scan.png');
    });
  });

  it('given document without storage when modal opens then does not show download', async () => {
    // Given
    mockWebPlatform();
    mockUseProtonConnect.mockReturnValue({
      session: { email: 'user@proton.me' },
      isSupported: true,
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnecting: false,
    });
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: '1',
            title: 'Local Doc',
            content: 'Body',
            created_at: '2026-07-11T00:00:00',
          },
        ]),
        { status: 200 }
      )
    );

    // When
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Local Doc')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Local Doc'));

    // Then
    expect(screen.queryByLabelText('Download document from Proton Drive')).toBeNull();
    expect(screen.queryByTestId('proton-preview')).toBeNull();
    expect(mockResolveProtonPreview).not.toHaveBeenCalled();
  });
});
