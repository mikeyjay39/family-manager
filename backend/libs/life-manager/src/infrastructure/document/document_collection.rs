use async_trait::async_trait;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::{application::document_repository::DocumentRepository, domain::document::Document};

pub struct DocumentCollection {
    pub documents: Mutex<Vec<Document>>,
}

#[async_trait]
impl DocumentRepository for DocumentCollection {
    async fn get_document(&self, id: Uuid) -> Option<Document> {
        tracing::info!("Retrieving document with ID: {}", id);
        let documents = self.documents.lock().await;
        tracing::info!("Total documents in collection: {}", documents.len());
        documents.iter().find(|doc| doc.id == id).cloned()
    }

    async fn get_documents(&self, user_id: &Uuid, limit: &u32) -> Vec<Document> {
        let mut documents: Vec<Document> = {
            let guard = self.documents.lock().await;
            guard.clone()
        };

        documents.sort_by_key(|d| (d.title.clone(), d.id));

        documents
            .into_iter()
            .filter(|doc| doc.user_id == *user_id)
            .take(*limit as usize)
            .collect()
    }

    async fn get_documents_title_cursor(
        &self,
        user_id: &Uuid,
        limit: &u32,
        title: &str,
    ) -> Vec<Document> {
        let mut documents: Vec<Document> = {
            let guard = self.documents.lock().await;
            guard.clone()
        };

        documents.sort_by_key(|d| (d.title.clone(), d.id));

        documents
            .into_iter()
            .filter(|doc| doc.user_id == *user_id)
            .filter(|doc| *doc.title > *title)
            .take(*limit as usize)
            .collect()
    }

    async fn save_document(
        &self,
        document: Document,
    ) -> Result<Document, Box<dyn std::error::Error>> {
        tracing::info!("Saving document with ID: {}", document.id);
        let mut documents = self.documents.lock().await;
        documents.push(document.clone());
        Ok(document)
    }

    async fn update_document(
        &self,
        document: Document,
    ) -> Result<Document, Box<dyn std::error::Error>> {
        tracing::info!("Updating document with ID: {}", document.id);
        let mut documents = self.documents.lock().await;
        let index = documents
            .iter()
            .position(|doc| doc.id == document.id)
            .ok_or("Document not found")?;
        documents[index] = document.clone();
        Ok(document)
    }
}

impl Default for DocumentCollection {
    fn default() -> Self {
        Self::new()
    }
}

impl DocumentCollection {
    pub fn new() -> Self {
        DocumentCollection {
            documents: Mutex::new(Vec::new()),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::document::Document;

    use super::*;

    #[tokio::test]
    pub async fn test_add_document() {
        let collection: DocumentCollection = DocumentCollection::new();
        {
            let documents = collection.documents.lock().await;
            assert_eq!(documents.len(), 0);
        }
        let doc = Document::new("Test document", "This is a test content.", Uuid::new_v4());
        collection
            .save_document(doc)
            .await
            .expect("Failed to save document");
        {
            let documents = collection.documents.lock().await;
            assert_eq!(documents.len(), 1);
        }
    }

    #[tokio::test]
    pub async fn test_get_document() {
        let collection: DocumentCollection = DocumentCollection::new();
        let doc = Document::new("Test document", "This is a test content.", Uuid::new_v4());
        let doc_id = doc.id;
        collection
            .save_document(doc.clone())
            .await
            .expect("Failed to save document");

        let retrieved_doc = collection.get_document(doc_id).await.unwrap();
        assert_eq!(retrieved_doc.id, doc.id);
        assert_eq!(retrieved_doc.title, doc.title);
        assert_eq!(retrieved_doc.content, doc.content);
    }
}
