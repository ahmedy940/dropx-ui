import { getPrisma } from "./prisma";
import { handleError } from "./errors";

/**
 * ✅ Stores an installation session in the `Session` table.
 */
export async function addSessionToDB(sessionData: {
    shopDomain: string;
    state: string;
    isOnline: boolean | undefined;
    scope: string | null | undefined;
    accessToken: string;
    expires: string | Date | null | undefined;
    email: string | null | undefined;
}) {
    try {
        console.log(`[DB]: Storing session for shop (${sessionData.shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.upsert({
            where: { shopDomain: sessionData.shopDomain }, // ✅ Reference shopDomain directly
            update: {
                accessToken: sessionData.accessToken,
                state: sessionData.state,
                isOnline: sessionData.isOnline,
                scope: sessionData.scope,
                expires: sessionData.expires,
                email: sessionData.email,
                updatedAt: new Date(),
            },
            create: {
                shopDomain: sessionData.shopDomain, // ✅ Directly store the domain instead of relation
                accessToken: sessionData.accessToken,
                state: sessionData.state,
                isOnline: sessionData.isOnline,
                scope: sessionData.scope,
                expires: sessionData.expires,
                email: sessionData.email,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to store session for shop (${sessionData.shopDomain}) - ${handleError(error)}`);
        throw new Error("Error storing session in database.");
    }
}

/**
 * ✅ Fetches the active session for a shop by `shopDomain`
 */
export async function getShopSession(shopDomain: string) {
    try {
        console.log(`[DB]: Fetching active session for shop (${shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.findUnique({
            where: { shopDomain }, // ✅ Lookup directly by shopDomain
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to fetch session for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error fetching shop session.");
    }
}

/**
 * ✅ Deletes a session when the shop logs out.
 */
export async function deleteShopSession(shopDomain: string) {
    try {
        console.log(`[DB]: Deleting session for shop (${shopDomain})`);
        const prisma = await getPrisma();

        return await prisma.session.deleteMany({
            where: { shopDomain }, // ✅ Delete session directly via shopDomain
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to delete session for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error deleting shop session.");
    }
}