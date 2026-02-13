from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Load environment variables from the root folder
load_dotenv(dotenv_path="../.env")

# 1. Get DB URL from .env
# Example .env format: DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if not SQLALCHEMY_DATABASE_URL:
    raise ValueError("❌ DATABASE_URL is missing in .env file!")

# 2. Create Engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 3. Create Session Factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base Class for Models
Base = declarative_base()

# Dependency for API Routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()