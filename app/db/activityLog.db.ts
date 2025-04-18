import { getPrisma } from "./prisma";
import { handleError } from "./errors";

/**
 * ✅ Logs an activity related to a shop.
 */
export async function logActivity(shopDomain: string, action: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Logging action '${action}' for shop (${shopDomain})`);

        return await prisma.activityLog.create({
            data: {
                shopDomain,
                action,
            },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to log activity for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error logging activity.");
    }
}

/**
 * ✅ Fetch activity logs for a specific shop.
 */
export async function getActivityLogs(shopDomain: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Fetching logs for shop (${shopDomain})`);

        return await prisma.activityLog.findMany({
            where: { shopDomain },
            orderBy: { createdAt: "desc" },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to fetch activity logs for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error fetching activity logs.");
    }
}

/**
 * ✅ Clear all activity logs for a shop.
 */
export async function deleteActivityLogs(shopDomain: string) {
    try {
        const prisma = await getPrisma();
        console.log(`[ACTIVITY LOG]: Deleting logs for shop (${shopDomain})`);

        return await prisma.activityLog.deleteMany({
            where: { shopDomain },
        });
    } catch (error) {
        console.error(`[DB ERROR]: Failed to delete activity logs for shop (${shopDomain}) - ${handleError(error)}`);
        throw new Error("Error deleting activity logs.");
    }
}