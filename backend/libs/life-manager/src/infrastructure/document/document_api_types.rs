use backend_utils::AppError;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::document_storage_ref::DocumentStorageRef;

#[derive(Serialize, Deserialize, Clone, Debug, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/DocumentStorageRefDto.ts"
)]
pub struct DocumentStorageRefDto {
    pub provider: String,
    pub share_id: String,
    pub node_id: String,
    pub filename: String,
    pub mime_type: Option<String>,
}

impl DocumentStorageRefDto {
    pub fn from_domain(storage: &DocumentStorageRef) -> Self {
        Self {
            provider: storage.provider.clone(),
            share_id: storage.share_id.clone(),
            node_id: storage.node_id.clone(),
            filename: storage.filename.clone(),
            mime_type: storage.mime_type.clone(),
        }
    }

    pub fn into_domain(self) -> Result<DocumentStorageRef, AppError> {
        DocumentStorageRef::new(
            self.provider,
            self.share_id,
            self.node_id,
            self.filename,
            self.mime_type,
        )
    }

    pub fn is_valid_proton_drive(&self) -> bool {
        DocumentStorageRef {
            provider: self.provider.clone(),
            share_id: self.share_id.clone(),
            node_id: self.node_id.clone(),
            filename: self.filename.clone(),
            mime_type: self.mime_type.clone(),
        }
        .is_valid_proton_drive()
    }
}

#[derive(Deserialize, Serialize, Clone, Debug, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/CreateDocumentCommand.ts"
)]
pub struct CreateDocumentCommand {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub issued_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub expire_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub storage: Option<DocumentStorageRefDto>,
}

#[derive(Deserialize, Serialize, Clone, Debug, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/UpdateDocumentCommand.ts"
)]
pub struct UpdateDocumentCommand {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub issued_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub expire_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub storage: Option<DocumentStorageRefDto>,
}

#[derive(Deserialize, Debug, Serialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/GetDocumentsQueryParams.ts"
)]
pub struct GetDocumentsQueryParams {
    pub title: Option<String>,
}

#[cfg(test)]
mod export_ts_bindings {
    use super::*;

    #[test]
    fn export_typescript_bindings() {
        DocumentStorageRefDto::export().unwrap();
        CreateDocumentCommand::export().unwrap();
        UpdateDocumentCommand::export().unwrap();
        GetDocumentsQueryParams::export().unwrap();
    }
}
