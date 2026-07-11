use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Deserialize, Serialize, Clone, Debug, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/CreateDocumentCommand.ts"
)]
pub struct CreateDocumentCommand {
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub issued_date: Option<NaiveDateTime>,
    #[serde(default)]
    pub expire_date: Option<NaiveDateTime>,
}

#[derive(Deserialize, Debug, Serialize, TS)]
#[ts(
    export,
    export_to = "../../../../frontend/lib/api/generated/life-manager/GetDocumentsQueryParams.ts"
)]
pub struct GetDocumentsQueryParams {
    pub title: Option<String>,
}

#[cfg(test)]
mod export_ts_bindings {
    use super::*;

    #[test]
    fn export_typescript_bindings() {
        CreateDocumentCommand::export().unwrap();
        GetDocumentsQueryParams::export().unwrap();
    }
}
