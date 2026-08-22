import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DocumentCreateForm from './document-create-form';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api/client';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

vi.mock('@/contexts/ProtonConnectContext', () => ({
  useProtonConnect: vi.fn(() => ({
    isSupported: false,
    session: null,
    isConnecting: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

const mockUseAuth = vi.mocked(useAuth);
const mockApiFetch = vi.mocked(apiFetch);

function renderDocumentCreateForm(props: { onDocumentCreated?: () => void } = {}) {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <DocumentCreateForm {...props} />
    </TenantThemeTestProvider>
  );
}

function defaultAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  return {
    token: 'test-token',
    handleUnauthorized: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

describe('DocumentCreateForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(defaultAuth());
    mockApiFetch.mockResolvedValue(
      new Response(JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000', title: 'My Title' }), {
        status: 201,
      })
    );
  });

  it('shows error alert when there is no token', () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    mockUseAuth.mockReturnValue(defaultAuth({ token: null, isAuthenticated: false }));
    renderDocumentCreateForm();
    fireEvent.press(screen.getByText('Create document'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'No authentication token available.');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('shows validation alert when title or content is missing', () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    renderDocumentCreateForm();
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'body');
    fireEvent.press(screen.getByText('Create document'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter a title and content.');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('submits document with POST and bearer token when valid', async () => {
    renderDocumentCreateForm();
    fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });
    const call = mockApiFetch.mock.calls[0];
    expect(call[0]).toBe('/documents');
    expect(call[1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer test-token' },
    });
  });

  it('shows error alert when response is not ok', async () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    mockApiFetch.mockResolvedValue(new Response('bad', { status: 400 }));
    renderDocumentCreateForm();
    fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', expect.stringContaining('400'));
    });
  });

  it('shows success alert with id when response contains id', async () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    renderDocumentCreateForm();
    fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Success',
        expect.stringContaining('550e8400-e29b-41d4-a716-446655440000')
      );
    });
  });

  it('calls onDocumentCreated once when create succeeds', async () => {
    const onDocumentCreated = vi.fn();
    renderDocumentCreateForm({ onDocumentCreated });
    fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(onDocumentCreated).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call onDocumentCreated on validation error', () => {
    const onDocumentCreated = vi.fn();
    const alertSpy = vi.spyOn(Alert, 'alert');
    renderDocumentCreateForm({ onDocumentCreated });
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'body');
    fireEvent.press(screen.getByText('Create document'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Please enter a title and content.');
    expect(onDocumentCreated).not.toHaveBeenCalled();
  });

  it('does not call onDocumentCreated when API returns error', async () => {
    const onDocumentCreated = vi.fn();
    mockApiFetch.mockResolvedValue(new Response('bad', { status: 400 }));
    renderDocumentCreateForm({ onDocumentCreated });
    fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
    fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });
    expect(onDocumentCreated).not.toHaveBeenCalled();
  });
});
