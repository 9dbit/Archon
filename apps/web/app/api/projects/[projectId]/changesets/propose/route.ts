import { NextResponse } from 'next/server';
import { createProposedChangeSet } from '@archon/db';
import { getDatabase } from '../../../../../../lib/db';

type MoveCommand = {
  targetArchonId?: string;
  command?: string;
};

function normalizeMoveCommand(targetArchonId:string,command:string){
  const normalized=command.trim().toLowerCase();
  const amountMatch=normalized.match(/(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/);
  if(!amountMatch)throw new Error('COMMAND_REQUIRES_DISTANCE');
  const raw=Number(amountMatch[1].replace(',','.'));
  const unit=amountMatch[2];
  const amountMm=unit==='m'?raw*1000:unit==='cm'?raw*10:raw;
  if(!Number.isFinite(amountMm)||amountMm===0||Math.abs(amountMm)>10000)throw new Error('INVALID_MOVE_DISTANCE');

  let axis:'X'|'Y'|'Z'='X'; let sign=1;
  if(/\b(kiri|left)\b/.test(normalized)){axis='X';sign=-1}
  else if(/\b(kanan|right)\b/.test(normalized)){axis='X';sign=1}
  else if(/\b(atas|up)\b/.test(normalized)){axis='Y';sign=1}
  else if(/\b(bawah|down)\b/.test(normalized)){axis='Y';sign=-1}
  else if(/\b(depan|forward|north)\b/.test(normalized)){axis='Z';sign=-1}
  else if(/\b(belakang|back|south)\b/.test(normalized)){axis='Z';sign=1}
  else throw new Error('COMMAND_REQUIRES_DIRECTION');

  const delta=amountMm*sign;
  const payload=axis==='X'?{deltaXmm:delta}:axis==='Y'?{deltaYmm:delta}:{deltaZmm:delta};
  return {type:'MOVE',targetId:targetArchonId,payload};
}

export async function POST(request:Request,context:{params:Promise<{projectId:string}>}){
  try{
    const {projectId}=await context.params;
    const body=await request.json() as MoveCommand;
    const targetArchonId=body.targetArchonId?.trim();
    const command=body.command?.trim();
    if(!targetArchonId||!command)return NextResponse.json({error:'TARGET_AND_COMMAND_REQUIRED'},{status:400});
    const operation=normalizeMoveCommand(targetArchonId,command);
    const changeSet=await createProposedChangeSet(getDatabase(),{projectId,intentSummary:command,operations:[operation],createdBy:'ARCHON Assistant'});
    return NextResponse.json({ok:true,changeSet,normalizedOperation:operation},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:'UNKNOWN_ERROR';
    const conflict=message==='ACTIVE_CHANGESET_EXISTS';
    const badRequest=['TARGET_AND_COMMAND_REQUIRED','COMMAND_REQUIRES_DISTANCE','COMMAND_REQUIRES_DIRECTION','INVALID_MOVE_DISTANCE','NO_OPERATIONS','INVALID_MOVE_PAYLOAD'].includes(message)||message.startsWith('CANONICAL_TARGET_NOT_FOUND')||message.startsWith('UNSUPPORTED_OPERATION');
    const status=message==='DATABASE_URL_NOT_CONFIGURED'?503:message==='PROJECT_NOT_FOUND'?404:conflict?409:badRequest?400:500;
    return NextResponse.json({error:message},{status});
  }
}
