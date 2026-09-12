import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDwgInput,serializeDwgInput} from './dwg-input.ts';
const source={projectId:'project',versionId:'v1',mode:'PREVIEW',level:'Ground Floor',changeSetId:'preview'};
const site={archonId:'site',revision:1,boundsMm:[-5000,-4000,5000,4000]};
const wall={archonId:'wall',revision:1,objectType:'WALL',parameters:{positionMm:[0,1500,-3900],sizeMm:[10000,3000,200]},relationships:{level:'Ground Floor'}};
const room={archonId:'kitchen',revision:2,objectType:'ROOM',parameters:{positionMm:[-1000,150,0],sizeMm:[4000,300,3000],label:'Kitchen'},relationships:{level:'Ground Floor'}};
test('maps X/Z to CAD X/Y and computes real dimensions without mutation',()=>{
 const objects=[wall,room]; const before=JSON.stringify({source,site,objects});
 const output=createDwgInput(source,site,objects);
 const poly=output.entities.find(e=>e.sourceId==='wall'); assert.deepEqual(poly.pointsMm,[[-5000,-4000],[5000,-4000],[5000,-3800],[-5000,-3800]]);
 const dimensions=output.entities.filter(e=>e.sourceId==='kitchen'&&e.kind==='DIMENSION');
 assert.deepEqual(dimensions.map(e=>e.measuredMm),[4000,3000]);
 assert.equal(output.executionEnabled,false); assert.equal(output.reconciliation,'PROPOSE_CHANGESET_ONLY');
 assert.equal(JSON.stringify({source,site,objects}),before);
 output.entities[0].pointsMm[0][0]=1; assert.equal(site.boundsMm[0],-5000);
 assert.deepEqual(JSON.parse(serializeDwgInput(output)),output);
});
test('500 mm wall move and kitchen resize preserve IDs and version reference',()=>{
 const moved={...wall,parameters:{...wall.parameters,positionMm:[0,1500,-3400]}};
 const resized={...room,parameters:{...room.parameters,sizeMm:[4500,300,3000]}};
 const output=createDwgInput(source,site,[moved,resized]);
 assert.equal(output.entities.find(e=>e.sourceId==='wall').pointsMm[0][1],-3500);
 assert.equal(output.entities.find(e=>e.sourceId==='kitchen'&&e.kind==='DIMENSION').measuredMm,4500);
 assert.equal(output.source.versionId,'v1');
});
test('invalid coordinates, dimensions, transforms, levels and duplicate IDs fail closed',()=>{
 const cases=[
 {...wall,parameters:{...wall.parameters,positionMm:[NaN,0,0]}},
 {...wall,parameters:{...wall.parameters,sizeMm:[0,100,100]}},
 {...wall,parameters:{...wall.parameters,rotationDeg:90}},
 {...wall,relationships:{level:'First Floor'}},
 {...wall,parameters:{...wall.parameters,positionMm:[10000,0,0]}},
 {...wall,revision:0}
 ];
 for(const object of cases) assert.throws(()=>createDwgInput(source,site,[object]));
 assert.throws(()=>createDwgInput(source,site,[wall,wall]),/DUPLICATE/);
 assert.throws(()=>createDwgInput({...source,changeSetId:undefined},site,[]),/CHANGESET_REQUIRED/);
 assert.throws(()=>createDwgInput(source,{...site,boundsMm:[0,0,0,0]},[]),/SITE_INVALID/);
});
test('unsupported objects are disclosed and room labels remain data',()=>{
 const label='Kitchen "north" \\ cabinet';
 const output=createDwgInput(source,site,[{...room,parameters:{...room.parameters,label}}, {...wall,archonId:'slab',objectType:'SLAB'}]);
 assert.deepEqual(output.excludedObjectIds,['slab']); assert.equal(output.entities.find(e=>e.kind==='TEXT').text,label);
 assert.equal(output.checklist.find(f=>f.category==='scope').status,'WARNING');
 assert.throws(()=>createDwgInput(source,site,[{...room,parameters:{...room.parameters,label:'bad\ntext'}}]),/LABEL_INVALID/);
});
