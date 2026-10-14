from pathlib import Path
from datetime import datetime, timedelta, timezone
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import sys
root = Path(sys.argv[1])
root.mkdir(parents=True, exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'JARVIS personal pairing')])
now = datetime.now(timezone.utc)
cert = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=730)).add_extension(x509.SubjectAlternativeName([x509.DNSName('jarvis.local')]), critical=False).sign(key, hashes.SHA256())
(root/'mobile-key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
(root/'mobile-cert.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
