import { PrismaClient } from "@prisma/client";
import { getSSMParam } from "../utils/getSSMParam";

let prisma: PrismaClient;

const getPrisma = async (): Promise<PrismaClient> => {
  if (!prisma) {
    const dbUrl = await getSSMParam("DROPX_DATABASE_URL");
    if (!dbUrl) throw new Error("❌ Failed to load DROPX_DATABASE_URL from SSM");

    prisma = new PrismaClient({
      datasources: {
        db: { url: dbUrl },
      },
    });
  }

  return prisma;
};

export { getPrisma };