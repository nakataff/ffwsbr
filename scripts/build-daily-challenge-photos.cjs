'use strict';
// Build small private, bundled portraits once; the quiz never fetches these images at play time.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function buildPhotos(bank,{canvas}={}){
 const api=canvas||require(require.resolve('@napi-rs/canvas',{paths:[path.join(root,'cloudflare/camp-notifications'),__dirname]}));
 const paths=[...new Set(bank.questions.filter(q=>q.kind==='player').map(q=>q.imagePath))],photos={};
 for(const source of paths){
  const file=path.resolve(root,source);if(!file.startsWith(root+path.sep))throw Error('Foto fora do repositório.');
  const original=fs.readFileSync(file),image=await api.loadImage(original),scale=Math.min(1,320/image.width,320/image.height),c=api.createCanvas(Math.max(1,Math.round(image.width*scale)),Math.max(1,Math.round(image.height*scale)));
  c.getContext('2d').drawImage(image,0,0,c.width,c.height);const bytes=await c.encode('webp',78);
  if(bytes.length>64*1024)throw Error('Miniatura do quiz excede 64 KB: '+source);
  photos[source]='data:image/webp;base64,'+bytes.toString('base64');
 }
 if(paths.length&&!Object.keys(photos).length)throw Error('Fotos do quiz não foram preparadas.');
 if(Buffer.byteLength(JSON.stringify(photos))>2*1024*1024)throw Error('Banco de fotos do quiz excede 2 MB.');
 return photos;
}
module.exports={buildPhotos};
