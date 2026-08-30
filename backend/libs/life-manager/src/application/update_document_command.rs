use std::sync::Arc;

use backend_utils::{AppError, AppResult};
use uuid::Uuid;

use crate::{
    application::document_repository::DocumentRepository,
    domain::{
        document::Document, document_summarizer::DocumentSummarizer,
        document_text_reader::DocumentTextReader, uploaded_document_input::UploadedDocumentInput,
    },
};

pub struct UpdateDocumentCommand {
    document_id: Uuid,
    uploaded_document_input: UploadedDocumentInput,
    document_repository: Arc<dyn DocumentRepository>,
    reader: Arc<dyn DocumentTextReader>,
    summarizer: Arc<dyn DocumentSummarizer>,
}

impl UpdateDocumentCommand {
    pub fn new(
        document_id: Uuid,
        uploaded_document_input: UploadedDocumentInput,
        document_repository: Arc<dyn DocumentRepository>,
        reader: Arc<dyn DocumentTextReader>,
        summarizer: Arc<dyn DocumentSummarizer>,
    ) -> Self {
        Self {
            document_id,
            uploaded_document_input,
            document_repository,
            reader,
            summarizer,
        }
    }

    pub async fn execute(self) -> AppResult<Document> {
        tracing::info!(
            "Received multipart update for document ID: {}",
            self.document_id
        );
        let Some(existing) = self
            .document_repository
            .load_owned_document(&self.document_id, &self.uploaded_document_input.user_id)
            .await
        else {
            return Err(AppError::NotFound);
        };

        let document_opt: Option<Document> = if self.uploaded_document_input.file_data.len() > 0 {
            Document::from_file(
                self.uploaded_document_input.clone(),
                &self.reader,
                &self.summarizer,
            )
            .await
            .map(|ocr_doc| Document::with_preserved_identity_from(&existing, ocr_doc))
        } else {
            let mut document: Document = existing.clone();
            document.apply_metadata_update(
                &self.uploaded_document_input.title,
                &self
                    .uploaded_document_input
                    .content
                    .as_deref()
                    .unwrap_or(""),
                self.uploaded_document_input.tags,
                self.uploaded_document_input.issued_date,
                self.uploaded_document_input.expire_date,
            );
            Some(document)
        };

        let document = match document_opt {
            Some(doc) => doc,
            None => {
                let err_msg = "Failed to create document from file data";
                tracing::error!(err_msg);
                return Err(AppError::internal_err_from_msg(err_msg));
            }
        };

        document.print_details();

        match self.document_repository.update_document(document).await {
            Err(e) => {
                tracing::error!("Error updating document: {}", e);
                Err(AppError::from(e))
            }
            Ok(saved_doc) => {
                tracing::info!("Document updated: {:?}", saved_doc.title);
                Ok(saved_doc)
            }
        }
    }
}
