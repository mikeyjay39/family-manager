use backend_utils::AppResult;
use uuid::Uuid;

use crate::{
    domain::uploaded_document_input::UploadedDocumentInput,
    infrastructure::document::document_api_types::CreateDocumentCommandDto,
};

pub fn from_create_to_uploaded_document_input(
    input: CreateDocumentCommandDto,
    user_id: Uuid,
    file_name: Option<String>,
    file_data: Vec<u8>,
) -> AppResult<UploadedDocumentInput> {
    Ok(UploadedDocumentInput::new(
        input.title,
        file_name,
        file_data,
        user_id,
        input.tags.clone(),
        Some(input.content.clone()),
        input.issued_date,
        input.expire_date,
        match input.storage {
            Some(storage) => Some(storage.into_domain()?),
            None => None,
        },
    ))
}
