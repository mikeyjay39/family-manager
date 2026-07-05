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

const mockUseAuth = vi.mocked(useAuth);
const mockAuthenticatedFetch = vi.mocked(authenticatedFetch);

function renderDocumentList() {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <DocumentList />
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

  it('loads and lists document titles', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: '1', title: 'Alpha', content: 'c1' },
          { id: '2', title: 'Beta', content: 'c2' },
        ]),
        { status: 200 }
      )
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeTruthy();
    });
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      '/documents',
      expect.objectContaining({ method: 'GET', token: 'tok' })
    );
  });

  it('shows error when fetch fails', async () => {
    mockAuthenticatedFetch.mockResolvedValue(new Response('oops', { status: 500 }));
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText(/500/)).toBeTruthy();
    });
  });

  it('shows empty state when array is empty', async () => {
    mockAuthenticatedFetch.mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('No documents yet.')).toBeTruthy();
    });
  });

  it('opens modal with title and content when a row is pressed', async () => {
    mockAuthenticatedFetch.mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', title: 'Doc A', content: 'Body text' }]), { status: 200 })
    );
    renderDocumentList();
    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText('Open document Doc A'));
    expect(screen.getByText('Body text')).toBeTruthy();
    fireEvent.press(screen.getByText('Close'));
  });
});

describe('parseDocumentDto', () => {
  it('defaults tags to an empty array when missing', () => {
    expect(parseDocumentDto({ id: '1', title: 'Alpha', content: 'c1' }).tags).toEqual([]);
  });

  it('maps tags when present', () => {
    expect(
      parseDocumentDto({ id: '1', title: 'Alpha', content: 'c1', tags: ['tax', '2024'] }).tags
    ).toEqual(['tax', '2024']);
  });

  it('defaults tags to an empty array when tags is not an array', () => {
    expect(
      parseDocumentDto({ id: '1', title: 'Alpha', content: 'c1', tags: 'not-an-array' }).tags
    ).toEqual([]);
  });
});
