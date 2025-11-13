// netlify/functions/register.js
const { MongoClient } = require("mongodb");
const crypto = require("crypto");

exports.handler = async (event) => {
  try {
    const { email, password, referralCode } = JSON.parse(event.body);

    if (!email || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and password required" }),
      };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("usersdb");
    const users = db.collection("users");

    const existingUser = await users.findOne({ email });
    if (existingUser) {
      await client.close();
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "User already exists" }),
      };
    }

    // Generate new referral code
    const newReferralCode = crypto.randomBytes(3).toString("hex").toUpperCase();

    const newUser = {
      email,
      password, // ⚠️ In production: hash this
      referralCode: newReferralCode,
      referredUsers: [],
      tokenStatus: "inactive",
      tokenExpiry: null,
      referralApplied: false,
    };

    // ✅ Handle referral logic
    if (referralCode) {
      const referrer = await users.findOne({ referralCode });

      if (referrer) {
        // Add referred user to referrer’s record
        await users.updateOne(
          { referralCode },
          { $push: { referredUsers: email } }
        );

        // ✅ Extend referrer’s token by +6 hours (1 base + 5 bonus)
        const newExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now (local equivalent)


        await users.updateOne(
          { referralCode },
          {
            $set: {
              tokenStatus: "active",
              tokenExpiry: newExpiry.toISOString(),
            },
          }
        );

        newUser.referralApplied = true;
      }
    }

    // Insert new user
    await users.insertOne(newUser);
    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "User registered successfully",
        email,
        referralCode: newReferralCode,
      }),
    };
  } catch (error) {
    console.error("Error registering user:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
