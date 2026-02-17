document.addEventListener("DOMContentLoaded", function () {

  const form = document.getElementById("dedicateForm");
  const tierBtns = document.querySelectorAll(".tier-btn");
  const tierValue = document.getElementById("tierValue");
  const pageFields = document.getElementById("pageFields");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoading = submitBtn.querySelector(".btn-loading");

  // Image elements
  const imageInput = document.getElementById("imageInput");
  const uploadZone = document.getElementById("uploadZone");
  const uploadIdle = document.getElementById("uploadIdle");
  const imagePreview = document.getElementById("imagePreview");
  const previewImg = document.getElementById("previewImg");
  const removeBtn = document.getElementById("removeBtn");

  // =============================
  // Tier toggle (buttons)
  // =============================
  tierBtns.forEach(btn => {
    btn.addEventListener("click", function () {
      tierBtns.forEach(b => b.classList.remove("active"));
      this.classList.add("active");

      const tier = this.dataset.tier;
      tierValue.value = tier;
      pageFields.style.display = tier === "page" ? "block" : "none";
    });
  });

  // =============================
  // Image preview
  // =============================
  imageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("Image must be under 1 MB.");
      this.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      imagePreview.classList.add("active");
      uploadIdle.style.display = "none";
      imageInput.style.pointerEvents = "none";
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    imageInput.value = "";
    previewImg.src = "";
    imagePreview.classList.remove("active");
    uploadIdle.style.display = "flex";
    imageInput.style.pointerEvents = "auto";
  });

  // =============================
  // Slug (unique)
  // =============================
  function generateSlug(data) {
    const base =
      data.get("eng_name") ||
      data.get("he_name") ||
      "memorial";

    const suffix = Date.now().toString(36);

    return base
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-\u0590-\u05fe]/g, "")
      .replace(/-+/g, "-")
      + "-" + suffix;
  }

  // =============================
  // Submit
  // =============================
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const formData = new FormData(form);

    // Validate
    const heName = (formData.get("he_name") || "").trim();
    const engName = (formData.get("eng_name") || "").trim();
    if (!heName && !engName) {
      alert("Please enter a Hebrew or English name.");
      return;
    }

    // Image check
    const file = formData.get("image");
    if (file && file.size > 1024 * 1024) {
      alert("Image must be under 1 MB.");
      return;
    }

    // Slug
    formData.append("slug", generateSlug(formData));

    // Loading
    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnLoading.style.display = "inline-flex";

    try {
      const response = await fetch("https://api.jewishatlas.org/api/dedicate", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (response.ok && result.success) {
        alert("Memorial submitted successfully.");
        window.location.href = "wall.html";
      } else {
      alert("Error: " + (typeof result.error === "string" ? result.error : JSON.stringify(result.error)));      }

    } catch (err) {
      console.error(err);
      alert("Could not reach the server. Please try again.");

    } finally {
      submitBtn.disabled = false;
      btnText.style.display = "inline";
      btnLoading.style.display = "none";
    }
  });

});