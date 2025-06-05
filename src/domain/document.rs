// This will contain the code for the 'domain::document' module

// Example struct for a document
pub struct Document {
    pub id: u32,
    pub title: String,
    pub content: String,
}

impl Document {
    // Creates a new document
    pub fn new(id: u32, title: &str, content: &str) -> Self {
        Self {
            id,
            title: title.to_string(),
            content: String::from(content),
        }
    }

    // Prints the document details
    pub fn print_details(&self) {
        println!("Document ID: {}", self.id);
        println!("Title: {}", self.title);
        println!("Content: {}", self.content);
    }

    pub fn content(&self) -> &String {
        &self.content
    }

    pub fn set_content(&mut self, content: String) {
        self.content = content;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_document_creation() {
        let doc = Document::new(1, "Test Document", "This is a test content.");
        assert_eq!(doc.id, 1);
        assert_eq!(doc.title, "Test Document");
        assert_eq!(doc.content, "This is a test content.");
    }

    #[test]
    fn test_document_print_details() {
        let doc = Document::new(2, "Another Document", "Content of another document.");
        doc.print_details();
    }
}
