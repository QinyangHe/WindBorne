from app.main import app
import os

# Set the directory for templates when running in Vercel
os.environ["TEMPLATES_DIR"] = os.path.join(os.getcwd(), "app/templates")

# Set the directory for static files when running in Vercel
os.environ["STATIC_DIR"] = os.path.join(os.getcwd(), "app/static") 