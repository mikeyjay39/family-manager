use chrono::NaiveDateTime;
use serde::Deserialize;
use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use crate::domain::document::Document;

#[derive(Serialize, Deserialize, Clone, Debug, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/DocumentDto.ts"
)]
pub struct DocumentDto {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub created_at: NaiveDateTime,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
}

impl DocumentDto {
    pub fn from_document(document: &Document) -> Self {
        Self {
            id: document.id,
            title: document.title.clone(),
            content: document.content.clone(),
            tags: document.tags.clone(),
            created_at: document.created_at,
            issued_date: document.issued_date,
            expire_date: document.expire_date,
        }
    }
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::*;
    use crate::domain::document::Document;

    #[test]
    fn test_document_dto_conversion() {
        let user_id = Uuid::new_v4();
        let document = Document::new("Test Document", "This is a test content.", user_id);
        let dto = DocumentDto::from_document(&document);
        assert_eq!(dto.id, document.id);
        assert_eq!(dto.title, "Test Document");
        assert_eq!(dto.content, "This is a test content.");
        assert!(dto.tags.is_empty());
        assert_eq!(dto.created_at, document.created_at);
        assert_eq!(dto.issued_date, document.issued_date);
        assert_eq!(dto.expire_date, document.expire_date);
    }

    #[test]
    fn export_typescript_bindings() {
        DocumentDto::export().unwrap();
    }
}
