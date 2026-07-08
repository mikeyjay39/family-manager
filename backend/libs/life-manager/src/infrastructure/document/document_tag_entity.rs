use diesel::prelude::*;

#[derive(Queryable, Insertable, Debug, Clone, PartialEq, Eq)]
#[diesel(table_name = crate::schema::document_tags)]
pub struct DocumentTagEntity {
    pub document_id: String,
    pub tag_id: String,
}
