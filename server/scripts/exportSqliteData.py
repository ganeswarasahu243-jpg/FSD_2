import sqlite3
import json
import os
import sys

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def export_db(db_path):
    if not os.path.exists(db_path):
        print(json.dumps({"error": f"Database file not found: {db_path}"}))
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.row_factory = dict_factory
    cur = conn.cursor()

    tables = [
        ('users', 'core_user'),
        ('policies', 'policies_policy'),
        ('rules', 'policies_rule'),
        ('logs', 'monitoring_log'),
        ('violations', 'monitoring_violation'),
    ]

    result = {}
    for key, table in tables:
        try:
            cur.execute(f"SELECT * FROM {table}")
            result[key] = cur.fetchall()
        except sqlite3.OperationalError:
            result[key] = []

    conn.close()
    print(json.dumps(result, default=str))

if __name__ == '__main__':
    db_file = sys.argv[1] if len(sys.argv) > 1 else 'svp/uday/db.sqlite3'
    export_db(db_file)
