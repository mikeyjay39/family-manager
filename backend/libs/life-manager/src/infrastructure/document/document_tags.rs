use std::collections::HashMap;

use diesel::prelude::*;
use diesel::sqlite::SqliteConnection;
use uuid::Uuid;

use crate::infrastructure::document::document_tag_entity::DocumentTagEntity;
use crate::infrastructure::document::tag_entity::{NewTagEntity, TagEntity};
use crate::schema::{document_tags, tags};

/// Trims whitespace, lowercases, skips empty strings, and dedupes (first-seen order).
pub fn normalize_tag_names(tags: &[String]) -> Vec<String> {
    let mut normalized = Vec::new();
    for tag in tags {
        let name = tag.trim().to_lowercase();
        if name.is_empty() || normalized.contains(&name) {
            continue;
        }
        normalized.push(name);
    }
    normalized
}

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

/// Removes all tag links for a document, then persists the new tag set.
pub fn replace_document_tags(
    conn: &mut SqliteConnection,
    document_id: &str,
    tag_names: &[String],
) -> Result<(), diesel::result::Error> {
    diesel::delete(
        document_tags::table.filter(document_tags::document_id.eq(document_id)),
    )
    .execute(conn)?;
    persist_document_tags(conn, document_id, tag_names)
}

/// Links a document to tag rows, creating global tag rows by normalized name when missing.
pub fn persist_document_tags(
    conn: &mut SqliteConnection,
    document_id: &str,
    tag_names: &[String],
) -> Result<(), diesel::result::Error> {
    for name in tag_names {
        let tag_id = match tags::table
            .filter(tags::name.eq(name))
            .select(TagEntity::as_select())
            .first::<TagEntity>(conn)
            .optional()?
        {
            Some(tag) => tag.id,
            None => {
                let id = Uuid::new_v4().to_string();
                let new_tag = NewTagEntity {
                    id: id.clone(),
                    name: name.clone(),
                };
                diesel::insert_into(tags::table)
                    .values(&new_tag)
                    .execute(conn)?;
                id
            }
        };

        diesel::insert_into(document_tags::table)
            .values(&DocumentTagEntity {
                document_id: document_id.to_string(),
                tag_id,
            })
            .execute(conn)?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_tag_names_trims_lowercases_dedupes_and_skips_empty() {
        assert_eq!(
            normalize_tag_names(&[
                " Tax ".to_string(),
                "tax".to_string(),
                "".to_string(),
                "Finance".to_string(),
                "  ".to_string(),
                "FINANCE".to_string(),
            ]),
            vec!["tax".to_string(), "finance".to_string()]
        );
    }

    #[test]
    fn normalize_tag_names_empty_input_returns_empty() {
        assert!(normalize_tag_names(&[]).is_empty());
    }
}
