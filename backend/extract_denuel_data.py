"""
Extract student data from old Denuel Academy MySQL database and save as CSV.
This script connects to the old MySQL database and exports all students to a CSV file.

Usage:
    python extract_denuel_data.py --host localhost --user root --password pass --db academy
"""

import argparse
import csv
import sys
from datetime import datetime

try:
    import mysql.connector
except ImportError:
    print("ERROR: mysql-connector-python not installed")
    print("Install it with: pip install mysql-connector-python")
    sys.exit(1)


def extract_students_to_csv(host, user, password, db, output_file):
    """Extract students from old database and save to CSV."""
    try:
        print(f"Connecting to {host}/{db}...")
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=db
        )
        cursor = conn.cursor(dictionary=True)

        # Fetch students
        cursor.execute('''
            SELECT 
                id, 
                name, 
                course, 
                status,
                created_at
            FROM students
            ORDER BY id ASC
        ''')

        students = cursor.fetchall()
        print(f"Found {len(students)} students")

        # Save to CSV
        if not students:
            print("No students found to export")
            return 0

        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(
                f,
                fieldnames=['id', 'name', 'course', 'status', 'created_at']
            )
            writer.writeheader()
            writer.writerows(students)

        print(f"✓ Exported to {output_file}")

        cursor.close()
        conn.close()

        return len(students)

    except mysql.connector.Error as err:
        print(f"ERROR: {err}")
        return 0


def extract_attendance_to_csv(host, user, password, db, output_file):
    """Extract attendance records from old database."""
    try:
        print(f"Connecting to {host}/{db} for attendance...")
        conn = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=db
        )
        cursor = conn.cursor(dictionary=True)

        # Fetch attendance
        cursor.execute('''
            SELECT 
                id, 
                student_id, 
                date, 
                status
            FROM attendance
            ORDER BY student_id ASC, date ASC
        ''')

        records = cursor.fetchall()
        print(f"Found {len(records)} attendance records")

        if not records:
            print("No attendance records found to export")
            return 0

        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(
                f,
                fieldnames=['id', 'student_id', 'date', 'status']
            )
            writer.writeheader()
            writer.writerows(records)

        print(f"✓ Exported to {output_file}")

        cursor.close()
        conn.close()

        return len(records)

    except mysql.connector.Error as err:
        print(f"ERROR: {err}")
        return 0


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Extract data from old Denuel Academy MySQL database'
    )
    parser.add_argument('--host', default='localhost', help='MySQL host')
    parser.add_argument('--user', default='root', help='MySQL user')
    parser.add_argument('--password', default='', help='MySQL password')
    parser.add_argument('--db', default='academy', help='Database name')
    parser.add_argument(
        '--output',
        default='denuel_students.csv',
        help='Output CSV file'
    )
    parser.add_argument(
        '--attendance',
        help='Export attendance to CSV file'
    )

    args = parser.parse_args()

    print('=' * 60)
    print('Denuel Academy Data Extractor')
    print('=' * 60)
    print()

    # Extract students
    count = extract_students_to_csv(
        args.host,
        args.user,
        args.password,
        args.db,
        args.output
    )

    if count > 0:
        print()

    # Extract attendance if requested
    if args.attendance:
        count = extract_attendance_to_csv(
            args.host,
            args.user,
            args.password,
            args.db,
            args.attendance
        )

    print()
    print('✓ Extraction complete!')
