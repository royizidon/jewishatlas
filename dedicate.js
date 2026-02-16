document.addEventListener("DOMContentLoaded", function () {

  const form = document.getElementById("dedicateForm");
  const tierRadios = document.querySelectorAll('input[name="tier"]');
  const pageFields = document.getElementById("pageFields");

  // Toggle Page Fields
  tierRadios.forEach(radio => {
    radio.addEventListener("change", function () {
      pageFields.style.display = this.value === "page" ? "block" : "none";
    });
  });

  // Slug generator
  function generateSlug(data) {
    const base =
      data.get("he_name") ||
      data.get("eng_name") ||
      "memorial";

    return base
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-א-ת]/g, "")
      .replace(/\-+/g, "-");
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(form);

    // Image size check (1MB max)
    const file = formData.get("image");
    if (file && file.size > 1024 * 1024) {
      alert("Image must be under 1MB.");
      return;
    }

    // Add slug
    formData.append("slug", generateSlug(formData));

    try {
      const response = await fetch("/api/dedicate", {
        method: "POST",
        body: formData   // IMPORTANT: no JSON, using multipart
      });

      const result = await response.json();

      if (response.ok) {
        alert("Memorial submitted successfully.");
        window.location.href = "wall.html";
      } else {
        alert("Error: " + (result.error || "Unknown error"));
      }

    } catch (err) {
      console.error(err);
      alert("Server error.");
    }
  });

});
