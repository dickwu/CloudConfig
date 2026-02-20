use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use rcgen::{KeyPair, PKCS_ED25519};
use ring::signature;
use ring::signature::KeyPair as RingKeyPair;
use sha2::{Digest, Sha256};

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone)]
pub struct GeneratedKeypair {
    pub private_key_pem: String,
    pub public_key_b64: String,
}

pub fn generate_ed25519_keypair() -> AppResult<GeneratedKeypair> {
    let generated = KeyPair::generate_for(&PKCS_ED25519)?;
    let private_key_der = generated.serialize_der();
    let private_key_pem = generated.serialize_pem();
    let ring_key = signature::Ed25519KeyPair::from_pkcs8(private_key_der.as_ref())?;
    let public_key_b64 = STANDARD.encode(ring_key.public_key().as_ref());

    Ok(GeneratedKeypair {
        private_key_pem,
        public_key_b64,
    })
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    hex::encode(digest)
}

pub fn canonical_string(
    timestamp: i64,
    method: &str,
    path_and_query: &str,
    nonce: &str,
    body: &[u8],
) -> String {
    let body_hash = sha256_hex(body);
    format!("{timestamp}\n{method}\n{path_and_query}\n{nonce}\n{body_hash}")
}

pub fn verify_signature(
    public_key_b64: &str,
    canonical: &str,
    signature_b64: &str,
) -> AppResult<()> {
    let public_key = STANDARD
        .decode(public_key_b64)
        .map_err(|_| AppError::Unauthorized(String::from("invalid public key encoding")))?;

    let signature = STANDARD
        .decode(signature_b64)
        .map_err(|_| AppError::Unauthorized(String::from("invalid signature encoding")))?;

    let verifier = signature::UnparsedPublicKey::new(&signature::ED25519, public_key);
    verifier
        .verify(canonical.as_bytes(), &signature)
        .map_err(|_| AppError::Unauthorized(String::from("signature verification failed")))?;

    Ok(())
}
