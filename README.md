# Stage 1: String Analyzer Service

A RESTful API and frontend dashboard for analyzing strings and storing their computed properties. Built with **Node.js**, **Express**, and vanilla HTML/JS frontend.

---

## Features

For each analyzed string, the service computes and stores:

- `length`: Number of characters
- `is_palindrome`: Boolean, true if string reads the same forwards and backwards (case-insensitive)
- `unique_characters`: Count of distinct characters
- `word_count`: Number of words separated by whitespace
- `sha256_hash`: SHA-256 hash for unique identification
- `character_frequency_map`: Object mapping each character to its occurrence count

---

## Endpoints

1. **Create/Analyze String**  
   `POST /strings`  
   Request Body:
   ```json
   {
     "value": "string to analyze"
   }
   ```
   - **Success:** `201 Created` with string properties
   - **Errors:**  
     - `400 Bad Request`: Invalid request body or missing `"value"` field  
     - `409 Conflict`: String already exists  
     - `422 Unprocessable Entity`: Invalid data type

2. **Get Specific String**  
   `GET /strings/{string_value}`  
   - **Success:** `200 OK` with string properties  
   - **Error:** `404 Not Found`

3. **Get All Strings with Filtering**  
   `GET /strings?is_palindrome=true&min_length=5&max_length=20&word_count=2&contains_character=a`  
   - Returns filtered list of strings with applied query parameters  
   - **Error:** `400 Bad Request` for invalid query parameters

4. **Natural Language Filtering**  
   `GET /strings/filter-by-natural-language?query=all single word palindromic strings`  
   - Converts human-readable query into filters  
   - **Success:** `200 OK` with matching strings  
   - **Errors:**  
     - `400 Bad Request`: Unable to parse natural language query  
     - `422 Unprocessable Entity`: Conflicting filters

5. **Delete String**  
   `DELETE /strings/{string_value}`  
   - **Success:** `204 No Content`  
   - **Error:** `404 Not Found`

---

## Frontend

Located in `public/` directory. The dashboard allows you to:

- Add strings  
- Delete strings  
- Filter strings using natural language queries  
- Display all strings with their properties

---

## Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd hng-stage1-node
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   node server.js
   ```
   Server runs at `http://localhost:3000`.

4. Open the frontend:
   ```
   http://localhost:3000/index.html
   ```

---

## Notes

- **Persistence:** Strings are automatically stored in `strings.json`  
- **Ignored in Git:** `node_modules/`, `strings.json`, `.env`

---

## Stack

- Node.js
- Express.js
- Vanilla HTML/CSS/JS for frontend
- SHA-256 hashing using Node's crypto module

---

## Testing the API (optional)

You can test endpoints using `curl`:

```bash
# Add string
curl -X POST http://localhost:3000/strings -H "Content-Type: application/json" -d '{"value":"racecar"}'

# Get string
curl http://localhost:3000/strings/racecar

# Delete string
curl -X DELETE http://localhost:3000/strings/racecar

# Filter strings using natural language
curl "http://localhost:3000/strings/filter-by-natural-language?query=all%20single%20word%20palindromic%20strings"
```
