import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const MIGRATIONS=[
 {id:'0000_archon_foundation',file:'0000_archon_foundation.sql'},
 {id:'0001_casa_nusa_canonical_geometry',file:'0001_casa_nusa_canonical_geometry.sql'},
 {id:'0002_sandbox_submission_ledger',file:'0002_sandbox_submission_ledger.sql'},
 {id:'0003_sandbox_transport_receipts',file:'0003_sandbox_transport_receipts.sql'},
 {id:'0004_sandbox_review_evidence',file:'0004_sandbox_review_evidence.sql'},
 {id:'0005_sandbox_validator_submissions',file:'0005_sandbox_validator_submissions.sql'}
] as const;
export async function migrate(databaseUrl:string){const sql=postgres(databaseUrl,{max:1,prepare:false});try{await sql.unsafe('CREATE TABLE IF NOT EXISTS archon_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());');for(const migration of MIGRATIONS){const [existing]=await sql<{id:string}[]>`SELECT id FROM archon_migrations WHERE id=${migration.id} LIMIT 1`;if(existing)continue;const migrationPath=fileURLToPath(new URL(`../drizzle/${migration.file}`,import.meta.url));const migrationSql=await readFile(migrationPath,'utf8');await sql.begin(async tx=>{await tx.unsafe(migrationSql);await tx`INSERT INTO archon_migrations (id) VALUES (${migration.id}) ON CONFLICT (id) DO NOTHING`;});console.log(`[ARCHON DB] applied ${migration.id}`);}}finally{await sql.end();}}
if(process.argv[1]?.endsWith('migrate.ts')){const databaseUrl=process.env.DATABASE_URL;if(!databaseUrl)throw new Error('DATABASE_URL is required');migrate(databaseUrl).catch(error=>{console.error('[ARCHON DB] migration failed',error);process.exit(1);});}
