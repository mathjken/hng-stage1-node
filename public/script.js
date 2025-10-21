const baseURL = window.location.origin;

async function analyzeString() {
  const value = document.getElementById("inputString").value.trim();
  if (!value) return alert("Please enter a string");

  try {
    const res = await fetch(`${baseURL}/strings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });

    if (!res.ok) throw new Error("Server error");

    const data = await res.json();
    document.getElementById("result").innerHTML = `
      <p><b>Value:</b> ${data.data.value}</p>
      <p><b>Palindrome:</b> ${data.data.properties.is_palindrome}</p>
      <p><b>Length:</b> ${data.data.properties.length}</p>
      <p><b>Unique Characters:</b> ${data.data.properties.unique_characters}</p>
      <p><b>Word Count:</b> ${data.data.properties.word_count}</p>
      <p><b>SHA256 Hash:</b> ${data.data.properties.sha256_hash}</p>
    `;
  } catch (err) {
    console.error(err);
    alert("Failed to connect to server. Please check your connection or try again.");
  }
}
