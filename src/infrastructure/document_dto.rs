use serde::Deserialize;
use serde::Serialize;

use crate::domain::document::Document;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DocumentDto {
    pub id: u32,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
}

impl DocumentDto {
    pub fn from_document(document: &Document) -> Self {
        Self {
            id: document.id,
            title: document.title.clone(),
            content: document.content.clone(),
            tags: document.tags.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::document::Document;

    #[test]
    fn test_document_dto_conversion() {
        let document = Document::new(1, "Test Document", "This is a test content.");
        let dto = DocumentDto::from_document(&document);
        assert_eq!(dto.id, 1);
        assert_eq!(dto.title, "Test Document");
        assert_eq!(dto.content, "This is a test content.");
        assert!(dto.tags.is_empty());
    }
}
