const { MongoClient } = require("mongodb");

exports.handler = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);
    if (!email || !password)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and password required" }),
      };

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db("usersdb");
    const users = db.collection("users");

    const user = await users.findOne({ email, password });
    await client.close();

    if (!user)
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid login" }) };

    return {
      statusCode: 200,
      body: JSON.stringify({
        email: user.email,
        referralCode: user.referralCode,
      }),
    };
  } catch (err) {
    console.error("Login error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
