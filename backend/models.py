from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from database import Base

class Profile(Base):
    __tablename__ = "profiles"

    # Matches: id uuid references auth.users not null primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    full_name = Column(String, nullable=True)
    wallet_balance = Column(Integer, default=100)
    face_url = Column(String, nullable=True)
    
    # Matches: cypher_id text unique
    cypher_id = Column(String, unique=True, index=True) 
    
    is_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationship to Trips
    trips = relationship("Trip", back_populates="user")

class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id"))
    station_name = Column(String)
    entry_time = Column(DateTime(timezone=True), server_default=text("now()"))
    fare_charged = Column(Integer, default=0)
    access_granted = Column(Boolean, default=True)
    status = Column(String, default="COMPLETED")

    user = relationship("Profile", back_populates="trips")

class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    status = Column(String, default="ACTIVE")