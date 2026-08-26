import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DocumentList, { parseDocumentDto } from './document-list';
import { useAuth } from '@/contexts/AuthContext';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { apiFetch, authenticatedFetch } from '@/lib/api/client';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

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

const mockUseAuth = vi.mocked(useAuth);
const mockUseProtonConnect = vi.mocked(useProtonConnect);
const mockAuthenticatedFetch = vi.mocked(authenticatedFetch);
const mockApiFetch = vi.mocked(apiFetch);

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
