import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { DocumentStorageRefDto } from '@/lib/api/types';
import { useColorPalette } from '@/lib/tenant/TenantThemeContext';
import type { ProtonPreviewResult } from '@/lib/proton-drive/types';

type DocumentProtonPreviewProps = {
  storage: DocumentStorageRefDto;
  hasSession: boolean;
  protonSupported: boolean;
  preview: ProtonPreviewResult | null;
  loading: boolean;
  error: string | null;
};

function isImageMime(mime: string | null | undefined): boolean {
  return Boolean(mime?.toLowerCase().startsWith('image/'));
}

/**
 * View-mode Proton file preview: thumbnail or downloaded image/PDF, else a file card.
 * Object URLs are created here and revoked when the blob changes or the component unmounts.
 */
export default function DocumentProtonPreview({
  storage,
  hasSession,
  protonSupported,
  preview,
  loading,
  error,
}: DocumentProtonPreviewProps) {
  const palette = useColorPalette();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginBottom: 12,
          gap: 8,
        },
        hint: {
          fontSize: 14,
          color: palette.icon,
        },
        errorText: {
          fontSize: 14,
          color: '#c00',
        },
        previewFrame: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: palette.icon,
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: palette.background,
          minHeight: 120,
          alignItems: 'center',
          justifyContent: 'center',
        },
        previewImage: {
          width: '100%',
          height: 220,
        },
        fileCard: {
          width: '100%',
          padding: 16,
          gap: 4,
        },
        fileName: {
          fontSize: 16,
          fontWeight: '600',
          color: palette.text,
        },
        fileMeta: {
          fontSize: 14,
          color: palette.icon,
        },
      }),
    [palette]
  );

  useEffect(() => {
    if (!preview || (preview.kind !== 'image' && preview.kind !== 'pdf')) {
      setObjectUrl(null);
      return;
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(preview.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [preview]);

  if (!protonSupported || Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>
          Stored in Proton Drive: {storage.filename}
        </Text>
      </View>
    );
  }

  if (!hasSession) {
    return (
      <View style={styles.container} testID="proton-preview-connect-hint">
        <Text style={styles.hint}>
          Connect Proton Drive above to preview and download this file.
        </Text>
        <Text style={styles.hint}>Stored in Proton Drive: {storage.filename}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="proton-preview">
      <Text style={styles.hint}>Stored in Proton Drive: {storage.filename}</Text>
      {loading ? (
        <View style={styles.previewFrame} accessibilityLabel="Loading file preview">
          <ActivityIndicator size="small" color={palette.tint} />
        </View>
      ) : error ? (
        <Text style={styles.errorText} testID="proton-preview-error">
          {error}
        </Text>
      ) : preview?.kind === 'image' && objectUrl ? (
        <View style={styles.previewFrame}>
          <Image
            source={{ uri: objectUrl }}
            style={styles.previewImage}
            resizeMode="contain"
            accessibilityLabel={`Preview of ${storage.filename}`}
            testID="proton-preview-image"
          />
        </View>
      ) : preview?.kind === 'pdf' && objectUrl ? (
        <View style={styles.previewFrame}>
          {/* PDF embed is web-only; React Native Image cannot render PDFs. */}
          {Platform.OS === 'web' ? (
            <iframe
              src={objectUrl}
              title={`Preview of ${storage.filename}`}
              style={{ width: '100%', height: 280, border: 'none' }}
              data-testid="proton-preview-pdf"
            />
          ) : null}
        </View>
      ) : preview?.kind === 'file' || (preview?.kind === 'image' && !objectUrl) ? (
        <View
          style={[styles.previewFrame, styles.fileCard]}
          testID="proton-preview-file-card"
          accessibilityLabel={`File ${storage.filename}`}
        >
          <Text style={styles.fileName} numberOfLines={2}>
            {storage.filename}
          </Text>
          <Text style={styles.fileMeta}>
            {storage.mime_type || preview?.mimeType || 'Unknown type'}
          </Text>
          {!isImageMime(storage.mime_type) ? (
            <Text style={styles.fileMeta}>Use Download to open this file.</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
