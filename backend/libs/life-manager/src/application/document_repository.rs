use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::document::Document;

/**
 * Port for document repository operations.
 */
#[async_trait]
pub trait DocumentRepository: Sync + Send {
    async fn get_document(&self, id: Uuid) -> Option<Document>;
    async fn get_documents(&self, user_id: &Uuid, limit: &u32) -> Vec<Document>;
    async fn get_documents_title_cursor(
        &self,
        user_id: &Uuid,
        limit: &u32,
        title: &str,
    ) -> Vec<Document>;
    async fn save_document(
        &self,
        document: Document,
    ) -> Result<Document, Box<dyn std::error::Error>>;
    async fn update_document(
        &self,
        document: Document,
    ) -> Result<Document, Box<dyn std::error::Error>>;
}
