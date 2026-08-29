use chrono::NaiveDateTime;
use uuid::Uuid;

#[derive(Clone, Debug)]
/**
* Structure representing an uploaded document input.
*/
pub struct UploadedDocumentInput {
    /** Name of the uploaded file. */
    pub file_name: String,
    /** Raw binary data of the uploaded file. */
    pub file_data: Vec<u8>,
    pub extension: String,
    pub user_id: Uuid,
    pub title: String,
    pub content: Option<String>,
    pub tags: Vec<String>,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
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
    pub fn new(file_name: String, file_data: Vec<u8>, user_id: Uuid) -> Self {
        let extension = file_name.rsplit('.').next().unwrap_or("").to_lowercase();
        UploadedDocumentInput {
            file_name,
            file_data,
            extension,
            user_id,
        }
    }

    pub fn is_pdf(&self) -> bool {
        self.file_name.to_lowercase().ends_with(".pdf")
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
