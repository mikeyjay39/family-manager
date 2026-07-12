mod common;

use std::fs;

use axum_test::TestServer;
use chrono::NaiveDate;
use life_manager::infrastructure::document::{
    document_api_types::CreateDocumentCommand, document_dto::DocumentDto,
};
use reqwest::multipart::{Form, Part};
use serial_test::serial;
use tracing_test::traced_test;

use crate::common::setup::{
    build_auth_header, run_test_with_all_containers, run_test_with_test_profile,
};
use reqwest::ClientBuilder;
use reqwest::StatusCode;
use std::time::Duration;

const DOCUMENTS_URL: &str = "/life-manager/api/v1/documents";

#[tokio::test]
#[serial]
#[traced_test]
#[ignore]
async fn create_and_get_document_docker_compose() {
    run_test_with_all_containers(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        // Make REST API call to create a document
        let payload = CreateDocumentCommand {
            title: String::from("Integration Test Document"),
            content: String::from("This is a test content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };

        let json_string = serde_json::to_string(&payload).unwrap();
        let file_name = "tests/resources/hello_world.pdf";
        let file_bytes = fs::read(file_name)
            .unwrap_or_else(|_| panic!("Could not read bytes from file: {}", file_name));

        let form = Form::new()
            .part(
                "json",
                Part::text(json_string.to_string())
                    .mime_str("application/json")
                    .expect("Could not set mime type to json"),
            )
            .part(
                "file",
                Part::bytes(file_bytes)
                    .file_name("hello_world.pdf")
                    .mime_str("application/pdf")
                    .expect("Could not set mime type to pdf"),
            );

        let url_result = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL");
        let url = url_result.as_str();
        tracing::info!("URL: {}", url);

        let client = ClientBuilder::new()
            .timeout(Duration::from_secs(30)) // Total request timeout
            .build()
            .expect("Failed to build HTTP client");
        let res = match client
            .post(url)
            .multipart(form)
            .header("Authorization", &auth_header)
            .send()
            .await
        {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Response: {:?}", res);
        assert!(
            res.status().is_success(),
            "Response status was not successful: {}",
            res.error_for_status().unwrap_err()
        );
        let saved_document_resp: DocumentDto = res.json().await.unwrap();

        // Verify the document was created in the database
        let get_request_url_result = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, &saved_document_resp.id))
            .expect("Failed to get server URL");
        let get_request_url = get_request_url_result.as_str();
        tracing::info!("Get Request URL: {}", get_request_url);

        let get_response = reqwest::Client::new()
            .get(get_request_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        tracing::info!("Get Response: {:?}", get_response);
        assert!(get_response.status().is_success());
        let document: DocumentDto = get_response.json().await.unwrap();
        assert_ne!(document.title.len(), 0); // TODO: Make this match our input title
        assert!(
            document.content.to_lowercase().contains("hello"),
            "{}",
            format!(
                "Document content does not contain expected text. Content: {}",
                document.content.as_str()
            )
        );
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn create_and_get_document() {
    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        // Make REST API call to create a document
        let payload = CreateDocumentCommand {
            title: String::from("Integration Test Document"),
            content: String::from("This is a test content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };

        let json_string = serde_json::to_string(&payload).unwrap();
        let file_name = "tests/resources/hello_world.pdf";
        let file_bytes = fs::read(file_name)
            .unwrap_or_else(|_| panic!("Could not read bytes from file: {}", file_name));

        let form = Form::new()
            .part(
                "json",
                Part::text(json_string.to_string())
                    .mime_str("application/json")
                    .expect("Could not set mime type to json"),
            )
            .part(
                "file",
                Part::bytes(file_bytes)
                    .file_name("hello_world.pdf")
                    .mime_str("application/pdf")
                    .expect("Could not set mime type to pdf"),
            );

        let url_result = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL");
        let url = url_result.as_str();
        tracing::info!("URL: {}", url);

        let client = ClientBuilder::new()
            .build()
            .expect("Failed to build HTTP client");
        let res = match client
            .post(url)
            .multipart(form)
            .header("Authorization", &auth_header)
            .send()
            .await
        {
            Ok(response) => response,
            Err(e) => panic!("Failed to send request: {}", e),
        };
        tracing::info!("Response: {:?}", res);
        assert!(
            res.status().is_success(),
            "Response status was not successful: {}",
            res.error_for_status().unwrap_err()
        );
        let saved_document_resp: DocumentDto = res.json().await.unwrap();

        // Verify the document was created in the database
        let get_request_url_result = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, &saved_document_resp.id))
            .expect("Failed to get server URL");
        let get_request_url = get_request_url_result.as_str();
        tracing::info!("Get Request URL: {}", get_request_url);

        let get_response = reqwest::Client::new()
            .get(get_request_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        tracing::info!("Get Response: {:?}", get_response);
        assert!(get_response.status().is_success());
        let document: DocumentDto = get_response.json().await.unwrap();
        assert_ne!(document.title.len(), 0); // TODO: Make this match our input title
        assert!(
            document.content.to_lowercase().contains("hello"),
            "{}",
            format!(
                "Document content does not contain expected text. Content: {}",
                document.content.as_str()
            )
        );
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn create_and_get_document_no_file() {
    run_test_with_test_profile(|server: TestServer| async move {
        // Login to get a token
        let auth_header = build_auth_header(&server).await;

        // Seed 1 document into the database
        let payload = CreateDocumentCommand {
            title: String::from("Integration Test Document"),
            content: String::from("This is a test content."),
            tags: vec![],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        // Make REST API call to create a document
        let json_string = serde_json::to_string(&payload).unwrap();

        let multipart_body = format!(
            "--boundary\r\n\
        Content-Disposition: form-data; name=\"json\"\r\n\
        Content-Type: application/json\r\n\r\n\
        {}\r\n\
        --boundary--",
            json_string
        );

        let url_result = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL");
        let url = url_result.as_str();
        tracing::info!("URL: {}", url);
        let res = reqwest::Client::new()
            .post(url)
            .body(multipart_body)
            .header("Content-Type", "multipart/form-data; boundary=boundary")
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        tracing::info!("Response: {:?}", res);
        assert!(res.status().is_success());

        let response_document = res.json::<DocumentDto>().await.unwrap();

        // Verify the document was created in the database

        let get_request_url_result = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, &response_document.id))
            .expect("Failed to get server URL");
        let get_request_url = get_request_url_result.as_str();
        tracing::info!("Get Request URL: {}", get_request_url);
        let get_response = reqwest::Client::new()
            .get(get_request_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        tracing::info!("Get Response: {:?}", get_response);
        assert!(get_response.status().is_success());
        let document: DocumentDto = get_response.json().await.unwrap();
        assert_eq!(document.title, payload.title);
        assert_eq!(document.content, payload.content);
        assert!(document.tags.is_empty());
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn create_and_get_document_with_dates() {
    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        let issued_date = NaiveDate::from_ymd_opt(2024, 6, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap();
        let expire_date = NaiveDate::from_ymd_opt(2026, 6, 1)
            .unwrap()
            .and_hms_opt(0, 0, 0)
            .unwrap();

        let payload = CreateDocumentCommand {
            title: String::from("Dated Integration Test Document"),
            content: String::from("This is a test content with dates."),
            tags: vec![],
            issued_date: Some(issued_date),
            expire_date: Some(expire_date),
            storage: None,
        };
        let json_string = serde_json::to_string(&payload).unwrap();

        let multipart_body = format!(
            "--boundary\r\n\
        Content-Disposition: form-data; name=\"json\"\r\n\
        Content-Type: application/json\r\n\r\n\
        {}\r\n\
        --boundary--",
            json_string
        );

        let url_result = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL");
        let url = url_result.as_str();

        let res = reqwest::Client::new()
            .post(url)
            .body(multipart_body)
            .header("Content-Type", "multipart/form-data; boundary=boundary")
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        assert!(res.status().is_success());

        let response_document = res.json::<DocumentDto>().await.unwrap();
        assert_eq!(response_document.issued_date, Some(issued_date));
        assert_eq!(response_document.expire_date, Some(expire_date));

        let get_request_url = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, &response_document.id))
            .expect("Failed to get server URL")
            .to_string();

        let get_response = reqwest::Client::new()
            .get(get_request_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        assert!(get_response.status().is_success());

        let document: DocumentDto = get_response.json().await.unwrap();
        assert_eq!(document.title, payload.title);
        assert_eq!(document.content, payload.content);
        assert_eq!(document.issued_date, Some(issued_date));
        assert_eq!(document.expire_date, Some(expire_date));
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn create_and_get_document_with_tags() {
    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        let payload = CreateDocumentCommand {
            title: String::from("Tagged Integration Test Document"),
            content: String::from("This is a test content."),
            tags: vec!["finance".to_string(), "Tax".to_string()],
            issued_date: None,
            expire_date: None,
            storage: None,
        };
        let json_string = serde_json::to_string(&payload).unwrap();

        let multipart_body = format!(
            "--boundary\r\n\
        Content-Disposition: form-data; name=\"json\"\r\n\
        Content-Type: application/json\r\n\r\n\
        {}\r\n\
        --boundary--",
            json_string
        );

        let url = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL")
            .to_string();

        let res = reqwest::Client::new()
            .post(&url)
            .body(multipart_body)
            .header("Content-Type", "multipart/form-data; boundary=boundary")
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        assert!(res.status().is_success());

        let response_document = res.json::<DocumentDto>().await.unwrap();
        assert_eq!(
            response_document.tags,
            vec!["finance".to_string(), "tax".to_string()]
        );

        let get_url = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, response_document.id))
            .expect("Failed to get server URL")
            .to_string();
        let get_response = reqwest::Client::new()
            .get(&get_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");
        assert!(get_response.status().is_success());

        let document: DocumentDto = get_response.json().await.unwrap();
        assert_eq!(document.title, payload.title);
        assert_eq!(document.content, payload.content);
        assert!(document.tags.contains(&"finance".to_string()));
        assert!(document.tags.contains(&"tax".to_string()));
        assert_eq!(document.tags.len(), payload.tags.len());
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn given_multipart_without_json_when_creating_document_then_returns_validation_error() {
    run_test_with_test_profile(|server: TestServer| async move {
        // Given
        let auth_header = build_auth_header(&server).await;
        let multipart_body = "--boundary\r\n\
            Content-Disposition: form-data; name=\"file\"; filename=\"test.txt\"\r\n\
            Content-Type: text/plain\r\n\r\n\
            This is test content.\r\n\
            --boundary--";

        let url = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL")
            .to_string();

        // When
        let res = reqwest::Client::new()
            .post(&url)
            .body(multipart_body)
            .header("Content-Type", "multipart/form-data; boundary=boundary")
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");

        // Then
        assert_validation_error_response(res).await;
    })
    .await;
}

#[tokio::test]
#[serial]
#[traced_test]
async fn get_all_documents() {
    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        // Create multiple documents
        let documents_to_create = vec![
            CreateDocumentCommand {
                title: String::from("First Document"),
                content: String::from("Content of first document"),
                tags: vec![],
                issued_date: None,
                expire_date: None,
                storage: None,
            },
            CreateDocumentCommand {
                title: String::from("Second Document"),
                content: String::from("Content of second document"),
                tags: vec![],
                issued_date: None,
                expire_date: None,
                storage: None,
            },
            CreateDocumentCommand {
                title: String::from("Third Document"),
                content: String::from("Content of third document"),
                tags: vec![],
                issued_date: None,
                expire_date: None,
                storage: None,
            },
        ];

        // Create each document
        for payload in &documents_to_create {
            let json_string = serde_json::to_string(&payload).unwrap();

            let multipart_body = format!(
                "--boundary\r\n\
            Content-Disposition: form-data; name=\"json\"\r\n\
            Content-Type: application/json\r\n\r\n\
            {}\r\n\
            --boundary--",
                json_string
            );

            let url_result = server
                .server_url(DOCUMENTS_URL)
                .expect("Failed to get server URL");
            let url = url_result.as_str();

            let res = reqwest::Client::new()
                .post(url)
                .body(multipart_body)
                .header("Content-Type", "multipart/form-data; boundary=boundary")
                .header("Authorization", &auth_header)
                .send()
                .await
                .expect("Failed to send request");

            assert!(
                res.status().is_success(),
                "Failed to create document with title: {}",
                payload.title
            );
        }

        // Now test the GET endpoint to retrieve all documents
        let get_all_url_result = server
            .server_url(DOCUMENTS_URL)
            .expect("Failed to get server URL");
        let get_all_url = get_all_url_result.as_str();
        tracing::info!("GET All Documents URL: {}", get_all_url);

        let get_response = reqwest::Client::new()
            .get(get_all_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send GET request");

        tracing::info!("GET Response status: {:?}", get_response.status());
        assert!(
            get_response.status().is_success(),
            "GET all documents failed with status: {}",
            get_response.status()
        );

        let documents: Vec<DocumentDto> = get_response
            .json()
            .await
            .expect("Failed to parse response as Vec<DocumentDto>");

        // Verify we got at least the documents we created
        assert!(
            documents.len() >= 3,
            "Expected at least 3 documents, got {}",
            documents.len()
        );

        // Verify that our created documents are in the response
        for expected_doc in &documents_to_create {
            let found = documents
                .iter()
                .any(|doc| doc.title == expected_doc.title && doc.content == expected_doc.content);
            assert!(
                found,
                "Document with title '{}' not found in response",
                expected_doc.title
            );
        }

        tracing::info!("Successfully retrieved {} documents", documents.len());

        // Test title query parameter
        let get_all_url_result = server
            .server_url("/life-manager/api/v1/documents?title=First")
            .expect("Failed to get server URL");
        let get_all_url = get_all_url_result.as_str();
        tracing::info!("GET All Documents URL: {}", get_all_url);

        let get_response = reqwest::Client::new()
            .get(get_all_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send GET request");

        tracing::info!("GET Response status: {:?}", get_response.status());
        assert!(
            get_response.status().is_success(),
            "GET all documents failed with status: {}",
            get_response.status()
        );

        let documents: Vec<DocumentDto> = get_response
            .json()
            .await
            .expect("Failed to parse response as Vec<DocumentDto>");

        // Verify we got at least the documents we created
        assert!(
            documents.len() >= 2,
            "Expected at least 3 documents, got {}",
            documents.len()
        );
    })
    .await;
}

const DOCUMENTS_JSON_URL: &str = "/life-manager/api/v1/documents/json";

#[tokio::test]
#[serial]
#[traced_test]
async fn create_and_get_document_json_with_proton_storage() {
    use life_manager::infrastructure::document::document_api_types::DocumentStorageRefDto;

    run_test_with_test_profile(|server: TestServer| async move {
        let auth_header = build_auth_header(&server).await;

        let payload = CreateDocumentCommand {
            title: String::from("Proton-backed document"),
            content: String::from("Manual summary text."),
            tags: vec!["proton".to_string()],
            issued_date: None,
            expire_date: None,
            storage: Some(DocumentStorageRefDto {
                provider: "proton_drive".to_string(),
                share_id: "share-integration".to_string(),
                node_id: "node-integration".to_string(),
                filename: "receipt.pdf".to_string(),
                mime_type: Some("application/pdf".to_string()),
            }),
        };

        let url = server
            .server_url(DOCUMENTS_JSON_URL)
            .expect("Failed to get server URL")
            .to_string();

        let res = reqwest::Client::new()
            .post(&url)
            .json(&payload)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send request");

        assert!(
            res.status().is_success(),
            "JSON create failed: {}",
            res.status()
        );

        let saved: DocumentDto = res.json().await.unwrap();
        assert_eq!(saved.title, "Proton-backed document");
        assert_eq!(saved.tags, vec!["proton".to_string()]);
        assert_eq!(
            saved.storage.as_ref().map(|s| s.filename.as_str()),
            Some("receipt.pdf")
        );

        let get_url = server
            .server_url(&format!("{}/{}", DOCUMENTS_URL, saved.id))
            .expect("Failed to get server URL")
            .to_string();

        let get_response = reqwest::Client::new()
            .get(&get_url)
            .header("Authorization", &auth_header)
            .send()
            .await
            .expect("Failed to send get request");

        assert!(get_response.status().is_success());
        let document: DocumentDto = get_response.json().await.unwrap();
        assert_eq!(
            document.storage.as_ref().map(|s| s.node_id.as_str()),
            Some("node-integration")
        );
    })
    .await;
}

async fn assert_validation_error_response(res: reqwest::Response) {
    assert_eq!(
        res.status(),
        StatusCode::BAD_REQUEST,
        "expected 400 Bad Request, got {}",
        res.status()
    );

    let body: serde_json::Value = res
        .json()
        .await
        .expect("validation error response should be JSON");

    assert_eq!(body["error"], "validation_error");
    assert_eq!(
        body["message"],
        "No valid JSON data found in the multipart form"
    );
}
