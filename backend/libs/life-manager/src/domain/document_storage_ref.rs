use backend_utils::AppError;
use serde::{Deserialize, Serialize};

pub const STORAGE_PROVIDER_PROTON_DRIVE: &str = "proton_drive";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DocumentStorageRef {
    pub provider: String,
    pub share_id: String,
    pub node_id: String,
    pub filename: String,
    pub mime_type: Option<String>,
}

impl DocumentStorageRef {
    pub fn new(
        provider: String,
        share_id: String,
        node_id: String,
        filename: String,
        mime_type: Option<String>,
    ) -> Result<Self, AppError> {
        let storage = Self {
            provider,
            share_id,
            node_id,
            filename,
            mime_type,
        };

        if !storage.is_valid_proton_drive() {
            return Err(AppError::Validation(
                "storage must be a valid proton_drive reference with share_id, node_id, and filename".to_string(),
            ));
        }
        if storage.provider != STORAGE_PROVIDER_PROTON_DRIVE {
            return Err(AppError::Validation(
                "Only proton_drive storage is supported".to_string(),
            ));
        }
        Ok(storage)
    }

    pub fn proton_drive(
        share_id: String,
        node_id: String,
        filename: String,
        mime_type: Option<String>,
    ) -> Self {
        Self {
            provider: STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
            share_id,
            node_id,
            filename,
            mime_type,
        }
    }

    pub fn is_valid_proton_drive(&self) -> bool {
        self.provider == STORAGE_PROVIDER_PROTON_DRIVE
            && !self.share_id.trim().is_empty()
            && !self.node_id.trim().is_empty()
            && !self.filename.trim().is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_proton_fields() -> (String, String, String, Option<String>) {
        (
            "share-123".to_string(),
            "node-456".to_string(),
            "scan.pdf".to_string(),
            Some("application/pdf".to_string()),
        )
    }

    #[test]
    fn proton_drive_sets_provider_and_fields() {
        let (share_id, node_id, filename, mime_type) = valid_proton_fields();
        let storage = DocumentStorageRef::proton_drive(
            share_id.clone(),
            node_id.clone(),
            filename.clone(),
            mime_type.clone(),
        );

        assert_eq!(storage.provider, STORAGE_PROVIDER_PROTON_DRIVE);
        assert_eq!(storage.share_id, share_id);
        assert_eq!(storage.node_id, node_id);
        assert_eq!(storage.filename, filename);
        assert_eq!(storage.mime_type, mime_type);
    }

    #[test]
    fn given_valid_proton_drive_ref_when_checking_validity_then_returns_true() {
        let (share_id, node_id, filename, mime_type) = valid_proton_fields();
        let storage =
            DocumentStorageRef::proton_drive(share_id, node_id, filename, mime_type);

        assert!(storage.is_valid_proton_drive());
    }

    #[test]
    fn given_wrong_provider_when_checking_validity_then_returns_false() {
        let storage = DocumentStorageRef {
            provider: "s3".to_string(),
            share_id: "share".to_string(),
            node_id: "node".to_string(),
            filename: "file.pdf".to_string(),
            mime_type: None,
        };

        assert!(!storage.is_valid_proton_drive());
    }

    #[test]
    fn given_blank_required_fields_when_checking_validity_then_returns_false() {
        let (share_id, node_id, filename, _) = valid_proton_fields();

        assert!(
            !DocumentStorageRef::proton_drive("".to_string(), node_id.clone(), filename.clone(), None)
                .is_valid_proton_drive()
        );
        assert!(
            !DocumentStorageRef::proton_drive(share_id.clone(), "  ".to_string(), filename.clone(), None)
                .is_valid_proton_drive()
        );
        assert!(
            !DocumentStorageRef::proton_drive(share_id, node_id, "".to_string(), None)
                .is_valid_proton_drive()
        );
    }

    #[test]
    fn given_valid_fields_when_new_then_returns_storage() {
        let (share_id, node_id, filename, mime_type) = valid_proton_fields();

        let storage = DocumentStorageRef::new(
            STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
            share_id.clone(),
            node_id.clone(),
            filename.clone(),
            mime_type.clone(),
        )
        .expect("valid proton_drive storage should succeed");

        assert_eq!(storage.provider, STORAGE_PROVIDER_PROTON_DRIVE);
        assert_eq!(storage.share_id, share_id);
        assert_eq!(storage.node_id, node_id);
        assert_eq!(storage.filename, filename);
        assert_eq!(storage.mime_type, mime_type);
    }

    #[test]
    fn given_missing_share_id_when_new_then_returns_validation_error() {
        let (_, node_id, filename, mime_type) = valid_proton_fields();

        let err = DocumentStorageRef::new(
            STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
            String::new(),
            node_id,
            filename,
            mime_type,
        )
        .expect_err("empty share_id should fail validation");

        assert!(matches!(err, AppError::Validation(msg) if msg.contains("share_id")));
    }

    #[test]
    fn given_unsupported_provider_when_new_then_returns_validation_error() {
        let (share_id, node_id, filename, mime_type) = valid_proton_fields();

        let err = DocumentStorageRef::new(
            "dropbox".to_string(),
            share_id,
            node_id,
            filename,
            mime_type,
        )
        .expect_err("unsupported provider should fail validation");

        assert!(matches!(err, AppError::Validation(msg) if msg.contains("proton_drive")));
    }
}
