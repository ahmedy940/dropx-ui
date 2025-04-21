import { PrismaClient } from "@prisma/client";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let prisma: PrismaClient | undefined;

async function getDatabaseUrl(): Promise<string> {
  const ssm = new SSMClient({});
  const command = new GetParameterCommand({
    Name: "/dropx/dev/DROPX_DATABASE_URL",
    WithDecryption: true,
  });

  try {
    const result = await ssm.send(command);
    const dbUrl = result.Parameter?.Value;
    if (!dbUrl) {
      throw new Error("DROPX_DATABASE_URL not found in SSM");
    }
    return dbUrl;
  } catch (error) {
    console.error("Failed to fetch database URL from SSM:", error);
    throw new Error("Database configuration error");
  }
}

export async function getPrisma(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const url = await getDatabaseUrl();
  prisma = new PrismaClient({
    datasources: {
      db: {
        url,
      },
    },
  });

  return prisma;
}