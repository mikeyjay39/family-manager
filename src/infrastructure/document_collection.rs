use crate::{application::application::DocumentRepository, domain::document::Document};

#[derive(Clone)]
pub struct DocumentCollection {
    pub documents: Vec<Document>,
}

impl DocumentRepository for DocumentCollection {
    fn get_document(&self, id: usize) -> Option<&Document> {
        println!("Retrieving document with ID: {}", id);
        println!("Total documents in collection: {}", self.documents.len());
        self.documents.iter().find(|doc| doc.id == id as u32)
    }

    fn save_document(&mut self, document: Document) -> bool {
        self.documents.push(document);
        true
    }

    fn new() -> Self {
        DocumentCollection {
            documents: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::document::Document;

    use super::*;

    #[test]
    pub fn test_add_document() {
        let mut collection: DocumentCollection = DocumentCollection::new();
        assert_eq!(collection.documents.len(), 0);
        let doc = Document::new(1, "Test document", "This is a test content.");
        collection.save_document(doc);
        assert_eq!(collection.documents.len(), 1);
    }

    #[test]
    pub fn test_get_document() {
        let mut collection: DocumentCollection = DocumentCollection::new();
        let doc = Document::new(1, "Test document", "This is a test content.");
        collection.save_document(doc.clone());

        let retrieved_doc = collection.get_document(1);
        assert!(retrieved_doc.is_some());
        assert_eq!(retrieved_doc.unwrap().id, doc.id);
        assert_eq!(retrieved_doc.unwrap().title, doc.title);
        assert_eq!(retrieved_doc.unwrap().content, doc.content);
    }
}
