
# The commented out code below is Supabase's method of connecting a database
#   to our code
#
# --------------------------------------------------------------------------
#
# import { createClient } from '@supabase/supabase-js'
# const supabaseUrl = 'https://vddwmlbjpytoboghywvm.supabase.co'
# const supabaseKey = process.env.SUPABASE_KEY
# const supabase = createClient(supabaseUrl, supabaseKey)


import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT", "5432"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
    )
