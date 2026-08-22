import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch } from '@/lib/api/client';
import type { DocumentDto } from '@/lib/api/types';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import DocumentGrid from './document-grid';

export function parseDocumentDto(item: unknown): DocumentDto {
  const d = item as Record<string, unknown>;
  const storageRaw = d.storage as Record<string, unknown> | null | undefined;
  const storage =
    storageRaw && typeof storageRaw === 'object'
      ? {
          provider: String(storageRaw.provider ?? ''),
          share_id: String(storageRaw.share_id ?? ''),
          node_id: String(storageRaw.node_id ?? ''),
          filename: String(storageRaw.filename ?? ''),
          mime_type:
            storageRaw.mime_type != null ? String(storageRaw.mime_type) : null,
        }
      : null;

  return {
    id: String(d.id ?? ''),
    title: String(d.title ?? ''),
    content: String(d.content ?? ''),
    tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
    created_at: String(d.created_at ?? ''),
    issued_date: d.issued_date != null ? String(d.issued_date) : null,
    expire_date: d.expire_date != null ? String(d.expire_date) : null,
    storage,
  };
}

type DocumentListProps = {
  refreshKey?: number;
};

export default function DocumentList({ refreshKey = 0 }: DocumentListProps) {
  const { token, handleUnauthorized } = useAuth();
  const palette = useColorPalette();
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DocumentDto | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 8,
          marginTop: 16,
        },
        toolbarRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          flex: 1,
          color: palette.text,
        },
        refreshButton: {
          paddingVertical: 8,
          paddingHorizontal: 12,
        },
        refreshButtonText: {
          fontSize: 14,
        },
        hint: {
          fontSize: 14,
          color: palette.icon,
        },
        errorText: {
          fontSize: 14,
          color: '#c00',
        },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          padding: 24,
        },
        modalCard: {
          backgroundColor: palette.background,
          borderRadius: 12,
          maxHeight: '80%',
          overflow: 'hidden',
        },
        modalScroll: {
          padding: 16,
        },
        modalTitle: {
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 12,
          color: palette.text,
        },
        modalContent: {
          fontSize: 16,
          lineHeight: 22,
          color: palette.text,
        },
        storageHint: {
          fontSize: 14,
          color: palette.icon,
          marginBottom: 12,
        },
        modalClose: {
          borderRadius: 0,
          borderWidth: 0,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.icon,
          padding: 14,
        },
        modalCloseText: {
          color: palette.tint,
        },
      }),
    [palette]
  );

  const load = useCallback(async () => {
    if (!token) {
      setDocuments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch('/documents', {
        method: 'GET',
        token,
        onUnauthorized: handleUnauthorized,
      });
      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(
          bodyText
            ? `Request failed (${response.status}): ${bodyText}`
            : `Request failed with status ${response.status}`
        );
      }
      const data = JSON.parse(bodyText) as unknown;
      if (!Array.isArray(data)) {
        throw new Error('Invalid response: expected a list of documents.');
      }
      const rows: DocumentDto[] = data.map(parseDocumentDto);
      setDocuments(rows);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [token, handleUnauthorized]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <View style={styles.container}>
      <View style={styles.toolbarRow}>
        <Text style={styles.sectionTitle}>Your documents</Text>
        <Button
          variant="secondary"
          label={loading ? 'Loading…' : 'Refresh'}
          onPress={() => void load()}
          disabled={loading || !token}
          accessibilityLabel={loading ? 'Loading documents' : 'Refresh documents'}
          style={styles.refreshButton}
          labelStyle={styles.refreshButtonText}
        />
      </View>

      {!token ? (
        <Text style={styles.hint}>Sign in to see your documents.</Text>
      ) : loading && documents.length === 0 ? (
        <ActivityIndicator size="small" color={palette.tint} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : documents.length === 0 ? (
        <Text style={styles.hint}>No documents yet.</Text>
      ) : (
        <DocumentGrid documents={documents} onRowPress={setSelected} />
      )}

      <Modal
        visible={selected !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalTitle}>{selected?.title ?? ''}</Text>
              {selected?.storage?.provider === 'proton_drive' ? (
                <Text style={styles.storageHint}>
                  Stored in Proton Drive: {selected.storage.filename}
                </Text>
              ) : null}
              <Text style={styles.modalContent}>{selected?.content ?? ''}</Text>
            </ScrollView>
            <Button
              variant="outline"
              label="Close"
              onPress={() => setSelected(null)}
              accessibilityLabel="Close document"
              style={styles.modalClose}
              labelStyle={styles.modalCloseText}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
