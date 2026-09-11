import { NextResponse } from 'next/server';
import { discardChangeSet } from '@archon/db';
import { getDatabase } from '../../../../../lib/db';

export async function POST(request:Request,context:{params:Promise<{changeSetId:string}>}){
 try{
  const {changeSetId}=await context.params;
  const body=await request.json().catch(()=>({}));
  const actor=typeof body.actor==='string'&&body.actor.trim()?body.actor:'ARCHON User';
  const reason=typeof body.reason==='string'?body.reason:undefined;
  const changeSet=await discardChangeSet(getDatabase(),{changeSetId,actor,reason});
  return NextResponse.json({ok:true,changeSet});
 }catch(error){
  const message=error instanceof Error?error.message:'UNKNOWN_ERROR';
  const status=message==='DATABASE_URL_NOT_CONFIGURED'?503:message==='CHANGESET_NOT_FOUND'?404:message.startsWith('CHANGESET_NOT_DISCARDABLE')?409:500;
  return NextResponse.json({ok:false,error:message},{status});
 }
}
