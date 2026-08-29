use std::sync::Arc;

use backend_utils::{AppResponse, app_result::ApiResult};
use uuid::Uuid;

use crate::application::document_repository::DocumentRepository;

pub struct DeleteDocumentCommand {
    document_id: Uuid,
    user_id: Uuid,
    document_repository: Arc<dyn DocumentRepository>,
}

impl DeleteDocumentCommand {
    pub fn new(
        document_id: Uuid,
        user_id: Uuid,
        document_repository: Arc<dyn DocumentRepository>,
    ) -> Self {
        Self {
            document_id,
            user_id,
            document_repository,
        }
    }

    pub async fn execute(&self) -> ApiResult<()> {
        tracing::info!("Deleting document with ID: {}", self.document_id);
        let Some(_document) = self
            .document_repository
            .load_owned_document(self.document_id, self.user_id)
            .await
        else {
            tracing::warn!(
                "Document {} not found or not owned by user {}",
                self.document_id,
                self.user_id
            );
            return AppResponse::not_found();
        };

        self.handle_delete_document_result(
            self.document_repository
                .delete_document(self.document_id)
                .await,
        )
    }

    fn handle_delete_document_result(
        &self,
        result: Result<bool, Box<dyn std::error::Error>>,
    ) -> ApiResult<()> {
        match result {
            Err(e) => {
                tracing::error!("Error deleting document: {}", e);
                AppResponse::internal_error(e)
            }
            Ok(false) => {
                tracing::warn!(
                    "Document {} owned but delete affected 0 rows",
                    self.document_id
                );
                AppResponse::not_found()
            }
            Ok(true) => {
                tracing::info!("Document deleted: {}", self.document_id);
                AppResponse::<()>::no_content()
            }
        }
    }
}
