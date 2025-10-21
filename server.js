import express from "express";
import fs from "fs"; // Kept for reference, but functions are disabled
import crypto from "crypto";
import path from "path"; 
import { fileURLToPath } from "url"; 

// --- Setup __dirname for ES Modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON body parsing and serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- In-Memory storage setup (Ephemeral on Heroku) ---
let strings = new Map();

// --- File I/O Functions (DISABLED FOR HEROKU STABILITY) ---
function loadStringsFromFile() {
  console.log("⚠️ Using in-memory store only. Data will be ephemeral.");
}
function saveStringsToFile() {
  // Disabled
}

// --- Initialize ---
loadStringsFromFile();

// --- Helper to create string object ---
function analyzeString(value) {
  const length = value.length;
  const lowerValue = value.toLowerCase(); 
  // Palindrome check (case-insensitive)
  const is_palindrome = lowerValue === lowerValue.split("").reverse().join("");
  const unique_characters = new Set(value).size;
  // Word count: split by any whitespace group
  const word_count = value.trim() === "" ? 0 : value.trim().split(/\s+/).length;
  const sha256_hash = crypto.createHash("sha256").update(value).digest("hex");

  const character_frequency_map = {};
  for (const char of value) {
    character_frequency_map[char] = (character_frequency_map[char] || 0) + 1;
  }

  return {
    id: sha256_hash,
    value,
    properties: {
      length,
      is_palindrome,
      unique_characters,
      word_count,
      sha256_hash,
      character_frequency_map,
    },
    created_at: new Date().toISOString(),
  };
}

// --- 1. POST /strings (CREATE) ---
app.post("/strings", (req, res) => {
  const { value } = req.body;
  
  if (value === undefined || value === null) {
    return res.status(400).json({ error: "Missing 'value' field." });
  }
  
  if (typeof value !== "string") {
    return res.status(422).json({ error: "Invalid data type for 'value'. Must be a string." });
  }

  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    return res.status(400).json({ error: "Value cannot be an empty string." });
  }

  const analyzed = analyzeString(trimmedValue);
  
  // 409 Conflict: String already exists
  if (strings.has(analyzed.id)) {
    return res.status(409).json({ error: "String already exists in the system." });
  }

  strings.set(analyzed.id, analyzed);

  res.status(201).json(analyzed);
});


// --- 3. GET /strings (READ ALL + STANDARD QUERY FILTERING) ---
app.get("/strings", (req, res) => {
    const filters = req.query;
    let results = Array.from(strings.values());
    const filters_applied = {};

    // Helper for invalid parameter
    const send400 = (message) => res.status(400).json({ error: message });

    // 1. is_palindrome (boolean)
    if (filters.is_palindrome !== undefined) {
        const isPalindrome = filters.is_palindrome.toLowerCase();
        if (isPalindrome !== 'true' && isPalindrome !== 'false') {
            return send400("Invalid value for is_palindrome. Must be 'true' or 'false'.");
        }
        const boolValue = isPalindrome === 'true';
        results = results.filter(s => s.properties.is_palindrome === boolValue);
        filters_applied.is_palindrome = boolValue;
    }

    // 2. min_length (integer)
    if (filters.min_length !== undefined) {
        const minLength = parseInt(filters.min_length, 10);
        if (isNaN(minLength) || minLength < 0) return send400("Invalid value for min_length. Must be a non-negative integer.");
        results = results.filter(s => s.properties.length >= minLength);
        filters_applied.min_length = minLength;
    }
    
    // 3. max_length (integer)
    if (filters.max_length !== undefined) {
        const maxLength = parseInt(filters.max_length, 10);
        if (isNaN(maxLength) || maxLength < 0) return send400("Invalid value for max_length. Must be a non-negative integer.");
        results = results.filter(s => s.properties.length <= maxLength);
        filters_applied.max_length = maxLength;
    }

    // 4. word_count (integer)
    if (filters.word_count !== undefined) {
        const wordCount = parseInt(filters.word_count, 10);
        if (isNaN(wordCount) || wordCount < 0) return send400("Invalid value for word_count. Must be a non-negative integer.");
        results = results.filter(s => s.properties.word_count === wordCount);
        filters_applied.word_count = wordCount;
    }

    // 5. contains_character (string)
    if (filters.contains_character !== undefined) {
        const char = filters.contains_character;
        if (typeof char !== 'string' || char.length > 1) return send400("Invalid value for contains_character. Must be a single character string.");
        const lowerChar = char.toLowerCase();
        results = results.filter(s => s.value.toLowerCase().includes(lowerChar));
        filters_applied.contains_character = char;
    }

    res.status(200).json({
        data: results,
        count: results.length,
        filters_applied: filters_applied,
    });
});


// --- 4. GET /strings/filter-by-natural-language (NATURAL LANGUAGE FILTERING) ---
// --- 4. GET /strings/filter-by-natural-language (NATURAL LANGUAGE FILTERING) ---
app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'query' parameter" });
  }

  const lowerQuery = query.toLowerCase();
  const filters = {};

  // --- Handle empty query: return all strings ---
  if (lowerQuery.trim() === "") {
    return res.json({
      data: Array.from(strings.values()),
      count: strings.size,
      interpreted_query: { original: "", parsed_filters: {} },
    });
  }

  // --- 1. Palindrome filter ---
  const isNegativePalindrome = lowerQuery.includes("non-palindrome") || lowerQuery.includes("not palindrome");
  const isPositivePalindrome = lowerQuery.includes("palindrome") && !isNegativePalindrome;

  if (isPositivePalindrome) filters.is_palindrome = true;
  if (isNegativePalindrome) filters.is_palindrome = false;

  // --- 2. Word count filter ---
  if (lowerQuery.includes("single word")) filters.word_count = 1;

  // --- 3. Length filters ---
  const minLengthMatch = lowerQuery.match(/longer than\s*(\d+)/);
  if (minLengthMatch) filters.min_length = parseInt(minLengthMatch[1], 10) + 1;

  const maxLengthMatch = lowerQuery.match(/shorter than\s*(\d+)/);
  if (maxLengthMatch) filters.max_length = parseInt(maxLengthMatch[1], 10) - 1;

  // --- 4. Character contains filter ---
  if (lowerQuery.includes("first vowel")) {
    filters.contains_character = "a"; // simple heuristic
  } else {
    const charMatch = lowerQuery.match(/contain(?:ing)? the letter (\w)/);
    if (charMatch) filters.contains_character = charMatch[1];
  }

  // --- 5. Default: value contains query if no filters matched ---
  if (Object.keys(filters).length === 0) {
    filters.value_contains = lowerQuery;
  }

  // --- 6. Execute filtering ---
  let results = Array.from(strings.values());

  if (filters.is_palindrome !== undefined) {
    results = results.filter(s => s.properties.is_palindrome === filters.is_palindrome);
  }
  if (filters.word_count !== undefined) {
    results = results.filter(s => s.properties.word_count === filters.word_count);
  }
  if (filters.min_length !== undefined) {
    results = results.filter(s => s.properties.length >= filters.min_length);
  }
  if (filters.max_length !== undefined) {
    results = results.filter(s => s.properties.length <= filters.max_length);
  }
  if (filters.contains_character !== undefined) {
    results = results.filter(s => s.value.toLowerCase().includes(filters.contains_character.toLowerCase()));
  }
  if (filters.value_contains !== undefined) {
    results = results.filter(s => s.value.toLowerCase().includes(filters.value_contains));
  }

  // --- Return response ---
  res.json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  });
});



// --- 2. GET /strings/{string_value} (READ SPECIFIC STRING) ---
app.get("/strings/:value", (req, res) => {
    const searchValue = req.params.value;
    
    // Calculate the expected ID (hash) to search in the map
    const tempAnalyzed = analyzeString(searchValue);
    const idToSearch = tempAnalyzed.id; 

    const foundString = strings.get(idToSearch);

    if (foundString) {
        return res.status(200).json(foundString);
    } else {
        return res.status(404).json({ error: "String not found" });
    }
});


// --- 5. DELETE /strings/{string_value} (DELETE) ---
app.delete("/strings/:value", (req, res) => {
    const deleteValue = req.params.value;

    // Calculate the expected ID (hash) to delete
    const tempAnalyzed = analyzeString(deleteValue);
    const idToDelete = tempAnalyzed.id;

    if (strings.delete(idToDelete)) {
        return res.status(204).send(); // 204 No Content for successful deletion
    } else {
        return res.status(404).json({ error: "String not found" });
    }
});


// --- Graceful shutdown ---
process.on("SIGINT", () => {
  console.log("\n🧩 Server shutting down (data will be lost)...");
  process.exit(0);
});

// --- Start server ---
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
