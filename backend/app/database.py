import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./exam_system.db")

if SQLALCHEMY_DATABASE_URL.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
        "postgresql://", "postgresql+psycopg://", 1
    )

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_database_schema() -> None:
    """Repair older SQLite databases that were created before newer columns existed."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            table.create(bind=engine)
            continue

        existing_columns = {column["name"] for column in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in existing_columns:
                continue

            column_type = column.type.compile(dialect=engine.dialect)
            sql = f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {column_type}'
            with engine.begin() as connection:
                connection.execute(text(sql))

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
