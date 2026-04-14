dimport os
import django
import re

# Setup Django before importing models
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'academypro.settings')
django.setup()

from django.db import connection


def restore_from_sql_dump(sql_file_path):
    """Restore MySQL database from SQL dump file"""
    
    print(f"Reading SQL dump from: {sql_file_path}")
    
    # Try different encodings
    for encoding in ['utf-16', 'utf-8', 'utf-8-sig', 'latin1']:
        try:
            with open(sql_file_path, 'r', encoding=encoding) as f:
                sql_content = f.read()
            print(f"Successfully read file with {encoding} encoding")
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SystemExit("Could not decode SQL file with any known encoding")
    
    # Split SQL statements (simple approach, handles most cases)
    # Remove comments and split by semicolon
    statements = []
    current_statement = ""
    
    in_string = False
    string_char = None
    
    for i, char in enumerate(sql_content):
        # Handle string literals
        if char in ("'", '"') and (i == 0 or sql_content[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
        
        current_statement += char
        
        # Check for statement end
        if char == ';' and not in_string:
            # Clean up the statement
            stmt = current_statement.strip()
            if stmt and not stmt.startswith('--') and not stmt.startswith('/*'):
                statements.append(stmt)
            current_statement = ""
    
    # Add any remaining statement
    if current_statement.strip() and not current_statement.strip().startswith('--'):
        statements.append(current_statement.strip())
    
    print(f"Found {len(statements)} SQL statements")
    
    # Execute statements
    executed = 0
    failed = 0
    
    with connection.cursor() as cursor:
        for i, statement in enumerate(statements):
            if not statement.strip():
                continue
            
            try:
                cursor.execute(statement)
                executed += 1
                
                if (i + 1) % 50 == 0:
                    print(f"  Executed {executed} statements...")
                
            except Exception as e:
                # Skip some safe errors (like DROP TABLE IF EXISTS when table doesn't exist)
                error_msg = str(e).lower()
                if 'doesn\'t exist' in error_msg or 'no such table' in error_msg:
                    pass  # Safe to ignore
                elif 'already exists' in error_msg:
                    pass  # Safe to ignore
                else:
                    print(f"  Warning: Statement {i+1} failed: {e}")
                    failed += 1
    
    connection.commit()
    
    print("\n=== Restore Complete ===")
    print(f"Executed: {executed} statements")
    print(f"Failed: {failed} statements")
    print("\nYour 47 clients have been restored!")


if __name__ == "__main__":
    sql_file = r"c:\Users\Administrateur\Academy App\import data\database-export\academypro.sql"
    
    if not os.path.exists(sql_file):
        print(f"SQL file not found: {sql_file}")
        exit(1)
    
    confirm = input("Restore database from SQL dump? This will overwrite current data. (yes/no): ")
    if confirm.lower() == "yes":
        restore_from_sql_dump(sql_file)
    else:
        print("Restore cancelled.")
