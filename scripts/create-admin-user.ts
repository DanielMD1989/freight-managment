/**
 * Create Test Admin User
 *
 * Run with: npx tsx scripts/create-admin-user.ts
 */

import { db } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function createAdminUser() {
  try {
    console.log("Creating test admin user...\n");

    // Check if admin user already exists
    const existingAdmin = await db.user.findUnique({
      where: { email: "admin@freight.com" },
    });

    if (existingAdmin) {
      console.log("✅ Admin user already exists!");
      console.log("\n📧 Email: admin@freight.com");
      console.log("🔑 Password: Admin123!");
      console.log("\n🌐 Login at: http://localhost:3000/login\n");
      return;
    }

    // Create admin organization
    const adminOrg = await db.organization.create({
      data: {
        name: "Platform Administration",
        type: "CARRIER_COMPANY", // Required field, but admins can access everything
        contactEmail: "admin@freight.com",
        contactPhone: "+251911111111",
        city: "Addis Ababa",
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    console.log("✅ Created admin organization");

    // Hash password
    const hashedPassword = await hashPassword("Admin123!");

    // Create admin user
    const adminUser = await db.user.create({
      data: {
        email: "admin@freight.com",
        passwordHash: hashedPassword,
        firstName: "Platform",
        lastName: "Admin",
        phone: "+251911111111",
        role: "ADMIN",
        organizationId: adminOrg.id,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    console.log("✅ Created admin user\n");
    console.log("═══════════════════════════════════════");
    console.log("  ADMIN USER CREDENTIALS");
    console.log("═══════════════════════════════════════");
    console.log("📧 Email:    admin@freight.com");
    console.log("🔑 Password: Admin123!");
    console.log("👤 Name:     Platform Admin");
    console.log("🏢 Role:     ADMIN");
    console.log("═══════════════════════════════════════\n");
    console.log("🌐 Login at: http://localhost:3000/login\n");
    console.log("✨ You can now access all admin features:\n");
    console.log("   • Dashboard:             /admin");
    console.log("   • GPS Management:        /admin/gps");
    console.log("   • Commission Settings:   /admin/commission");
    console.log("   • Organizations:         /admin/organizations");
    console.log("   • Settlement Automation: /admin/settlement");
    console.log("   • Bypass Review:         /admin/bypass-review");
    console.log("   • Audit Logs:            /admin/audit-logs");
    console.log("   • User Management:       /admin/users");
    console.log("   • Verification Queue:    /admin/verification\n");
  } catch (error) {
    console.error("❌ Error creating admin user:", error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

createAdminUser()
  .then(() => {
    console.log("✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Failed:", error);
    process.exit(1);
  });
