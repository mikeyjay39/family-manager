use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::Serialize;

use crate::domain::document_storage_ref::DocumentStorageRef;

#[derive(Serialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::documents)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct DocumentEntity {
    pub id: String,
    pub title: String,
    pub content: String,
    pub user_id: String,
    pub created_at: NaiveDateTime,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
    pub storage_provider: Option<String>,
    pub storage_share_id: Option<String>,
    pub storage_node_id: Option<String>,
    pub storage_filename: Option<String>,
    pub storage_mime_type: Option<String>,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = crate::schema::documents)]
pub struct NewDocumentEntity {
    pub id: String,
    pub title: String,
    pub content: String,
    pub user_id: String,
    pub created_at: NaiveDateTime,
    pub issued_date: Option<NaiveDateTime>,
    pub expire_date: Option<NaiveDateTime>,
    pub storage_provider: Option<String>,
    pub storage_share_id: Option<String>,
    pub storage_node_id: Option<String>,
    pub storage_filename: Option<String>,
    pub storage_mime_type: Option<String>,
}

impl DocumentEntity {
    pub fn storage_ref(&self) -> Option<DocumentStorageRef> {
        storage_ref_from_columns(
            self.storage_provider.as_deref(),
            self.storage_share_id.as_deref(),
            self.storage_node_id.as_deref(),
            self.storage_filename.as_deref(),
            self.storage_mime_type.clone(),
        )
    }
}

pub fn storage_ref_from_columns(
    provider: Option<&str>,
    share_id: Option<&str>,
    node_id: Option<&str>,
    filename: Option<&str>,
    mime_type: Option<String>,
) -> Option<DocumentStorageRef> {
    let (provider, share_id, node_id, filename) = (provider?, share_id?, node_id?, filename?);
    Some(DocumentStorageRef {
        provider: provider.to_string(),
        share_id: share_id.to_string(),
        node_id: node_id.to_string(),
        filename: filename.to_string(),
        mime_type,
    })
}

pub fn storage_columns_from_ref(
    storage: &Option<DocumentStorageRef>,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    match storage {
        Some(storage) => (
            Some(storage.provider.clone()),
            Some(storage.share_id.clone()),
            Some(storage.node_id.clone()),
            Some(storage.filename.clone()),
            storage.mime_type.clone(),
        ),
        None => (None, None, None, None, None),
    }
}
