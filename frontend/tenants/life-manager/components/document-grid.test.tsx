import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import DocumentGrid from './document-grid';
import { TenantThemeTestProvider } from '@/lib/tenant/TenantThemeContext';
import { defaultResolvedTheme } from '@/lib/tenant/theme/defaults';
import type { DocumentDto } from '@/lib/api/types';

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{`icon:${name}`}</Text>;
  },
}));

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

function getRowTitles(): string[] {
  return screen
    .getAllByRole('button')
    .map((node) => node.props.accessibilityLabel as string | undefined)
    .filter((label): label is string => Boolean(label?.startsWith('Open document ')))
    .map((label) => label.replace('Open document ', ''));
}

const shortRow: DocumentDto = {
  id: '1',
  title: 'Short',
  content: 'Hi',
  tags: [],
  created_at: '2026-07-11T00:00:00',
  issued_date: null,
  expire_date: null,
  storage: null,
};

const longRow: DocumentDto = {
  id: '2',
  title: 'Long title example',
  content: 'This is a very long content value that would previously stretch column widths',
  tags: ['tax', 'accounting', '2024', 'rental'],
  created_at: '2026-06-01T00:00:00',
  issued_date: '2024-01-15T00:00:00',
  expire_date: '2027-01-15T00:00:00',
  storage: null,
};

const alphaRow: DocumentDto = {
  id: '3',
  title: 'Alpha',
  content: 'A',
  tags: ['alpha'],
  created_at: '2026-01-01T00:00:00',
  issued_date: null,
  expire_date: null,
  storage: null,
};

const betaRow: DocumentDto = {
  id: '4',
  title: 'Beta',
  content: 'B',
  tags: ['zebra'],
  created_at: '2026-12-01T00:00:00',
  issued_date: null,
  expire_date: null,
  storage: null,
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

  it('sorts by title ascending on first header click', () => {
    renderDocumentGrid([betaRow, alphaRow, shortRow]);

    fireEvent.press(screen.getByLabelText('Sort by Title'));

    expect(getRowTitles()).toEqual(['Alpha', 'Beta', 'Short']);
    expect(screen.getByLabelText('Sort by Title, ascending')).toBeTruthy();
    expect(screen.getByText('icon:arrow.up')).toBeTruthy();
  });

  it('sorts by title descending on second header click', () => {
    renderDocumentGrid([betaRow, alphaRow, shortRow]);

    fireEvent.press(screen.getByLabelText('Sort by Title'));
    fireEvent.press(screen.getByLabelText('Sort by Title, ascending'));

    expect(getRowTitles()).toEqual(['Short', 'Beta', 'Alpha']);
    expect(screen.getByLabelText('Sort by Title, descending')).toBeTruthy();
    expect(screen.getByText('icon:arrow.down')).toBeTruthy();
  });

  it('switches to ascending sort when a different column header is clicked', () => {
    renderDocumentGrid([betaRow, alphaRow]);

    fireEvent.press(screen.getByLabelText('Sort by Title'));
    fireEvent.press(screen.getByLabelText('Sort by Title, ascending'));
    fireEvent.press(screen.getByLabelText('Sort by Tags'));

    expect(getRowTitles()).toEqual(['Alpha', 'Beta']);
    expect(screen.getByLabelText('Sort by Tags, ascending')).toBeTruthy();
    expect(screen.queryByLabelText('Sort by Title, descending')).toBeNull();
  });
});
