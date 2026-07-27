from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional


class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    encrypted_master_key: str
    kdf_salt: str
    recovery_bundle: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleAuthRequest(BaseModel):
    id_token: str
    encrypted_master_key: Optional[str] = None
    kdf_salt: Optional[str] = None
    recovery_bundle: Optional[str] = None


class GoogleDriveConnectRequest(BaseModel):
    access_token: str
    expires_in: Optional[int] = None
    scope: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    recovery_key: Optional[str] = None

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    is_active: bool


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse
    encrypted_master_key: str


class UpdateMasterKeyRequest(BaseModel):
    encrypted_master_key: str
    kdf_salt: str
