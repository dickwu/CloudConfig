use axum::{
    body::Body,
    http::{Method, StatusCode, Uri, header},
    response::{IntoResponse, Response},
};
use rust_embed::RustEmbed;

#[derive(RustEmbed)]
#[folder = "frontend"]
#[include = "out/*"]
#[include = "out/**/*"]
struct FrontendAssets;

pub async fn serve(method: Method, uri: Uri) -> Response {
    let is_head = method == Method::HEAD;
    if method != Method::GET && !is_head {
        return (StatusCode::METHOD_NOT_ALLOWED, "Method not allowed").into_response();
    }

    for candidate in asset_candidates(uri.path()) {
        let embedded_path = format!("out/{candidate}");
        if let Some(asset) = FrontendAssets::get(&embedded_path) {
            return build_asset_response(StatusCode::OK, &candidate, asset.data.into_owned(), is_head);
        }
    }

    if let Some(asset) = FrontendAssets::get("out/404.html") {
        return build_asset_response(
            StatusCode::NOT_FOUND,
            "404.html",
            asset.data.into_owned(),
            is_head,
        );
    }

    (StatusCode::NOT_FOUND, "Not Found").into_response()
}

fn asset_candidates(path: &str) -> Vec<String> {
    let clean = path.trim_matches('/');
    if clean.is_empty() {
        return vec![String::from("index.html")];
    }

    let mut candidates = vec![clean.to_owned()];
    if path.ends_with('/') {
        candidates.push(format!("{clean}/index.html"));
    }

    if !clean.contains('.') {
        candidates.push(format!("{clean}.html"));
        candidates.push(format!("{clean}/index.html"));
    }

    candidates.dedup();
    candidates
}

fn build_asset_response(status: StatusCode, path: &str, bytes: Vec<u8>, is_head: bool) -> Response {
    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let mut response = if is_head {
        Response::new(Body::empty())
    } else {
        Response::new(Body::from(bytes))
    };
    *response.status_mut() = status;

    if let Ok(content_type) = mime.essence_str().parse() {
        response
            .headers_mut()
            .insert(header::CONTENT_TYPE, content_type);
    }

    response.headers_mut().insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("public, max-age=0, must-revalidate"),
    );
    response
}

#[cfg(test)]
mod tests {
    use super::asset_candidates;

    #[test]
    fn normalizes_root_path() {
        assert_eq!(asset_candidates("/"), vec![String::from("index.html")]);
    }

    #[test]
    fn supports_trailing_slash_route() {
        let candidates = asset_candidates("/clients/");
        assert!(candidates.contains(&String::from("clients/index.html")));
    }
}
