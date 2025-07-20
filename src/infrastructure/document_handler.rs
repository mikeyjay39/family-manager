use crate::{application::application::DocumentRepository, domain::document::Document};
use axum::extract::{Multipart, Path, State};
use axum::response::IntoResponse;
use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use super::app_state::AppState;
use super::document_collection::DocumentCollection;
use super::document_dto::DocumentDto;
use std::sync::Arc;

#[derive(Deserialize, Serialize)]
pub struct CreateDocumentCommand {
    pub id: u32,
    pub title: String,
    pub content: String,
}

pub async fn create_document(
    State(state): State<Arc<AppState<DocumentCollection>>>,
    // Json(payload): Json<CreateDocumentCommand>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    // TODO: Continue looking into how to add a multipart file upload here with json payload
    let mut json_data: Option<CreateDocumentCommand> = None;

    while let Some(field) = multipart.next_field().await.unwrap() {
        match field.name() {
            Some("json") => {
                let text = field.text().await.unwrap();
                json_data = serde_json::from_str(&text).ok();
            }
            Some("file") => {
                let data = field.bytes().await.unwrap();
                let mut file_data = Vec::new();
                while let Some(mut field) = multipart.next_field().await.unwrap() {
                    while let Some(chunk) = field.chunk().await.unwrap() {
                        file_data.extend_from_slice(&chunk);
                    }
                }

                // let mut file = File::create("upload.bin").await.unwrap();
                // file.write_all(&data).await.unwrap();
            }
            _ => {}
        }
    }

    if let Some(payload) = json_data {
        // print!(format!("Received JSON: {}", payload));
        let document = Document::new(payload.id, &payload.title, &payload.content);
        document.print_details();

        let mut repo = state.document_repository.lock().await;
        repo.save_document(document.clone());
        // let json_response = Json(DocumentDto::from_document(&document));
        (
            StatusCode::CREATED,
            Json(serde_json::json!(DocumentDto::from_document(&document))),
        )
    } else {
        (StatusCode::NOT_FOUND, Json(serde_json::json!({})))
    }

    // let mut file_data = Vec::new();
    // while let Some(mut field) = multipart.next_field().await.unwrap() {
    //     while let Some(chunk) = field.chunk().await.unwrap() {
    //         file_data.extend_from_slice(&chunk);
    //     }
    // }
    // let document = Document::new(payload.id, &payload.title, &payload.content);
    // document.print_details();
    //
    // let mut repo = state.document_repository.lock().await;
    // repo.save_document(document.clone());
    // let json_response = Json(DocumentDto::from_document(&document));
    // (StatusCode::CREATED, json_response)
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
    use axum::extract::FromRequest;
    use axum::http::StatusCode;
    use hyper::body::to_bytes;
    use hyper::{Body, Request};
    use serde_json::from_slice;

    #[tokio::test]
    async fn test_create_document() {
        // Arrange
        let payload = CreateDocumentCommand {
            id: 1,
            title: String::from("Test Document"),
            content: String::from("This is a test content."),
        };
        // let json_payload = Json(payload);

        let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
            document_repository: Arc::new(tokio::sync::Mutex::new(DocumentCollection::new())),
        });

        // Serialize the JSON payload
        let json_string = serde_json::to_string(&payload).unwrap();

        // Create the multipart body
        let multipart_body = format!(
            "--boundary\r\n\
        Content-Disposition: form-data; name=\"json\"\r\n\
        Content-Type: application/json\r\n\r\n\
        {}\r\n\
        --boundary\r\n\
        Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
        Content-Type: text/plain\r\n\r\n\
        This is test content.\r\n\
        --boundary--",
            json_string
        );

        // Create the request
        let request = Request::builder()
            .header("content-type", "multipart/form-data; boundary=boundary")
            .body(Body::from(multipart_body))
            .unwrap();

        let multipart = Multipart::from_request(request, &state).await.unwrap();
        let response = create_document(State(state), multipart)
            .await
            .into_response();

        // let body = response.into_body();
        let (parts, body) = response.into_parts();
        let status_code = parts.status;
        // Assert
        assert_eq!(status_code, StatusCode::CREATED);

        let bytes = to_bytes(body).await.expect("Failed to read body");

        // Deserialize the bytes into a DocumentDto object
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(response_document.id, 1);
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is a test content.");
    }

    // #[tokio::test]
    // async fn test_get_document() {
    //     // Arrange
    //     let document = Document::new(1, "Test Document", "This is a test content.");
    //     let mut repo = DocumentCollection::new();
    //     repo.save_document(document.clone());
    //
    //     let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
    //         document_repository: Arc::new(tokio::sync::Mutex::new(repo)),
    //     });
    //
    //     // Act
    //     let response = get_document(State(state), Path(1)).await;
    //
    //     let response = response.into_response();
    //     let status_code = response.status();
    //     let body = response.into_body();
    //     // Assert
    //     assert_eq!(status_code, StatusCode::OK);
    //
    //     let bytes = to_bytes(body).await.expect("Failed to read body");
    //     let response_document =
    //         serde_json::from_slice::<Document>(&bytes).expect("Failed to deserialize JSON");
    //
    //     // let response_document: Document =
    //     // serde_json::from_slice(&body_bytes).expect("Failed to deserialize response body");
    //     assert_eq!(response_document.id, 1);
    //     assert_eq!(response_document.title, "Test Document");
    //     assert_eq!(response_document.content, "This is a test content.");
    // }
    //
    // #[tokio::test]
    // async fn test_get_document_not_found() {
    //     // Arrange
    //     let document = Document::new(1, "Test Document", "This is a test content.");
    //     let mut repo = DocumentCollection::new();
    //     repo.save_document(document.clone());
    //
    //     let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
    //         document_repository: Arc::new(tokio::sync::Mutex::new(repo)),
    //     });
    //
    //     // Act
    //     let response = get_document(State(state), Path(2)).await;
    //     let response = response.into_response();
    //     let status_code = response.status();
    //     let body = response.into_body();
    //     let bytes = to_bytes(body).await.expect("Failed to read body");
    //
    //     // Assert
    //     assert_eq!(status_code, StatusCode::NOT_FOUND);
    //     // TODO: assert empty response body
    // }
}
