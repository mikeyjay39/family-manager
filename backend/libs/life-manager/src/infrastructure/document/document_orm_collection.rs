use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;

use crate::application::document_repository::DocumentRepository;
use crate::infrastructure::document::document_tag_loader::load_tags_by_document_ids;
use crate::schema::documents;
use crate::{
    domain::document::Document,
    infrastructure::document::document_entity::{DocumentEntity, NewDocumentEntity},
};
use async_trait::async_trait;
use deadpool_diesel::sqlite::Pool;
use diesel::{ExpressionMethods, QueryDsl, QueryResult, RunQueryDsl, SelectableHelper};
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
            .interact(move |conn| -> QueryResult<(DocumentEntity, HashMap<String, Vec<String>>)> {
                let entity = documents::table
                    .filter(documents::id.eq(id_str))
                    .select(DocumentEntity::as_select())
                    .get_result(conn)?;

                let tags_by_document_id =
                    load_tags_by_document_ids(conn, std::slice::from_ref(&entity.id))?;
                Ok((entity, tags_by_document_id))
            })
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
                    ))
                }
                Err(_) => None,
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
                        let tags = tags_by_document_id
                            .get(&e.id)
                            .cloned()
                            .unwrap_or_default();
                        Some(Document::with_id(
                            doc_id,
                            &e.title,
                            &e.content,
                            user_id,
                            tags,
                        ))
                    })
                    .collect(),
                Err(_) => vec![],
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
                        let tags = tags_by_document_id
                            .get(&e.id)
                            .cloned()
                            .unwrap_or_default();
                        Some(Document::with_id(
                            doc_id,
                            &e.title,
                            &e.content,
                            user_id,
                            tags,
                        ))
                    })
                    .collect(),
                Err(_) => vec![],
            },
            Err(e) => {
                tracing::error!("Error retrieving documents: {}", e);
                vec![]
            }
        }
    }

    async fn save_document(&self, document: Document) -> Result<Document, Box<dyn Error>> {
        let conn = self.pool.get().await?;
        let new_document = NewDocumentEntity {
            id: document.id.to_string(),
            title: document.title.clone(),
            content: document.content.clone(),
            user_id: document.user_id.to_string(),
        };

        let result = conn
            .interact(move |conn| {
                diesel::insert_into(documents::table)
                    .values(&new_document)
                    .returning(DocumentEntity::as_returning())
                    .get_result::<DocumentEntity>(conn)
            })
            .await;

        match result {
            Ok(success) => match success {
                Ok(saved_doc) => {
                    tracing::info!("Document saved with ID: {}", saved_doc.id);
                    let doc_id = Uuid::parse_str(&saved_doc.id)?;
                    let user_id = Uuid::parse_str(&saved_doc.user_id)?;
                    Ok(Document::with_id(
                        doc_id,
                        &saved_doc.title,
                        &saved_doc.content,
                        user_id,
                        vec![],
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
}
