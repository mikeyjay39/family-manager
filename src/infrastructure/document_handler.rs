use crate::{application::application::DocumentRepository, domain::document::Document};
use axum::extract::{Multipart, Path, State};
use axum::response::IntoResponse;
use axum::{Json, http::StatusCode};
use serde::Deserialize;

use super::app_state::AppState;
use super::document_dto::DocumentDto;
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
    // Multipart(multipart): Multipart,
) -> (StatusCode, Json<DocumentDto>) {
    // TODO: Continue looking into how to add a multipart file upload here with json payload
    // let mut file_data = Vec::new();
    // while let Some(mut field) = multipart.next_field().await.unwrap() {
    //     while let Some(chunk) = field.chunk().await.unwrap() {
    //         file_data.extend_from_slice(&chunk);
    //     }
    // }
    let document = Document::new(payload.id, &payload.title, &payload.content);
    document.print_details();

    let mut repo = state.document_repository.lock().await;
    repo.save_document(document.clone());
    let json_response = Json(DocumentDto::from_document(&document));
    (StatusCode::CREATED, json_response)
}

pub async fn get_document<T: DocumentRepository>(
    State(state): State<Arc<AppState<T>>>,
    Path(id): Path<u32>,
) -> impl IntoResponse {
    let repo = state.document_repository.lock().await;
    if let Some(document) = repo.get_document(id as usize) {
        (StatusCode::OK, Json(serde_json::json!(document.clone())))
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({})))
    }
}

/*
* TODO: Remove this. It is for testing only
* */
pub async fn upload(mut multipart: Multipart) {
    while let Some(mut field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap().to_string();
        let data = field.bytes().await.unwrap();

        println!("Length of `{}` is {} bytes", name, data.len());
    }
}

#[cfg(test)]
mod tests {
    use crate::infrastructure::document_collection::DocumentCollection;

    use super::*;
    use axum::Json;
    use axum::http::StatusCode;
    use hyper::body::to_bytes;

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
        let response = get_document(State(state), Path(1)).await;

        let response = response.into_response();
        let status_code = response.status();
        let body = response.into_body();
        // Assert
        assert_eq!(status_code, StatusCode::OK);

        let bytes = to_bytes(body).await.expect("Failed to read body");
        let response_document =
            serde_json::from_slice::<Document>(&bytes).expect("Failed to deserialize JSON");

        // let response_document: Document =
        // serde_json::from_slice(&body_bytes).expect("Failed to deserialize response body");
        assert_eq!(response_document.id, 1);
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is a test content.");
    }

    #[tokio::test]
    async fn test_get_document_not_found() {
        // Arrange
        let document = Document::new(1, "Test Document", "This is a test content.");
        let mut repo = DocumentCollection::new();
        repo.save_document(document.clone());

        let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
            document_repository: Arc::new(tokio::sync::Mutex::new(repo)),
        });

        // Act
        let response = get_document(State(state), Path(2)).await;
        let response = response.into_response();
        let status_code = response.status();
        let body = response.into_body();
        let bytes = to_bytes(body).await.expect("Failed to read body");

        // Assert
        assert_eq!(status_code, StatusCode::NOT_FOUND);
        // TODO: assert empty response body
    }
}
