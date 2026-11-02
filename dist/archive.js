export function openArchive(indexedDB){
 return new Promise((resolve,reject)=>{
  if(!indexedDB){reject(Error('Browser recording storage unavailable'));return}
  const request=indexedDB.open('neurorunner-recordings',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('trials',{keyPath:'id'});
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
  request.onblocked=()=>reject(Error('Close other NeuroRunner tabs to open recording storage'));
 });
}
export function writeRecords(db,records){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('trials','readwrite');
  tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||Error('Recording write failed'));
  for(const record of records)tx.objectStore('trials').put(record);
 });
}
export function readRecords(db){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('trials','readonly'),request=tx.objectStore('trials').getAll();
  tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Recording read failed'));
 });
}
