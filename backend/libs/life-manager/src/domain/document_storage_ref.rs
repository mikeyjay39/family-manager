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
