from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# --- User Schemas ---
class UserCreate(BaseModel):
    full_name: str
    initial_balance: int = 100

class UserResponse(BaseModel):
    id: UUID
    full_name: str
    wallet_balance: int
    cypher_id: str
    face_url: Optional[str]
    
    class Config:
        from_attributes = True

# --- Trip Schemas ---
class TripCreate(BaseModel):
    user_id: UUID
    station_name: str
    fare: int
    access_granted: bool

class TripResponse(BaseModel):
    id: UUID
    station_name: str
    fare_charged: int
    entry_time: datetime
    
    class Config:
        from_attributes = True