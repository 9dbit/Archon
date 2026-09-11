export type CanonicalGeometryOperation={type:string;targetId:string;payload:Record<string,unknown>};

function finiteNumber(value:unknown): value is number { return typeof value==='number'&&Number.isFinite(value); }
function positiveNumber(value:unknown): value is number { return finiteNumber(value)&&value>0; }
function tuple3(value:unknown):[number,number,number]{ return Array.isArray(value)&&value.length===3&&value.every(finiteNumber)?value as [number,number,number]:[0,0,0]; }

/** Pure canonical geometry materializer shared by persistence and future previews. */
export function applyCanonicalOperationToParameters(parameters:Record<string,unknown>|null|undefined,operation:CanonicalGeometryOperation){
 const next:Record<string,unknown>={...(parameters??{})};
 if(operation.type==='MOVE'){
  const position=tuple3(next.positionMm);
  next.positionMm=[position[0]+(finiteNumber(operation.payload.deltaXmm)?operation.payload.deltaXmm:0),position[1]+(finiteNumber(operation.payload.deltaYmm)?operation.payload.deltaYmm:0),position[2]+(finiteNumber(operation.payload.deltaZmm)?operation.payload.deltaZmm:0)];
  return next;
 }
 if(operation.type==='UPDATE'){
  Object.assign(next,operation.payload);
  const size=tuple3(next.sizeMm);
  let changed=false;
  if(positiveNumber(operation.payload.widthMm)){size[0]=operation.payload.widthMm;changed=true;}
  if(positiveNumber(operation.payload.heightMm)){size[1]=operation.payload.heightMm;changed=true;}
  if(positiveNumber(operation.payload.depthMm)){size[2]=operation.payload.depthMm;changed=true;}
  if(changed)next.sizeMm=size;
  return next;
 }
 return next;
}
