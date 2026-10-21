
import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def calculate_parking_metrics():
    """Calculate parking space metrics from the database."""
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        # Total spaces
        cur.execute("SELECT COUNT(*) FROM parking_spaces;")
        total_spaces = cur.fetchone()[0]

        # Total occupied spaces
        cur.execute("SELECT COUNT(*) FROM parking_spaces WHERE is_occupied = TRUE;")
        occupied_spaces = cur.fetchone()[0]

        # Total available spaces
        available_spaces = total_spaces - occupied_spaces

        # Occupancy percentage
        if total_spaces > 0:
            occupancy_percentage = (occupied_spaces / total_spaces) * 100
        else:
            occupancy_percentage = 0.0

        # Print results
        # print(f"Total spaces:           {total_spaces}")
        # print(f"Total occupied spaces:  {occupied_spaces}")
        # print(f"Total available spaces: {available_spaces}")
        # print(f"Occupancy percentage:   {occupancy_percentage:.2f}%")

        return {
            "total_spaces": total_spaces,
            "occupied_spaces": occupied_spaces,
            "available_spaces": available_spaces,
            "occupancy_percentage": round(occupancy_percentage, 2),
        }

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    calculate_parking_metrics()