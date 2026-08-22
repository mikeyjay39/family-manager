import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import DocumentList, { parseDocumentDto } from './document-list';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/client';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    authenticatedFetch: vi.fn(),
  };
});

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockAuthenticatedFetch = vi.mocked(authenticatedFetch);

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
    mockAuthenticatedFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
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
    expect(screen.getAllByText('Body text').length).toBeGreaterThanOrEqual(2);
    fireEvent.press(screen.getByText('Close'));
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
