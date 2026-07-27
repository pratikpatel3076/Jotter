from datetime import datetime, timezone, timedelta
from typing import Optional
import hashlib
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.db.database import get_db
from app.models.models import User, UserSession, PasswordResetToken, GoogleDriveConnection
from app.schemas.auth import (
    SignupRequest, LoginRequest, RefreshRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    ChangePasswordRequest, TokenResponse, UserResponse, AuthResponse, UpdateMasterKeyRequest,
    GoogleAuthRequest, GoogleDriveConnectRequest,
)
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
    create_password_reset_token, verify_password_reset_token,
)
from app.core.config import settings
from app.services.email import send_password_reset_email
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])
DRIVE_APPDATA_SCOPE = "https://www.googleapis.com/auth/drive.appdata"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _make_tokens(user_id: str) -> tuple[str, str]:
    access = create_access_token({"sub": user_id})
    refresh = create_refresh_token({"sub": user_id})
    return access, refresh


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(body: SignupRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        full_name=body.full_name,
        email=body.email,
        hashed_password=hash_password(body.password),
        encrypted_master_key=body.encrypted_master_key,
        kdf_salt=body.kdf_salt,
        recovery_bundle=body.recovery_bundle,
        is_active=True,
        is_verified=True,
        last_login_at=datetime.now(timezone.utc),
    )


@router.post("/google", response_model=AuthResponse)
async def google_auth(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google Sign-In is not configured")
    try:
        claims = google_id_token.verify_oauth2_token(
            body.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google ID token")

    if claims.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")
    if not claims.get("email") or not claims.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    email = str(claims["email"]).lower()
    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        if not body.encrypted_master_key or not body.kdf_salt:
            raise HTTPException(status_code=409, detail="New Google users must create an encrypted vault")
        user = User(
            full_name=claims.get("name"),
            email=email,
            hashed_password=hash_password(f"google:{claims.get('sub')}:{settings.SECRET_KEY}"),
            encrypted_master_key=body.encrypted_master_key,
            kdf_salt=body.kdf_salt,
            recovery_bundle=body.recovery_bundle,
            is_active=True,
            is_verified=True,
            last_login_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()
    elif not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access, refresh = _make_tokens(user.id)
    db.add(UserSession(
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    ))
    await db.execute(update(User).where(User.id == user.id).values(last_login_at=datetime.now(timezone.utc)))
    await db.commit()

    return AuthResponse(
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active),
        tokens=TokenResponse(access_token=access, refresh_token=refresh),
        encrypted_master_key=user.encrypted_master_key or "",
    )
    db.add(user)
    await db.flush()

    access, refresh = _make_tokens(user.id)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    return AuthResponse(
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active),
        tokens=TokenResponse(access_token=access, refresh_token=refresh),
        encrypted_master_key=user.encrypted_master_key or "",
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")

    access, refresh = _make_tokens(user.id)

    # Clean up old expired sessions (keep last 5 active)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh),
        device_name=request.headers.get("X-Device-Name"),
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("User-Agent"),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)

    await db.execute(
        update(User).where(User.id == user.id).values(last_login_at=datetime.now(timezone.utc))
    )
    await db.commit()

    return AuthResponse(
        user=UserResponse(id=user.id, email=user.email, full_name=user.full_name, is_active=user.is_active),
        tokens=TokenResponse(access_token=access, refresh_token=refresh),
        encrypted_master_key=user.encrypted_master_key or "",
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("not refresh")
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    token_hash = _hash_token(body.refresh_token)
    session = await db.scalar(
        select(UserSession).where(
            UserSession.refresh_token_hash == token_hash,
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        )
    )
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    access, new_refresh = _make_tokens(user_id)
    session.refresh_token_hash = _hash_token(new_refresh)
    session.last_active_at = datetime.now(timezone.utc)
    await db.commit()

    return TokenResponse(access_token=access, refresh_token=new_refresh)


@router.post("/logout")
async def logout(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    token_hash = _hash_token(body.refresh_token)
    session = await db.scalar(
        select(UserSession).where(UserSession.refresh_token_hash == token_hash)
    )
    if session:
        session.is_active = False
        await db.commit()
    return {"detail": "Logged out"}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email))
    if not user:
        # Return success to avoid user enumeration
        return {"detail": "If the email exists, a reset link was sent"}

    token = create_password_reset_token(body.email)
    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )
    db.add(reset_record)
    await db.commit()

    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    await send_password_reset_email(body.email, reset_url)
    return {"detail": "If the email exists, a reset link was sent"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = verify_password_reset_token(body.token)
    if not email:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = await db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    token_hash = _hash_token(body.token)
    reset_record = await db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.is_used == False,
            PasswordResetToken.user_id == user.id,
        )
    )
    if not reset_record:
        raise HTTPException(status_code=400, detail="Token already used")

    user.hashed_password = hash_password(body.new_password)
    reset_record.is_used = True

    # Invalidate all sessions
    await db.execute(
        update(UserSession).where(UserSession.user_id == user.id).values(is_active=False)
    )
    await db.commit()
    return {"detail": "Password reset successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"detail": "Password changed successfully"}


@router.post("/google-drive/connect")
async def connect_google_drive(
    body: GoogleDriveConnectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scopes = set(body.scope.split())
    if scopes != {DRIVE_APPDATA_SCOPE}:
        raise HTTPException(status_code=400, detail="Only drive.appdata scope is allowed for backup sync")
    expires_at = None
    if body.expires_in:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=body.expires_in)
    existing = await db.scalar(select(GoogleDriveConnection).where(GoogleDriveConnection.user_id == current_user.id))
    if existing:
        existing.access_token = body.access_token
        existing.token_expires_at = expires_at
        existing.is_active = True
    else:
        db.add(GoogleDriveConnection(
            user_id=current_user.id,
            access_token=body.access_token,
            token_expires_at=expires_at,
            is_active=True,
        ))
    await db.commit()
    return {"detail": "Google Drive appDataFolder connected"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
    )


@router.get("/master-key")
async def get_master_key(current_user: User = Depends(get_current_user)):
    return {"encrypted_master_key": current_user.encrypted_master_key, "kdf_salt": current_user.kdf_salt}


@router.put("/master-key")
async def update_master_key(
    body: UpdateMasterKeyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.encrypted_master_key = body.encrypted_master_key
    current_user.kdf_salt = body.kdf_salt
    await db.commit()
    return {"detail": "Master key updated"}


@router.get("/sessions")
async def get_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions = await db.scalars(
        select(UserSession).where(
            UserSession.user_id == current_user.id,
            UserSession.is_active == True,
        ).order_by(UserSession.last_active_at.desc())
    )
    return [
        {
            "id": s.id,
            "device_name": s.device_name,
            "ip_address": s.ip_address,
            "last_active_at": s.last_active_at,
            "created_at": s.created_at,
        }
        for s in sessions.all()
    ]


@router.delete("/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.scalar(
        select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == current_user.id,
        )
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    await db.commit()
    return {"detail": "Session revoked"}
