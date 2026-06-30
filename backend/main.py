from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import Base, engine

app = FastAPI()
Base.metadata.create_all(bind=engine)

# Configure CORS to allow your React development server
origins = [
    "http://localhost:5173",  # Default Vite port
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all request headers
)

@app.get("/api/data")
def read_data():
    return {"message": "Hello from the FastAPI backend!"}