import prisma from "./app/db.server";

async function test() {
  try {
    // Test: Create a user
    console.log("Creating a user...");
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        shopDomain: "test-shop.myshopify.com",
        accessToken: "test-access-token",
      },
    });
    console.log("User created:", user);

    // Test: Create a session for the user
    console.log("Adding a session...");
    const session = await prisma.session.create({
      data: {
        shop: "test-shop.myshopify.com",
        state: "active",
        accessToken: "test-access-token",
        userId: user.id, // Associate the session with the created user
      },
    });
    console.log("Session created:", session);
  } catch (error) {
    console.error("Error during test:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();