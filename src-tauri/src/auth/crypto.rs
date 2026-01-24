use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};

use super::types::AuthError;

/// Get the machine's unique identifier (HWID)
/// This is used as the encryption key basis
pub fn get_hwid() -> Result<String, AuthError> {
    machine_uid::get()
        .map_err(|e| AuthError::EncryptionError(format!("Failed to get HWID: {}", e)))
}

/// Derive a 256-bit encryption key from HWID
fn derive_key_from_hwid(hwid: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(hwid.as_bytes());
    // Add a salt for extra security
    hasher.update(b"spotify-rework-salt-v1");
    hasher.finalize().into()
}

/// Encrypt data using HWID-derived key with AES-256-GCM
pub fn encrypt(plaintext: &str) -> Result<String, AuthError> {
    let hwid = get_hwid()?;
    let key = derive_key_from_hwid(&hwid);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AuthError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    // Generate random 96-bit nonce
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| AuthError::EncryptionError(format!("Encryption failed: {}", e)))?;

    // Combine nonce + ciphertext and encode as base64
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

/// Decrypt data using HWID-derived key
pub fn decrypt(encrypted: &str) -> Result<String, AuthError> {
    let hwid = get_hwid()?;
    let key = derive_key_from_hwid(&hwid);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| AuthError::EncryptionError(format!("Failed to create cipher: {}", e)))?;

    // Decode from base64
    let combined = BASE64
        .decode(encrypted)
        .map_err(|e| AuthError::EncryptionError(format!("Base64 decode failed: {}", e)))?;

    if combined.len() < 12 {
        return Err(AuthError::EncryptionError("Invalid encrypted data".into()));
    }

    // Split nonce and ciphertext
    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AuthError::EncryptionError(format!("Decryption failed: {}", e)))?;

    String::from_utf8(plaintext)
        .map_err(|e| AuthError::EncryptionError(format!("UTF-8 decode failed: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let original = "test secret data 123";
        let encrypted = encrypt(original).unwrap();
        let decrypted = decrypt(&encrypted).unwrap();
        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_different_encryptions() {
        let original = "same data";
        let enc1 = encrypt(original).unwrap();
        let enc2 = encrypt(original).unwrap();
        // Same plaintext should produce different ciphertexts (due to random nonce)
        assert_ne!(enc1, enc2);
        // But both should decrypt to the same value
        assert_eq!(decrypt(&enc1).unwrap(), decrypt(&enc2).unwrap());
    }
}
