import dotenv from "dotenv";
  import mongoose from "mongoose";
  import bcrypt from "bcryptjs";
  import { Package } from "./models/Package.js";
  import { Team } from "./models/Team.js";
  import { User } from "./models/User.js";

  dotenv.config();

  const MONGODB_URI = process.env.MONGODB_URI || "";

  async function seed() {
    await mongoose.connect(MONGODB_URI);

    const packageCount = await Package.countDocuments();
    if (packageCount === 0) {
      await Package.insertMany([
        { name: "Starter",   ksPrice: 30,  txAmount: 10,  bonusTx: 0,  isBestDeal: false, active: true, order: 1 },
        { name: "Basic",     ksPrice: 60,  txAmount: 20,  bonusTx: 0,  isBestDeal: false, active: true, order: 2 },
        { name: "Standard",  ksPrice: 90,  txAmount: 30,  bonusTx: 0,  isBestDeal: false, active: true, order: 3 },
        { name: "Best Deal", ksPrice: 100, txAmount: 50,  bonusTx: 20, isBestDeal: true,  active: true, order: 4 },
        { name: "Pro",       ksPrice: 150, txAmount: 50,  bonusTx: 0,  isBestDeal: false, active: true, order: 5 },
        { name: "Elite",     ksPrice: 300, txAmount: 100, bonusTx: 0,  isBestDeal: false, active: true, order: 6 },
        { name: "Ultimate",  ksPrice: 600, txAmount: 200, bonusTx: 0,  isBestDeal: false, active: true, order: 7 }
      ]);
    }

    const teamCount = await Team.countDocuments();
    if (teamCount === 0 && process.env.HEROKU_TEAM) {
      await Team.insertMany([
        ...(process.env.HEROKU_TEAM ? [{ name: process.env.HEROKU_TEAM, active: true }] : [])
      ]);
    }

    const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const adminPassword = process.env.ADMIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD || "";
    if (!adminEmail || !adminPassword) { process.stderr.write("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env to seed the admin account\n"); await mongoose.disconnect(); return; }
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await User.create({
        email: adminEmail,
        passwordHash,
        txCoins: 999999,
        usedFreeTrial: false,
        trialPhoneNumbers: [],
        bots: []
      });
    } else if (existingAdmin.txCoins < 999999) {
      await User.updateOne({ email: adminEmail }, { txCoins: 999999 });
    }

    await mongoose.disconnect();
  }

  seed().catch(err => {
    process.stderr.write(String(err) + "\n");
    process.exit(1);
  });
  