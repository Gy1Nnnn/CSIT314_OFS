from __future__ import annotations

from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app import auth_utils, models, schemas
from app.database import Base, SessionLocal, engine, get_db

app = FastAPI(title="Backend API")

# React dev server commonly runs on 5173 (Vite). In production, set tighter origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")


@app.on_event("startup")
def _startup() -> None:
    Base.metadata.create_all(bind=engine)
    _seed_defaults()


def _seed_defaults() -> None:
    """
    Ensure a default admin profile + account exist.

    Idempotent: safe to run on every startup.
    """
    db = SessionLocal()
    try:
        profile_name = "User Admin"
        admin_email = "admin@gmail.com"
        admin_password = "qwertyui"

        profile = (
            db.query(models.UserProfile)
            .filter(models.UserProfile.profile_name == profile_name)
            .first()
        )
        if profile is None:
            profile = models.UserProfile(
                profile_name=profile_name,
                is_user_admin=True,
                full_access=True,
                manage_fra=True,
                partial_access=True,
                manage_platform=True,
                suspended=False,
            )
            db.add(profile)
            db.flush()
        else:
            # If someone created it manually, make sure it's actually admin-capable.
            changed = False
            for attr, value in (
                ("is_user_admin", True),
                ("full_access", True),
                ("manage_fra", True),
                ("partial_access", True),
                ("manage_platform", True),
            ):
                if getattr(profile, attr) is not value:
                    setattr(profile, attr, value)
                    changed = True
            if changed:
                db.flush()

        user = db.query(models.UserAccount).filter(models.UserAccount.email == admin_email).first()
        if user is None:
            user = models.UserAccount(
                email=admin_email,
                hashed_password=auth_utils.hash_password(admin_password),
                profile_name=profile_name,
                profile_id=profile.id,
                suspended=False,
                name="Admin",
            )
            db.add(user)
        else:
            # Keep it linked to the default admin profile.
            if user.profile_id != profile.id or user.profile_name != profile_name:
                user.profile_id = profile.id
                user.profile_name = profile_name
            if user.suspended:
                user.suspended = False

        # Default profile for fundraiser logins (not an admin).
        fr_profile = (
            db.query(models.UserProfile)
            .filter(models.UserProfile.profile_name == "Fundraiser")
            .first()
        )
        if fr_profile is None:
            db.add(
                models.UserProfile(
                    profile_name="Fundraiser",
                    is_user_admin=False,
                    full_access=False,
                    manage_fra=True,
                    partial_access=False,
                    manage_platform=False,
                    suspended=False,
                )
            )

        db.commit()
    finally:
        db.close()


DbDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


@app.get("/api/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/api/public/profiles", response_model=schemas.ProfilesListResponse)
def public_profiles(db: DbDep) -> schemas.ProfilesListResponse:
    profiles = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.suspended == False)  # noqa: E712
        .order_by(models.UserProfile.profile_name.asc())
        .all()
    )
    return schemas.ProfilesListResponse(
        profiles=[
            schemas.UserProfileOut.model_validate(p, from_attributes=True)  # type: ignore[arg-type]
            for p in profiles
        ],
    )


def _get_current_user(db: Session, token: str) -> tuple[models.UserAccount, models.UserProfile | None]:
    payload = auth_utils.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(models.UserAccount).filter(models.UserAccount.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if user.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is suspended")

    profile = None
    if user.profile_id is not None:
        profile = db.query(models.UserProfile).filter(models.UserProfile.id == user.profile_id).first()
        if profile and profile.suspended:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile is suspended")

    return user, profile


@app.get("/api/me", response_model=schemas.UserAccountOut)
def me(db: DbDep, token: TokenDep) -> schemas.UserAccountOut:
    user, profile = _get_current_user(db, token)
    return _user_out(user, profile)


def _require_admin(db: Session, token: str) -> tuple[models.UserAccount, models.UserProfile]:
    user, profile = _get_current_user(db, token)
    if not profile or not profile.is_user_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user, profile


def _require_fundraiser(db: Session, token: str) -> tuple[models.UserAccount, models.UserProfile]:
    """Non-admin users who may manage fundraising activities (profile flag)."""
    user, profile = _get_current_user(db, token)
    if not profile or profile.is_user_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fundraiser access required")
    if not (profile.manage_fra or profile.full_access):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Fundraiser access required")
    return user, profile


@app.get("/api/fundraiser/activities/next-id")
def fundraiser_activities_next_id(db: DbDep, token: TokenDep) -> dict[str, int]:
    _require_fundraiser(db, token)
    max_id = db.query(func.max(models.FundraisingActivity.id)).scalar()
    next_id = (int(max_id) + 1) if max_id is not None else 1
    return {"next_id": next_id}


@app.get("/api/fundraiser/activities", response_model=schemas.FundraisingActivitiesListResponse)
def fundraiser_activities_list(
    db: DbDep, token: TokenDep, q: str | None = None
) -> schemas.FundraisingActivitiesListResponse:
    user, _p = _require_fundraiser(db, token)
    query = db.query(models.FundraisingActivity).filter(models.FundraisingActivity.owner_id == user.id)
    if q:
        s = q.strip()
        if s.isdigit():
            query = query.filter(models.FundraisingActivity.id == int(s))
        elif s:
            like = f"%{s}%"
            query = query.filter(
                or_(
                    models.FundraisingActivity.name.ilike(like),
                    models.FundraisingActivity.description.ilike(like),
                )
            )
    rows = query.order_by(models.FundraisingActivity.id.asc()).all()
    return schemas.FundraisingActivitiesListResponse(
        activities=[schemas.FundraisingActivityOut.model_validate(a, from_attributes=True) for a in rows],
    )


@app.post("/api/fundraiser/activities", response_model=schemas.FundraisingActivityOut)
def fundraiser_activities_create(
    payload: schemas.FundraisingActivityCreateRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.FundraisingActivityOut:
    user, _p = _require_fundraiser(db, token)
    a = models.FundraisingActivity(
        owner_id=user.id,
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        goal_amount=payload.goal_amount,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return schemas.FundraisingActivityOut.model_validate(a, from_attributes=True)


@app.patch("/api/fundraiser/activities/{activity_id}", response_model=schemas.FundraisingActivityOut)
def fundraiser_activities_update(
    activity_id: int,
    payload: schemas.FundraisingActivityUpdateRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.FundraisingActivityOut:
    user, _p = _require_fundraiser(db, token)
    a = (
        db.query(models.FundraisingActivity)
        .filter(
            models.FundraisingActivity.id == activity_id,
            models.FundraisingActivity.owner_id == user.id,
        )
        .first()
    )
    if a is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    if payload.name is not None:
        a.name = payload.name.strip()
    if payload.description is not None:
        a.description = (payload.description or "").strip()
    if payload.status is not None:
        a.status = payload.status
    if payload.start_date is not None:
        a.start_date = payload.start_date
    if payload.end_date is not None:
        a.end_date = payload.end_date
    if payload.goal_amount is not None:
        a.goal_amount = payload.goal_amount
    db.commit()
    db.refresh(a)
    return schemas.FundraisingActivityOut.model_validate(a, from_attributes=True)


@app.get("/api/admin/profiles/next-id")
def admin_profiles_next_id(db: DbDep, token: TokenDep) -> dict[str, int]:
    _require_admin(db, token)
    max_id = db.query(func.max(models.UserProfile.id)).scalar()
    next_id = (int(max_id) + 1) if max_id is not None else 1
    return {"next_id": next_id}


@app.get("/api/admin/profiles", response_model=schemas.ProfilesListResponse)
def admin_profiles_list(db: DbDep, token: TokenDep, q: str | None = None) -> schemas.ProfilesListResponse:
    _require_admin(db, token)
    query = db.query(models.UserProfile)
    if q:
        s = q.strip()
        if s:
            query = query.filter(models.UserProfile.profile_name.ilike(f"%{s}%"))
    profiles = query.order_by(models.UserProfile.id.asc()).all()
    return schemas.ProfilesListResponse(
        profiles=[
            schemas.UserProfileOut.model_validate(p, from_attributes=True)  # type: ignore[arg-type]
            for p in profiles
        ],
    )


@app.post("/api/admin/profiles", response_model=schemas.UserProfileOut)
def admin_profiles_create(
    payload: schemas.AdminCreateProfileRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.UserProfileOut:
    _require_admin(db, token)
    name = (payload.profile_name or "").strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="profile_name is required")

    existing = (
        db.query(models.UserProfile)
        .filter(models.UserProfile.profile_name == name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile already exists")

    profile = models.UserProfile(
        profile_name=name,
        description=(payload.description or "").strip(),
        is_user_admin=bool(payload.is_user_admin),
        full_access=bool(payload.full_access),
        manage_fra=bool(payload.manage_fra),
        partial_access=bool(payload.partial_access),
        manage_platform=bool(payload.manage_platform),
        suspended=False,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return schemas.UserProfileOut.model_validate(profile, from_attributes=True)  # type: ignore[arg-type]


@app.patch("/api/admin/profiles/{profile_id}", response_model=schemas.UserProfileOut)
def admin_profiles_update(
    profile_id: int,
    payload: schemas.AdminUpdateProfileRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.UserProfileOut:
    _require_admin(db, token)
    profile = db.query(models.UserProfile).filter(models.UserProfile.id == profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    if payload.profile_name is not None:
        name = (payload.profile_name or "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="profile_name cannot be blank")
        existing = (
            db.query(models.UserProfile)
            .filter(models.UserProfile.profile_name == name, models.UserProfile.id != profile_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Profile name already in use")
        profile.profile_name = name

    if payload.description is not None:
        profile.description = (payload.description or "").strip()
    if payload.suspended is not None:
        profile.suspended = bool(payload.suspended)
    if payload.is_user_admin is not None:
        profile.is_user_admin = bool(payload.is_user_admin)
    if payload.full_access is not None:
        profile.full_access = bool(payload.full_access)
    if payload.manage_fra is not None:
        profile.manage_fra = bool(payload.manage_fra)
    if payload.partial_access is not None:
        profile.partial_access = bool(payload.partial_access)
    if payload.manage_platform is not None:
        profile.manage_platform = bool(payload.manage_platform)

    db.commit()
    db.refresh(profile)
    return schemas.UserProfileOut.model_validate(profile, from_attributes=True)  # type: ignore[arg-type]


@app.get("/api/admin/users/next-id")
def admin_users_next_id(db: DbDep, token: TokenDep) -> dict[str, int]:
    _require_admin(db, token)
    max_id = db.query(func.max(models.UserAccount.id)).scalar()
    next_id = (int(max_id) + 1) if max_id is not None else 1
    return {"next_id": next_id}


@app.get("/api/admin/users", response_model=schemas.UsersListResponse)
def admin_users_list(db: DbDep, token: TokenDep, q: str | None = None) -> schemas.UsersListResponse:
    _require_admin(db, token)
    query = db.query(models.UserAccount)
    if q:
        s = q.strip()
        if s.isdigit():
            query = query.filter(models.UserAccount.id == int(s))
        elif s:
            query = query.filter(models.UserAccount.email.ilike(f"%{s}%"))
    users = query.order_by(models.UserAccount.id.asc()).all()

    # Bulk-load profiles to compute admin flags in the response.
    profile_ids = {u.profile_id for u in users if u.profile_id is not None}
    profiles_by_id: dict[int, models.UserProfile] = {}
    if profile_ids:
        profiles = db.query(models.UserProfile).filter(models.UserProfile.id.in_(profile_ids)).all()
        profiles_by_id = {p.id: p for p in profiles}

    return schemas.UsersListResponse(
        users=[_user_out(u, profiles_by_id.get(u.profile_id or -1)) for u in users],
    )


@app.post("/api/admin/users", response_model=schemas.UserAccountOut)
def admin_users_create(
    payload: schemas.AdminCreateUserRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.UserAccountOut:
    _require_admin(db, token)

    existing = db.query(models.UserAccount).filter(models.UserAccount.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    profile = db.query(models.UserProfile).filter(models.UserProfile.id == payload.profile_id).first()
    if profile is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid profile_id")

    user = models.UserAccount(
        name=payload.name.strip(),
        email=payload.email,
        hashed_password=auth_utils.hash_password(payload.password),
        profile_id=profile.id,
        profile_name=profile.profile_name,
        suspended=False,
        access_create=bool(payload.access_create),
        access_list=bool(payload.access_list),
        access_search=bool(payload.access_search),
        access_update=bool(payload.access_update),
        access_suspend=bool(payload.access_suspend),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user, profile)


@app.patch("/api/admin/users/{user_id}", response_model=schemas.UserAccountOut)
def admin_users_update(
    user_id: int,
    payload: schemas.AdminUpdateUserRequest,
    db: DbDep,
    token: TokenDep,
) -> schemas.UserAccountOut:
    _require_admin(db, token)
    user = db.query(models.UserAccount).filter(models.UserAccount.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if payload.name is not None:
        nm = payload.name.strip()
        if not nm:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="name cannot be blank")
        user.name = nm

    if payload.email is not None:
        email = payload.email
        existing = (
            db.query(models.UserAccount)
            .filter(models.UserAccount.email == email, models.UserAccount.id != user_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        user.email = email

    profile = None
    if payload.profile_id is not None:
        profile = db.query(models.UserProfile).filter(models.UserProfile.id == payload.profile_id).first()
        if profile is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid profile_id")
        user.profile_id = profile.id
        user.profile_name = profile.profile_name
    elif user.profile_id is not None:
        profile = db.query(models.UserProfile).filter(models.UserProfile.id == user.profile_id).first()

    if payload.suspended is not None:
        user.suspended = bool(payload.suspended)

    if payload.access_create is not None:
        user.access_create = bool(payload.access_create)
    if payload.access_list is not None:
        user.access_list = bool(payload.access_list)
    if payload.access_search is not None:
        user.access_search = bool(payload.access_search)
    if payload.access_update is not None:
        user.access_update = bool(payload.access_update)
    if payload.access_suspend is not None:
        user.access_suspend = bool(payload.access_suspend)

    db.commit()
    db.refresh(user)
    return _user_out(user, profile)


@app.post("/api/register", response_model=schemas.TokenResponse)
def register(payload: schemas.RegisterRequest, db: DbDep) -> schemas.TokenResponse:
    existing = db.query(models.UserAccount).filter(models.UserAccount.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    profile_name = (payload.profile_name or "").strip()
    if not profile_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="profile_name is required")

    profile = (
        db.query(models.UserProfile).filter(models.UserProfile.profile_name == profile_name).first()
    )
    if profile is None:
        profile = models.UserProfile(profile_name=profile_name)
        db.add(profile)
        db.flush()

    user = models.UserAccount(
        email=payload.email,
        hashed_password=auth_utils.hash_password(payload.password),
        profile_name=profile_name,
        profile_id=profile.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = auth_utils.create_access_token(user_id=user.id, email=user.email, role=user.profile_name)
    return schemas.TokenResponse(access_token=token, user=_user_out(user, profile))


@app.post("/api/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: DbDep) -> schemas.TokenResponse:
    user = db.query(models.UserAccount).filter(models.UserAccount.email == payload.email).first()
    if not user or not auth_utils.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if user.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is suspended")

    requested_profile = (payload.profile_name or "").strip()
    if requested_profile and requested_profile != user.profile_name:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profile does not match this account")

    profile = None
    if user.profile_id is not None:
        profile = db.query(models.UserProfile).filter(models.UserProfile.id == user.profile_id).first()

    token = auth_utils.create_access_token(user_id=user.id, email=user.email, role=user.profile_name)
    return schemas.TokenResponse(access_token=token, user=_user_out(user, profile))


def _user_out(user: models.UserAccount, profile: models.UserProfile | None) -> schemas.UserAccountOut:
    return schemas.UserAccountOut(
        id=user.id,
        name=user.name or "",
        email=user.email,
        profile_name=user.profile_name,
        profile_id=user.profile_id,
        suspended=bool(user.suspended),
        description=user.description or "",
        is_user_admin=bool(profile.is_user_admin) if profile else False,
        manage_fra=bool(profile.manage_fra) if profile else False,
        full_access=bool(profile.full_access) if profile else False,
        access_create=bool(user.access_create),
        access_list=bool(user.access_list),
        access_search=bool(user.access_search),
        access_update=bool(user.access_update),
        access_suspend=bool(user.access_suspend),
    )