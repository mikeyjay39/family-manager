import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingFn,
  type SortingState,
} from '@tanstack/react-table';
import type { DocumentDto } from '@/lib/api/types';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import { withAlpha } from '@/lib/tenant/theme/color-utils';
import { createDocumentSortingFns, formatDocumentCellValue } from './document-grid-utils';

export type DocumentGridProps = {
  documents: DocumentDto[];
  onRowPress: (doc: DocumentDto) => void;
};

const columnHelper = createColumnHelper<DocumentDto>();

function buildColumns(sortingFns: Record<string, SortingFn<DocumentDto>>) {
  return [
    columnHelper.accessor('title', {
      header: 'Title',
      size: 160,
      sortingFn: sortingFns.title,
      cell: (info) => formatDocumentCellValue(info.row.original, 'title'),
    }),
    columnHelper.accessor('content', {
      header: 'Content',
      size: 240,
      sortingFn: sortingFns.content,
      cell: (info) => formatDocumentCellValue(info.row.original, 'content'),
    }),
    columnHelper.accessor('tags', {
      header: 'Tags',
      size: 180,
      sortingFn: sortingFns.tags,
      cell: (info) => formatDocumentCellValue(info.row.original, 'tags'),
    }),
    columnHelper.accessor('created_at', {
      header: 'Created',
      size: 110,
      sortingFn: sortingFns.created_at,
      cell: (info) => formatDocumentCellValue(info.row.original, 'created_at'),
    }),
    columnHelper.accessor('issued_date', {
      header: 'Issued',
      size: 110,
      sortingFn: sortingFns.issued_date,
      cell: (info) => formatDocumentCellValue(info.row.original, 'issued_date'),
    }),
    columnHelper.accessor('expire_date', {
      header: 'Expires',
      size: 110,
      sortingFn: sortingFns.expire_date,
      cell: (info) => formatDocumentCellValue(info.row.original, 'expire_date'),
    }),
    columnHelper.accessor('storage', {
      header: 'File',
      size: 160,
      sortingFn: sortingFns.storage,
      cell: (info) => formatDocumentCellValue(info.row.original, 'storage'),
    }),
  ];
}

function sortAccessibilityLabel(headerLabel: string, sortDirection: false | 'asc' | 'desc'): string {
  if (sortDirection === 'asc') {
    return `Sort by ${headerLabel}, ascending`;
  }
  if (sortDirection === 'desc') {
    return `Sort by ${headerLabel}, descending`;
  }
  return `Sort by ${headerLabel}`;
}

export default function DocumentGrid({ documents, onRowPress }: DocumentGridProps) {
  const palette = useColorPalette();
  const [sorting, setSorting] = useState<SortingState>([]);
  const sortingRef = useRef(sorting);
  sortingRef.current = sorting;

  const sortingFns = useMemo(
    () => createDocumentSortingFns(() => sortingRef.current),
    []
  );

  const columns = useMemo(() => buildColumns(sortingFns), [sortingFns]);

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableSortingRemoval: false,
    sortDescFirst: false,
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
        headerCellContent: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        headerCellText: {
          fontSize: 13,
          fontWeight: '700',
          color: palette.text,
          flexShrink: 1,
        },
        sortIcon: {
          flexShrink: 0,
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
            {headerGroup.headers.map((header) => {
              const headerLabel =
                typeof header.column.columnDef.header === 'string'
                  ? header.column.columnDef.header
                  : header.column.id;
              const sortDirection = header.column.getIsSorted();

              return (
                <Pressable
                  key={header.id}
                  style={[styles.headerCell, { width: header.getSize() }]}
                  onPress={() => header.column.toggleSorting()}
                  accessibilityRole="button"
                  accessibilityLabel={sortAccessibilityLabel(headerLabel, sortDirection)}
                >
                  <View style={styles.headerCellContent}>
                    <Text style={styles.headerCellText}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </Text>
                    {sortDirection === 'asc' ? (
                      <IconSymbol
                        name="arrow.up"
                        size={14}
                        color={palette.tint}
                        style={styles.sortIcon}
                      />
                    ) : null}
                    {sortDirection === 'desc' ? (
                      <IconSymbol
                        name="arrow.down"
                        size={14}
                        color={palette.tint}
                        style={styles.sortIcon}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
        {table.getSortedRowModel().rows.map((row, rowIndex) => (
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
