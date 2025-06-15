pub mod application {
    use crate::domain::document::Document;

    pub trait DocumentRepository {
        fn get_document(&self, id: usize) -> Option<&Document>;
        fn save_document(&mut self, document: Document) -> bool;
        fn new() -> Self;
    }
    pub struct GetDocumentQuery;
}
