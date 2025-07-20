mod application;
mod domain;
mod infrastructure;
use crate::domain::document::Document;
use application::application::DocumentRepository;
use axum::{
    Router,
    routing::{get, post},
};
use infrastructure::{
    app_state::AppState,
    document_collection::DocumentCollection,
    document_handler::{create_document, get_document, upload},
};
use std::net::SocketAddr;
use std::sync::Arc;

#[tokio::main]
pub async fn start_server() {
    // Build our application with a single route
    let state: Arc<AppState<DocumentCollection>> = Arc::new(AppState {
        document_repository: Arc::new(tokio::sync::Mutex::new(DocumentCollection::new())),
    });
    let app = Router::new()
        .route("/", get(handler))
        .route("/foo", get(|| async { "Hello, Foo!" }))
        .route("/bar", get(|| async { String::from("Hello, Bar!") }))
        .route("/documents", post(create_document))
        .route("/documents/:id", get(get_document))
        .route("/upload", post(upload)) // TODO: Remove this after testing
        .with_state(state);

    // Define the address to run the server on
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("Listening on http://{}", addr);

    // Run the server
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

// Define a handler for the route
async fn handler() -> String {
    let document = Document::new(123, "Test", "This is a test document.");
    document.print_details();
    println!("{}", document.content);
    String::from(document.content)
}
