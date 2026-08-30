use std::sync::Arc;

use backend_utils::{AppError, AppResult};

use crate::{
    application::document_repository::DocumentRepository,
    domain::{
        document::Document, document_summarizer::DocumentSummarizer,
        document_text_reader::DocumentTextReader, uploaded_document_input::UploadedDocumentInput,
    },
};

pub struct CreateDocumentCommand {
    uploaded_document_input: UploadedDocumentInput,
    document_repository: Arc<dyn DocumentRepository>,
    reader: Arc<dyn DocumentTextReader>,
    summarizer: Arc<dyn DocumentSummarizer>,
}

impl CreateDocumentCommand {
    pub fn new(
        uploaded_document_input: UploadedDocumentInput,
        document_repository: Arc<dyn DocumentRepository>,
        reader: Arc<dyn DocumentTextReader>,
        summarizer: Arc<dyn DocumentSummarizer>,
    ) -> Self {
        Self {
            uploaded_document_input,
            document_repository,
            reader,
            summarizer,
        }
    }

    pub async fn execute(self) -> AppResult<Document> {
        let document_opt = match !self.uploaded_document_input.file_data.is_empty() {
            true => {
                Document::from_file(self.uploaded_document_input, &self.reader, &self.summarizer)
                    .await
            }
            false => Some(Document::from_uploaded_input(self.uploaded_document_input)),
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

        let saved_doc_res = self.document_repository.save_document(document).await;
        match saved_doc_res {
            Err(e) => {
                tracing::error!("Error saving document: {}", e);
                Err(AppError::from(e))
            }
            Ok(saved_doc) => {
                tracing::info!("Document saved: {:?}", saved_doc.title);
                AppResult::Ok(saved_doc)
            }
        }
    }
}
