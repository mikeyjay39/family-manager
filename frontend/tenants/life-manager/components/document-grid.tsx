import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { DocumentDto } from '@/lib/api/types';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import { withAlpha } from '@/lib/tenant/theme/color-utils';
import { formatDocumentCellValue } from './document-grid-utils';

export type DocumentGridProps = {
  documents: DocumentDto[];
  onRowPress: (doc: DocumentDto) => void;
};

const columnHelper = createColumnHelper<DocumentDto>();

const DOCUMENT_COLUMNS = [
  columnHelper.accessor('title', {
    header: 'Title',
    size: 160,
    cell: (info) => formatDocumentCellValue(info.row.original, 'title'),
  }),
  columnHelper.accessor('content', {
    header: 'Content',
    size: 240,
    cell: (info) => formatDocumentCellValue(info.row.original, 'content'),
  }),
  columnHelper.accessor('tags', {
    header: 'Tags',
    size: 180,
    cell: (info) => formatDocumentCellValue(info.row.original, 'tags'),
  }),
  columnHelper.accessor('created_at', {
    header: 'Created',
    size: 110,
    cell: (info) => formatDocumentCellValue(info.row.original, 'created_at'),
  }),
  columnHelper.accessor('issued_date', {
    header: 'Issued',
    size: 110,
    cell: (info) => formatDocumentCellValue(info.row.original, 'issued_date'),
  }),
  columnHelper.accessor('expire_date', {
    header: 'Expires',
    size: 110,
    cell: (info) => formatDocumentCellValue(info.row.original, 'expire_date'),
  }),
];

export default function DocumentGrid({ documents, onRowPress }: DocumentGridProps) {
  const palette = useColorPalette();

  const columns = useMemo(() => DOCUMENT_COLUMNS, []);

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        gridScroll: {
          marginTop: 4,
        },
        grid: {
          borderWidth: 1,
          borderColor: palette.icon,
          borderRadius: 4,
          overflow: 'hidden',
        },
        headerRow: {
          flexDirection: 'row',
          backgroundColor: withAlpha(palette.tint, 0.15),
        },
        dataRow: {
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.icon,
        },
        dataRowAlt: {
          backgroundColor: withAlpha(palette.icon, 0.06),
        },
        headerCell: {
          paddingVertical: 10,
          paddingHorizontal: 10,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: palette.icon,
          flexShrink: 0,
        },
        headerCellText: {
          fontSize: 13,
          fontWeight: '700',
          color: palette.text,
        },
        cell: {
          paddingVertical: 10,
          paddingHorizontal: 10,
          borderRightWidth: StyleSheet.hairlineWidth,
          borderRightColor: palette.icon,
          flexShrink: 0,
        },
        cellText: {
          fontSize: 14,
          color: palette.text,
        },
      }),
    [palette]
  );

  return (
    <ScrollView horizontal style={styles.gridScroll} showsHorizontalScrollIndicator>
      <View style={styles.grid}>
        {table.getHeaderGroups().map((headerGroup) => (
          <View key={headerGroup.id} style={styles.headerRow}>
            {headerGroup.headers.map((header) => (
              <View
                key={header.id}
                style={[styles.headerCell, { width: header.getSize() }]}
              >
                <Text style={styles.headerCellText}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </Text>
              </View>
            ))}
          </View>
        ))}
        {table.getRowModel().rows.map((row, rowIndex) => (
          <TouchableOpacity
            key={row.id}
            style={[styles.dataRow, rowIndex % 2 === 1 && styles.dataRowAlt]}
            onPress={() => onRowPress(row.original)}
            accessibilityRole="button"
            accessibilityLabel={`Open document ${row.original.title || '(Untitled)'}`}
          >
            {row.getVisibleCells().map((cell) => (
              <View
                key={cell.id}
                style={[styles.cell, { width: cell.column.getSize() }]}
              >
                <Text style={styles.cellText} numberOfLines={1} ellipsizeMode="tail">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </Text>
              </View>
            ))}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}
