// ========================================================
// Elementary Edge — server.js  (FIXED VERSION)
// ========================================================

require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const multer   = require("multer");
const cors     = require("cors");
const path     = require("path");
const fs       = require("fs");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────
app.use(cors()); // allows your HTML page to talk to this server
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve your HTML/CSS/JS files from the "public" folder
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Multer (file upload config) ─────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads", "aadhaar");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.fieldname}_${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG, PNG, WEBP, and PDF files are allowed."), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ── MongoDB Connection (FIXED) ──────────
// FIX: Added proper connection options so it connects reliably
const MONGO_URI = process.env.MONGO_URI ||
  "mongodb+srv://mpuri2825:MUKESH282500@cluster0.rg3e9ls.mongodb.net/elementaryedge?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 10000, // wait max 10 seconds to connect
  socketTimeoutMS: 45000,
})
  .then(() => console.log("✅ MongoDB connected successfully!"))
  .catch((err) => {
    console.error("❌ MongoDB connection FAILED:", err.message);
    console.error("👉 Go to MongoDB Atlas → Network Access → Add IP Address → Allow 0.0.0.0/0");
  });

// If MongoDB disconnects later, log it
mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

// ── Mongoose Schemas ────────────────────

const tutorSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  gender:        { type: String, required: true },
  phone:         { type: String, required: true, trim: true },
  email:         { type: String, required: true, trim: true, lowercase: true },
  qualification: { type: String, required: true },
  subjects:      { type: [String], required: true },
  classes:       { type: [String], required: true },
  aadharFront:   { type: String, required: true },
  aadharBack:    { type: String, required: true },
  termsAccepted: { type: Boolean, required: true, default: false },
  status:        { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
}, { timestamps: true });

const Tutor = mongoose.model("Tutor", tutorSchema);

const studentDemoSchema = new mongoose.Schema({
  studentName:           { type: String, required: true, trim: true },
  contact:               { type: String, required: true, trim: true },
  studentClass:          { type: String, required: true, trim: true },
  board:                 { type: String, required: true },
  subject1:              { type: String, required: true, trim: true },
  city:                  { type: String, required: true, trim: true },
  tutorGenderPreference: { type: String, default: "No Preference" },
  subject2:              { type: String, trim: true, default: "" },
  email:                 { type: String, trim: true, lowercase: true, default: "" },
  address:               { type: String, trim: true, default: "" },
  status:                { type: String, enum: ["new", "contacted", "confirmed", "cancelled"], default: "new" },
}, { timestamps: true });

const StudentDemo = mongoose.model("StudentDemo", studentDemoSchema);

const feedbackSchema = new mongoose.Schema({
  name:    { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
}, { timestamps: true });

const Feedback = mongoose.model("Feedback", feedbackSchema);

// ── Routes ──────────────────────────────

// ── Health check (to test if server is running) ──
app.get("/api/health", (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({ server: "running", database: dbStatus });
});

// ── STUDENT DEMO BOOKING ─────────────────

// POST /api/students/demo
app.post("/api/students/demo", async (req, res) => {
  try {
    // FIX: Check if MongoDB is connected before trying to save
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: "Database not connected. Please try again in a moment." });
    }

    const {
      studentName, contact, studentClass, board,
      subject1, city, tutorGenderPreference,
      subject2, email, address,
    } = req.body;

    if (!studentName || !contact || !studentClass || !board || !subject1 || !city) {
      return res.status(400).json({ message: "All required fields must be filled in." });
    }
    if (!/^\d{10}$/.test(contact)) {
      return res.status(400).json({ message: "Please provide a valid 10-digit contact number." });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    const demo = new StudentDemo({
      studentName,
      contact,
      studentClass,
      board,
      subject1,
      city,
      tutorGenderPreference: tutorGenderPreference || "No Preference",
      subject2:  subject2  || "",
      email:     email     || "",
      address:   address   || "",
    });

    await demo.save();
    console.log("✅ New demo booking saved:", studentName, contact);

    return res.status(201).json({
      message: "Demo class booked successfully! We will contact you shortly.",
      demoId: demo._id,
    });
  } catch (err) {
    // FIX: Log the REAL error so you can see it in your terminal
    console.error("❌ Demo booking error:", err.message);
    return res.status(500).json({
      message: "Server error: " + err.message  // now you'll see the real reason
    });
  }
});

// GET /api/students/demo — Admin: all demo bookings
app.get("/api/students/demo", async (req, res) => {
  try {
    const { status, board, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (board)  filter.board  = board;

    const demos = await StudentDemo.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await StudentDemo.countDocuments(filter);
    return res.json({ total, page: Number(page), demos });
  } catch (err) {
    console.error("❌ Fetch demos error:", err.message);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// GET /api/students/demo/:id
app.get("/api/students/demo/:id", async (req, res) => {
  try {
    const demo = await StudentDemo.findById(req.params.id);
    if (!demo) return res.status(404).json({ message: "Booking not found." });
    return res.json(demo);
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// PATCH /api/students/demo/:id/status
app.patch("/api/students/demo/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["new", "contacted", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    const demo = await StudentDemo.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!demo) return res.status(404).json({ message: "Booking not found." });
    return res.json({ message: `Status updated to ${status}.`, demo });
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ── TUTOR REGISTRATION ────────────────────

app.post(
  "/api/tutors/register",
  upload.fields([
    { name: "aadharFront", maxCount: 1 },
    { name: "aadharBack",  maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: "Database not connected. Please try again." });
      }

      const { name, gender, phone, email, qualification, subjects, classes, termsAccepted } = req.body;

      if (!name || !gender || !phone || !email || !qualification) {
        return res.status(400).json({ message: "All personal details are required." });
      }
      if (!req.files?.aadharFront || !req.files?.aadharBack) {
        return res.status(400).json({ message: "Both sides of Aadhaar card are required." });
      }
      if (!termsAccepted || termsAccepted === "false") {
        return res.status(400).json({ message: "Terms & Conditions must be accepted." });
      }

      const parsedSubjects = JSON.parse(subjects || "[]");
      const parsedClasses  = JSON.parse(classes  || "[]");

      if (parsedSubjects.length === 0) return res.status(400).json({ message: "At least one subject is required." });
      if (parsedClasses.length === 0)  return res.status(400).json({ message: "At least one class is required." });

      const existing = await Tutor.findOne({ $or: [{ phone }, { email }] });
      if (existing) {
        return res.status(409).json({ message: "A tutor with this phone or email already exists." });
      }

      const tutor = new Tutor({
        name, gender, phone, email, qualification,
        subjects:    parsedSubjects,
        classes:     parsedClasses,
        aadharFront: req.files.aadharFront[0].path,
        aadharBack:  req.files.aadharBack[0].path,
        termsAccepted: true,
      });

      await tutor.save();
      console.log("✅ New tutor registered:", name, phone);

      return res.status(201).json({
        message: "Registration successful! We will review your details and contact you shortly.",
        tutorId: tutor._id,
      });
    } catch (err) {
      console.error("❌ Registration error:", err.message);
      return res.status(500).json({ message: "Server error: " + err.message });
    }
  }
);

// GET /api/tutors
app.get("/api/tutors", async (req, res) => {
  try {
    const { status, subject, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)  filter.status   = status;
    if (subject) filter.subjects = subject;

    const tutors = await Tutor.find(filter)
      .select("-aadharFront -aadharBack")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Tutor.countDocuments(filter);
    return res.json({ total, page: Number(page), tutors });
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// GET /api/tutors/:id
app.get("/api/tutors/:id", async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id);
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    return res.json(tutor);
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// PATCH /api/tutors/:id/status
app.patch("/api/tutors/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    const tutor = await Tutor.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!tutor) return res.status(404).json({ message: "Tutor not found." });
    return res.json({ message: `Status updated to ${status}.`, tutor });
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ── FEEDBACK ─────────────────────────────

app.post("/api/feedback", async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message) {
      return res.status(400).json({ message: "Name and message are required." });
    }
    const fb = new Feedback({ name, message });
    await fb.save();
    console.log("✅ Feedback saved from:", name);
    return res.status(201).json({ message: "Feedback submitted successfully!", feedbackId: fb._id });
  } catch (err) {
    console.error("❌ Feedback error:", err.message);
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

app.get("/api/feedback", async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 }).limit(100);
    return res.json(feedbacks);
  } catch (err) {
    return res.status(500).json({ message: "Server error: " + err.message });
  }
});

// ── Multer error handling ───────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: "File upload error: " + err.message });
  }
  if (err) return res.status(400).json({ message: err.message });
  next();
});

// ── Start Server ────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Elementary Edge server running at http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
});
