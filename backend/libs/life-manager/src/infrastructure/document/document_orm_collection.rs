use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;

use crate::application::document_repository::DocumentRepository;
use crate::infrastructure::document::document_tags::{
    load_tags_by_document_ids, persist_document_tags, replace_document_tags,
};
use crate::schema::documents;
use crate::{
    domain::document::Document,
    infrastructure::document::document_entity::{
        DocumentEntity, NewDocumentEntity, UpdateDocumentEntity, storage_columns_from_ref,
    },
};
use async_trait::async_trait;
use deadpool_diesel::sqlite::Pool;
use diesel::{Connection, ExpressionMethods, QueryDsl, QueryResult, RunQueryDsl, SelectableHelper};
use uuid::Uuid;

#[derive(Clone)]
pub struct DocumentOrmCollection {
    pub pool: Arc<Pool>,
}

impl DocumentOrmCollection {
    pub fn new(pool: Arc<Pool>) -> Self {
        DocumentOrmCollection { pool }
    }
}

#[async_trait]
impl DocumentRepository for DocumentOrmCollection {
    async fn get_document(&self, id: Uuid) -> Option<Document> {
        tracing::info!("Retrieving document with ID: {}", id);
        let conn = self
            .pool
            .get()
            .await
            .expect("Failed to get DB connection from pool");

        let id_str = id.to_string();
        let result = conn
            .interact(
                move |conn| -> QueryResult<(DocumentEntity, HashMap<String, Vec<String>>)> {
                    let entity = documents::table
                        .filter(documents::id.eq(id_str))
                        .select(DocumentEntity::as_select())
                        .get_result(conn)?;

                    let tags_by_document_id =
                        load_tags_by_document_ids(conn, std::slice::from_ref(&entity.id))?;
                    Ok((entity, tags_by_document_id))
                },
            )
            .await;

        match result {
            Ok(r) => match r {
                Ok((entity, tags_by_document_id)) => {
                    let doc_id = Uuid::parse_str(&entity.id).ok()?;
                    let user_id = Uuid::parse_str(&entity.user_id).ok()?;
                    let tags = tags_by_document_id
                        .get(&entity.id)
                        .cloned()
                        .unwrap_or_default();
                    Some(Document::with_id(
                        doc_id,
                        &entity.title,
                        &entity.content,
                        user_id,
                        tags,
                        entity.created_at,
                        entity.issued_date,
                        entity.expire_date,
                        entity.storage_ref(),
                    ))
                }
                Err(e) => {
                    tracing::error!("Database error retrieving document {}: {}", id, e);
                    None
                }
            },
            Err(e) => {
                tracing::error!("Error retrieving document: {}", e);
                None
            }
        }
    }

    async fn get_documents(&self, user_id: &Uuid, limit: &u32) -> Vec<Document> {
        let conn = match self.pool.get().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::error!("Could not get db connection for get_documents: {}", e);
                return vec![];
            }
        };

        let user_id_str = user_id.to_string();
        let limit = *limit as i64;

        let result = conn
            .interact(
                move |conn| -> QueryResult<(Vec<DocumentEntity>, HashMap<String, Vec<String>>)> {
                    let entities = documents::table
                        .filter(documents::user_id.eq(user_id_str))
                        .limit(limit)
                        .select(DocumentEntity::as_select())
                        .get_results(conn)?;

                    let document_ids: Vec<String> = entities.iter().map(|e| e.id.clone()).collect();
                    let tags_by_document_id = load_tags_by_document_ids(conn, &document_ids)?;
                    Ok((entities, tags_by_document_id))
                },
            )
            .await;

        match result {
            Ok(r) => match r {
                Ok((entities, tags_by_document_id)) => entities
                    .into_iter()
                    .filter_map(|e| {
                        let doc_id = Uuid::parse_str(&e.id).ok()?;
                        let user_id = Uuid::parse_str(&e.user_id).ok()?;
                        let tags = tags_by_document_id.get(&e.id).cloned().unwrap_or_default();
                        Some(Document::with_id(
                            doc_id,
                            &e.title,
                            &e.content,
                            user_id,
                            tags,
                            e.created_at,
                            e.issued_date,
                            e.expire_date,
                            e.storage_ref(),
                        ))
                    })
                    .collect(),
                Err(e) => {
                    tracing::error!("Database error retrieving documents: {}", e);
                    vec![]
                }
            },
            Err(e) => {
                tracing::error!("Error retrieving documents: {}", e);
                vec![]
            }
        }
    }

    async fn get_documents_title_cursor(
        &self,
        user_id: &Uuid,
        limit: &u32,
        title: &str,
    ) -> Vec<Document> {
        let conn = match self.pool.get().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::error!("Could not get db connection: {}", e);
                return vec![];
            }
        };

        let user_id_str = user_id.to_string();
        let limit = *limit as i64;
        let title = title.to_owned();

        let result = conn
            .interact(
                move |conn| -> QueryResult<(Vec<DocumentEntity>, HashMap<String, Vec<String>>)> {
                    let entities = documents::table
                        .filter(documents::user_id.eq(user_id_str))
                        .filter(documents::title.gt(title))
                        .order_by(documents::title.asc())
                        .limit(limit)
                        .select(DocumentEntity::as_select())
                        .get_results(conn)?;

                    let document_ids: Vec<String> = entities.iter().map(|e| e.id.clone()).collect();
                    let tags_by_document_id = load_tags_by_document_ids(conn, &document_ids)?;
                    Ok((entities, tags_by_document_id))
                },
            )
            .await;

        match result {
            Ok(r) => match r {
                Ok((entities, tags_by_document_id)) => entities
                    .into_iter()
                    .filter_map(|e| {
                        let doc_id = Uuid::parse_str(&e.id).ok()?;
                        let user_id = Uuid::parse_str(&e.user_id).ok()?;
                        let tags = tags_by_document_id.get(&e.id).cloned().unwrap_or_default();
                        Some(Document::with_id(
                            doc_id,
                            &e.title,
                            &e.content,
                            user_id,
                            tags,
                            e.created_at,
                            e.issued_date,
                            e.expire_date,
                            e.storage_ref(),
                        ))
                    })
                    .collect(),
                Err(e) => {
                    tracing::error!("Database error retrieving documents by title cursor: {}", e);
                    vec![]
                }
            },
            Err(e) => {
                tracing::error!("Error retrieving documents by title cursor: {}", e);
                vec![]
            }
        }
    }

    async fn save_document(&self, document: Document) -> Result<Document, Box<dyn Error>> {
        let conn = self.pool.get().await?;
        let (
            storage_provider,
            storage_share_id,
            storage_node_id,
            storage_filename,
            storage_mime_type,
        ) = storage_columns_from_ref(&document.storage);
        let new_document = NewDocumentEntity {
            id: document.id.to_string(),
            title: document.title.clone(),
            content: document.content.clone(),
            user_id: document.user_id.to_string(),
            created_at: document.created_at,
            issued_date: document.issued_date,
            expire_date: document.expire_date,
            storage_provider,
            storage_share_id,
            storage_node_id,
            storage_filename,
            storage_mime_type,
        };
        let tag_names = document.tags.clone();
        let tag_names_for_return = tag_names.clone();
        let doc_id = document.id;
        let title = document.title.clone();
        let content = document.content.clone();
        let user_id = document.user_id;
        let storage = document.storage.clone();

        let result = conn
            .interact(move |conn| -> QueryResult<DocumentEntity> {
                conn.transaction(|conn| {
                    let saved_doc = diesel::insert_into(documents::table)
                        .values(&new_document)
                        .returning(DocumentEntity::as_returning())
                        .get_result::<DocumentEntity>(conn)?;
                    persist_document_tags(conn, &saved_doc.id, &tag_names)?;
                    Ok(saved_doc)
                })
            })
            .await;

        match result {
            Ok(success) => match success {
                Ok(saved_doc) => {
                    tracing::info!("Document saved with ID: {}", doc_id);
                    Ok(Document::with_id(
                        doc_id,
                        &title,
                        &content,
                        user_id,
                        tag_names_for_return,
                        saved_doc.created_at,
                        saved_doc.issued_date,
                        saved_doc.expire_date,
                        storage,
                    ))
                }
                Err(e) => {
                    tracing::error!("Error saving document: {}", e);
                    Err(Box::new(e))
                }
            },
            Err(e) => {
                tracing::error!("Error saving document: {}", e);
                Err(Box::new(e))
            }
        }
    }

    async fn update_document(&self, document: Document) -> Result<Document, Box<dyn Error>> {
        let conn = self.pool.get().await?;
        let (
            storage_provider,
            storage_share_id,
            storage_node_id,
            storage_filename,
            storage_mime_type,
        ) = storage_columns_from_ref(&document.storage);
        let update_entity = UpdateDocumentEntity {
            title: document.title.clone(),
            content: document.content.clone(),
            issued_date: document.issued_date,
            expire_date: document.expire_date,
            storage_provider,
            storage_share_id,
            storage_node_id,
            storage_filename,
            storage_mime_type,
        };
        let tag_names = document.tags.clone();
        let tag_names_for_return = tag_names.clone();
        let doc_id = document.id;
        let doc_id_str = document.id.to_string();
        let title = document.title.clone();
        let content = document.content.clone();
        let user_id = document.user_id;
        let storage = document.storage.clone();

        let result = conn
            .interact(move |conn| -> QueryResult<DocumentEntity> {
                conn.transaction(|conn| {
                    let updated_doc =
                        diesel::update(documents::table.filter(documents::id.eq(&doc_id_str)))
                            .set(&update_entity)
                            .returning(DocumentEntity::as_returning())
                            .get_result::<DocumentEntity>(conn)?;
                    replace_document_tags(conn, &updated_doc.id, &tag_names)?;
                    Ok(updated_doc)
                })
            })
            .await;

        match result {
            Ok(success) => match success {
                Ok(saved_doc) => {
                    tracing::info!("Document updated with ID: {}", doc_id);
                    Ok(Document::with_id(
                        doc_id,
                        &title,
                        &content,
                        user_id,
                        tag_names_for_return,
                        saved_doc.created_at,
                        saved_doc.issued_date,
                        saved_doc.expire_date,
                        storage,
                    ))
                }
                Err(e) => {
                    tracing::error!("Error updating document: {}", e);
                    Err(Box::new(e))
                }
            },
            Err(e) => {
                tracing::error!("Error updating document: {}", e);
                Err(Box::new(e))
            }
        }
    }

    async fn load_owned_document(&self, id: Uuid, user_id: Uuid) -> Option<Document> {
        let document = self.get_document(id).await?;
        if document.user_id == user_id {
            Some(document)
        } else {
            tracing::warn!(
                "Document {} is not owned by user {}. Access denied.",
                id,
                user_id
            );
            None
        }
    }

    async fn delete_document(&self, id: Uuid) -> Result<bool, Box<dyn std::error::Error>> {
        tracing::info!("Deleting document with ID: {}", id);
        let conn = self.pool.get().await?;
        let id_str = id.to_string();

        let result = conn
            .interact(move |conn| -> QueryResult<usize> {
                diesel::delete(documents::table.filter(documents::id.eq(id_str))).execute(conn)
            })
            .await;

        match result {
            Ok(Ok(rows)) => {
                tracing::info!("Document delete affected {} row(s) for ID: {}", rows, id);
                Ok(rows > 0)
            }
            Ok(Err(e)) => {
                tracing::error!("Error deleting document: {}", e);
                Err(Box::new(e))
            }
            Err(e) => {
                tracing::error!("Error deleting document: {}", e);
                Err(Box::new(e))
            }
        }
    }
}
