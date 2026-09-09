import pg from "pg";

const source = new URL(process.env.LANGGRAPH_POSTGRES_URL);
const projectRef = "aqgrsihxlokdmaivqhff";
const regions = [
  "ap-southeast-1",
  "us-east-1",
  "us-west-1",
  "eu-central-1",
  "eu-west-1",
  "ap-northeast-1",
  "sa-east-1",
];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new pg.Client({
    host,
    port: 6543,
    user: `postgres.${projectRef}`,
    password: decodeURIComponent(source.password),
    database: source.pathname.slice(1) || "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 2500,
  });
  try {
    await client.connect();
    await client.query("select 1");
    console.log(`REACHABLE ${host}`);
    await client.end();
    process.exit(0);
  } catch (error) {
    console.log(`unavailable ${host}: ${error instanceof Error ? error.message.split("\n")[0] : "unknown"}`);
    await client.end().catch(() => undefined);
  }
}
process.exit(1);
