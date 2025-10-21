const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));


const DATA_FILE = "./strings.json";
const strings = new Map();

// --- Load persisted strings on startup ---
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [hash, entry] of Object.entries(raw)) {
      strings.set(hash, entry);
    }
    console.log(`✅ Loaded ${strings.size} strings from ${DATA_FILE}`);
  } catch (err) {
    console.error("⚠️ Error reading strings.json:", err.message);
  }
}

// --- Helper: Save strings to file ---
function saveStringsToFile() {
  try {
    const obj = Object.fromEntries(strings);
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
    console.log(`💾 Auto-saved ${strings.size} strings to ${DATA_FILE}`);
  } catch (err) {
    console.error("❌ Error saving strings:", err.message);
  }
}

// 🔁 Auto-save every 30 seconds
setInterval(saveStringsToFile, 30000);

// --- POST /strings ---
app.post("/strings", (req, res) => {
  const { value } = req.body;
  if (!value || typeof value !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'value' field" });
  }

  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();
  const hash = crypto.createHash("sha256").update(lower).digest("hex");

  if (strings.has(hash)) {
    return res.status(409).json({ error: "String already exists" });
  }

  const props = {
    length: cleaned.length,
    is_palindrome: lower === lower.split("").reverse().join(""),
    unique_characters: new Set(lower).size,
    word_count: cleaned.split(/\s+/).length,
    sha256_hash: hash,
    character_frequency_map: [...cleaned].reduce((acc, char) => {
      acc[char] = (acc[char] || 0) + 1;
      return acc;
    }, {})
  };

  const result = {
    id: hash,
    value: cleaned,
    properties: props,
    created_at: new Date().toISOString()
  };

  strings.set(hash, result);
  saveStringsToFile(); // immediate save
  res.status(201).json(result);
});

// --- GET /strings/:value ---
app.get("/strings/:value", (req, res) => {
  let { value } = req.params;
  if (!value || typeof value !== "string") {
    return res.status(400).json({ error: "Invalid string value" });
  }

  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();
  const hash = crypto.createHash("sha256").update(lower).digest("hex");

  if (!strings.has(hash)) {
    return res.status(404).json({ error: "String not found." });
  }

  const data = strings.get(hash);
  res.status(200).json(data);
});

// --- GET /strings ---
app.get("/strings", (req, res) => {
  let results = Array.from(strings.values());
  const {
    is_palindrome,
    min_length,
    max_length,
    word_count,
    contains_character
  } = req.query;

  try {
    if (is_palindrome !== undefined) {
      const boolVal = is_palindrome === "true";
      results = results.filter((s) => s.properties.is_palindrome === boolVal);
    }

    if (min_length !== undefined) {
      const min = parseInt(min_length);
      if (isNaN(min)) return res.status(400).json({ error: "Invalid min_length" });
      results = results.filter((s) => s.properties.length >= min);
    }

    if (max_length !== undefined) {
      const max = parseInt(max_length);
      if (isNaN(max)) return res.status(400).json({ error: "Invalid max_length" });
      results = results.filter((s) => s.properties.length <= max);
    }

    if (word_count !== undefined) {
      const wc = parseInt(word_count);
      if (isNaN(wc)) return res.status(400).json({ error: "Invalid word_count" });
      results = results.filter((s) => s.properties.word_count === wc);
    }

    if (contains_character !== undefined) {
      if (contains_character.length !== 1) {
        return res.status(400).json({ error: "contains_character must be a single character" });
      }
      const char = contains_character.toLowerCase();
      results = results.filter((s) => s.value.toLowerCase().includes(char));
    }

    res.json({
      data: results,
      count: results.length,
      filters_applied: req.query
    });
  } catch (error) {
    console.error("Error filtering:", error.message);
    res.status(400).json({ error: "Invalid query parameters" });
  }
});

// --- GET /strings/filter-by-natural-language ---
app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'query' parameter" });
  }

  const lowerQuery = query.toLowerCase();
  const filters = {};

  // --- Natural Language Parsing ---
  if (lowerQuery.includes("palindrome")) filters.is_palindrome = true;
  if (lowerQuery.includes("single word")) filters.word_count = 1;

  const minLengthMatch = lowerQuery.match(/longer than (\d+)/);
  if (minLengthMatch) filters.min_length = parseInt(minLengthMatch[1]);

  const maxLengthMatch = lowerQuery.match(/shorter than (\d+)/);
  if (maxLengthMatch) filters.max_length = parseInt(maxLengthMatch[1]);

  const charMatch = lowerQuery.match(/contain(?:ing)? the letter (\w)/);
  if (charMatch) filters.contains_character = charMatch[1];
  // --------------------------------

  let results = Array.from(strings.values());

  // --- Filter Application ---
  if (filters.is_palindrome !== undefined)
    results = results.filter(s => s.properties.is_palindrome === filters.is_palindrome);
  if (filters.word_count !== undefined)
    results = results.filter(s => s.properties.word_count === filters.word_count);
  if (filters.min_length !== undefined)
    results = results.filter(s => s.properties.length >= filters.min_length);
  if (filters.max_length !== undefined)
    results = results.filter(s => s.properties.length <= filters.max_length);
  if (filters.contains_character !== undefined)
    results = results.filter(s => s.value.toLowerCase().includes(filters.contains_character.toLowerCase()));
  // --------------------------

  // Respond with 200 OK and the results, even if count is 0
  res.json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters
    }
  });
});

// 🗑️ DELETE /strings/:value
app.delete("/strings/:value", (req, res) => {
  const value = req.params.value;

  if (!value || typeof value !== "string") {
    return res.status(400).json({ error: "Invalid string value" });
  }

  // Normalize just like in POST/GET
  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();
  const hash = crypto.createHash("sha256").update(lower).digest("hex");

  if (!strings.has(hash)) {
    return res.status(404).json({ error: "String not found." });
  }

  strings.delete(hash); // Remove from the Map
  saveStringsToFile(); // Immediate save after deletion

  res.status(204).send(); // No Content, as per spec
});



// --- Graceful shutdown ---
process.on("SIGINT", () => {
  console.log("\n🧩 Saving before shutdown...");
  saveStringsToFile();
  process.exit(0);
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));