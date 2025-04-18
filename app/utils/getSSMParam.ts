import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

export async function getSSMParam(key: string): Promise<string | undefined> {
  const ssm = new SSMClient({});
  const command = new GetParameterCommand({
    Name: `/dropx/dev/${key}`,
    WithDecryption: true,
  });

  const response = await ssm.send(command);
  return response.Parameter?.Value;
}