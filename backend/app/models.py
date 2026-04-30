from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def _utc_now() -> datetime:
    return datetime.utcnow()


class UserAccount(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    # Stored in the existing `role` column for backwards-compatible SQLite DBs.
    profile_name: Mapped[str] = mapped_column("role", String(128))
    profile_id: Mapped[int | None] = mapped_column(ForeignKey("profiles.id"), nullable=True)
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    name: Mapped[str] = mapped_column(String(120), default="")
    description: Mapped[str] = mapped_column(Text, default="")

    # Access control flags (checkboxes)
    access_create: Mapped[bool] = mapped_column(Boolean, default=False)
    access_list: Mapped[bool] = mapped_column(Boolean, default=False)
    access_search: Mapped[bool] = mapped_column(Boolean, default=False)
    access_update: Mapped[bool] = mapped_column(Boolean, default=False)
    access_suspend: Mapped[bool] = mapped_column(Boolean, default=False)


class UserProfile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # Stored in the existing `role` column for backwards-compatible SQLite DBs.
    profile_name: Mapped[str] = mapped_column("role", String(128), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    suspended: Mapped[bool] = mapped_column(Boolean, default=False)
    is_user_admin: Mapped[bool] = mapped_column(Boolean, default=False)

    # Access control (checkboxes)
    full_access: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_fra: Mapped[bool] = mapped_column(Boolean, default=False)
    partial_access: Mapped[bool] = mapped_column(Boolean, default=False)
    manage_platform: Mapped[bool] = mapped_column(Boolean, default=False)


class FundraisingActivity(Base):
    __tablename__ = "fundraising_activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    goal_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utc_now, onupdate=_utc_now)
