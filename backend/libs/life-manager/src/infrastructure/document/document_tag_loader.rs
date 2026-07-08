use std::collections::HashMap;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;

use crate::infrastructure::document::tag_entity::TagEntity;
use crate::schema::{document_tags, tags};

/// Loads tag names grouped by document id (one query for many documents).
pub fn load_tags_by_document_ids(
    conn: &mut SqliteConnection,
    document_ids: &[String],
) -> Result<HashMap<String, Vec<String>>, diesel::result::Error> {
    if document_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let rows = tags::table
        .inner_join(document_tags::table)
        .filter(document_tags::document_id.eq_any(document_ids))
        .select((document_tags::document_id, TagEntity::as_select()))
        .load::<(String, TagEntity)>(conn)?;

    let mut tags_by_document_id: HashMap<String, Vec<String>> = HashMap::new();
    for (document_id, tag) in rows {
        tags_by_document_id
            .entry(document_id)
            .or_default()
            .push(tag.name);
    }

    Ok(tags_by_document_id)
}
