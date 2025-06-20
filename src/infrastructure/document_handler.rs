use axum::extract::State;
use axum::{Json, http::StatusCode};

use crate::{application::application::DocumentRepository, domain::document::Document};
use serde::Deserialize;

use super::app_state::AppState;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CreateDocumentCommand {
    pub id: u32,
    pub title: String,
    pub content: String,
}

pub async fn create_document<T: DocumentRepository>(
    State(state): State<Arc<AppState<T>>>,
    Json(payload): Json<CreateDocumentCommand>,
) -> (StatusCode, Json<Document>) {
    let document = Document::new(payload.id, &payload.title, &payload.content);
    document.print_details();

    let mut repo = state.document_repository.lock().await;
    repo.save_document(document.clone());
    let json_response = Json(document);
    (StatusCode::CREATED, json_response)
}

pub async fn get_document<T: DocumentRepository>(
    State(state): State<Arc<AppState<T>>>,
    id: u32,
) -> (StatusCode, Option<Json<Document>>) {
    let repo = state.document_repository.lock().await;
    if let Some(document) = repo.get_document(id as usize) {
        (StatusCode::OK, Some(Json(document.clone())))
    } else {
        (StatusCode::NOT_FOUND, None)
    }
}

#[cfg(test)]
mod tests {
    use crate::infrastructure::document_collection::DocumentCollection;

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

        let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
            document_repository: Arc::new(tokio::sync::Mutex::new(DocumentCollection::new())),
        });

        // Act
        let (status_code, body) = create_document(State(state), json_payload).await;

        // Assert
        assert_eq!(status_code, StatusCode::CREATED);

        let response_document = body.0;
        assert_eq!(response_document.id, 1);
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is a test content.");
    }

    #[tokio::test]
    async fn test_get_document() {
        // Arrange
        let document = Document::new(1, "Test Document", "This is a test content.");
        let mut repo = DocumentCollection::new();
        repo.save_document(document.clone());

        let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
            document_repository: Arc::new(tokio::sync::Mutex::new(repo)),
        });

        // Act
        let (status_code, body) = get_document(State(state), 1).await;

        // Assert
        assert_eq!(status_code, StatusCode::OK);
        assert!(body.is_some());

        let response_document = body.unwrap().0;
        assert_eq!(response_document.id, 1);
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is a test content.");
    }
}
