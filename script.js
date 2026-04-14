// ========================================
// Elementary Edge — script.js
// Frontend form logic + API communication
// ========================================

const API_BASE = "/api";

// ── Role Selection Popup ────────────────
function selectRole(role) {
  // Hide the role overlay
  document.getElementById("role-overlay").classList.add("hidden");
  // Save choice so popup doesn't show again this session
  sessionStorage.setItem("ee-role", role);

  if (role === "student") {
    // Show the demo booking popup
    openDemoPopup();
  }
  // If teacher → just show the normal website (nothing extra needed)
}

// ── Demo Popup Open / Close ─────────────
function openDemoPopup() {
  const overlay = document.getElementById("demo-overlay");
  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeDemoPopup() {
  const overlay = document.getElementById("demo-overlay");
  overlay.classList.remove("active");
  document.body.style.overflow = "";
}

// Close demo popup when clicking outside the card
document.addEventListener("DOMContentLoaded", () => {
  const demoOverlay = document.getElementById("demo-overlay");
  if (demoOverlay) {
    demoOverlay.addEventListener("click", (e) => {
      if (e.target === demoOverlay) closeDemoPopup();
    });
  }

  // If the user already selected a role this session, skip the popup
  const savedRole = sessionStorage.getItem("ee-role");
  if (savedRole) {
    document.getElementById("role-overlay").classList.add("hidden");
  }

  // Scroll animations
  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    },
    { threshold: 0.08 }
  );
  document.querySelectorAll(".animate-in").forEach((el) => obs.observe(el));
});

// ── Student Demo Booking Submit ─────────
async function submitDemoBooking() {
  const studentName  = document.getElementById("d-name").value.trim();
  const contact      = document.getElementById("d-contact").value.trim();
  const studentClass = document.getElementById("d-class").value.trim();
  const board        = document.getElementById("d-board").value;
  const subject1     = document.getElementById("d-subject1").value.trim();
  const city         = document.getElementById("d-city").value.trim();
  const tutorGender  = document.getElementById("d-tutor-gender").value;
  const subject2     = document.getElementById("d-subject2").value.trim();
  const email        = document.getElementById("d-email").value.trim();
  const address      = document.getElementById("d-address").value.trim();

  // Validation — required fields
  if (!studentName || !contact || !studentClass || !board || !subject1 || !city) {
    alert("Please fill in all required fields (marked with *).");
    return;
  }
  if (!/^\d{10}$/.test(contact)) {
    alert("Please enter a valid 10-digit contact number.");
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }

  const payload = {
    studentName,
    contact,
    studentClass,
    board,
    subject1,
    city,
    tutorGenderPreference: tutorGender || "No Preference",
    subject2,
    email,
    address,
  };

  try {
    const res = await fetch(`${API_BASE}/students/demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      const successEl = document.getElementById("demo-success");
      successEl.style.display = "block";
      successEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Reset form fields
      ["d-name","d-contact","d-class","d-subject1","d-city","d-subject2","d-email","d-address"]
        .forEach(id => { document.getElementById(id).value = ""; });
      document.getElementById("d-board").value = "";
      document.getElementById("d-tutor-gender").value = "";

      // Auto-close popup after 3 seconds
      setTimeout(() => {
        closeDemoPopup();
        successEl.style.display = "none";
      }, 3000);
    } else {
      alert("Booking failed: " + (data.message || "Unknown error."));
    }
  } catch (err) {
    console.error("Demo booking error:", err);
    alert("Could not connect to the server. Please try again later.");
  }
}

// ── Aadhaar upload preview ──────────────
function showPreview(input, previewId) {
  const el = document.getElementById(previewId);
  if (input.files && input.files[0]) {
    el.textContent = "Uploaded: " + input.files[0].name;
  }
}

// ── Tutor Registration Submit ───────────
async function submitRegister() {
  // 1. Collect basic fields
  const name  = document.getElementById("r-name").value.trim();
  const gender = document.getElementById("r-gender").value;
  const phone  = document.getElementById("r-phone").value.trim();
  const email  = document.getElementById("r-email").value.trim();
  const qual   = document.getElementById("r-qual").value;

  const aadharFront = document.getElementById("aadhar-front").files[0];
  const aadharBack  = document.getElementById("aadhar-back").files[0];

  const subjects = Array.from(
    document.querySelectorAll(".subjects-check input:checked")
  ).map((c) => c.value);

  const classes = Array.from(
    document.querySelectorAll(".classes-check input:checked")
  ).map((c) => c.value);

  // 2. T&C checkboxes
  const t1 = document.getElementById("t1").checked;
  const t2 = document.getElementById("t2").checked;
  const t3 = document.getElementById("t3").checked;
  const t4 = document.getElementById("t4").checked;

  // 3. Validation
  if (!name || !gender || !phone || !email || !qual) {
    alert("Please fill in all personal details.");
    return;
  }
  if (!/^\d{10}$/.test(phone)) {
    alert("Please enter a valid 10-digit phone number.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    alert("Please enter a valid email address.");
    return;
  }
  if (subjects.length === 0) {
    alert("Please select at least one subject.");
    return;
  }
  if (classes.length === 0) {
    alert("Please select at least one class.");
    return;
  }
  if (!aadharFront || !aadharBack) {
    alert("Please upload both sides of your Aadhaar card.");
    return;
  }
  if (!t1 || !t2 || !t3 || !t4) {
    const warn = document.getElementById("tac-warn");
    warn.style.display = "block";
    warn.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  document.getElementById("tac-warn").style.display = "none";

  // 4. Build FormData (supports file uploads)
  const formData = new FormData();
  formData.append("name",          name);
  formData.append("gender",        gender);
  formData.append("phone",         phone);
  formData.append("email",         email);
  formData.append("qualification", qual);
  formData.append("subjects",      JSON.stringify(subjects));
  formData.append("classes",       JSON.stringify(classes));
  formData.append("aadharFront",   aadharFront);
  formData.append("aadharBack",    aadharBack);
  formData.append("termsAccepted", true);

  // 5. Send to backend
  try {
    const res = await fetch(`${API_BASE}/tutors/register`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (res.ok) {
      const successEl = document.getElementById("reg-success");
      successEl.style.display = "block";
      successEl.scrollIntoView({ behavior: "smooth", block: "center" });
      // Reset form
      document.getElementById("r-name").value   = "";
      document.getElementById("r-gender").value = "";
      document.getElementById("r-phone").value  = "";
      document.getElementById("r-email").value  = "";
      document.getElementById("r-qual").value   = "";
      document.querySelectorAll(".subjects-check input, .classes-check input")
        .forEach((c) => (c.checked = false));
      document.getElementById("aadhar-front").value = "";
      document.getElementById("aadhar-back").value  = "";
      document.getElementById("prev-front").textContent = "";
      document.getElementById("prev-back").textContent  = "";
      ["t1","t2","t3","t4"].forEach(id => document.getElementById(id).checked = false);
    } else {
      alert("Registration failed: " + (data.message || "Unknown error."));
    }
  } catch (err) {
    console.error("Registration error:", err);
    alert("Could not connect to the server. Please try again later.");
  }
}

// ── Student Feedback Submit ─────────────
async function submitFeedback() {
  const name    = document.getElementById("f-name").value.trim();
  const message = document.getElementById("f-message").value.trim();

  if (!name || !message) {
    alert("Please fill in both fields.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message }),
    });
    const data = await res.json();

    if (res.ok) {
      // Show feedback card locally
      const list = document.getElementById("feedbackList");
      const item = document.createElement("div");
      item.className = "feedback-item";
      item.innerHTML = `
        <div class="feedback-name">${name}</div>
        <div style="font-size:14px;color:#6b7280;">${message}</div>
      `;
      list.prepend(item);
      document.getElementById("f-name").value    = "";
      document.getElementById("f-message").value = "";
    } else {
      alert("Feedback submission failed: " + (data.message || "Unknown error."));
    }
  } catch (err) {
    console.error("Feedback error:", err);
    alert("Could not connect to the server. Please try again later.");
  }
}
