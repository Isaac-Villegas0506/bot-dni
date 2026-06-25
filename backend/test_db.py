import asyncio
from database import Database

__test__ = False

async def main():
    db = Database()
    await db.connect()
    cursor = db.conn.cursor()
    cursor.execute("SELECT plan_key, name FROM credit_packages")
    print("Packages:", cursor.fetchall())
    cursor.execute("SELECT id, plan_key, plan_label FROM credit_purchases ORDER BY id DESC LIMIT 5")
    print("Purchases:", cursor.fetchall())
    cursor.close()
    await db.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
