use chrono::NaiveDateTime;
use uuid::Uuid;

use crate::domain::document_storage_ref::DocumentStorageRef;

#[derive(Clone, Debug)]
/**
* Structure representing an uploaded document input.
*/
pub struct UploadedDocumentInput {
    /** Name of the uploaded file. */
    pub file_name: Option<String>,
    /** Raw binary data of the uploaded file. */
    pub file_data: Vec<u8>,
    pub extension: Option<String>,
    pub user_id: Uuid,
    pub title: String,
    pub content: Option<String>,
    pub tags: Vec<String>,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
    pub storage: Option<DocumentStorageRef>,
}

impl UploadedDocumentInput {
    /**
     * Creates a new `UploadedDocumentInput`.
     *
     * # Arguments
     *
     * * `file_name` - The name of the uploaded file.
     * * `file_data` - The raw binary data of the uploaded file.
     * * `user_id` - The ID of the user who uploaded the document.
     *
     * # Returns
     *
     * A new instance of `UploadedDocumentInput`.
     */
    pub fn new(
        title: String,
        file_name: Option<String>,
        file_data: Vec<u8>,
        user_id: Uuid,
        tags: Vec<String>,
        content: Option<String>,
        issued_date: Option<NaiveDateTime>,
        expire_date: Option<NaiveDateTime>,
        storage: Option<DocumentStorageRef>,
    ) -> Self {
        let extension = match &file_name {
            Some(name) => name.split('.').last().map(|s| s.to_string()),
            None => None,
        };
        UploadedDocumentInput {
            title,
            file_name,
            file_data,
            extension,
            user_id,
            tags,
            content,
            issued_date,
            expire_date,
            storage,
        }
    }

    pub fn is_pdf(&self) -> bool {
        match &self.file_name {
            Some(name) => name.to_lowercase().ends_with(".pdf"),
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs::File;
    use std::io::Read;
    use std::path::PathBuf;

    use uuid::Uuid;

    use super::UploadedDocumentInput;

    fn test_resources_path(file_name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/resources")
            .join(file_name)
    }

    #[test]
    pub fn test_new() {
        let file_name = "hello_world.png";
        let path = test_resources_path(file_name);
        let mut file = File::open(path).expect("Failed to open the file");
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .expect("Failed to read the file");
        let buffer_length = buffer.len();
        let uploaded_document_input =
            UploadedDocumentInput::new(file_name.to_string(), buffer, Uuid::new_v4());
        assert_eq!(uploaded_document_input.extension, "png");
        assert_eq!(uploaded_document_input.file_name, file_name);
        assert_eq!(uploaded_document_input.file_data.len(), buffer_length);
    }
}
