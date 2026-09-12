import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const context='ARCHON_SANDBOX_OUTPUT_RECEIPT_V1';
const hex=(value,length)=>typeof value==='string'&&new RegExp('^[a-f0-9]{'+length+'}$').test(value);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const key=value=>{if(!hex(value,64))throw Error('SANDBOX_RECEIPT_KEY_REQUIRED');return Buffer.from(value,'hex');};
const aad=(runId,manifestSha256)=>Buffer.from(context+'\n'+runId+'\n'+manifestSha256);
function normalize(receipt,now,requireFresh=true){
 if(receipt?.schemaVersion!==1||!validId(receipt.runId)||!/^archon_sandbox_[a-f0-9]{24}$/.test(receipt.bucketKey??'')||!Array.isArray(receipt.outputs)||receipt.outputs.length!==2)throw Error('SANDBOX_RECEIPT_INVALID');
 const expected={outputDwg:receipt.runId+'/archon-output.dwg',report:receipt.runId+'/archon-report.json'},seen=new Set(),outputs=[];
 for(const value of receipt.outputs){
  if(!Object.hasOwn(expected,value?.argument)||seen.has(value.argument)||value.key!==expected[value.argument]||typeof value.uploadKey!=='string'||value.uploadKey.length<1||value.uploadKey.length>4096||/[\u0000-\u001f\u007f]/.test(value.uploadKey))throw Error('SANDBOX_RECEIPT_INVALID');
  seen.add(value.argument);outputs.push({argument:value.argument,key:value.key,uploadKey:value.uploadKey});
 }
 const expiresAt=Date.parse(receipt.expiresAt);
 if(!Number.isFinite(expiresAt)||(requireFresh&&(expiresAt<=now||expiresAt>now+31*60000)))throw Error('SANDBOX_RECEIPT_EXPIRED');
 return {schemaVersion:1,runId:receipt.runId,bucketKey:receipt.bucketKey,outputs:outputs.sort((a,b)=>a.argument.localeCompare(b.argument)),expiresAt:new Date(expiresAt).toISOString()};
}
export function sealSandboxReceipt({receipt,runId,manifestSha256,secret,now=Date.now}){
 if(!validId(runId)||!hex(manifestSha256,64))throw Error('SANDBOX_RECEIPT_BINDING_INVALID');
 const plain=normalize(receipt,now());if(plain.runId!==runId)throw Error('SANDBOX_RECEIPT_BINDING_INVALID');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);cipher.setAAD(aad(runId,manifestSha256));
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(plain),'utf8'),cipher.final()]);
 return Object.freeze({schemaVersion:1,runId,manifestSha256,ciphertext:ciphertext.toString('base64'),iv:iv.toString('hex'),authTag:cipher.getAuthTag().toString('hex'),expiresAt:plain.expiresAt,state:'PREPARED'});
}
export function openSandboxReceipt({record,runId,manifestSha256,secret,now=Date.now}){
 if(record?.schemaVersion!==1||record.runId!==runId||record.manifestSha256!==manifestSha256||record.state!=='PREPARED'||!hex(record.iv,24)||!hex(record.authTag,32)||typeof record.ciphertext!=='string'||record.ciphertext.length<1||record.ciphertext.length>16384)throw Error('SANDBOX_RECEIPT_RECORD_INVALID');
 let plaintext;
 try{const decipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(record.iv,'hex'));decipher.setAAD(aad(runId,manifestSha256));decipher.setAuthTag(Buffer.from(record.authTag,'hex'));plaintext=Buffer.concat([decipher.update(Buffer.from(record.ciphertext,'base64')),decipher.final()]);}catch{throw Error('SANDBOX_RECEIPT_AUTHENTICATION_FAILED');}
 let value;try{value=JSON.parse(plaintext.toString('utf8'));}catch{throw Error('SANDBOX_RECEIPT_INVALID');}finally{plaintext.fill(0);}
 return Object.freeze(normalize(value,now()));
}
