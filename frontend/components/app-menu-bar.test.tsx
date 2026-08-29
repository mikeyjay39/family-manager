import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import AppMenuBar from '@/components/app-menu-bar';
import { useAuth } from '@/contexts/AuthContext';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

vi.mock('expo-router', () => ({
  router: {
    replace: vi.fn(),
  },
  usePathname: vi.fn(() => '/'),
}));

const mockUseAuth = vi.mocked(useAuth);

function renderAppMenuBar() {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <AppMenuBar />
    </TenantThemeTestProvider>
  );
}

describe('AppMenuBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      logout: vi.fn().mockResolvedValue(undefined),
      token: 'tok',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      handleUnauthorized: vi.fn(),
    });
  });

  it('renders Home and Log Out menu items', () => {
    renderAppMenuBar();
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Log out')).toBeTruthy();
  });

  it('opens logout confirmation when Log Out is pressed', () => {
    renderAppMenuBar();
    fireEvent.press(screen.getByLabelText('Log out'));
    expect(screen.getByText('Are you sure you want to log out?')).toBeTruthy();
  });

  it('calls logout when logout is confirmed', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      logout,
      token: 'tok',
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      handleUnauthorized: vi.fn(),
    });

    renderAppMenuBar();
    fireEvent.press(screen.getByLabelText('Log out'));
    fireEvent.press(screen.getByLabelText('Log Out'));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
  });
});
