import bcrypt
h = b"$2y$10$V7Y9fXyDYU8fA6QYW2mdSOyQta31vPB6nhR9B8I2N/x4OnfLSdL8i"
for p in ["admin123", "123456", "password", "admin", "admin@123", "YourSecurePassword123"]:
    print(p, bcrypt.checkpw(p.encode(), h))
