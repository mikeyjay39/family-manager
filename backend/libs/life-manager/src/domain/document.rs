use std::sync::Arc;

use chrono::NaiveDateTime;
use chrono::Utc;
use serde::Deserialize;
use serde::Serialize;
use uuid::Uuid;

use crate::domain::document_storage_ref::DocumentStorageRef;
use crate::domain::document_summarizer::DocumentSummarizer;
use crate::domain::document_summarizer::DocumentSummaryResult;
use crate::domain::document_text_reader::DocumentTextReader;
use crate::domain::uploaded_document_input::UploadedDocumentInput;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Document {
    pub id: Uuid,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
    pub user_id: Uuid,
    pub created_at: NaiveDateTime,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
    pub storage: Option<DocumentStorageRef>,
}

impl Document {
    /// Creates a new document with an auto-generated UUID
    pub fn new(title: &str, content: &str, user_id: Uuid) -> Self {
        Self {
            id: Uuid::new_v4(),
            title: title.to_string(),
            content: String::from(content),
            tags: vec![],
            user_id,
            created_at: Utc::now().naive_utc(),
            issued_date: None,
            expire_date: None,
            storage: None,
        }
    }

    /// Creates a document with a known ID (for loading from database)
    pub fn with_id(
        id: Uuid,
        title: &str,
        content: &str,
        user_id: Uuid,
        tags: Vec<String>,
        created_at: NaiveDateTime,
        issued_date: Option<NaiveDateTime>,
        expire_date: Option<NaiveDateTime>,
        storage: Option<DocumentStorageRef>,
    ) -> Self {
        Self {
            id,
            title: title.to_string(),
            content: String::from(content),
            tags,
            user_id,
            created_at,
            issued_date,
            expire_date,
            storage,
        }
    }

    /// Creates a document with metadata and optional external storage reference.
    pub fn new_with_storage(
        title: &str,
        content: &str,
        user_id: Uuid,
        storage: Option<DocumentStorageRef>,
    ) -> Self {
        let mut document = Self::new(title, content, user_id);
        document.storage = storage;
        document
    }

    /**
     * Creates a Document from file bytes by reading the text and summarizing it.
     */
    pub async fn from_file(
        uploaded_document_input: UploadedDocumentInput,
        reader: Arc<dyn DocumentTextReader>,
        summarizer: Arc<dyn DocumentSummarizer>,
    ) -> Option<Document> {
        tracing::info!("Document::from_file");
        let text = match reader.read_image(&uploaded_document_input).await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Error reading document text: {}", e);
                return None;
            }
        };

        tracing::info!("Document text read successfully, text: {}", text);

        let summary_result = match (summarizer.summarize(&text)).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("Error summarizing document text: {}", e);
                return None;
            }
        };

        let DocumentSummaryResult { summary, title } = summary_result;
        let document = Document {
            id: Uuid::new_v4(),
            title,
            content: summary,
            tags: uploaded_document_input.tags,
            user_id: uploaded_document_input.user_id,
            created_at: Utc::now().naive_utc(),
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        Some(document)
    }

    // Prints the document details
    pub fn print_details(&self) {
        tracing::info!("Document ID: {}", self.id);
        tracing::info!("Title: {}", self.title);
        tracing::info!("Content: {}", self.content);
    }

    pub fn content(&self) -> &String {
        &self.content
    }

    pub fn set_content(&mut self, content: String) {
        self.content = content;
    }

    /// Copies title/content/tags/dates/storage from `updated` while preserving identity fields.
    pub fn with_preserved_identity_from(existing: &Self, updated: Self) -> Self {
        Self {
            id: existing.id,
            user_id: existing.user_id,
            created_at: existing.created_at,
            title: updated.title,
            content: updated.content,
            tags: updated.tags,
            issued_date: updated.issued_date,
            expire_date: updated.expire_date,
            storage: updated.storage,
        }
    }

    /// Applies metadata fields from an update payload without changing identity or storage.
    pub fn apply_metadata_update(
        &mut self,
        title: &str,
        content: &str,
        tags: Vec<String>,
        issued_date: Option<NaiveDateTime>,
        expire_date: Option<NaiveDateTime>,
    ) {
        self.title = title.to_string();
        self.content = content.to_string();
        self.tags = tags;
        self.issued_date = issued_date;
        self.expire_date = expire_date;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    #[test]
    fn test_document_creation() {
        let user_id = Uuid::new_v4();
        let doc = Document::new("Test Document", "This is a test content.", user_id);
        assert!(!doc.id.is_nil());
        assert_eq!(doc.title, "Test Document");
        assert_eq!(doc.content, "This is a test content.");
        assert!(doc.tags.is_empty());
    }

    #[test]
    fn test_document_with_id() {
        let doc_id = Uuid::new_v4();
        let user_id = Uuid::new_v4();
        let doc = Document::with_id(
            doc_id,
            "Test Document",
            "This is a test content.",
            user_id,
            vec![],
            Utc::now().naive_utc(),
            None,
            None,
            None,
        );
        assert_eq!(doc.id, doc_id);
        assert_eq!(doc.title, "Test Document");
        assert_eq!(doc.content, "This is a test content.");
        assert!(doc.tags.is_empty());
    }

    #[test]
    fn test_document_print_details() {
        let doc = Document::new(
            "Another Document",
            "Content of another document.",
            Uuid::new_v4(),
        );
        doc.print_details();
    }

    #[test]
    fn test_document_with_empty_strings() {
        let user_id = Uuid::new_v4();
        let doc = Document::new("", "", user_id);

        assert!(!doc.id.is_nil());
        assert_eq!(doc.title, "");
        assert_eq!(doc.content, "");
        assert_eq!(doc.user_id, user_id);
        assert!(doc.tags.is_empty());
    }

    #[test]
    fn test_document_with_very_long_strings() {
        let long_title = "A".repeat(10_000);
        let long_content = "B".repeat(1_000_000);
        let user_id = Uuid::new_v4();

        let doc = Document::new(&long_title, &long_content, user_id);

        assert_eq!(doc.title.len(), 10_000);
        assert_eq!(doc.content.len(), 1_000_000);
        assert!(!doc.id.is_nil());
    }

    #[test]
    fn test_document_with_unicode_and_special_chars() {
        let title = "文档标题 🚀 Тест";
        let content = "Content with émojis 😀 and special chars: <>&\"'\n\t\r";
        let user_id = Uuid::new_v4();

        let doc = Document::new(title, content, user_id);

        assert_eq!(doc.title, title);
        assert_eq!(doc.content, content);
    }

    #[test]
    fn test_document_with_newlines_and_whitespace() {
        let title = "  Title with spaces  ";
        let content = "\n\n  Content\n  with\n  newlines  \n\n";
        let user_id = Uuid::new_v4();

        let doc = Document::new(title, content, user_id);

        assert_eq!(doc.title, title);
        assert_eq!(doc.content, content);
    }

    #[test]
    fn test_content_getter() {
        let content = "Test content";
        let doc = Document::new("Title", content, Uuid::new_v4());

        assert_eq!(doc.content(), content);
        assert_eq!(doc.content(), &doc.content);
    }

    #[test]
    fn test_set_content() {
        let mut doc = Document::new("Title", "Original", Uuid::new_v4());

        doc.set_content("Updated content".to_string());
        assert_eq!(doc.content, "Updated content");

        doc.set_content(String::new());
        assert_eq!(doc.content, "");

        let long_content = "X".repeat(100_000);
        doc.set_content(long_content.clone());
        assert_eq!(doc.content, long_content);
    }

    #[test]
    fn test_document_clone() {
        let user_id = Uuid::new_v4();
        let doc = Document::new("Title", "Content", user_id);
        let cloned = doc.clone();

        assert_eq!(doc.id, cloned.id);
        assert_eq!(doc.title, cloned.title);
        assert_eq!(doc.content, cloned.content);
        assert_eq!(doc.user_id, cloned.user_id);
        assert_eq!(doc.tags, cloned.tags);
        assert_eq!(doc.created_at, cloned.created_at);
        assert_eq!(doc.issued_date, cloned.issued_date);
        assert_eq!(doc.expire_date, cloned.expire_date);
    }

    #[test]
    fn test_document_serialization() {
        let user_id = Uuid::new_v4();
        let doc = Document::new("Serialize Test", "Content here", user_id);

        let serialized = serde_json::to_string(&doc).expect("Failed to serialize");
        assert!(serialized.contains("Serialize Test"));
        assert!(serialized.contains("Content here"));

        let deserialized: Document =
            serde_json::from_str(&serialized).expect("Failed to deserialize");
        assert_eq!(deserialized.id, doc.id);
        assert_eq!(deserialized.title, doc.title);
        assert_eq!(deserialized.content, doc.content);
        assert_eq!(deserialized.user_id, doc.user_id);
        assert_eq!(deserialized.created_at, doc.created_at);
        assert_eq!(deserialized.issued_date, doc.issued_date);
        assert_eq!(deserialized.expire_date, doc.expire_date);
    }

    // Mock implementations for testing from_file

    #[derive(Debug)]
    struct MockError(String);

    impl std::fmt::Display for MockError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "{}", self.0)
        }
    }

    impl std::error::Error for MockError {}

    struct MockTextReader {
        should_succeed: bool,
        text: String,
        error_message: String,
    }

    impl MockTextReader {
        fn success(text: String) -> Self {
            Self {
                should_succeed: true,
                text,
                error_message: String::new(),
            }
        }

        fn error(message: String) -> Self {
            Self {
                should_succeed: false,
                text: String::new(),
                error_message: message,
            }
        }
    }

    #[async_trait]
    impl DocumentTextReader for MockTextReader {
        async fn read_image(
            &self,
            _uploaded_document_input: &UploadedDocumentInput,
        ) -> Result<String, Box<dyn std::error::Error>> {
            if self.should_succeed {
                Ok(self.text.clone())
            } else {
                Err(Box::new(MockError(self.error_message.clone())))
            }
        }
    }

    struct MockSummarizer {
        should_succeed: bool,
        summary: String,
        title: String,
        error_message: String,
    }

    impl MockSummarizer {
        fn success(summary: String, title: String) -> Self {
            Self {
                should_succeed: true,
                summary,
                title,
                error_message: String::new(),
            }
        }

        fn error(message: String) -> Self {
            Self {
                should_succeed: false,
                summary: String::new(),
                title: String::new(),
                error_message: message,
            }
        }
    }

    #[async_trait]
    impl DocumentSummarizer for MockSummarizer {
        async fn summarize(
            &self,
            _text: &str,
        ) -> Result<DocumentSummaryResult, Box<dyn std::error::Error>> {
            if self.should_succeed {
                Ok(DocumentSummaryResult {
                    summary: self.summary.clone(),
                    title: self.title.clone(),
                })
            } else {
                Err(Box::new(MockError(self.error_message.clone())))
            }
        }
    }

    #[tokio::test]
    async fn test_from_file_success() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("test.pdf".to_string(), vec![1, 2, 3], user_id);

        let reader = Arc::new(MockTextReader::success(
            "Extracted text from document".to_string(),
        ));

        let summarizer = Arc::new(MockSummarizer::success(
            "This is a summary".to_string(),
            "Generated Title".to_string(),
        ));

        let doc = Document::from_file(input, reader, summarizer)
            .await
            .expect("Should create document");

        assert!(!doc.id.is_nil());
        assert_eq!(doc.title, "Generated Title");
        assert_eq!(doc.content, "This is a summary");
        assert_eq!(doc.user_id, user_id);
        assert!(doc.tags.is_empty());
    }

    #[tokio::test]
    async fn test_from_file_reader_error() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("test.pdf".to_string(), vec![1, 2, 3], user_id);

        let reader = Arc::new(MockTextReader::error("Failed to read document".to_string()));

        let summarizer = Arc::new(MockSummarizer::success(
            "Summary".to_string(),
            "Title".to_string(),
        ));

        let result = Document::from_file(input, reader, summarizer).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_from_file_summarizer_error() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("test.pdf".to_string(), vec![1, 2, 3], user_id);

        let reader = Arc::new(MockTextReader::success("Extracted text".to_string()));

        let summarizer = Arc::new(MockSummarizer::error("Failed to summarize".to_string()));

        let result = Document::from_file(input, reader, summarizer).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn test_from_file_with_empty_text() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("empty.pdf".to_string(), vec![], user_id);

        let reader = Arc::new(MockTextReader::success(String::new()));

        let summarizer = Arc::new(MockSummarizer::success(String::new(), String::new()));

        let doc = Document::from_file(input, reader, summarizer)
            .await
            .expect("Should create document even with empty strings");

        assert_eq!(doc.title, "");
        assert_eq!(doc.content, "");
    }

    #[tokio::test]
    async fn test_from_file_with_very_long_text() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("large.pdf".to_string(), vec![1; 10000], user_id);

        let long_text = "A".repeat(1_000_000);
        let long_summary = "B".repeat(500_000);
        let long_title = "C".repeat(10_000);

        let reader = Arc::new(MockTextReader::success(long_text));

        let summarizer = Arc::new(MockSummarizer::success(
            long_summary.clone(),
            long_title.clone(),
        ));

        let doc = Document::from_file(input, reader, summarizer)
            .await
            .expect("Should handle very long text");

        assert_eq!(doc.title.len(), 10_000);
        assert_eq!(doc.content.len(), 500_000);
    }

    #[tokio::test]
    async fn test_from_file_with_unicode() {
        let user_id = Uuid::new_v4();
        let input = UploadedDocumentInput::new("unicode.pdf".to_string(), vec![1, 2, 3], user_id);

        let reader = Arc::new(MockTextReader::success(
            "Text with émojis 🚀 and 中文字符".to_string(),
        ));

        let summarizer = Arc::new(MockSummarizer::success(
            "Summary with émojis 😀".to_string(),
            "Título con ñ".to_string(),
        ));

        let doc = Document::from_file(input, reader, summarizer)
            .await
            .expect("Should handle unicode");

        assert_eq!(doc.title, "Título con ñ");
        assert_eq!(doc.content, "Summary with émojis 😀");
    }
}
