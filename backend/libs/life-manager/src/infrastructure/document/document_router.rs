use axum::{
    Router,
    routing::{get, post},
};

use crate::infrastructure::{
    app_state::LifeManagerState,
    document::document_handler::{create_document, create_document_json, get_document, get_documents_by_title},
};

pub fn document_router() -> Router<LifeManagerState> {
    Router::new()
        .route("/", post(create_document))
        .route("/json", post(create_document_json))
        .route("/{id}", get(get_document))
        .route("/", get(get_documents_by_title))
}
