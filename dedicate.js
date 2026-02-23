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

  // Terms modal
  const termsModal = document.getElementById("termsModal");
  const openTermsBtn = document.getElementById("openTermsBtn");
  const closeTermsBtn = document.getElementById("closeTermsBtn");
  const acceptTermsBtn = document.getElementById("acceptTermsBtn");

  openTermsBtn.addEventListener("click", function () {
    termsModal.classList.add("active");
    document.body.style.overflow = "hidden";
  });

  function closeModal() {
    termsModal.classList.remove("active");
    document.body.style.overflow = "";
  }

  closeTermsBtn.addEventListener("click", closeModal);

  termsModal.addEventListener("click", function (e) {
    if (e.target === termsModal) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeModal();
  });

  acceptTermsBtn.addEventListener("click", function () {
    termsCheck.checked = true;
    submitBtn.disabled = false;
    closeModal();
  });

  // Disable submit until terms are accepted
  submitBtn.disabled = true;
  termsCheck.addEventListener("change", function () {
    submitBtn.disabled = !this.checked;
  });

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

    // Email validation
    const email = (formData.get("dedicator_email") || "").trim();
    if (!email) {
      alert("Please enter your email address.");
      return;
    }
    if (!email.includes("@")) {
      alert("Please enter a valid email address (must include @).");
      return;
    }
    if (email.length > 256) {
      alert("Email address must be 256 characters or fewer.");
      return;
    }

    // Image check
    const file = formData.get("image");
    if (file && file.size > 1024 * 1024) {
      alert("Image must be under 1 MB.");
      return;
    }



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