import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Platform,
  TextInput,
  Alert,
  TouchableOpacity,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useProtonConnect } from '@/contexts/ProtonConnectContext';
import { apiFetch, authenticatedFetch } from '@/lib/api/client';
import type { DocumentDto, UpdateDocumentCommand } from '@/lib/api/types';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import type { ProtonPreviewResult } from '@/lib/proton-drive/types';
import DocumentGrid, { DOCUMENT_GRID_WIDTH } from './document-grid';
import DocumentProtonPreview from './document-proton-preview';
import {
  formatIsoDateForInput,
  parseOptionalDateInput,
  parseTags,
} from './document-create-form-utils';

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

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) {
    return '—';
  }
  return formatIsoDateForInput(iso);
}

async function assetToFile(asset: DocumentPickerAsset): Promise<File> {
  const filename = asset.name?.trim() || 'upload';
  if (asset.file?.name?.trim()) {
    return asset.file;
  }
  if (asset.file) {
    return new File([asset.file], filename, {
      type: asset.file.type || asset.mimeType || 'application/octet-stream',
    });
  }
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return new File([blob], filename, {
    type: asset.mimeType || blob.type || 'application/octet-stream',
  });
}

type DocumentListProps = {
  refreshKey?: number;
  onDocumentUpdated?: () => void;
};

export default function DocumentList({
  refreshKey = 0,
  onDocumentUpdated,
}: DocumentListProps) {
  const { token, handleUnauthorized } = useAuth();
  const { session: protonSession, isSupported: protonSupported } = useProtonConnect();
  const palette = useColorPalette();
  const isWeb = Platform.OS === 'web';
  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DocumentDto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editIssuedDateInput, setEditIssuedDateInput] = useState('');
  const [editExpireDateInput, setEditExpireDateInput] = useState('');
  const [pickedFile, setPickedFile] = useState<DocumentPickerAsset | null>(null);
  const [protonPreview, setProtonPreview] = useState<ProtonPreviewResult | null>(null);
  const [protonPreviewLoading, setProtonPreviewLoading] = useState(false);
  const [protonPreviewError, setProtonPreviewError] = useState<string | null>(null);
  const [protonDownloading, setProtonDownloading] = useState(false);
  /** Full-file blob when preview already downloaded the file (not a thumbnail-only image). */
  const [cachedFullFileBlob, setCachedFullFileBlob] = useState<Blob | null>(null);

  const isProtonStorage =
    selected?.storage?.provider === 'proton_drive' && Boolean(selected.storage.share_id);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          gap: 8,
          marginTop: 16,
        },
        tableScroll: {
          width: '100%',
        },
        tableScrollContent: {
          flexGrow: 1,
          justifyContent: 'center',
        },
        tableBlock: {
          width: DOCUMENT_GRID_WIDTH,
          gap: 8,
        },
        toolbarRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          zIndex: 1,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: palette.text,
          flexShrink: 1,
          ...(Platform.OS === 'web'
            ? ({
                position: 'sticky',
                left: 0,
                backgroundColor: palette.background,
              } as const)
            : {}),
        },
        refreshButton: {
          paddingVertical: 8,
          paddingHorizontal: 12,
          ...(Platform.OS === 'web'
            ? ({
                position: 'sticky',
                right: 0,
                backgroundColor: palette.background,
              } as const)
            : {}),
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
        metaRow: {
          fontSize: 14,
          color: palette.text,
          marginBottom: 8,
        },
        metaLabel: {
          fontWeight: '600',
        },
        label: {
          fontSize: 16,
          marginBottom: 4,
          color: palette.text,
        },
        input: {
          borderWidth: 1,
          borderColor: palette.icon,
          borderRadius: 8,
          padding: 10,
          marginBottom: 8,
          color: palette.text,
          backgroundColor: palette.background,
        },
        inputMultiline: {
          minHeight: 100,
        },
        fileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 8,
        },
        fileName: {
          fontSize: 14,
          color: palette.text,
          flexShrink: 1,
        },
        modalActions: {
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: palette.icon,
        },
        modalActionButton: {
          flex: 1,
          borderRadius: 0,
          borderWidth: 0,
          padding: 14,
        },
        modalActionDivider: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: palette.icon,
        },
        modalActionText: {
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

  const closeModal = useCallback(() => {
    setSelected(null);
    setIsEditing(false);
    setSaving(false);
    setPickedFile(null);
    setProtonPreview(null);
    setProtonPreviewLoading(false);
    setProtonPreviewError(null);
    setProtonDownloading(false);
    setCachedFullFileBlob(null);
  }, []);

  useEffect(() => {
    if (!selected || isEditing || !isProtonStorage || !selected.storage) {
      return;
    }
    if (!isWeb || !protonSupported) {
      return;
    }
    if (!protonSession) {
      setProtonPreview(null);
      setProtonPreviewError(null);
      setProtonPreviewLoading(false);
      setCachedFullFileBlob(null);
      return;
    }

    let cancelled = false;
    const storage = selected.storage;
    setProtonPreviewLoading(true);
    setProtonPreviewError(null);
    setProtonPreview(null);
    setCachedFullFileBlob(null);

    void (async () => {
      try {
        const proton = await import('@/lib/proton-drive/load-proton.web');
        const result = await proton.resolveProtonPreview(
          storage.share_id,
          storage.node_id,
          storage.mime_type,
          storage.filename
        );
        if (cancelled) {
          return;
        }
        setProtonPreview(result);
        if (result.kind === 'image' && result.source === 'thumbnail') {
          setCachedFullFileBlob(null);
        } else {
          setCachedFullFileBlob(result.blob);
        }
      } catch (err: unknown) {
        if (cancelled) {
          return;
        }
        console.error(err);
        setProtonPreviewError(
          err instanceof Error ? err.message : 'Failed to load Proton Drive preview'
        );
        setProtonPreview(null);
        setCachedFullFileBlob(null);
      } finally {
        if (!cancelled) {
          setProtonPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    selected,
    isEditing,
    isProtonStorage,
    isWeb,
    protonSupported,
    protonSession,
  ]);

  const handleProtonDownload = useCallback(async () => {
    if (!selected?.storage || selected.storage.provider !== 'proton_drive') {
      return;
    }
    if (!protonSession) {
      Alert.alert('Proton Drive', 'Connect Proton Drive before downloading.');
      return;
    }
    setProtonDownloading(true);
    try {
      const proton = await import('@/lib/proton-drive/load-proton.web');
      const storage = selected.storage;
      let blob = cachedFullFileBlob;
      if (!blob) {
        blob = await proton.downloadProtonFile(
          storage.share_id,
          storage.node_id,
          storage.mime_type
        );
        setCachedFullFileBlob(blob);
      }
      await proton.triggerBrowserDownload(blob, storage.filename);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to download file';
      Alert.alert('Error', msg);
    } finally {
      setProtonDownloading(false);
    }
  }, [selected, protonSession, cachedFullFileBlob]);

  const populateEditDrafts = useCallback((doc: DocumentDto) => {
    setEditTitle(doc.title);
    setEditContent(doc.content);
    setEditTagsInput(doc.tags.join(', '));
    setEditIssuedDateInput(formatIsoDateForInput(doc.issued_date));
    setEditExpireDateInput(formatIsoDateForInput(doc.expire_date));
    setPickedFile(null);
  }, []);

  const startEdit = useCallback(() => {
    if (!selected) {
      return;
    }
    populateEditDrafts(selected);
    setIsEditing(true);
  }, [populateEditDrafts, selected]);

  const cancelEdit = useCallback(() => {
    if (selected) {
      populateEditDrafts(selected);
    }
    setIsEditing(false);
    setPickedFile(null);
  }, [populateEditDrafts, selected]);

  /**
   * Saves document edits via one of three API paths:
   *   web + new file + Proton  -> PUT /documents/json/{id} (after Proton upload)
   *   new file (native)        -> PUT /documents/{id} multipart
   *   metadata only            -> PUT /documents/json/{id}
   */
  const handleSave = async () => {
    if (!token || !selected) {
      Alert.alert('Error', 'No authentication token available.');
      return;
    }
    if (!editTitle.trim() || !editContent.trim()) {
      Alert.alert('Error', 'Please enter a title and content.');
      return;
    }
    if (isWeb && pickedFile && !protonSession) {
      Alert.alert('Proton Drive', 'Connect Proton Drive before uploading a file on web.');
      return;
    }

    const tags = parseTags(editTagsInput);
    const issuedDate = parseOptionalDateInput(editIssuedDateInput);
    if (!issuedDate.ok) {
      Alert.alert('Error', 'Issue date must be in YYYY-MM-DD format.');
      return;
    }
    const expireDate = parseOptionalDateInput(editExpireDateInput);
    if (!expireDate.ok) {
      Alert.alert('Error', 'Expire date must be in YYYY-MM-DD format.');
      return;
    }

    setSaving(true);
    try {
      let response: Response;

      if (isWeb && pickedFile && protonSession) {
        const proton = await import('@/lib/proton-drive/load-proton.web');
        const file = await assetToFile(pickedFile);
        const storage = await proton.uploadToLifeManagerFolder(file, undefined, pickedFile.name);
        const payload: UpdateDocumentCommand = {
          title: editTitle.trim(),
          content: editContent.trim(),
          tags,
          issued_date: issuedDate.value,
          expire_date: expireDate.value,
          storage: {
            provider: storage.provider,
            share_id: storage.shareId,
            node_id: storage.nodeId,
            filename: storage.filename,
            mime_type: storage.mimeType,
          },
        };

        response = await apiFetch(`/documents/json/${selected.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          onUnauthorized: handleUnauthorized,
        });
      } else if (pickedFile) {
        const payload: UpdateDocumentCommand = {
          title: editTitle.trim(),
          content: editContent.trim(),
          tags,
          issued_date: issuedDate.value,
          expire_date: expireDate.value,
          storage: null,
        };
        const formData = new FormData();
        formData.append('json', JSON.stringify(payload));
        if (pickedFile.file) {
          formData.append('file', pickedFile.file);
        } else {
          formData.append('file', {
            uri: pickedFile.uri,
            name: pickedFile.name,
            type: pickedFile.mimeType ?? 'application/octet-stream',
          } as any);
        }

        response = await apiFetch(`/documents/${selected.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          onUnauthorized: handleUnauthorized,
        });
      } else {
        const payload: UpdateDocumentCommand = {
          title: editTitle.trim(),
          content: editContent.trim(),
          tags,
          issued_date: issuedDate.value,
          expire_date: expireDate.value,
          storage: null,
        };

        response = await apiFetch(`/documents/json/${selected.id}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          onUnauthorized: handleUnauthorized,
        });
      }

      const bodyText = await response.text();
      if (!response.ok) {
        throw new Error(
          bodyText
            ? `Request failed (${response.status}): ${bodyText}`
            : `Request failed with status ${response.status}`
        );
      }

      const updated = parseDocumentDto(JSON.parse(bodyText) as unknown);
      setDocuments((prev) =>
        prev.map((doc) => (doc.id === updated.id ? updated : doc))
      );
      setSelected(updated);
      setIsEditing(false);
      setPickedFile(null);
      onDocumentUpdated?.();
      Alert.alert('Success', `Updated document "${updated.title}".`);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.length) {
      return;
    }
    setPickedFile(result.assets[0]);
  };

  const toolbar = (
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
  );

  const hasTable = token && !error && documents.length > 0;

  return (
    <View style={styles.container}>
      {hasTable ? (
        <ScrollView
          horizontal
          style={styles.tableScroll}
          contentContainerStyle={styles.tableScrollContent}
          showsHorizontalScrollIndicator
          testID="documents-table-scroll"
        >
          <View style={styles.tableBlock} testID="documents-table-block">
            {toolbar}
            <DocumentGrid documents={documents} onRowPress={setSelected} />
          </View>
        </ScrollView>
      ) : (
        <>
          {toolbar}

          {!token ? (
            <Text style={styles.hint}>Sign in to see your documents.</Text>
          ) : loading && documents.length === 0 ? (
            <ActivityIndicator size="small" color={palette.tint} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <Text style={styles.hint}>No documents yet.</Text>
          )}
        </>
      )}

      <Modal
        visible={selected !== null}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {isEditing ? (
                <>
                  <Text style={styles.modalTitle}>Edit document</Text>

                  <Text style={styles.label}>Title</Text>
                  <TextInput
                    style={styles.input}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Document title"
                    placeholderTextColor={palette.icon}
                  />

                  <Text style={styles.label}>Content</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    value={editContent}
                    onChangeText={setEditContent}
                    placeholder="Document content"
                    placeholderTextColor={palette.icon}
                    multiline
                    textAlignVertical="top"
                  />

                  <Text style={styles.label}>Tags (optional, comma-separated)</Text>
                  <TextInput
                    style={styles.input}
                    value={editTagsInput}
                    onChangeText={setEditTagsInput}
                    placeholder="e.g. work, notes"
                    placeholderTextColor={palette.icon}
                  />

                  <Text style={styles.label}>Issue date (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={editIssuedDateInput}
                    onChangeText={setEditIssuedDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.icon}
                  />

                  <Text style={styles.label}>Expire date (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={editExpireDateInput}
                    onChangeText={setEditExpireDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={palette.icon}
                  />

                  <Text style={styles.label}>File (optional)</Text>
                  {isWeb && protonSupported && !protonSession ? (
                    <Text style={styles.hint}>
                      Connect Proton Drive above to replace files on web.
                    </Text>
                  ) : null}
                  <View style={styles.fileRow}>
                    <Button
                      variant="secondary"
                      label="Choose file"
                      onPress={() => void pickFile()}
                      disabled={saving}
                      accessibilityLabel="Choose file"
                    />
                    {pickedFile ? (
                      <>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {pickedFile.name}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setPickedFile(null)}
                          accessibilityLabel="Clear selected file"
                        >
                          <Text style={styles.hint}>Clear</Text>
                        </TouchableOpacity>
                      </>
                    ) : selected?.storage?.provider === 'proton_drive' ? (
                      <Text style={styles.hint}>
                        Current: {selected.storage.filename}
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.modalTitle}>{selected?.title ?? ''}</Text>
                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Created: </Text>
                    {formatDisplayDate(selected?.created_at)}
                  </Text>
                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Tags: </Text>
                    {selected?.tags.length ? selected.tags.join(', ') : '—'}
                  </Text>
                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Issued: </Text>
                    {formatDisplayDate(selected?.issued_date)}
                  </Text>
                  <Text style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Expires: </Text>
                    {formatDisplayDate(selected?.expire_date)}
                  </Text>
                  {selected?.storage?.provider === 'proton_drive' ? (
                    <DocumentProtonPreview
                      storage={selected.storage}
                      hasSession={Boolean(protonSession)}
                      protonSupported={protonSupported}
                      preview={protonPreview}
                      loading={protonPreviewLoading}
                      error={protonPreviewError}
                    />
                  ) : null}
                  <Text style={styles.modalContent}>{selected?.content ?? ''}</Text>
                </>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    label={saving ? 'Saving…' : 'Save'}
                    onPress={() => void handleSave()}
                    disabled={saving}
                    accessibilityLabel="Save document"
                    style={styles.modalActionButton}
                    labelStyle={styles.modalActionText}
                  />
                  <View style={styles.modalActionDivider} />
                  <Button
                    variant="outline"
                    label="Cancel"
                    onPress={cancelEdit}
                    disabled={saving}
                    accessibilityLabel="Cancel edit"
                    style={styles.modalActionButton}
                    labelStyle={styles.modalActionText}
                  />
                </>
              ) : (
                <>
                  {isProtonStorage && isWeb && protonSupported ? (
                    <>
                      <Button
                        variant="outline"
                        label={protonDownloading ? 'Downloading…' : 'Download'}
                        onPress={() => void handleProtonDownload()}
                        disabled={
                          protonDownloading ||
                          !protonSession ||
                          protonPreviewLoading
                        }
                        accessibilityLabel="Download document from Proton Drive"
                        style={styles.modalActionButton}
                        labelStyle={styles.modalActionText}
                      />
                      <View style={styles.modalActionDivider} />
                    </>
                  ) : null}
                  <Button
                    variant="outline"
                    label="Edit"
                    onPress={startEdit}
                    accessibilityLabel="Edit document"
                    style={styles.modalActionButton}
                    labelStyle={styles.modalActionText}
                  />
                  <View style={styles.modalActionDivider} />
                  <Button
                    variant="outline"
                    label="Close"
                    onPress={closeModal}
                    accessibilityLabel="Close document"
                    style={styles.modalActionButton}
                    labelStyle={styles.modalActionText}
                  />
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
