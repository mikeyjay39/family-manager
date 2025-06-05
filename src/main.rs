use axum::{Router, routing::get};
use domain::document::Document;
mod domain;
use std::net::SocketAddr;
use tokio;

#[tokio::main]
async fn main() {
    // Build our application with a single route
    let app = Router::new()
        .route("/", get(handler))
        .route("/foo", get(|| async { "Hello, Foo!" }))
        .route("/bar", get(|| async { String::from("Hello, Bar!") }));

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
