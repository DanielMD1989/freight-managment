import pg from "pg";
import bcrypt from "bcryptjs";

const client = new pg.Client({
  connectionString: "postgresql://danieldamitew@localhost:5432/freight_db",
});

async function main() {
  await client.connect();

  const result = await client.query(
    'SELECT id, email, "firstName", "lastName", role, status, "isActive", "passwordHash" FROM users WHERE email = $1',
    ["daniel.mulugeta1989@gmail.com"]
  );

  if (result.rows.length === 0) {
    console.log("User not found");
  } else {
    const user = result.rows[0];
    console.log("User found:");
    console.log("  ID:", user.id);
    console.log("  Email:", user.email);
    console.log("  Name:", user.firstName, user.lastName);
    console.log("  Role:", user.role);
    console.log("  Status:", user.status);
    console.log("  isActive:", user.isActive);
    console.log("  passwordHash length:", user.passwordHash?.length);
    console.log(
      "  passwordHash starts with $2:",
      user.passwordHash?.startsWith("$2")
    );
    console.log(
      "  passwordHash (first 30 chars):",
      user.passwordHash?.substring(0, 30)
    );

    // Test some common passwords
    const testPasswords = [
      "password",
      "Password123",
      "admin",
      "test123",
      "Admin123!",
      "Daniel123!",
      "daniel123",
      "Freight123!",
    ];

    console.log("\nTesting common passwords:");
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, user.passwordHash);
      console.log(
        `  ${match ? "✓" : "✗"} "${pwd}": ${match ? "MATCH" : "no match"}`
      );
    }
  }

  await client.end();
}

main().catch(console.error);
