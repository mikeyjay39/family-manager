import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { Button } from '@/components/ui/button';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';

function renderButton(props: Partial<React.ComponentProps<typeof Button>> = {}) {
  const onPress = vi.fn();
  render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <Button label="Save" onPress={onPress} accessibilityLabel="Save button" {...props} />
    </TenantThemeTestProvider>
  );
  return { onPress };
}

describe('Button', () => {
  it('given primary button when pressed then calls onPress', () => {
    const { onPress } = renderButton();
    fireEvent.press(screen.getByLabelText('Save button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('given disabled button when rendered then exposes disabled accessibility state', () => {
    renderButton({ disabled: true });
    expect(screen.getByLabelText('Save button')).toBeDisabled();
  });

  it('given loading button when rendered then hides label and marks busy/disabled', () => {
    renderButton({ loading: true });
    expect(screen.queryByText('Save')).toBeNull();
    const button = screen.getByLabelText('Save button');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });

  it('given secondary variant when rendered then shows label', () => {
    renderButton({ variant: 'secondary', label: 'Refresh' });
    expect(screen.getByText('Refresh')).toBeTruthy();
  });

  it('given destructive variant when rendered then shows label', () => {
    renderButton({ variant: 'destructive', label: 'Delete' });
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('given outline variant when rendered then shows label', () => {
    renderButton({ variant: 'outline', label: 'Cancel' });
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
