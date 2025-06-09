pub trait DocumentRepository {
    fn get_document(&self, id: usize) -> Option<&Document>;
    fn save_document(&self, document: Document) -> bool;
}
