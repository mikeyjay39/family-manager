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

function getSubmittedPayloadJson(): Record<string, unknown> {
  const call = mockApiFetch.mock.calls[0];
  const body = call[1]?.body;
  if (!(body instanceof FormData)) {
    throw new Error('Expected FormData body');
  }
  const jsonPart = body.get('json');
  if (typeof jsonPart !== 'string') {
    throw new Error('Expected json string in FormData');
  }
  return JSON.parse(jsonPart) as Record<string, unknown>;
}

function fillRequiredFields() {
  fireEvent.changeText(screen.getByPlaceholderText('Document title'), 'Hello');
  fireEvent.changeText(screen.getByPlaceholderText('Document content'), 'World');
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
    fillRequiredFields();
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });
    expect(onDocumentCreated).not.toHaveBeenCalled();
  });

  it('submits null dates when issue and expire fields are empty', async () => {
    renderDocumentCreateForm();
    fillRequiredFields();
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });
    const payload = getSubmittedPayloadJson();
    expect(payload.issued_date).toBeNull();
    expect(payload.expire_date).toBeNull();
  });

  it('submits parsed issue and expire dates in API format', async () => {
    renderDocumentCreateForm();
    fillRequiredFields();
    const dateInputs = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(dateInputs[0], '2024-06-01');
    fireEvent.changeText(dateInputs[1], '2026-12-31');
    fireEvent.press(screen.getByText('Create document'));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled();
    });
    const payload = getSubmittedPayloadJson();
    expect(payload.issued_date).toBe('2024-06-01T00:00:00');
    expect(payload.expire_date).toBe('2026-12-31T00:00:00');
  });

  it('shows validation alert for invalid issue date and does not submit', () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    renderDocumentCreateForm();
    fillRequiredFields();
    const dateInputs = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(dateInputs[0], 'not-a-date');
    fireEvent.press(screen.getByText('Create document'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Issue date must be in YYYY-MM-DD format.');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });

  it('shows validation alert for invalid expire date and does not submit', () => {
    const alertSpy = vi.spyOn(Alert, 'alert');
    renderDocumentCreateForm();
    fillRequiredFields();
    const dateInputs = screen.getAllByPlaceholderText('YYYY-MM-DD');
    fireEvent.changeText(dateInputs[1], '2024-02-30');
    fireEvent.press(screen.getByText('Create document'));
    expect(alertSpy).toHaveBeenCalledWith('Error', 'Expire date must be in YYYY-MM-DD format.');
    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});
