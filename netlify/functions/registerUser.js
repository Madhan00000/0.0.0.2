// /netlify/functions/registerUser.js
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

exports.handler = async (event) => {
  try {
    const { email, referralCode } = JSON.parse(event.body || "{}");

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email is required" }),
      };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("usersdb");
    const users = db.collection("users");

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      await client.close();
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "User already exists" }),
      };
    }

    // Generate referral code for new user
    const newReferralCode = crypto.randomBytes(3).toString("hex").toUpperCase();

    const newUser = {
      email,
      referralCode: newReferralCode,
      referredUsers: [],
      tokenStatus: "inactive",
      tokenExpiry: null,
      referralApplied: !!referralCode,
      createdAt: new Date(),
    };

    // ✅ If referral code was entered
    if (referralCode) {
      const referrer = await users.findOne({ referralCode });

      if (referrer) {
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // +5:30 hrs
        // Add this new user to referrer’s referredUsers
        await users.updateOne(
          { referralCode },
          {
            $push: { referredUsers: email },
            // Extend tokenExpiry by +5 hours from now
            $set: {
              tokenStatus: "active",
              //tokenExpiry: new Date(Date.now() + 5 * 60 * 60 * 1000),
              tokenExpiry: new Date(Date.now() + 10 * 60 * 1000 + IST_OFFSET),
            },
          }
        );
      }
    }

    // Save new user
    await users.insertOne(newUser);

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User registered successfully",
        referralCode: newReferralCode,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
