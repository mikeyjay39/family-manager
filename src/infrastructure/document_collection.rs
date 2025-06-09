use crate::{application::application::DocumentRepository, domain::document::Document};

pub struct DocumentCollection {
    pub documents: Vec<Document>,
}

impl DocumentRepository for DocumentCollection {
    fn get_document(&self, id: usize) -> Option<&Document> {
        self.documents.get(id as usize)
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
}
