import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import ProtonConnectPanel from './proton-connect-panel';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

vi.mock('@/contexts/ProtonConnectContext', () => ({
  useProtonConnect: vi.fn(),
}));

const mockUseProtonConnect = vi.mocked(useProtonConnect);

function renderProtonConnectPanel() {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <ProtonConnectPanel />
    </TenantThemeTestProvider>
  );
}

function defaultProtonConnect(
  overrides: Partial<ReturnType<typeof useProtonConnect>> = {}
) {
  return {
    isSupported: true,
    session: null,
    isConnecting: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProtonConnectPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProtonConnect.mockReturnValue(defaultProtonConnect());
  });

  it('shows only Connect Proton Drive when collapsed by default', () => {
    renderProtonConnectPanel();

    expect(screen.getByLabelText('Connect Proton Drive')).toBeTruthy();
    expect(screen.queryByText('Proton email')).toBeNull();
    expect(screen.queryByLabelText('Login to Proton Drive')).toBeNull();
    expect(screen.queryByLabelText('Cancel Proton Drive login')).toBeNull();
  });

  it('expands the login form when Connect Proton Drive is pressed', () => {
    renderProtonConnectPanel();

    fireEvent.press(screen.getByLabelText('Connect Proton Drive'));

    expect(screen.getByText('Proton email')).toBeTruthy();
    expect(screen.getByLabelText('Login to Proton Drive')).toBeTruthy();
    expect(screen.getByLabelText('Cancel Proton Drive login')).toBeTruthy();
  });

  it('collapses the form when Cancel is pressed', () => {
    renderProtonConnectPanel();

    fireEvent.press(screen.getByLabelText('Connect Proton Drive'));
    fireEvent.press(screen.getByLabelText('Cancel Proton Drive login'));

    expect(screen.getByLabelText('Connect Proton Drive')).toBeTruthy();
    expect(screen.queryByText('Proton email')).toBeNull();
    expect(screen.queryByLabelText('Login to Proton Drive')).toBeNull();
  });

  it('calls connect with credentials when Login is pressed', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    mockUseProtonConnect.mockReturnValue(defaultProtonConnect({ connect }));

    renderProtonConnectPanel();
    fireEvent.press(screen.getByLabelText('Connect Proton Drive'));

    fireEvent.changeText(screen.getByPlaceholderText('you@proton.me'), 'user@proton.me');
    fireEvent.changeText(screen.getByPlaceholderText('Proton login password'), 'secret');
    fireEvent.changeText(
      screen.getByPlaceholderText('Leave blank if same as login password'),
      'mailbox-secret'
    );
    fireEvent.changeText(screen.getByPlaceholderText('Optional TOTP'), '123456');
    fireEvent.press(screen.getByLabelText('Login to Proton Drive'));

    await waitFor(() => {
      expect(connect).toHaveBeenCalledWith({
        email: 'user@proton.me',
        password: 'secret',
        mailboxPassword: 'mailbox-secret',
        totp: '123456',
      });
    });
  });
});
