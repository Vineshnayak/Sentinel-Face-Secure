"""
Embedding Encryption Module
Provides encryption for stored face embeddings
Ensures privacy and security of biometric data
"""

import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


import base64
import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def get_encryption_key():
    """Get encryption key from file or environment"""
    key_file = os.path.join(os.path.dirname(__file__), ".encryption_key")
    
    if os.path.exists(key_file):
        with open(key_file, 'r') as f:
            return f.read().strip()
    else:
        return os.getenv("ENCRYPTION_KEY", "sentinel-face-secure-default-key-2024")


ENCRYPTION_PASSPHRASE = get_encryption_key()


class EmbeddingEncryptor:
    """
    Encryption handler for face embeddings
    Uses Fernet (symmetric encryption) for secure storage
    """
    
    _instance = None
    
    def __init__(self, key: bytes = None):
        if key is None:
            salt = b'sentinel_face_salt'
            self.key = self._derive_key_from_passphrase(ENCRYPTION_PASSPHRASE, salt)
        else:
            self.key = key
        self.fernet = Fernet(self.key)
    
    @staticmethod
    def _derive_key_from_passphrase(passphrase: str, salt: bytes) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,
        )
        return base64.urlsafe_b64encode(kdf.derive(passphrase.encode()))
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def encrypt_embedding(self, embedding) -> str:
        if hasattr(embedding, 'tobytes'):
            data = embedding.tobytes()
        else:
            data = str(embedding).encode()
        
        encrypted = self.fernet.encrypt(data)
        return base64.b64encode(encrypted).decode()
    
    def decrypt_embedding(self, encrypted_str: str) -> bytes:
        encrypted = base64.b64decode(encrypted_str.encode())
        return self.fernet.decrypt(encrypted)
    
    def encrypt_list(self, embedding_list) -> str:
        import json
        data = json.dumps([e.tolist() if hasattr(e, 'tolist') else list(e) for e in embedding_list])
        return self.encrypt_embedding(data)
    
    def decrypt_list(self, encrypted_str: str):
        import json
        data = self.decrypt_embedding(encrypted_str).decode()
        return json.loads(data)


def get_encryptor() -> EmbeddingEncryptor:
    return EmbeddingEncryptor.get_instance()


def encrypt_embedding(embedding) -> str:
    return get_encryptor().encrypt_embedding(embedding)


def decrypt_embedding(encrypted_str: str) -> bytes:
    return get_encryptor().decrypt_embedding(encrypted_str)
