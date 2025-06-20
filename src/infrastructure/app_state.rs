use std::sync::Arc;
use tokio::sync::Mutex;

use crate::application::application::DocumentRepository;

#[derive(Clone, Debug)]
pub struct AppState<T: DocumentRepository> {
    pub document_repository: Arc<Mutex<T>>,
}
