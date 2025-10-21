import express from "express";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Allow CORS for frontend (both local + deployed)
app.use(cors({
  origin: ["http://localhost:5500", "https://mathjken.github.io"], // add your GitHub Pages or Netlify domain here
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// --- File-based storage setup ---
const STRINGS_FILE = "./strings.json";
let strings = new Map();

// --- Load strings from file ---
function loadStringsFromFile() {
  try {
    if (fs.existsSync(STRINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STRINGS_FILE, "utf8"));
      strings = new Map(Object.entries(data));
      console.log(`✅ Loaded ${strings.size} strings from file.`);
    } else {
      console.log("⚠️ strings.json not found, starting with empty store.");
    }
  } catch (err) {
    console.error("❌ Error loading strings:", err);
  }
}

// --- Save strings to file ---
function saveStringsToFile() {
  try {
    const json = Object.fromEntries(strings);
    fs.writeFileSync(STRINGS_FILE, JSON.stringify(json, null, 2));
    console.log(`💾 Auto-saved ${strings.size} strings to ${STRINGS_FILE}`);
  } catch (err) {
    console.error("❌ Error saving strings:", err);
  }
}

loadStringsFromFile();

// --- Helper to analyze string ---
function analyzeString(value) {
  const length = value.length;
  const is_palindrome = value === value.split("").reverse().join("");
  const unique_characters = new Set(value).size;
  const word_count = value.trim().split(/\s+/).length;
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

// --- POST /strings ---
app.post("/strings", (req, res) => {
  const { value } = req.body;
  if (!value || typeof value !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'value' field." });
  }

  const analyzed = analyzeString(value);
  strings.set(analyzed.id, analyzed);
  saveStringsToFile();

  res.status(201).json({ message: "String added successfully", data: analyzed });
});

// --- GET /strings ---
app.get("/strings", (req, res) => {
  res.status(200).json({
    data: Array.from(strings.values()),
    count: strings.size,
    filters_applied: {},
  });
});

// --- GET /strings/filter-by-natural-language ---
app.get("/strings/filter-by-natural-language", (req, res) => {
  const { query } = req.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "Missing or invalid 'query' parameter" });
  }

  const lowerQuery = query.toLowerCase();
  const filters = {};

  if (lowerQuery.includes("palindrome")) filters.is_palindrome = true;
  if (lowerQuery.includes("single word")) filters.word_count = 1;

  const minLengthMatch = lowerQuery.match(/longer than (\d+)/);
  if (minLengthMatch) filters.min_length = parseInt(minLengthMatch[1]);

  const maxLengthMatch = lowerQuery.match(/shorter than (\d+)/);
  if (maxLengthMatch) filters.max_length = parseInt(maxLengthMatch[1]);

  const charMatch = lowerQuery.match(/contain(?:ing)? the letter (\w)/);
  if (charMatch) filters.contains_character = charMatch[1];

  let results = Array.from(strings.values());

  if (filters.is_palindrome !== undefined)
    results = results.filter((s) => s.properties.is_palindrome === filters.is_palindrome);
  if (filters.word_count !== undefined)
    results = results.filter((s) => s.properties.word_count === filters.word_count);
  if (filters.min_length !== undefined)
    results = results.filter((s) => s.properties.length >= filters.min_length);
  if (filters.max_length !== undefined)
    results = results.filter((s) => s.properties.length <= filters.max_length);
  if (filters.contains_character !== undefined)
    results = results.filter((s) =>
      s.value.toLowerCase().includes(filters.contains_character.toLowerCase())
    );

  res.json({
    data: results,
    count: results.length,
    interpreted_query: {
      original: query,
      parsed_filters: filters,
    },
  });
});

// --- Graceful shutdown ---
process.on("SIGINT", () => {
  console.log("\n🧩 Saving before shutdown...");
  saveStringsToFile();
  process.exit(0);
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
