// Read-only adapter metadata. This contract never schedules stimulation.
export function validateChannelConnectivity(input){
 if(!input||input.schema!=='neurorunner.channel-connectivity.v1'||!Array.isArray(input.channels)||!input.channels.length||!Array.isArray(input.connections))throw Error('Invalid channel connectivity snapshot');
 const ids=new Set(),indices=new Set();
 for(const channel of input.channels){
  if(!Number.isSafeInteger(channel.id)||channel.id<0||ids.has(channel.id))throw Error('Invalid or duplicate channel ID');ids.add(channel.id);
  for(const key of ['label','role'])if(channel[key]!==undefined&&(typeof channel[key]!=='string'||channel[key].length>100))throw Error('Invalid channel '+key);
  if(channel.count_index!==undefined){if(!Number.isInteger(channel.count_index)||channel.count_index<0||channel.count_index>7||indices.has(channel.count_index))throw Error('Invalid or duplicate response count index');indices.add(channel.count_index)}
 }
 for(const edge of input.connections){
  if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)throw Error('Connection references an unknown channel');
  if(edge.strength!==undefined&&!Number.isFinite(edge.strength))throw Error('Invalid connection strength');
  if(edge.kind!==undefined&&!['functional','anatomical','routing','unknown'].includes(edge.kind))throw Error('Invalid connection kind');
 }
 if(input.strength_units!==undefined&&(typeof input.strength_units!=='string'||input.strength_units.length>100))throw Error('Invalid strength units');
 return structuredClone(input);
}
