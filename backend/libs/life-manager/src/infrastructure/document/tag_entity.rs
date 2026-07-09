use diesel::prelude::*;
use serde::Serialize;

#[derive(Serialize, Queryable, Selectable, Debug, Clone)]
#[diesel(table_name = crate::schema::tags)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TagEntity {
    pub id: String,
    pub name: String,
}

#[derive(Insertable, Debug, Clone)]
#[diesel(table_name = crate::schema::tags)]
pub struct NewTagEntity {
    pub id: String,
    pub name: String,
}
