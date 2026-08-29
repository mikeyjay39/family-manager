use std::sync::Arc;

use crate::application::delete_document_command::DeleteDocumentCommand;
use crate::application::get_documents_query::{GetDocumentsQuery, GetDocumentsTitleCursorQuery};
use crate::domain::document::Document;
use crate::domain::uploaded_document_input::UploadedDocumentInput;
use crate::infrastructure::document::document_api_types::{
    CreateDocumentCommand, GetDocumentsQueryParams, UpdateDocumentCommand,
};
use crate::infrastructure::document::document_state::DocumentState;
use crate::infrastructure::document::document_tags::normalize_tag_names;
use auth::AuthUser;
use axum::extract::{Multipart, Path, Query, State};
use axum::response::IntoResponse;
use axum::{Json, http::StatusCode};
use backend_utils::AppResponse;
use backend_utils::app_result::ApiResult;
use serde_json::json;
use uuid::Uuid;

use super::document_dto::DocumentDto;

const PAGE_LIMIT: u32 = 100;

/**
* Loads a document by ID and checks if it belongs to the specified user.
* Returns Some(Document) if the document exists and belongs to the user, otherwise returns None.
*/
async fn load_owned_document(
    repo: &Arc<dyn crate::application::document_repository::DocumentRepository>,
    id: Uuid,
    user_id: Uuid,
) -> Option<Document> {
    let document = repo.get_document(id).await?;
    if document.user_id == user_id {
        Some(document)
    } else {
        None
    }
}

/// Creates a new document by processing multipart form data.
/// +---------+     +-----------+     +--------+     +------------------+
/// |         |     |           |     |        |     | SQLite           |
/// | Handler |---->| Tesseract |---->| Ollama |---->| documents        |
/// |         |     |           |     |        |     | tags/document_tags|
/// +---------+     +-----------+     +--------+     +------------------+
pub async fn create_document(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    mut multipart: Multipart,
) -> ApiResult<DocumentDto> {
    tracing::info!("Received multipart form data");
    let mut json_data: Option<CreateDocumentCommand> = None;
    let mut file_data = Vec::new();
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        match field.name() {
            Some("json") => {
                let text = field.text().await.unwrap();
                json_data = serde_json::from_str(&text).ok();
            }
            Some("file") => {
                tracing::info!("Processing file field");
                if let Some(name) = field.file_name() {
                    file_name = name.to_string();
                }
                file_data = field.bytes().await.unwrap().to_vec();
                tracing::info!("Received file: {}", file_name);
            }
            _ => {}
        }
    }

    if let Some(payload) = json_data {
        let document_opt = match !file_data.is_empty() {
            true => {
                let reader = document_use_cases.reader.clone();
                let summarizer = document_use_cases.summarizer.clone();
                let uploaded_document_input =
                    UploadedDocumentInput::new(file_name, file_data, user_id);
                Document::from_file(&uploaded_document_input, reader, summarizer).await
            }
            false => Some(Document::new(&payload.title, &payload.content, user_id)),
        };

        let mut document = match document_opt {
            Some(doc) => doc,
            None => {
                let err_msg = "Failed to create document from file data";
                tracing::error!(err_msg);
                return AppResponse::internal_error_from_msg(err_msg);
            }
        };

        document.tags = normalize_tag_names(&payload.tags);
        document.issued_date = payload.issued_date;
        document.expire_date = payload.expire_date;
        document.print_details();

        let repo = document_use_cases.document_repository.clone();
        let saved_doc_res = repo.save_document(document).await;
        match saved_doc_res {
            Err(e) => {
                tracing::error!("Error saving document: {}", e);
                AppResponse::internal_error(e)
            }
            Ok(saved_doc) => {
                tracing::info!("Document saved: {:?}", saved_doc.title);
                AppResponse::created(DocumentDto::from_document(&saved_doc))
            }
        }
    } else {
        let err_msg = "No valid JSON data found in the multipart form";
        tracing::warn!(err_msg);
        AppResponse::validation_error(err_msg)
    }
}

/// Creates a document from JSON metadata and an external storage reference (Proton Drive).
/// +---------+     +------------------+     +------------------+
/// |         |     | Handler          |     | SQLite           |
/// | WebApp  |---->| create_document  |---->| documents        |
/// |         |     | _json            |     | tags/document_tags|
/// +---------+     +------------------+     +------------------+
pub async fn create_document_json(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Json(payload): Json<CreateDocumentCommand>,
) -> ApiResult<DocumentDto> {
    let storage = match payload.storage {
        Some(storage) => storage.into_domain()?,
        None => {
            return AppResponse::validation_error(
                "JSON document create requires storage metadata; use multipart POST /documents for file uploads",
            );
        }
    };

    let mut document =
        Document::new_with_storage(&payload.title, &payload.content, user_id, Some(storage));
    document.tags = normalize_tag_names(&payload.tags);
    document.issued_date = payload.issued_date;
    document.expire_date = payload.expire_date;
    document.print_details();

    let repo = document_use_cases.document_repository.clone();
    match repo.save_document(document).await {
        Err(e) => {
            tracing::error!("Error saving document: {}", e);
            AppResponse::internal_error(e)
        }
        Ok(saved_doc) => {
            tracing::info!("Document saved from JSON: {:?}", saved_doc.title);
            AppResponse::created(DocumentDto::from_document(&saved_doc))
        }
    }
}

pub async fn get_document(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Path(id): Path<Uuid>,
) -> ApiResult<DocumentDto> {
    tracing::info!("Fetching document with ID: {}", id);
    let repo = document_use_cases.document_repository.clone();
    repo.load_owned_document(id, user_id).await.map_or_else(
        || AppResponse::not_found(),
        |doc| {
            tracing::info!("Document found: {:?}", doc.title);
            AppResponse::ok(DocumentDto::from_document(&doc))
        },
    )
}

/// Deletes an owned document from Life Manager (hard delete).
/// Proton Drive file removal is client-side and must happen before this call when storage exists.
///
/// +--------+     +------------------+     +--------+
/// |        |     |                  |     | SQLite |
/// | Client |---->| delete_document  |---->| DELETE |
/// |        |     | (owner check)    |     | docs   |
/// +--------+     +------------------+     +--------+
///      |                                          |
///      |  (optional, beforehand)                  |
///      +----> Proton Drive trashNodes ------------+
pub async fn delete_document(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Path(id): Path<Uuid>,
) -> ApiResult<()> {
    DeleteDocumentCommand::new(id, user_id, document_use_cases.document_repository.clone())
        .execute()
        .await
}

/// Updates an existing document from JSON metadata and optional external storage reference.
pub async fn update_document_json(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDocumentCommand>,
) -> ApiResult<DocumentDto> {
    tracing::info!("Updating document from JSON with ID: {}", id);
    let repo = document_use_cases.document_repository.clone();
    let mut document = match repo.load_owned_document(id, user_id).await {
        Some(doc) => doc,
        None => return AppResponse::not_found(),
    };

    document.apply_metadata_update(
        &payload.title,
        &payload.content,
        normalize_tag_names(&payload.tags),
        payload.issued_date,
        payload.expire_date,
    );

    if let Some(storage) = payload.storage {
        document.storage = Some(storage.into_domain()?);
    }

    document.print_details();

    match repo.update_document(document).await {
        Err(e) => {
            tracing::error!("Error updating document: {}", e);
            AppResponse::internal_error(e)
        }
        Ok(saved_doc) => {
            tracing::info!("Document updated from JSON: {:?}", saved_doc.title);
            AppResponse::ok(DocumentDto::from_document(&saved_doc))
        }
    }
}

/// Updates an existing document by processing multipart form data (optional file re-upload with OCR).
/// +---------+     +-----------+     +--------+     +------------------+
/// |         |     |           |     |        |     | SQLite           |
/// | Handler |---->| Tesseract |---->| Ollama |---->| documents        |
/// |         |     |           |     |        |     | tags/document_tags|
/// +---------+     +-----------+     +--------+     +------------------+
pub async fn update_document(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Path(id): Path<Uuid>,
    mut multipart: Multipart,
) -> ApiResult<DocumentDto> {
    tracing::info!("Received multipart update for document ID: {}", id);
    let repo = document_use_cases.document_repository.clone();
    let Some(existing) = &repo.load_owned_document(id, user_id).await else {
        return AppResponse::not_found();
    };

    let mut json_data: Option<UpdateDocumentCommand> = None;
    let mut file_data = Vec::new();
    let mut file_name = String::new();

    while let Some(field) = multipart.next_field().await.unwrap_or(None) {
        match field.name() {
            Some("json") => {
                let text = field.text().await.unwrap();
                json_data = serde_json::from_str(&text).ok();
            }
            Some("file") => {
                tracing::info!("Processing file field for update");
                if let Some(name) = field.file_name() {
                    file_name = name.to_string();
                }
                file_data = field.bytes().await.unwrap().to_vec();
                tracing::info!("Received file for update: {}", file_name);
            }
            _ => {}
        }
    }

    if let Some(payload) = json_data {
        let has_file = !file_data.is_empty();
        let document_opt = match has_file {
            true => {
                let reader = document_use_cases.reader.clone();
                let summarizer = document_use_cases.summarizer.clone();
                let uploaded_document_input =
                    UploadedDocumentInput::new(file_name, file_data, user_id);
                Document::from_file(&uploaded_document_input, reader, summarizer)
                    .await
                    .map(|ocr_doc| Document::with_preserved_identity_from(existing, ocr_doc))
            }
            false => {
                let mut document: Document = existing.clone();
                document.apply_metadata_update(
                    &payload.title,
                    &payload.content,
                    normalize_tag_names(&payload.tags),
                    payload.issued_date,
                    payload.expire_date,
                );
                Some(document)
            }
        };

        let mut document = match document_opt {
            Some(doc) => doc,
            None => {
                let err_msg = "Failed to create document from file data";
                tracing::error!(err_msg);
                return AppResponse::internal_error_from_msg(err_msg);
            }
        };

        if has_file {
            document.tags = normalize_tag_names(&payload.tags);
            document.issued_date = payload.issued_date;
            document.expire_date = payload.expire_date;
        }

        document.print_details();

        match repo.update_document(document).await {
            Err(e) => {
                tracing::error!("Error updating document: {}", e);
                AppResponse::internal_error(e)
            }
            Ok(saved_doc) => {
                tracing::info!("Document updated: {:?}", saved_doc.title);
                AppResponse::ok(DocumentDto::from_document(&saved_doc))
            }
        }
    } else {
        let err_msg = "No valid JSON data found in the multipart form";
        tracing::warn!(err_msg);
        AppResponse::validation_error(err_msg)
    }
}

/**
* NOTE: This is a testing function that doesn't guarantee order and is not suited for pagination.
*
*/
pub async fn get_documents(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
) -> impl IntoResponse {
    tracing::info!("Fetching documents for user: {}", user_id.to_string());
    let repo = document_use_cases.document_repository.clone();
    let query = GetDocumentsQuery::new(repo, user_id, PAGE_LIMIT);
    let documents = query.execute().await;
    let document_dtos: Vec<DocumentDto> =
        documents.iter().map(DocumentDto::from_document).collect();
    (StatusCode::OK, Json(json!(document_dtos)))
}

pub async fn get_documents_by_title(
    AuthUser {
        user_id,
        tenant: _tenant,
    }: AuthUser,
    State(DocumentState(document_use_cases)): State<DocumentState>,
    Query(params): Query<GetDocumentsQueryParams>,
) -> ApiResult<Vec<DocumentDto>> {
    let title = params.title.unwrap_or_else(|| "".to_string());
    tracing::info!(
        "Fetching documents for user: {} with title cursor: {}",
        user_id.to_string(),
        title
    );
    let repo = document_use_cases.document_repository.clone();
    let query = GetDocumentsTitleCursorQuery::new(repo, user_id, title, PAGE_LIMIT);
    let documents = query.execute().await;
    let document_dtos: Vec<DocumentDto> =
        documents.iter().map(DocumentDto::from_document).collect();
    AppResponse::ok(document_dtos)
}

/*
* TODO: Remove this. It is for testing only
* */
pub async fn upload(mut multipart: Multipart) {
    while let Some(field) = multipart.next_field().await.unwrap() {
        let name = field.name().unwrap().to_string();
        let data = field.bytes().await.unwrap();

        tracing::info!("Length of `{}` is {} bytes", name, data.len());
    }
}

#[cfg(test)]
mod tests {
    use std::error::Error;
    use std::sync::Arc;

    use crate::application::document_repository::DocumentRepository;
    use crate::application::document_use_cases::DocumentUseCases;
    use crate::domain::document_storage_ref::STORAGE_PROVIDER_PROTON_DRIVE;
    use crate::domain::document_summarizer::{DocumentSummarizer, DocumentSummaryResult};
    use crate::domain::document_text_reader::DocumentTextReader;
    use crate::infrastructure::document::document_collection::DocumentCollection;

    use crate::infrastructure::document::document_api_types::DocumentStorageRefDto;

    use super::*;
    use async_trait::async_trait;
    use axum::body::{Body, to_bytes};
    use axum::extract::FromRequest;
    use axum::http::{Request, StatusCode};
    use serde::de::DeserializeOwned;
    use serde_json::from_slice;
    use uuid::Uuid;

    struct MockDocumentTextReader;

    #[async_trait]
    impl DocumentTextReader for MockDocumentTextReader {
        async fn read_image(
            &self,
            _uploaded_document_input: &UploadedDocumentInput,
        ) -> Result<String, Box<dyn Error>> {
            Ok(String::from("This is test content."))
        }
    }

    struct MockDocumentSummarizer;
    #[async_trait]
    impl DocumentSummarizer for MockDocumentSummarizer {
        async fn summarize(&self, text: &str) -> Result<DocumentSummaryResult, Box<dyn Error>> {
            Ok(DocumentSummaryResult {
                summary: text.to_string(),
                title: String::from("Test Document"),
            })
        }
    }

    struct MockFailingDocumentTextReader;

    #[async_trait]
    impl DocumentTextReader for MockFailingDocumentTextReader {
        async fn read_image(
            &self,
            _uploaded_document_input: &UploadedDocumentInput,
        ) -> Result<String, Box<dyn Error>> {
            Err(Box::new(std::io::Error::other("read failed")))
        }
    }

    struct MockFailingDocumentRepository;

    #[async_trait]
    impl DocumentRepository for MockFailingDocumentRepository {
        async fn get_document(&self, _id: Uuid) -> Option<Document> {
            None
        }

        async fn get_documents(&self, _user_id: &Uuid, _limit: &u32) -> Vec<Document> {
            Vec::new()
        }

        async fn get_documents_title_cursor(
            &self,
            _user_id: &Uuid,
            _limit: &u32,
            _title: &str,
        ) -> Vec<Document> {
            Vec::new()
        }

        async fn save_document(
            &self,
            _document: Document,
        ) -> Result<Document, Box<dyn std::error::Error>> {
            Err(Box::new(std::io::Error::other("save failed")))
        }

        async fn update_document(
            &self,
            _document: Document,
        ) -> Result<Document, Box<dyn std::error::Error>> {
            Err(Box::new(std::io::Error::other("update failed")))
        }

        async fn delete_document(&self, _id: Uuid) -> Result<bool, Box<dyn std::error::Error>> {
            Err(Box::new(std::io::Error::other("delete failed")))
        }

        async fn load_owned_document(&self, id: Uuid, _user_id: Uuid) -> Option<Document> {
            self.get_document(id).await
        }
    }

    struct GivenUserAndDocuments {
        pub auth_user: AuthUser,
        pub document_use_cases: Arc<DocumentUseCases>,
        pub document1_id: Uuid,
        #[allow(dead_code)]
        pub document2_id: Uuid,
    }

    struct ProcessedResponse<T> {
        pub status_code: StatusCode,
        pub response_payload: T,
    }

    #[tokio::test]
    async fn test_create_document() {
        // Arrange
        let payload = CreateDocumentCommand {
            title: String::from("Test Document"),
            content: String::from("This is test content."),
            tags: vec!["Tax".to_string()],
            issued_date: None,
            expire_date: None,
            storage: None,
        };

        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
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

        let multipart = Multipart::from_request(request, &()).await.unwrap();
        let auth_user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        };
        let response = create_document(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            multipart,
        )
        .await
        .into_response();

        let (parts, body) = response.into_parts();
        let status_code = parts.status;
        // Assert
        assert_eq!(status_code, StatusCode::CREATED);

        let bytes = to_bytes(body, usize::MAX)
            .await
            .expect("Failed to read body");

        // Deserialize the bytes into a DocumentDto object
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is test content.");
        assert_eq!(response_document.tags, vec!["tax".to_string()]);
        assert!(!response_document.id.is_nil());
    }

    #[tokio::test]
    async fn given_valid_proton_storage_when_creating_document_json_then_returns_created() {
        let payload = CreateDocumentCommand {
            title: String::from("Proton Doc"),
            content: String::from("Manual content."),
            tags: vec!["drive".to_string()],
            issued_date: None,
            expire_date: None,
            storage: Some(DocumentStorageRefDto {
                provider: STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
                share_id: "share-123".to_string(),
                node_id: "node-456".to_string(),
                filename: "scan.pdf".to_string(),
                mime_type: Some("application/pdf".to_string()),
            }),
        };
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });

        let response = create_document_json(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            Json(payload),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::CREATED);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(response_document.title, "Proton Doc");
        assert_eq!(
            response_document
                .storage
                .as_ref()
                .map(|s| s.filename.as_str()),
            Some("scan.pdf")
        );
    }

    #[tokio::test]
    async fn given_missing_storage_when_creating_document_json_then_returns_validation_error() {
        let payload = CreateDocumentCommand {
            title: String::from("No storage"),
            content: String::from("content"),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });

        let response = create_document_json(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            Json(payload),
        )
        .await
        .into_response();

        assert_api_error_response(
            response,
            StatusCode::BAD_REQUEST,
            "validation_error",
            "JSON document create requires storage metadata; use multipart POST /documents for file uploads",
        )
        .await;
    }

    #[tokio::test]
    async fn given_invalid_proton_storage_when_creating_document_json_then_returns_validation_error()
     {
        let payload = CreateDocumentCommand {
            title: String::from("Bad storage"),
            content: String::from("content"),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: Some(DocumentStorageRefDto {
                provider: STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
                share_id: String::new(),
                node_id: "node".to_string(),
                filename: "file.pdf".to_string(),
                mime_type: None,
            }),
        };
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });

        let response = create_document_json(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            Json(payload),
        )
        .await
        .into_response();

        assert_api_error_response(
            response,
            StatusCode::BAD_REQUEST,
            "validation_error",
            "storage must be a valid proton_drive reference with share_id, node_id, and filename",
        )
        .await;
    }

    #[tokio::test]
    async fn given_multipart_without_json_when_creating_document_then_returns_validation_error() {
        // Given
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });
        let multipart = multipart_from_parts(None, true).await;

        // When
        let response = create_document(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            multipart,
        )
        .await
        .into_response();

        // Then
        assert_api_error_response(
            response,
            StatusCode::BAD_REQUEST,
            "validation_error",
            "No valid JSON data found in the multipart form",
        )
        .await;
    }

    #[tokio::test]
    async fn given_from_file_failure_when_creating_document_then_returns_internal_error() {
        // Given
        let payload = CreateDocumentCommand {
            title: String::from("Test Document"),
            content: String::from("This is test content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(DocumentCollection::new()),
            reader: Arc::new(MockFailingDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });
        let multipart =
            multipart_from_parts(Some(&serde_json::to_string(&payload).unwrap()), true).await;

        // When
        let response = create_document(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            multipart,
        )
        .await
        .into_response();

        // Then
        assert_api_error_response(
            response,
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "An internal error occurred",
        )
        .await;
    }

    #[tokio::test]
    async fn given_save_failure_when_creating_document_then_returns_internal_error() {
        // Given
        let payload = CreateDocumentCommand {
            title: String::from("Test Document"),
            content: String::from("This is test content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(MockFailingDocumentRepository {}),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });
        let multipart =
            multipart_from_parts(Some(&serde_json::to_string(&payload).unwrap()), false).await;

        // When
        let response = create_document(
            test_auth_user(),
            State(DocumentState(document_use_cases)),
            multipart,
        )
        .await
        .into_response();

        // Then
        assert_api_error_response(
            response,
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal_error",
            "An internal error occurred",
        )
        .await;
    }

    #[tokio::test]
    async fn test_get_document() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;
        let response = get_document(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
        )
        .await;

        let ProcessedResponse {
            status_code,
            response_payload: response_document,
        } = process_response::<DocumentDto>(response).await;
        // Assert
        assert_eq!(status_code, StatusCode::OK);

        assert_eq!(response_document.title, "Test Document");
        assert_eq!(response_document.content, "This is test content.");
    }

    #[tokio::test]
    async fn test_get_document_not_found() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            ..
        } = given_user_and_documents().await;

        let response = get_document(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Path(Uuid::new_v4()),
        )
        .await;
        let response = response.into_response();
        let status_code = response.status();

        // Assert
        assert_eq!(status_code, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn given_wrong_owner_when_getting_document_then_returns_not_found() {
        let GivenUserAndDocuments {
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;
        let other_user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        };

        let response = get_document(
            other_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn given_owned_document_when_deleting_then_returns_no_content() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;

        let response = delete_document(
            AuthUser {
                user_id: auth_user.user_id,
                tenant: auth_user.tenant.clone(),
            },
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let get_after = get_document(
            auth_user,
            State(DocumentState(document_use_cases)),
            Path(document1_id),
        )
        .await
        .into_response();
        assert_eq!(get_after.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn given_missing_document_when_deleting_then_returns_not_found() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            ..
        } = given_user_and_documents().await;

        let response = delete_document(
            auth_user,
            State(DocumentState(document_use_cases)),
            Path(Uuid::new_v4()),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn given_wrong_owner_when_deleting_document_then_returns_not_found() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;
        let other_user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        };

        let response = delete_document(
            other_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let get_response = get_document(
            auth_user,
            State(DocumentState(document_use_cases)),
            Path(document1_id),
        )
        .await
        .into_response();
        assert_eq!(get_response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn given_owned_document_when_updating_json_then_returns_ok_with_updated_fields() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;

        let payload = UpdateDocumentCommand {
            title: String::from("Updated Title"),
            content: String::from("Updated content."),
            tags: vec!["finance".to_string()],
            issued_date: None,
            expire_date: None,
            storage: None,
        };

        let response = update_document_json(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
            Json(payload),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(response_document.id, document1_id);
        assert_eq!(response_document.title, "Updated Title");
        assert_eq!(response_document.content, "Updated content.");
        assert_eq!(response_document.tags, vec!["finance".to_string()]);
    }

    #[tokio::test]
    async fn given_wrong_owner_when_updating_json_then_returns_not_found() {
        let GivenUserAndDocuments {
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;
        let other_user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        };

        let payload = UpdateDocumentCommand {
            title: String::from("Updated Title"),
            content: String::from("Updated content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };

        let response = update_document_json(
            other_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
            Json(payload),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn given_valid_proton_storage_when_updating_document_json_then_replaces_storage() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;

        let payload = UpdateDocumentCommand {
            title: String::from("Proton Updated"),
            content: String::from("Updated content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: Some(DocumentStorageRefDto {
                provider: STORAGE_PROVIDER_PROTON_DRIVE.to_string(),
                share_id: "share-new".to_string(),
                node_id: "node-new".to_string(),
                filename: "updated.pdf".to_string(),
                mime_type: Some("application/pdf".to_string()),
            }),
        };

        let response = update_document_json(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
            Json(payload),
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(
            response_document
                .storage
                .as_ref()
                .map(|s| s.filename.as_str()),
            Some("updated.pdf")
        );
    }

    #[tokio::test]
    async fn given_owned_document_when_updating_multipart_then_returns_ok() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            ..
        } = given_user_and_documents().await;

        let payload = UpdateDocumentCommand {
            title: String::from("Multipart Updated"),
            content: String::from("Updated via multipart."),
            tags: vec!["tagged".to_string()],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        let multipart =
            multipart_from_parts(Some(&serde_json::to_string(&payload).unwrap()), false).await;

        let response = update_document(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Path(document1_id),
            multipart,
        )
        .await
        .into_response();

        assert_eq!(response.status(), StatusCode::OK);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let response_document: DocumentDto =
            from_slice(&bytes).expect("Failed to deserialize body");
        assert_eq!(response_document.title, "Multipart Updated");
        assert_eq!(response_document.tags, vec!["tagged".to_string()]);
    }

    #[tokio::test]
    async fn test_get_documents_by_title_empty() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            ..
        } = given_user_and_documents().await;

        let response = get_documents_by_title(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Query(GetDocumentsQueryParams { title: None }),
        )
        .await;
        let ProcessedResponse {
            status_code,
            response_payload: response_documents,
        } = process_response::<Vec<DocumentDto>>(response).await;

        // Assert
        assert_eq!(status_code, StatusCode::OK);
        assert_eq!(response_documents.len(), 2); // NOTE: Check given_user_and_documents function for length
    }

    /// This tests that documents are returned in order, and we should skip the ones with a name
    /// before the one we search on.
    #[tokio::test]
    async fn test_get_documents_by_title_named() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            ..
        } = given_user_and_documents().await;

        let response = get_documents_by_title(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Query(GetDocumentsQueryParams {
                title: Some("Second Document".to_string()),
            }),
        )
        .await;
        let ProcessedResponse {
            status_code,
            response_payload: response_documents,
        } = process_response::<Vec<DocumentDto>>(response).await;

        // Assert
        assert_eq!(status_code, StatusCode::OK);
        assert_eq!(response_documents.len(), 1); // NOTE: Check given_user_and_documents function for length
    }

    /// This tests that documents are returned in order, and we should not return any when we search
    /// with the last one.
    #[tokio::test]
    async fn test_get_documents_by_title_last() {
        let GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            ..
        } = given_user_and_documents().await;

        let response = get_documents_by_title(
            auth_user,
            State(DocumentState(document_use_cases.clone())),
            Query(GetDocumentsQueryParams {
                title: Some("Test Document".to_string()),
            }), // NOTE: Check given_user_and_documents function for
                // name of last document.
        )
        .await;
        let ProcessedResponse {
            status_code,
            response_payload: response_documents,
        } = process_response::<Vec<DocumentDto>>(response).await;

        // Assert
        assert_eq!(status_code, StatusCode::OK);
        assert_eq!(response_documents.len(), 0);
    }

    async fn given_user_and_documents() -> GivenUserAndDocuments {
        let auth_user = AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        };
        let document1 = Document::new("Test Document", "This is test content.", auth_user.user_id);
        let document2 = Document::new(
            "Second Document",
            "This is the second document",
            auth_user.user_id,
        );
        let document1_id = document1.id;
        let document2_id = document2.id;
        let repo = DocumentCollection::new();
        repo.save_document(document1)
            .await
            .expect("Failed to save document to seed test");
        repo.save_document(document2)
            .await
            .expect("Failed to save document to seed test");

        let document_use_cases = Arc::new(DocumentUseCases {
            document_repository: Arc::new(repo),
            reader: Arc::new(MockDocumentTextReader {}),
            summarizer: Arc::new(MockDocumentSummarizer {}),
        });

        GivenUserAndDocuments {
            auth_user,
            document_use_cases,
            document1_id,
            document2_id,
        }
    }

    async fn process_response<T>(response: impl IntoResponse) -> ProcessedResponse<T>
    where
        T: DeserializeOwned,
    {
        let response = response.into_response();
        let status_code = response.status();
        let body = response.into_body();
        let bytes = to_bytes(body, usize::MAX)
            .await
            .expect("Failed to read body");

        let response_payload =
            serde_json::from_slice::<T>(&bytes).expect("Failed to deserialize JSON");

        ProcessedResponse {
            status_code,
            response_payload,
        }
    }

    fn test_auth_user() -> AuthUser {
        AuthUser {
            user_id: Uuid::new_v4(),
            tenant: "test-tenant".to_string(),
        }
    }

    fn build_multipart_body(json: Option<&str>, include_file: bool) -> String {
        let mut multipart_body = String::new();
        if let Some(json_string) = json {
            multipart_body.push_str(&format!(
                "--boundary\r\n\
            Content-Disposition: form-data; name=\"json\"\r\n\
            Content-Type: application/json\r\n\r\n\
            {}\r\n",
                json_string
            ));
        }
        if include_file {
            multipart_body.push_str(
                "--boundary\r\n\
            Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
            Content-Type: text/plain\r\n\r\n\
            This is test content.\r\n",
            );
        }
        multipart_body.push_str("--boundary--");
        multipart_body
    }

    async fn multipart_from_parts(json: Option<&str>, include_file: bool) -> Multipart {
        let request = Request::builder()
            .header("content-type", "multipart/form-data; boundary=boundary")
            .body(Body::from(build_multipart_body(json, include_file)))
            .unwrap();
        Multipart::from_request(request, &()).await.unwrap()
    }

    async fn assert_api_error_response(
        response: axum::response::Response,
        expected_status: StatusCode,
        expected_error: &str,
        expected_message: &str,
    ) {
        assert_eq!(response.status(), expected_status);
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("Failed to read body");
        let json: serde_json::Value =
            serde_json::from_slice(&bytes).expect("error response should be JSON");
        assert_eq!(json["error"], expected_error);
        assert_eq!(json["message"], expected_message);
    }
}
