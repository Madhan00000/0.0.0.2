// /netlify/functions/applyReferral.js
const { MongoClient } = require("mongodb");

exports.handler = async (event) => {
  try {
    const { email, referralCode } = JSON.parse(event.body || "{}");

    if (!email || !referralCode) {
      return { statusCode: 400, body: JSON.stringify({ error: "Email and referral code required" }) };
    }

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("usersdb");
    const users = db.collection("users");

    const currentUser = await users.findOne({ email });
    if (!currentUser) {
      await client.close();
      return { statusCode: 404, body: JSON.stringify({ error: "User not found" }) };
    }

    if (currentUser.referralApplied) {
      await client.close();
      return { statusCode: 400, body: JSON.stringify({ error: "Referral already applied" }) };
    }

    const referrer = await users.findOne({ referralCode });
    if (!referrer) {
      await client.close();
      return { statusCode: 404, body: JSON.stringify({ error: "Referral code not found" }) };
    }

    // Add 1 day for referrer
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    const newExpiry = referrer.tokenExpiry && new Date(referrer.tokenExpiry) > now
      ? new Date(new Date(referrer.tokenExpiry).getTime() + ONE_DAY_MS)
      : new Date(now.getTime() + ONE_DAY_MS);

    await users.updateOne(
      { referralCode },
      {
        $set: { tokenStatus: "active", tokenExpiry: newExpiry },
        $addToSet: { referredUsers: email },
      }
    );

    await users.updateOne(
      { email },
      { $set: { referralApplied: true } }
    );

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Referral applied successfully! Referrer got +1 day." }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
