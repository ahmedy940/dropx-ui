import { PrismaClient } from "@prisma/client";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

let prisma: PrismaClient | undefined;

async function getDatabaseUrl(): Promise<string> {
  const ssm = new SSMClient({});
  const command = new GetParameterCommand({
    Name: "/dropx/dev/DROPX_DATABASE_URL",
    WithDecryption: true,
  });
  const result = await ssm.send(command);
  return result.Parameter?.Value || "";
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