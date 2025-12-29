import bcrypt

# Hasło jako bytes
password = b"user"  # musi być typu bytes
# Tworzymy hash
hashed = bcrypt.hashpw(password, bcrypt.gensalt())

# Weryfikacja hasła
def verify_password(plain_password: str, hashed_password: bytes) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)

print("Hashed:", hashed)
print("Weryfikacja (user):", verify_password("user", hashed))
