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
    /// Accepted in multipart JSON; not persisted by the handler yet.
    #[serde(default)]
    pub tags: Vec<String>,
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
