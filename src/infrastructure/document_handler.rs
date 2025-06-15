use axum::{Json, http::StatusCode};

use crate::domain::document::Document;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CreateDocumentCommand {
    pub id: u32,
    pub title: String,
    pub content: String,
}

pub async fn create_document(
    Json(payload): Json<CreateDocumentCommand>,
) -> (StatusCode, Json<Document>) {
    let document = Document::new(payload.id, &payload.title, &payload.content);
    document.print_details();

    let json_response = Json(document);
    (StatusCode::CREATED, json_response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::Json;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn test_create_document() {
        // Arrange
        let payload = CreateDocumentCommand {
            id: 1,
            title: String::from("Test Document"),
            content: String::from("This is a test content."),
        };
        let json_payload = Json(payload);

        // Act
        let (status_code, body) = create_document(json_payload).await;

        // Assert
        assert_eq!(status_code, StatusCode::CREATED);

        let response_document = body.0;
        assert_eq!(response_document.id, 1);
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is a test content.");
    }
}
