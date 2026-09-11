import { and, desc, eq, inArray, max } from 'drizzle-orm';
import type { ArchonDatabase } from './index';
import { approvals, auditEvents, canonicalObjects, changeSets, projectVersions, projects, validationFindings } from './schema';

export async function listProjects(db: ArchonDatabase) {
  return db.select({ id:projects.id,name:projects.name,status:projects.status,buildingType:projects.buildingType,locationText:projects.locationText,currentApprovedVersionId:projects.currentApprovedVersionId,updatedAt:projects.updatedAt }).from(projects).orderBy(desc(projects.updatedAt));
}

export async function getProjectSummary(db: ArchonDatabase, projectId:string) {
  const [project]=await db.select().from(projects).where(eq(projects.id,projectId)).limit(1); if(!project)return null;
  const versions=await db.select().from(projectVersions).where(eq(projectVersions.projectId,projectId)).orderBy(desc(projectVersions.versionNumber));
  const proposedChanges=await db.select().from(changeSets).where(eq(changeSets.projectId,projectId)).orderBy(desc(changeSets.createdAt));
  const buildingObjects=await db.select().from(canonicalObjects).where(eq(canonicalObjects.projectId,projectId));
  const changeSetIds=proposedChanges.map(c=>c.id);
  const findings=changeSetIds.length?(await Promise.all(changeSetIds.map(async changeSetId=>({changeSetId,findings:await db.select().from(validationFindings).where(eq(validationFindings.changeSetId,changeSetId))})))).flatMap(e=>e.findings):[];
  return {project,versions,proposedChanges,validationFindings:findings,canonicalObjects:buildingObjects};
}

type CanonicalOperation={type:string;targetId:string;payload:Record<string,unknown>};
function finiteNumber(value:unknown){return typeof value==='number'&&Number.isFinite(value)}
function tuple3(value:unknown):[number,number,number]{return Array.isArray(value)&&value.length===3&&value.every(finiteNumber)?value as [number,number,number]:[0,0,0]}

export async function createProposedChangeSet(db:ArchonDatabase,input:{projectId:string;intentSummary:string;operations:CanonicalOperation[];createdBy:string}){
  return db.transaction(async tx=>{
    const [project]=await tx.select().from(projects).where(eq(projects.id,input.projectId)).limit(1); if(!project)throw new Error('PROJECT_NOT_FOUND');
    if(!project.currentApprovedVersionId)throw new Error('PROJECT_HAS_NO_APPROVED_VERSION');
    if(!input.operations.length)throw new Error('NO_OPERATIONS');
    const active=await tx.select({id:changeSets.id}).from(changeSets).where(and(eq(changeSets.projectId,input.projectId),inArray(changeSets.state,['DRAFT','PROPOSED','SANDBOXED','VALIDATING','NEEDS_REVIEW','APPROVED']))).limit(1);
    if(active.length)throw new Error('ACTIVE_CHANGESET_EXISTS');
    const targets=await tx.select().from(canonicalObjects).where(eq(canonicalObjects.projectId,input.projectId));
    const targetMap=new Map(targets.map(item=>[item.archonId,item]));
    for(const operation of input.operations){
      if(!targetMap.has(operation.targetId))throw new Error(`CANONICAL_TARGET_NOT_FOUND:${operation.targetId}`);
      if(!['MOVE','UPDATE'].includes(operation.type))throw new Error(`UNSUPPORTED_OPERATION:${operation.type}`);
      if(operation.type==='MOVE'){const values=['deltaXmm','deltaYmm','deltaZmm'].map(key=>operation.payload[key]).filter(value=>value!==undefined);if(!values.length||values.some(value=>!finiteNumber(value)))throw new Error('INVALID_MOVE_PAYLOAD')}
    }
    const [changeSet]=await tx.insert(changeSets).values({projectId:input.projectId,baseVersionId:project.currentApprovedVersionId,intentSummary:input.intentSummary,operations:input.operations,affectedDomains:['geometry','layout'],requestedLocks:['approved-building-state'],createdBy:input.createdBy,state:'NEEDS_REVIEW'}).returning();
    await tx.insert(validationFindings).values([{changeSetId:changeSet.id,category:'geometry',status:'PASS',sourceType:'ARCHON_RULE',sourceReference:'CANONICAL-TARGET-INTEGRITY',evidence:'All operation targets resolve to canonical Building Graph objects.',confidencePermille:1000},{changeSetId:changeSet.id,category:'governance',status:'PASS',sourceType:'ARCHON_RULE',sourceReference:'APPROVAL-BOUNDARY',evidence:'Proposal is sandboxed as a ChangeSet; approved Building Graph has not been mutated.',confidencePermille:1000}]);
    await tx.insert(auditEvents).values({projectId:input.projectId,entityType:'ChangeSet',entityId:changeSet.id,eventType:'PROPOSED',actor:input.createdBy,payload:{operations:input.operations,intentSummary:input.intentSummary}}); return changeSet;
  });
}

export async function discardChangeSet(db:ArchonDatabase,input:{changeSetId:string;actor:string;reason?:string}){
 return db.transaction(async tx=>{
  const [changeSet]=await tx.select().from(changeSets).where(eq(changeSets.id,input.changeSetId)).limit(1); if(!changeSet)throw new Error('CHANGESET_NOT_FOUND');
  if(changeSet.state==='REJECTED')return changeSet;
  if(!['DRAFT','PROPOSED','SANDBOXED','VALIDATING','NEEDS_REVIEW','APPROVED'].includes(changeSet.state))throw new Error(`CHANGESET_NOT_DISCARDABLE:${changeSet.state}`);
  const [discarded]=await tx.update(changeSets).set({state:'REJECTED',updatedAt:new Date()}).where(eq(changeSets.id,changeSet.id)).returning();
  await tx.insert(auditEvents).values({projectId:changeSet.projectId,entityType:'ChangeSet',entityId:changeSet.id,eventType:'DISCARDED',actor:input.actor,payload:{reason:input.reason??null,approvedBuildingMutated:false}});
  return discarded;
 });
}

function materializeCanonicalObjects(objects:any[],operations:CanonicalOperation[],nextVersionNumber:number){
 const operationMap=new Map<string,CanonicalOperation[]>();for(const operation of operations){const list=operationMap.get(operation.targetId)??[];list.push(operation);operationMap.set(operation.targetId,list)}
 return objects.map(item=>{const itemOperations=operationMap.get(item.archonId)??[];if(!itemOperations.length)return {...item};let parameters={...(item.parameters??{})};for(const operation of itemOperations){if(operation.type==='MOVE'){const position=tuple3(parameters.positionMm);parameters={...parameters,positionMm:[position[0]+(finiteNumber(operation.payload.deltaXmm)?operation.payload.deltaXmm as number:0),position[1]+(finiteNumber(operation.payload.deltaYmm)?operation.payload.deltaYmm as number:0),position[2]+(finiteNumber(operation.payload.deltaZmm)?operation.payload.deltaZmm as number:0)]}}else if(operation.type==='UPDATE')parameters={...parameters,...operation.payload}}return {...item,parameters,revision:item.revision+1,provenance:{...(item.provenance??{}),source:'ARCHON_CHANGESET',version:String(nextVersionNumber),authority:'BUILDING'}}})
}

export async function approveChangeSet(db:ArchonDatabase,input:{changeSetId:string;reviewer:string;note?:string}){
 return db.transaction(async tx=>{
  const [changeSet]=await tx.select().from(changeSets).where(eq(changeSets.id,input.changeSetId)).limit(1); if(!changeSet)throw new Error('CHANGESET_NOT_FOUND');
  const [existingVersion]=await tx.select().from(projectVersions).where(eq(projectVersions.approvedChangeSetId,changeSet.id)).limit(1); if(existingVersion)return existingVersion;
  if(!['NEEDS_REVIEW','APPROVED'].includes(changeSet.state))throw new Error(`CHANGESET_NOT_APPROVABLE:${changeSet.state}`);
  const findings=await tx.select().from(validationFindings).where(eq(validationFindings.changeSetId,changeSet.id)); if(findings.some(f=>f.status==='BLOCKER'||f.status==='CRITICAL'))throw new Error('VALIDATION_BLOCKS_APPROVAL');
  await tx.insert(approvals).values({changeSetId:changeSet.id,decision:'APPROVED',reviewer:input.reviewer,note:input.note}); await tx.update(changeSets).set({state:'COMMITTING',updatedAt:new Date()}).where(eq(changeSets.id,changeSet.id));
  const [latest]=await tx.select({versionNumber:max(projectVersions.versionNumber)}).from(projectVersions).where(eq(projectVersions.projectId,changeSet.projectId)); const nextVersionNumber=(latest?.versionNumber??0)+1;
  const currentObjects=await tx.select().from(canonicalObjects).where(eq(canonicalObjects.projectId,changeSet.projectId)); const materializedObjects=materializeCanonicalObjects(currentObjects,(changeSet.operations??[]) as CanonicalOperation[],nextVersionNumber);
  for(const item of materializedObjects){const previous=currentObjects.find(current=>current.id===item.id);if(previous&&item.revision!==previous.revision)await tx.update(canonicalObjects).set({parameters:item.parameters,revision:item.revision,provenance:item.provenance}).where(eq(canonicalObjects.id,item.id))}
  const canonicalSnapshot=materializedObjects.map(({id,projectId,...item})=>item); const snapshot={schemaVersion:2,projectId:changeSet.projectId,baseVersionId:changeSet.baseVersionId,canonicalObjects:canonicalSnapshot,committedChangeSet:{id:changeSet.id,intentSummary:changeSet.intentSummary,operations:changeSet.operations,affectedDomains:changeSet.affectedDomains,requestedLocks:changeSet.requestedLocks}};
  const [version]=await tx.insert(projectVersions).values({projectId:changeSet.projectId,versionNumber:nextVersionNumber,parentVersionId:changeSet.baseVersionId,snapshot,approvedChangeSetId:changeSet.id}).returning();
  await tx.update(changeSets).set({state:'COMMITTED',updatedAt:new Date()}).where(eq(changeSets.id,changeSet.id)); await tx.update(projects).set({currentApprovedVersionId:version.id,updatedAt:new Date()}).where(eq(projects.id,changeSet.projectId));
  await tx.insert(auditEvents).values([{projectId:changeSet.projectId,entityType:'ChangeSet',entityId:changeSet.id,eventType:'APPROVED_AND_COMMITTED',actor:input.reviewer,payload:{versionId:version.id,versionNumber:version.versionNumber,materializedCanonicalObjects:true}},{projectId:changeSet.projectId,entityType:'ProjectVersion',entityId:version.id,eventType:'CREATED',actor:input.reviewer,payload:{changeSetId:changeSet.id,schemaVersion:2}}]); return version;
 });
}
