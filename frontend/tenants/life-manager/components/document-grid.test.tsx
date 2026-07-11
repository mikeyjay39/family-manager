import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import DocumentGrid from './document-grid';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';
import type { DocumentDto } from '@/lib/api/types';

function renderDocumentGrid(
  documents: DocumentDto[],
  onRowPress: (doc: DocumentDto) => void = vi.fn()
) {
  return render(
    <TenantThemeTestProvider theme={defaultResolvedTheme}>
      <DocumentGrid documents={documents} onRowPress={onRowPress} />
    </TenantThemeTestProvider>
  );
}

const shortRow: DocumentDto = {
  id: '1',
  title: 'Short',
  content: 'Hi',
  tags: [],
  created_at: '2026-07-11T00:00:00',
  issued_date: null,
  expire_date: null,
};

const longRow: DocumentDto = {
  id: '2',
  title: 'Long title example',
  content: 'This is a very long content value that would previously stretch column widths',
  tags: ['tax', 'accounting', '2024', 'rental'],
  created_at: '2026-06-01T00:00:00',
  issued_date: '2024-01-15T00:00:00',
  expire_date: '2027-01-15T00:00:00',
};

describe('DocumentGrid', () => {
  it('renders all column headers for rows with mixed content lengths', () => {
    renderDocumentGrid([shortRow, longRow]);

    expect(screen.getByText('Title')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByText('Created')).toBeTruthy();
    expect(screen.getByText('Issued')).toBeTruthy();
    expect(screen.getByText('Expires')).toBeTruthy();
    expect(screen.getByText('Short')).toBeTruthy();
    expect(screen.getByText('Long title example')).toBeTruthy();
  });

  it('calls onRowPress when a row is pressed', () => {
    const onRowPress = vi.fn();
    renderDocumentGrid([shortRow], onRowPress);

    fireEvent.press(screen.getByLabelText('Open document Short'));
    expect(onRowPress).toHaveBeenCalledWith(shortRow);
  });
});
