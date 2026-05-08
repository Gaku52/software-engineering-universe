# Network Tools (curl, wget)

> curl and wget are essential tools for HTTP communication from the CLI, indispensable for API development and debugging.
> They are widely used for testing Web APIs, downloading files, health checks, and CI/CD integration.

## What You Will Learn

- [ ] Send various HTTP requests with curl
- [ ] Download files and mirror websites with wget
- [ ] Use these tools for API testing and debugging
- [ ] Process JSON by combining them with jq
- [ ] Write automation scripts using curl
- [ ] Configure secure communication settings


## Prerequisites

Having the following knowledge before reading this guide will deepen your understanding:

- Basic programming knowledge
- Understanding of related foundational concepts

---

## 1. curl Basics

### 1.1 GET Requests

```bash
# Basic: curl [options] URL

# Most basic GET request
curl https://example.com                     # Output HTML to stdout

# Save to a file
curl -o output.html https://example.com      # Save with a specified filename
curl -O https://example.com/file.zip         # Save with the original filename
curl -O -O https://example.com/{a,b}.zip     # Multiple files

# Silent mode
curl -s https://api.example.com/data         # No progress display
curl -sS https://api.example.com/data        # Show errors only
curl -s --fail https://api.example.com/data  # Non-zero exit code on HTTP error

# Output control
curl -s https://api.example.com/data | python3 -m json.tool  # Format JSON
curl -s https://api.example.com/data | jq '.'                # Format with jq
```

### 1.2 Checking Response Headers

```bash
# Get headers only (HEAD request)
curl -I https://example.com
# HTTP/2 200
# content-type: text/html; charset=UTF-8
# date: Mon, 15 Jan 2024 10:30:00 GMT
# content-length: 1234

# Headers + body
curl -i https://example.com

# Detailed communication info (full request/response content)
curl -v https://example.com
# > GET / HTTP/2
# > Host: example.com
# > User-Agent: curl/8.1.0
# > Accept: */*
# >
# < HTTP/2 200
# < content-type: text/html; charset=UTF-8
# ...

# Even more detail (including TLS handshake)
curl -vvv https://example.com

# Trace (binary-level detail)
curl --trace /tmp/curl_trace.log https://example.com
curl --trace-ascii /tmp/curl_trace.txt https://example.com  # ASCII format
```

### 1.3 Redirects

```bash
# Follow redirects (-L / --location)
curl -L https://example.com                  # Automatically follow 301/302

# Limit the maximum number of redirects
curl -L --max-redirs 5 https://example.com

# Just check the redirect destination
curl -sI -o /dev/null -w "%{url_effective}\n" -L https://short.url/abc

# Show redirect history
curl -sIL https://example.com | grep -i "^location:"
```

### 1.4 User-Agent and Headers

```bash
# Specify User-Agent
curl -A "Mozilla/5.0 (compatible; MyBot/1.0)" https://example.com

# Add custom headers (-H)
curl -H "Accept: application/json" https://api.example.com
curl -H "Accept-Language: en" https://example.com
curl -H "X-Custom-Header: value" https://api.example.com

# Multiple custom headers
curl -H "Accept: application/json" \
     -H "X-API-Version: 2" \
     -H "X-Request-ID: $(uuidgen)" \
     https://api.example.com

# Specify referer
curl -e "https://google.com" https://example.com
curl --referer "https://google.com" https://example.com
```

---

## 2. HTTP Methods

### 2.1 POST Requests

```bash
# Send JSON data
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Gaku", "email": "gaku@example.com"}'

# Send JSON data (shorthand, curl 7.82+)
curl -X POST https://api.example.com/users \
  --json '{"name": "Gaku"}'
# --json is equivalent to:
# -H "Content-Type: application/json"
# -H "Accept: application/json"
# -d 'data'

# Read data from a file
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d @data.json

# Read data from stdin
echo '{"name": "Gaku"}' | curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d @-

# URL-encoded form data
curl -X POST https://example.com/login \
  -d "username=gaku&password=secret"
# Content-Type: application/x-www-form-urlencoded is set automatically

# Auto-encode with --data-urlencode
curl -X POST https://example.com/search \
  --data-urlencode "q=hello world" \
  --data-urlencode "lang=Japanese"
```

### 2.2 File Upload (Multipart)

```bash
# Form data + file upload
curl -X POST https://example.com/upload \
  -F "file=@photo.jpg" \
  -F "name=test"
# Content-Type: multipart/form-data is set automatically

# Upload multiple files
curl -X POST https://example.com/upload \
  -F "files[]=@file1.pdf" \
  -F "files[]=@file2.pdf" \
  -F "description=Documents"

# Explicitly specify the Content-Type of the file
curl -X POST https://example.com/upload \
  -F "file=@data.csv;type=text/csv"

# Upload with a different filename
curl -X POST https://example.com/upload \
  -F "file=@local_name.jpg;filename=uploaded.jpg"

# Upload a large file (with progress display)
curl -X POST https://example.com/upload \
  -F "file=@large_file.zip" \
  --progress-bar
```

### 2.3 PUT / PATCH / DELETE

```bash
# PUT (complete replacement of a resource)
curl -X PUT https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name", "email": "new@example.com"}'

# PATCH (partial update of a resource)
curl -X PATCH https://api.example.com/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Patched Name"}'

# DELETE
curl -X DELETE https://api.example.com/users/1

# DELETE with body (used by some APIs)
curl -X DELETE https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3]}'

# OPTIONS (checking CORS preflight)
curl -X OPTIONS https://api.example.com/users \
  -H "Origin: https://frontend.example.com" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

---

## 3. Authentication

### 3.1 Basic Authentication

```bash
# Basic authentication
curl -u username:password https://api.example.com
# Authorization: Basic base64(username:password) is set automatically

# Enter password via prompt (avoids leaving it in command history)
curl -u username https://api.example.com
# You will be prompted for the password

# Use a .netrc file (store credentials in a file)
# ~/.netrc:
# machine api.example.com
# login username
# password secret
curl -n https://api.example.com              # Use .netrc
curl --netrc-file /path/to/netrc https://api.example.com
```

### 3.2 Bearer Token / API Key

```bash
# Bearer token (OAuth2, etc.)
curl -H "Authorization: Bearer TOKEN_HERE" https://api.example.com

# Use a variable (recommended)
TOKEN="your_api_token_here"
curl -H "Authorization: Bearer $TOKEN" https://api.example.com

# Read from an environment variable
curl -H "Authorization: Bearer ${API_TOKEN}" https://api.example.com

# API key (header)
curl -H "X-API-Key: KEY_HERE" https://api.example.com

# API key (query parameter)
curl "https://api.example.com/data?api_key=KEY_HERE"

# AWS Signature v4 (typically done via AWS CLI)
curl --aws-sigv4 "aws:amz:us-east-1:s3" \
  --user "$AWS_ACCESS_KEY_ID:$AWS_SECRET_ACCESS_KEY" \
  https://s3.amazonaws.com/bucket/key
```

### 3.3 Cookie

```bash
# Send cookies
curl -b "session=abc123; lang=en" https://example.com

# Save cookies to a file (saves Set-Cookie from response)
curl -c cookies.txt https://example.com/login \
  -d "username=gaku&password=secret"

# Send saved cookies
curl -b cookies.txt https://example.com/dashboard

# Save and send cookies simultaneously (maintain session)
curl -b cookies.txt -c cookies.txt https://example.com/api/data

# Session management using a cookie jar (series of requests)
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

# Login
curl -s -c "$COOKIE_JAR" https://example.com/login \
  -d "username=gaku&password=secret"

# Fetch data using the session
curl -s -b "$COOKIE_JAR" https://example.com/api/data

# Logout
curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" https://example.com/logout
```

### 3.4 Client Certificate

```bash
# Authenticate with a client certificate
curl --cert client.pem --key client-key.pem https://secure.example.com

# PKCS#12 format
curl --cert client.p12:password https://secure.example.com

# Specify CA certificate
curl --cacert ca-bundle.crt https://example.com

# Skip certificate validation (development environment only)
curl -k https://self-signed.example.com
# Warning: never use this in production
```

---

## 4. Advanced Options

### 4.1 Timeouts and Retries

```bash
# Connection timeout (until TCP connection is established)
curl --connect-timeout 5 https://example.com

# Total timeout (entire request)
curl --max-time 30 https://example.com

# Specify both (recommended)
curl --connect-timeout 5 --max-time 30 https://example.com

# Retries
curl --retry 3 https://example.com
curl --retry 3 --retry-delay 2 https://example.com          # 2-second interval
curl --retry 3 --retry-max-time 60 https://example.com      # Up to 60 seconds total for retries
curl --retry 3 --retry-all-errors https://example.com        # Retry on all errors
# By default, only retries on timeouts and some HTTP errors

# DNS resolution timeout
curl --dns-servers 8.8.8.8 https://example.com  # Specify DNS server
curl --resolve example.com:443:93.184.216.34 https://example.com  # Override DNS resolution
```

### 4.2 Proxy

```bash
# HTTP proxy
curl -x http://proxy:8080 https://example.com
curl --proxy http://proxy:8080 https://example.com

# Proxy with authentication
curl -x http://user:pass@proxy:8080 https://example.com
curl --proxy-user user:pass -x http://proxy:8080 https://example.com

# SOCKS proxy
curl --proxy socks5://proxy:1080 https://example.com
curl --proxy socks5h://proxy:1080 https://example.com  # DNS also goes through proxy

# No proxy
curl --noproxy "*" https://example.com
curl --noproxy "localhost,127.0.0.1,.internal.com" https://example.com

# Configure proxy via environment variables
export http_proxy=http://proxy:8080
export https_proxy=http://proxy:8080
export no_proxy=localhost,127.0.0.1
curl https://example.com   # Uses proxy from environment variables
```

### 4.3 SSL/TLS

```bash
# Skip certificate validation (development environment only)
curl -k https://self-signed.example.com

# Specify CA certificate
curl --cacert ca.pem https://example.com

# Specify CA certificate directory
curl --capath /etc/ssl/certs https://example.com

# Specify TLS version
curl --tlsv1.2 https://example.com           # TLS 1.2 or higher
curl --tlsv1.3 https://example.com           # TLS 1.3 or higher

# Specify cipher suite
curl --ciphers "ECDHE-RSA-AES256-GCM-SHA384" https://example.com

# Display certificate information
curl -vI https://example.com 2>&1 | grep -A 5 "Server certificate"

# Check HSTS
curl -sI https://example.com | grep -i "strict-transport-security"
```

### 4.4 Retrieving Response Information (-w option)

```bash
# Get only the status code
curl -s -o /dev/null -w "%{http_code}" https://example.com
# Output: 200

# Get response time
curl -s -o /dev/null -w "%{time_total}" https://example.com
# Output: 0.123456

# Detailed timing information
curl -s -o /dev/null -w "\
DNS Lookup:      %{time_namelookup}s\n\
TCP Connect:     %{time_connect}s\n\
TLS Handshake:   %{time_appconnect}s\n\
Redirect:        %{time_redirect}s\n\
TTFB:            %{time_starttransfer}s\n\
Total:           %{time_total}s\n\
" https://example.com

# Main variables available with -w
# %{http_code}:          Status code
# %{http_version}:       HTTP version
# %{url_effective}:      Final URL (after redirect)
# %{content_type}:       Content-Type
# %{size_download}:      Download size (bytes)
# %{size_header}:        Header size
# %{speed_download}:     Download speed (bytes/sec)
# %{time_namelookup}:    DNS lookup time
# %{time_connect}:       TCP connection time
# %{time_appconnect}:    TLS handshake completion time
# %{time_pretransfer}:   Time before transfer starts
# %{time_starttransfer}: Time to first byte (TTFB)
# %{time_redirect}:      Redirect time
# %{time_total}:         Total time
# %{num_redirects}:      Number of redirects
# %{ssl_verify_result}:  SSL verification result (0=success)
# %{local_ip}:           Local IP address
# %{remote_ip}:          Remote IP address
# %{remote_port}:        Remote port

# Output in JSON format
curl -s -o /dev/null -w '{"code":%{http_code},"time":%{time_total},"size":%{size_download}}' \
  https://example.com

# Read format from a file
# format.txt: %{http_code}\t%{time_total}\t%{url_effective}\n
curl -s -o /dev/null -w @format.txt https://example.com
```

### 4.5 Download Control

```bash
# Resume a download
curl -C - -O https://example.com/large.zip
# -C -: Automatically resume from where it left off

# Bandwidth limit
curl --limit-rate 1M -O https://example.com/large.zip  # 1MB/s

# Progress bar
curl --progress-bar -O https://example.com/large.zip
# #####################################    85%

# Maximum file size limit
curl --max-filesize 10485760 -O https://example.com/file.zip
# Abort if over 10MB

# Conditional download (fetch only if updated)
curl -z "2024-01-01" https://example.com/file.txt  # If updated after the specified date
curl -z localfile.txt -O https://example.com/file.txt  # If newer than local file

# Parallel download (curl 7.66+)
curl --parallel --parallel-max 5 \
  -O https://example.com/file1.zip \
  -O https://example.com/file2.zip \
  -O https://example.com/file3.zip
```

### 4.6 curl Configuration File

```bash
# Write common settings in ~/.curlrc
# Example:
# --connect-timeout 10
# --max-time 60
# --retry 3
# --silent
# --show-error
# --location
# --user-agent "MyCurlClient/1.0"

# Ignore the configuration file
curl -q https://example.com

# Specify a different configuration file
curl -K /path/to/config https://example.com
curl --config /path/to/config https://example.com

# Example configuration file (api_config.txt):
# url = "https://api.example.com/data"
# header = "Authorization: Bearer TOKEN"
# header = "Accept: application/json"
# silent
# show-error

# Usage
curl -K api_config.txt
```

---

## 5. wget

### 5.1 Basic Download

```bash
# Basic: wget [options] URL

# File download
wget https://example.com/file.zip             # Download
wget -O output.zip https://example.com/file   # Specify filename
wget -O - https://example.com                 # Output to stdout
wget -c https://example.com/large.zip         # Resume an interrupted download
wget -q https://example.com/file.zip          # Download quietly
wget -nv https://example.com/file.zip         # Simple output

# Multiple files
wget -i urls.txt                              # Batch download from a URL list

# Bandwidth limit
wget --limit-rate=1m https://example.com/large.zip  # 1MB/s limit

# User agent
wget -U "Mozilla/5.0" https://example.com

# Background download
wget -b https://example.com/large.zip
# Log is output to wget-log
tail -f wget-log                              # Check progress
```

### 5.2 Recursive Download / Mirroring

```bash
# Mirroring (download an entire website)
wget -m https://example.com                   # Mirror
wget -m -p -k https://example.com             # Include files needed for page display
# -m: Mirror (recursive + timestamps + unlimited depth)
# -p: Images/CSS/JS needed for page display
# -k: Convert to local links

# Complete offline copy
wget -m -p -k -E https://example.com
# -E: Add .html extension

# Recursive download
wget -r -l 2 https://example.com              # Recurse up to depth 2
wget -r --accept=pdf https://example.com      # PDFs only
wget -r --reject=jpg,png https://example.com  # Exclude images
wget -r -A "*.pdf,*.doc" https://example.com  # Only PDFs and DOCs
wget -r -R "*.exe,*.zip" https://example.com  # Exclude exe and zip

# Domain restriction
wget -r -np https://example.com/docs/         # Do not ascend to parent directory
wget -r -D example.com https://example.com    # Specified domain only
wget -r --exclude-domains=ads.example.com https://example.com

# Wait (reduce server load)
wget -r -w 2 https://example.com              # 2-second interval
wget -r --random-wait https://example.com     # Random interval (0.5–1.5x)
wget -r -w 1 --random-wait https://example.com  # Random interval of 0.5–1.5 seconds

# Ignore robots exclusion (use with caution)
wget -r -e robots=off https://example.com
```

### 5.3 Authentication and Security

```bash
# Basic authentication
wget --user=username --password=password https://secure.example.com

# Password prompt
wget --user=username --ask-password https://secure.example.com

# Cookie
wget --load-cookies cookies.txt https://example.com
wget --save-cookies cookies.txt https://example.com

# SSL certificate
wget --no-check-certificate https://self-signed.example.com  # Skip validation
wget --ca-certificate=ca.pem https://example.com             # Specify CA

# Add headers
wget --header="Authorization: Bearer TOKEN" https://api.example.com
wget --header="Accept: application/json" https://api.example.com

# POST request
wget --post-data="username=gaku&password=secret" https://example.com/login
wget --post-file=data.json --header="Content-Type: application/json" \
  https://api.example.com/users
```

---

## 6. curl vs wget Comparison

```
┌──────────────────┬────────────────────┬────────────────────┐
│ Feature          │ curl               │ wget               │
├──────────────────┼────────────────────┼────────────────────┤
│ Main use case    │ API/debug          │ File download      │
│ HTTP methods     │ All methods        │ GET/POST           │
│ Protocols        │ Many (FTP,SMTP...) │ HTTP/FTP           │
│ Recursive DL     │ Not supported      │ Supported          │
│ Resume           │ -C -               │ -c                 │
│ Output           │ stdout (default)   │ File               │
│ JSON support     │ --json option      │ Not supported      │
│ Piping           │ Excellent          │ Not ideal          │
│ Cookie handling  │ -b/-c options      │ --cookies          │
│ SSL control      │ Fine-grained       │ Basic control      │
│ Timing           │ -w for details     │ Not supported      │
│ Parallel DL      │ --parallel (7.66+) │ No (use xargs)     │
│ robots.txt       │ Ignored            │ Respected (default)│
│ Mirroring        │ Not supported      │ -m option          │
│ WebSocket        │ Supported (7.86+)  │ Not supported      │
│ HTTP/2           │ Supported          │ Supported (2.0+)   │
│ HTTP/3           │ Supported (exp.)   │ Not supported      │
└──────────────────┴────────────────────┴────────────────────┘

Usage guide:
  API development/debugging    → curl (flexible method/header/auth control)
  File download                → wget (curl -O also works)
  Website mirroring            → wget -m
  Pipeline processing          → curl -s
  CI/CD scripts                → curl (more widely available)
  JSON API testing             → curl + jq
  Health check                 → curl -s -o /dev/null -w "%{http_code}"
  Response time measurement    → curl -w
```

---

## 7. Combining with jq (JSON Processing)

### 7.1 Basic Usage

```bash
# jq: A tool for parsing, formatting, and transforming JSON
# Install:
# macOS: brew install jq
# Ubuntu: sudo apt install jq

# Format a JSON response
curl -s https://api.github.com/users/octocat | jq '.'

# Extract a specific field
curl -s https://api.github.com/users/octocat | jq '.name'
# "The Octocat"

# Extract multiple fields
curl -s https://api.github.com/users/octocat | jq '{name: .name, id: .id, location: .location}'

# Get as a string (without quotes)
curl -s https://api.github.com/users/octocat | jq -r '.name'
# The Octocat (without quotes)
```

### 7.2 Processing Arrays

```bash
# A specific field from all array elements
curl -s https://api.github.com/users/octocat/repos | jq '.[].name'

# First element of an array
curl -s https://api.github.com/users/octocat/repos | jq '.[0]'

# Array slice
curl -s https://api.github.com/users/octocat/repos | jq '.[:5]'  # First 5

# Array length
curl -s https://api.github.com/users/octocat/repos | jq 'length'

# Build objects
curl -s https://api.github.com/users/octocat/repos \
  | jq '.[] | {name, stars: .stargazers_count, lang: .language}'

# Output in table format
curl -s https://api.github.com/users/octocat/repos \
  | jq -r '.[] | "\(.name)\t\(.stargazers_count)\t\(.language)"' \
  | sort -t$'\t' -k2 -rn \
  | head -10
```

### 7.3 Filtering and Transformation

```bash
# Filter by condition
curl -s https://api.github.com/users/octocat/repos \
  | jq '[.[] | select(.stargazers_count > 100)]'

# Filter by language
curl -s https://api.github.com/users/octocat/repos \
  | jq '[.[] | select(.language == "Ruby")]'

# Only non-null values
curl -s https://api.github.com/users/octocat/repos \
  | jq '[.[] | select(.language != null)]'

# Sort
curl -s https://api.github.com/users/octocat/repos \
  | jq 'sort_by(-.stargazers_count) | .[:5]'

# Group (number of repositories per language)
curl -s https://api.github.com/users/octocat/repos \
  | jq 'group_by(.language) | map({language: .[0].language, count: length}) | sort_by(-.count)'

# Aggregation
curl -s https://api.github.com/users/octocat/repos \
  | jq '[.[].stargazers_count] | add'  # Total star count

# map / reduce
curl -s https://api.github.com/users/octocat/repos \
  | jq 'map(.name) | join(", ")'  # Join names with commas

# if-then-else
curl -s https://api.github.com/users/octocat/repos \
  | jq '.[] | {name, popularity: (if .stargazers_count > 1000 then "popular" elif .stargazers_count > 100 then "moderate" else "niche" end)}'
```

### 7.4 Advanced jq Usage

```bash
# Update JSON (modify input and output)
echo '{"name":"Gaku","age":30}' | jq '.age = 31'

# Add a field
echo '{"name":"Gaku"}' | jq '. + {country: "Japan"}'

# Delete a field
echo '{"name":"Gaku","age":30,"email":"a@b.com"}' | jq 'del(.email)'

# Type conversion
echo '{"count":"42"}' | jq '.count | tonumber'

# Convert to CSV
curl -s https://api.github.com/users/octocat/repos \
  | jq -r '.[] | [.name, .stargazers_count, .language // "N/A"] | @csv'

# Convert to TSV
curl -s https://api.github.com/users/octocat/repos \
  | jq -r '.[] | [.name, .stargazers_count, .language // "N/A"] | @tsv'

# Convert to HTML
curl -s https://api.github.com/users/octocat/repos \
  | jq -r '.[] | "<li>\(.name) (\(.stargazers_count) stars)</li>"'

# Use variables
curl -s https://api.github.com/users/octocat/repos \
  | jq --arg lang "Ruby" '[.[] | select(.language == $lang)]'

# Process multiple JSON files
jq -s '.' file1.json file2.json  # Combine into an array
jq -s 'add' file1.json file2.json  # Merge
```

---

## 8. Practical Patterns

### 8.1 API Health Check

```bash
# Basic health check
check_api() {
    local url=$1
    local timeout=${2:-5}
    local status

    status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$timeout" --max-time "$timeout" "$url")

    if [ "$status" -eq 200 ]; then
        echo "OK: $url (${status})"
        return 0
    else
        echo "FAIL: $url (${status})"
        return 1
    fi
}

# Single endpoint
check_api "https://api.example.com/health"

# Multiple endpoints
for endpoint in /health /ready /metrics; do
    check_api "https://api.example.com${endpoint}"
done

# Check JSON response
check_api_json() {
    local url=$1
    local expected_field=$2
    local expected_value=$3

    local response
    response=$(curl -s --max-time 5 "$url")

    local actual
    actual=$(echo "$response" | jq -r ".$expected_field" 2>/dev/null)

    if [ "$actual" = "$expected_value" ]; then
        echo "OK: $url ($expected_field = $expected_value)"
        return 0
    else
        echo "FAIL: $url ($expected_field = $actual, expected $expected_value)"
        return 1
    fi
}

check_api_json "https://api.example.com/health" "status" "ok"
```

### 8.2 Response Time Measurement

```bash
# Measure response time for multiple endpoints
for endpoint in /users /posts /comments; do
    time=$(curl -s -o /dev/null -w "%{time_total}" "https://api.example.com$endpoint")
    echo "$endpoint: ${time}s"
done

# Detailed timing measurement script
measure_api() {
    local url=$1
    curl -s -o /dev/null -w "\
URL: %{url_effective}\n\
Status: %{http_code}\n\
DNS Lookup: %{time_namelookup}s\n\
TCP Connect: %{time_connect}s\n\
TLS: %{time_appconnect}s\n\
TTFB: %{time_starttransfer}s\n\
Total: %{time_total}s\n\
Size: %{size_download} bytes\n\
Speed: %{speed_download} bytes/s\n\
---\n\
" "$url"
}

# Measure multiple times and compute average
measure_avg() {
    local url=$1
    local count=${2:-10}
    local total=0

    for i in $(seq 1 "$count"); do
        time=$(curl -s -o /dev/null -w "%{time_total}" "$url")
        total=$(echo "$total + $time" | bc)
        echo "  Trial $i: ${time}s"
    done

    avg=$(echo "scale=4; $total / $count" | bc)
    echo "Average: ${avg}s ($count trials)"
}

measure_avg "https://api.example.com/health" 5
```

### 8.3 Parallel File Download

```bash
# Parallel download using xargs
cat urls.txt | xargs -P 4 -I {} curl -sOL {}
# -P 4: 4 parallel
# -s: silent
# -O: save with original filename
# -L: follow redirects

# aria2c (high-speed downloader)
# brew install aria2
aria2c -x 16 -s 16 https://example.com/large.zip
# -x 16: up to 16 connections
# -s 16: 16-segment download

# wget + xargs
cat urls.txt | xargs -P 4 -I {} wget -q {}

# curl built-in parallel (7.66+)
curl --parallel --parallel-max 4 \
  -O https://example.com/file1.zip \
  -O https://example.com/file2.zip \
  -O https://example.com/file3.zip \
  -O https://example.com/file4.zip
```

### 8.4 Webhook Testing

```bash
# Slack Webhook
curl -X POST https://hooks.slack.com/services/XXX/YYY/ZZZ \
  -H "Content-Type: application/json" \
  -d '{"text": "Deploy completed! :rocket:"}'

# Discord Webhook
curl -X POST "https://discord.com/api/webhooks/ID/TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Deploy completed!"}'

# GitHub API (create an Issue)
curl -X POST https://api.github.com/repos/owner/repo/issues \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -d '{"title": "Bug report", "body": "Description here", "labels": ["bug"]}'

# PagerDuty alert
curl -X POST https://events.pagerduty.com/v2/enqueue \
  -H "Content-Type: application/json" \
  -d '{
    "routing_key": "ROUTING_KEY",
    "event_action": "trigger",
    "payload": {
      "summary": "Server CPU > 90%",
      "severity": "critical",
      "source": "web-server-01"
    }
  }'
```

### 8.5 REST API CRUD Testing

```bash
#!/bin/bash
# api_crud_test.sh - REST API CRUD test

BASE_URL="${1:-https://jsonplaceholder.typicode.com}"
TOKEN="${API_TOKEN:-}"
AUTH_HEADER=""
[ -n "$TOKEN" ] && AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""

echo "=== REST API CRUD Test ==="
echo "Base URL: $BASE_URL"
echo ""

# Create
echo "--- CREATE (POST) ---"
CREATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/posts" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Post", "body": "Hello, World!", "userId": 1}')
CREATE_BODY=$(echo "$CREATE_RESPONSE" | head -n -1)
CREATE_STATUS=$(echo "$CREATE_RESPONSE" | tail -1)
echo "Status: $CREATE_STATUS"
echo "Response: $(echo "$CREATE_BODY" | jq -c '.')"
CREATED_ID=$(echo "$CREATE_BODY" | jq -r '.id')
echo ""

# Read (single)
echo "--- READ (GET) ---"
READ_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/posts/1")
READ_STATUS=$(echo "$READ_RESPONSE" | tail -1)
echo "Status: $READ_STATUS"
echo "Response: $(echo "$READ_RESPONSE" | head -n -1 | jq -c '{id, title}')"
echo ""

# Read (list)
echo "--- READ LIST (GET) ---"
LIST_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/posts?_limit=3")
LIST_STATUS=$(echo "$LIST_RESPONSE" | tail -1)
echo "Status: $LIST_STATUS"
echo "Count: $(echo "$LIST_RESPONSE" | head -n -1 | jq 'length')"
echo ""

# Update
echo "--- UPDATE (PUT) ---"
UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"id": 1, "title": "Updated Title", "body": "Updated body", "userId": 1}')
UPDATE_STATUS=$(echo "$UPDATE_RESPONSE" | tail -1)
echo "Status: $UPDATE_STATUS"
echo "Response: $(echo "$UPDATE_RESPONSE" | head -n -1 | jq -c '{id, title}')"
echo ""

# Partial Update
echo "--- PARTIAL UPDATE (PATCH) ---"
PATCH_RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"title": "Patched Title"}')
PATCH_STATUS=$(echo "$PATCH_RESPONSE" | tail -1)
echo "Status: $PATCH_STATUS"
echo "Response: $(echo "$PATCH_RESPONSE" | head -n -1 | jq -c '{id, title}')"
echo ""

# Delete
echo "--- DELETE ---"
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/posts/1")
echo "Status: $DELETE_STATUS"
echo ""

echo "=== Test Complete ==="
```

### 8.6 API Monitoring Script

```bash
#!/bin/bash
# api_monitor.sh - Continuous API monitoring script

ENDPOINTS=(
    "https://api.example.com/health"
    "https://api.example.com/v1/status"
    "https://web.example.com/"
)
CHECK_INTERVAL=60
TIMEOUT=10
LOG_FILE="/tmp/api_monitor.log"
ALERT_THRESHOLD=3  # Consecutive failure count

declare -A FAIL_COUNTS

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_endpoint() {
    local url=$1
    local result

    result=$(curl -s -o /dev/null \
        -w "%{http_code},%{time_total},%{size_download}" \
        --connect-timeout "$TIMEOUT" \
        --max-time "$TIMEOUT" \
        "$url" 2>/dev/null)

    local status=$(echo "$result" | cut -d, -f1)
    local time=$(echo "$result" | cut -d, -f2)
    local size=$(echo "$result" | cut -d, -f3)

    if [ "$status" -ge 200 ] && [ "$status" -lt 400 ]; then
        FAIL_COUNTS[$url]=0
        log "OK $url status=$status time=${time}s size=${size}b"
        return 0
    else
        local count=${FAIL_COUNTS[$url]:-0}
        count=$((count + 1))
        FAIL_COUNTS[$url]=$count

        log "FAIL $url status=$status time=${time}s (consecutive failure #${count})"

        if [ "$count" -ge "$ALERT_THRESHOLD" ]; then
            log "ALERT: $url has failed ${count} times consecutively"
            # Send alert (Slack, PagerDuty, etc.)
            # curl -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"ALERT: $url down\"}"
        fi
        return 1
    fi
}

log "Monitoring started (${#ENDPOINTS[@]} endpoints, ${CHECK_INTERVAL}s interval)"

while true; do
    for url in "${ENDPOINTS[@]}"; do
        check_endpoint "$url"
    done
    sleep "$CHECK_INTERVAL"
done
```

### 8.7 Smoke Test with curl

```bash
#!/bin/bash
# smoke_test.sh - Smoke test after deployment

BASE_URL="${1:?Usage: $0 <base_url>}"
PASSED=0
FAILED=0
TOTAL=0

assert_status() {
    local description=$1
    local expected_status=$2
    local url=$3
    shift 3  # Remaining args are curl options

    TOTAL=$((TOTAL + 1))
    local actual_status
    actual_status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$@" "$url")

    if [ "$actual_status" = "$expected_status" ]; then
        echo "  PASS: $description (status=$actual_status)"
        PASSED=$((PASSED + 1))
    else
        echo "  FAIL: $description (expected=$expected_status, actual=$actual_status)"
        FAILED=$((FAILED + 1))
    fi
}

assert_contains() {
    local description=$1
    local expected_text=$2
    local url=$3

    TOTAL=$((TOTAL + 1))
    local body
    body=$(curl -s --max-time 10 "$url")

    if echo "$body" | grep -q "$expected_text"; then
        echo "  PASS: $description"
        PASSED=$((PASSED + 1))
    else
        echo "  FAIL: $description (body does not contain '$expected_text')"
        FAILED=$((FAILED + 1))
    fi
}

echo "=== Smoke Test: $BASE_URL ==="
echo ""

# Health check
assert_status "Health check" "200" "$BASE_URL/health"

# Top page
assert_status "Top page" "200" "$BASE_URL/"
assert_contains "Top page contains title" "<title>" "$BASE_URL/"

# API endpoint
assert_status "API v1 status" "200" "$BASE_URL/api/v1/status"

# Reject unauthenticated access
assert_status "No auth → 401" "401" "$BASE_URL/api/v1/protected"

# Non-existent page
assert_status "404 page" "404" "$BASE_URL/nonexistent-page"

# Redirect
assert_status "HTTP → HTTPS redirect" "301" "http://${BASE_URL#https://}/"

echo ""
echo "=== Results: $PASSED/$TOTAL passed, $FAILED/$TOTAL failed ==="

if [ "$FAILED" -gt 0 ]; then
    exit 1
fi
```

---

## 9. Security Best Practices

```bash
# 1. Do not write credentials directly on the command line
# Bad example (visible in ps, remains in history)
curl -u "user:password" https://api.example.com

# Good example (use .netrc file)
curl -n https://api.example.com

# Good example (use environment variables)
curl -H "Authorization: Bearer ${API_TOKEN}" https://api.example.com

# 2. Always use HTTPS
# curl verifies certificates by default → -k should only be used in development

# 3. Validate the response
response=$(curl -s -w "\n%{http_code}" https://api.example.com/data)
status=$(echo "$response" | tail -1)
body=$(echo "$response" | head -n -1)
if [ "$status" != "200" ]; then
    echo "Error: status $status" >&2
    exit 1
fi

# 4. Always set timeouts
curl --connect-timeout 5 --max-time 30 https://api.example.com

# 5. Sanitize output (do not leave credentials in logs)
curl -v https://api.example.com 2>&1 | sed 's/Authorization:.*/Authorization: [REDACTED]/'

# 6. Set defaults in .curlrc
# ~/.curlrc:
# --connect-timeout 10
# --max-time 60
# --location
# --fail

# 7. Handle temporary files securely
TMPFILE=$(mktemp)
chmod 600 "$TMPFILE"
trap "rm -f $TMPFILE" EXIT
curl -s https://api.example.com/data > "$TMPFILE"
```

---

## 10. Frequently Asked Questions (FAQ)

### Q1: Which should I use, curl or wget?

```bash
# Basic usage guide:
# - API operations / REST requests → curl (flexible control of methods, headers, body)
# - File download → wget (recursive download, mirroring)
# - Automation scripts → curl (richer return values and output customization)
# - Unstable bandwidth → wget (-c supports resume natively)

# curl can also be used like wget
curl -LOC - https://example.com/large.zip
# -L: follow redirects
# -O: save with original filename
# -C -: resume from interruption
```

### Q2: What if the curl request body is too large for the command line?

```bash
# Method 1: Read from a file (@ prefix)
curl -X POST https://api.example.com/data \
  -H "Content-Type: application/json" \
  -d @request.json

# Method 2: Read from stdin (@-)
cat request.json | curl -X POST https://api.example.com/data \
  -H "Content-Type: application/json" \
  -d @-

# Method 3: Here document
curl -X POST https://api.example.com/data \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "title": "Large request",
  "items": [1, 2, 3, 4, 5]
}
EOF
```

### Q3: How do I get only the response headers with curl?

```bash
# HEAD request (-I)
curl -I https://example.com
# Response headers only for GET (-sD - -o /dev/null)
curl -sD - -o /dev/null https://example.com
# Get a specific header only
curl -sI https://example.com | grep -i "content-type"
# Also available with -w (curl 7.84+)
curl -s -o /dev/null -w "%header{content-type}" https://example.com
```

### Q4: How do I use cookies with curl?

```bash
# Send cookies
curl -b "session=abc123; lang=en" https://example.com

# Save cookies to a file
curl -c cookies.txt https://example.com/login -d "user=admin&pass=secret"

# Use saved cookies in a request
curl -b cookies.txt https://example.com/dashboard

# Save and send cookies simultaneously (maintain session)
curl -b cookies.txt -c cookies.txt https://example.com/page1
curl -b cookies.txt -c cookies.txt https://example.com/page2
```

### Q5: How do I process JSON in environments where jq is not installed?

```bash
# Use Python (available in most environments)
curl -s https://api.example.com/data | python3 -m json.tool

# Extract a specific field
curl -s https://api.example.com/data | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(data['name'])
"

# Quick extraction with grep (not recommended, for emergencies only)
curl -s https://api.example.com/data | grep -o '"name":"[^"]*"' | head -1

# Quick formatting with sed
curl -s https://api.example.com/data | sed 's/,/,\n/g; s/{/{\n/g; s/}/\n}/g'

# If Node.js is available
curl -s https://api.example.com/data | node -e "
const chunks = [];
process.stdin.on('data', c => chunks.push(c));
process.stdin.on('end', () => {
  const data = JSON.parse(chunks.join(''));
  console.log(data.name);
});
"
```

### Q6: How do I handle SSL certificate errors?

```bash
# Check certificate details
curl -vI https://example.com 2>&1 | grep -A5 "SSL certificate"

# Allow self-signed certificates (development environment only!)
curl -k https://localhost:8443/api

# Explicitly specify CA certificate
curl --cacert /path/to/ca-bundle.crt https://example.com

# Check certificate chain
openssl s_client -connect example.com:443 -showcerts </dev/null 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer

# In production, do not use -k — fix the certificate issue at its root
```


---

## Practical Exercises

### Exercise 1: Basic Implementation

Implement code that satisfies the following requirements.

**Requirements:**
- Validate input data
- Implement proper error handling
- Write test code as well

```python
# Exercise 1: Basic implementation template
class Exercise1:
    """Exercise on basic implementation patterns"""

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

# Test
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
    """Exercise on applied patterns"""

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

# Test
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
- Be aware of algorithmic complexity
- Choose appropriate data structures
- Measure the effect with benchmarks

---

## Troubleshooting

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| Initialization error | Invalid configuration file | Check the config file path and format |
| Timeout | Network delay / insufficient resources | Adjust timeout values, add retry logic |
| Out of memory | Increased data volume | Introduce batch processing, implement pagination |
| Permission error | Insufficient access rights | Check the execution user's permissions, review settings |
| Data inconsistency | Concurrent processing race condition | Introduce locking, manage transactions |

### Debugging Steps

1. **Check the error message**: Read the stack trace to identify where it occurred
2. **Establish reproduction steps**: Reproduce the error with minimal code
3. **Form hypotheses**: List possible causes
4. **Verify incrementally**: Use log output or a debugger to verify hypotheses
5. **Fix and run regression tests**: After fixing, also run tests for related areas

```python
# Debugging utility
import logging
import traceback
from functools import wraps

# Logger configuration
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

def debug_decorator(func):
    """Decorator that logs function input and output"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        logger.debug(f"Call: {func.__name__}(args={args}, kwargs={kwargs})")
        try:
            result = func(*args, **kwargs)
            logger.debug(f"Return: {func.__name__} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Exception in: {func.__name__}: {e}")
            logger.error(traceback.format_exc())
            raise
    return wrapper

@debug_decorator
def process_data(items):
    """Data processing (debug target)"""
    if not items:
        raise ValueError("Empty data")
    return [item * 2 for item in items]
```

### Diagnosing Performance Issues

Steps for diagnosing performance issues:

1. **Identify the bottleneck**: Measure with profiling tools
2. **Check memory usage**: Look for memory leaks
3. **Check for I/O waits**: Check disk and network I/O status
4. **Check concurrent connections**: Check connection pool status

| Issue type | Diagnostic tool | Solution |
|------------|----------------|---------|
| High CPU load | cProfile, py-spy | Algorithm improvement, parallelization |
| Memory leak | tracemalloc, objgraph | Properly release references |
| I/O bottleneck | strace, iostat | Async I/O, caching |
| DB latency | EXPLAIN, slow query log | Indexes, query optimization |

---

## Design Decision Guide

### Selection Criteria Matrix

The following summarizes the criteria for making technology choices.

| Criteria | When to prioritize | When to compromise |
|----------|-------------------|--------------------|
| Performance | Real-time processing, large-scale data | Admin panels, batch processing |
| Maintainability | Long-term operation, team development | Prototypes, short-term projects |
| Scalability | Services expected to grow | Internal tools, fixed user base |
| Security | Personal info, financial data | Public data, internal use |
| Development speed | MVP, time-to-market | Quality-focused, mission-critical |

### Choosing an Architecture Pattern

```
┌─────────────────────────────────────────────────┐
│           Architecture Selection Flow            │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. What is the team size?                       │
│    ├─ Small (1-5) → Monolith                     │
│    └─ Large (10+) → Go to 2                      │
│                                                 │
│  2. How often do you deploy?                     │
│    ├─ Once a week or less → Monolith + modules   │
│    └─ Daily / multiple times → Go to 3           │
│                                                 │
│  3. How independent are the teams?               │
│    ├─ High → Microservices                       │
│    └─ Medium → Modular monolith                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Trade-off Analysis

Every technical decision involves trade-offs. Analyze from the following perspectives:

**1. Short-term vs long-term costs**
- A fast short-term approach can become technical debt in the long run
- Conversely, over-engineering has high short-term costs and can delay projects

**2. Consistency vs flexibility**
- A unified technology stack has lower learning costs
- Adopting diverse technologies allows the right tool for the job, but increases operational costs

**3. Level of abstraction**
- High abstraction improves reusability but can make debugging difficult
- Low abstraction is intuitive but prone to code duplication

```python
# Design decision record template
class ArchitectureDecisionRecord:
    """Create an ADR (Architecture Decision Record)"""

    def __init__(self, title: str):
        self.title = title
        self.context = ""
        self.decision = ""
        self.consequences = []
        self.alternatives = []

    def set_context(self, context: str):
        """Describe background and issues"""
        self.context = context
        return self

    def set_decision(self, decision: str):
        """Describe the decision"""
        self.decision = decision
        return self

    def add_consequence(self, consequence: str, positive: bool = True):
        """Add a consequence"""
        self.consequences.append({
            'description': consequence,
            'type': 'positive' if positive else 'negative'
        })
        return self

    def add_alternative(self, name: str, reason_rejected: str):
        """Add a rejected alternative"""
        self.alternatives.append({
            'name': name,
            'reason_rejected': reason_rejected
        })
        return self

    def to_markdown(self) -> str:
        """Output in Markdown format"""
        md = f"# ADR: {self.title}\n\n"
        md += f"## Background\n{self.context}\n\n"
        md += f"## Decision\n{self.decision}\n\n"
        md += "## Consequences\n"
        for c in self.consequences:
            icon = "✅" if c['type'] == 'positive' else "⚠️"
            md += f"- {icon} {c['description']}\n"
        md += "\n## Rejected Alternatives\n"
        for a in self.alternatives:
            md += f"- **{a['name']}**: {a['reason_rejected']}\n"
        return md
```
---


## FAQ

### Q1: What is the most important point when learning this topic?

Accumulating hands-on experience is most important. Understanding deepens not just through theory but by actually writing code and verifying its behavior.

### Q2: What mistakes do beginners commonly make?

Skipping the basics and jumping to advanced topics. We recommend thoroughly understanding the fundamental concepts explained in this guide before moving on to the next step.

### Q3: How is this used in practice?

Knowledge of this topic is frequently applied in day-to-day development work. It becomes especially important during code reviews and architecture design.

---

## Summary

| Command | Purpose | Common options |
|---------|---------|---------------|
| curl -s URL | GET request | -s (silent), -S (show errors) |
| curl -X POST --json '{...}' | JSON POST | --json (curl 7.82+) |
| curl -H "Authorization: Bearer TOKEN" | Authenticated request | -H (add header) |
| curl -w "%{http_code}" | Get status code | Combine with -o /dev/null |
| curl -w "%{time_total}" | Get response time | |
| curl -L | Follow redirects | Limit with --max-redirs |
| curl --connect-timeout 5 --max-time 30 | Set timeouts | Always set these |
| curl --retry 3 | Retry | --retry-delay, --retry-all-errors |
| wget -c URL | Resumable download | -q (quiet), -O (output path) |
| wget -m URL | Mirror a website | -p -k for complete copy |
| jq '.field' | Parse JSON | -r (raw output), -c (compact) |

---

## What to Read Next

---

## References
1. Stenberg, D. "Everything curl." curl.se, 2024.
2. Barrett, D. "Efficient Linux at the Command Line." Ch.11, O'Reilly, 2022.
3. "jq Manual." jqlang.github.io/jq/manual.
4. "GNU Wget Manual." gnu.org/software/wget/manual.
5. "curl man page." curl.se/docs/manpage.html.
