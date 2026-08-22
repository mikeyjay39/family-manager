import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { SignupForm } from '@/components/auth/signup-form';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

function renderSignupForm(onSubmit = vi.fn().mockResolvedValue({ success: true })) {
  return {
    onSubmit,
    ...render(
      <TenantThemeTestProvider theme={defaultResolvedTheme}>
        <SignupForm onSubmit={onSubmit} />
      </TenantThemeTestProvider>
    ),
  };
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows required errors when submitting an empty form', () => {
    const { onSubmit } = renderSignupForm();

    fireEvent.press(screen.getByLabelText('Create account button'));

    expect(screen.getByText('Email is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();
    expect(screen.getByText('Confirm your password.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows password mismatch error', () => {
    const { onSubmit } = renderSignupForm();

    fireEvent.changeText(screen.getByLabelText('Email input'), 'user@example.com');
    fireEvent.changeText(screen.getByLabelText('Password input'), 'password123');
    fireEvent.changeText(screen.getByLabelText('Confirm password input'), 'different');
    fireEvent.press(screen.getByLabelText('Create account button'));

    expect(screen.getByText('Passwords do not match.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed email and password when valid', async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    renderSignupForm(onSubmit);

    fireEvent.changeText(screen.getByLabelText('Email input'), ' user@example.com ');
    fireEvent.changeText(screen.getByLabelText('Password input'), 'password123');
    fireEvent.changeText(screen.getByLabelText('Confirm password input'), 'password123');
    fireEvent.press(screen.getByLabelText('Create account button'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('user@example.com', 'password123');
    });
  });

  it('shows inline error when signup is rejected', async () => {
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: 'An account with this email already exists.',
    });
    renderSignupForm(onSubmit);

    fireEvent.changeText(screen.getByLabelText('Email input'), 'user@example.com');
    fireEvent.changeText(screen.getByLabelText('Password input'), 'password123');
    fireEvent.changeText(screen.getByLabelText('Confirm password input'), 'password123');
    fireEvent.press(screen.getByLabelText('Create account button'));

    await waitFor(() => {
      expect(screen.getByText('An account with this email already exists.')).toBeTruthy();
    });
  });
});
