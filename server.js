const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

/* ---------------- DATABASE ---------------- */
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log(err));

/* ---------------- MODEL ---------------- */
const userSchema = new mongoose.Schema({
  name: String,
  phone: String,
  referralCode: String,
  referredBy: String,
  points: { type: Number, default: 0 },
  redemptions: [
    {
      pointsUsed: Number,
      date: Date
    }
  ]
});

const User = mongoose.model("User", userSchema);

/* ---------------- ROOT ---------------- */
app.get("/", (req, res) => {
  res.send("API is running");
});

/* ---------------- SIGNUP ---------------- */
app.post("/signup", async (req, res) => {
  try {
    const { name, phone, referralCode } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.json({ message: "User already exists", user: existingUser });
    }

    const myReferralCode = "BAN" + phone.slice(-4);

    let newUser = new User({
      name,
      phone,
      referralCode: myReferralCode,
      points: 0
    });

    // If referral used
    if (referralCode) {
      const refUser = await User.findOne({ referralCode });

      if (refUser) {
        newUser.referredBy = refUser.referralCode;

        // Give points
        newUser.points += 20;
        refUser.points += 20;

        await refUser.save();
      }
    }

    await newUser.save();

    res.json({
      message: "User created successfully",
      user: newUser
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- LOGIN ---------------- */
app.post("/login", async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- GET USER ---------------- */
app.get("/user/:phone", async (req, res) => {
  try {
    const user = await User.findOne({ phone: req.params.phone });

    if (!user) {
      return res.json({ message: "User not found" });
    }

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- ADMIN: GET ALL USERS ---------------- */
app.get("/admin/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- ADMIN: REDEEM ---------------- */
app.post("/admin/redeem", async (req, res) => {
  try {
    const { phone, adminPassword } = req.body;

    // 🔐 CHANGE THIS PASSWORD
    if (adminPassword !== "12345") {
      return res.status(401).json({ message: "Invalid admin password" });
    }

    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.points < 100) {
      return res.status(400).json({ message: "Minimum 100 points required" });
    }

    // Deduct points
    user.points -= 100;

    // Save redemption history
    user.redemptions.push({
      pointsUsed: 100,
      date: new Date()
    });

    await user.save();

    res.json({
      message: "Redeemed successfully",
      user
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- ADMIN: EXPORT CSV ---------------- */
app.get("/admin/export-csv", async (req, res) => {
  try {
    const users = await User.find();

    let csv = "Name,Phone,Points,ReferralCode,ReferredBy\n";

    users.forEach(u => {
      csv += `${u.name},${u.phone},${u.points},${u.referralCode},${u.referredBy || ""}\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    res.send(csv);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------------- SERVER ---------------- */
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});