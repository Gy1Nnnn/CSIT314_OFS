from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    profile_name: str = Field(..., min_length=1, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    profile_name: str = Field(..., min_length=1, max_length=128)


class UserAccountOut(BaseModel):
    id: int
    name: str = ""
    email: str
    profile_name: str
    profile_id: int | None = None
    suspended: bool = False
    description: str = ""

    is_user_admin: bool = False
    manage_fra: bool = False
    full_access: bool = False

    access_create: bool = False
    access_list: bool = False
    access_search: bool = False
    access_update: bool = False
    access_suspend: bool = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserAccountOut


class AdminCreateUserRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    profile_id: int

    access_create: bool = False
    access_list: bool = False
    access_search: bool = False
    access_update: bool = False
    access_suspend: bool = False


class UsersListResponse(BaseModel):
    users: list[UserAccountOut]


class UserProfileOut(BaseModel):
    id: int
    profile_name: str
    description: str = ""
    suspended: bool = False
    is_user_admin: bool = False

    full_access: bool = False
    manage_fra: bool = False
    partial_access: bool = False
    manage_platform: bool = False

    model_config = {"from_attributes": True}


class ProfilesListResponse(BaseModel):
    profiles: list[UserProfileOut]


class AdminCreateProfileRequest(BaseModel):
    """`profile_name` is the profile name (unique)."""

    profile_name: str = Field(..., max_length=128)
    description: str = ""
    is_user_admin: bool = False

    full_access: bool = False
    manage_fra: bool = False
    partial_access: bool = False
    manage_platform: bool = False

    @field_validator("profile_name")
    @classmethod
    def strip_profile_name(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("Name cannot be blank")
        if len(s) > 128:
            raise ValueError("Name must be at most 128 characters")
        return s


class AdminUpdateProfileRequest(BaseModel):
    profile_name: str | None = None
    description: str | None = None
    suspended: bool | None = None
    is_user_admin: bool | None = None

    full_access: bool | None = None
    manage_fra: bool | None = None
    partial_access: bool | None = None
    manage_platform: bool | None = None

    @field_validator("profile_name")
    @classmethod
    def strip_profile_name_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("Name cannot be blank")
        if len(s) > 128:
            raise ValueError("Name must be at most 128 characters")
        return s


class AdminUpdateUserRequest(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    profile_id: int | None = None
    suspended: bool | None = None

    access_create: bool | None = None
    access_list: bool | None = None
    access_search: bool | None = None
    access_update: bool | None = None
    access_suspend: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("Name cannot be blank")
        if len(s) > 120:
            raise ValueError("Name must be at most 120 characters")
        return s


FUNDRAISER_STATUSES = frozenset(
    {"draft", "active", "paused", "completed", "cancelled"},
)


class FundraisingActivityOut(BaseModel):
    id: int
    owner_id: int
    name: str
    description: str = ""
    status: str
    start_date: date | None = None
    end_date: date | None = None
    goal_amount: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FundraisingActivitiesListResponse(BaseModel):
    activities: list[FundraisingActivityOut]


class FundraisingActivityCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = ""
    status: str = "draft"
    start_date: date | None = None
    end_date: date | None = None
    goal_amount: Decimal | None = Field(None, ge=0)

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("Name cannot be blank")
        return s

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = (v or "").strip().lower()
        if s not in FUNDRAISER_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(FUNDRAISER_STATUSES))}")
        return s


class FundraisingActivityUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    goal_amount: Decimal | None = Field(None, ge=0)

    @field_validator("name")
    @classmethod
    def strip_name_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            raise ValueError("Name cannot be blank")
        return s

    @field_validator("status")
    @classmethod
    def validate_status_optional(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip().lower()
        if s not in FUNDRAISER_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(FUNDRAISER_STATUSES))}")
        return s
