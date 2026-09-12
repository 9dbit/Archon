import {writeFileSync} from 'node:fs';
import {createDwgInput} from '../engine-adapters/src/dwg-input.ts';
const source={projectId:'test-only',versionId:'test-version',mode:'PREVIEW',changeSetId:'test-preview-reference',level:'Ground Floor'};
const site={archonId:'test-site',revision:1,boundsMm:[-5000,-4000,5000,4000]};
const objects=[
 {archonId:'test-wall',revision:1,objectType:'WALL',parameters:{positionMm:[0,1500,-3900],sizeMm:[10000,3000,200]},relationships:{level:'Ground Floor'}},
 {archonId:'test-kitchen',revision:1,objectType:'ROOM',parameters:{positionMm:[0,150,0],sizeMm:[4000,300,3000],label:'Kitchen'},relationships:{level:'Ground Floor'}}
];
writeFileSync('archon-contract-fixture.json',JSON.stringify(createDwgInput(source,site,objects)));
