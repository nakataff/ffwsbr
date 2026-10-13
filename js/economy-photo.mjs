export async function prepareEconomyPhoto(value){
 if(!value)return '';if(typeof value==='string'&&!value.startsWith('data:'))return value;
 const source=typeof value==='string'?value:URL.createObjectURL(value);
 try{const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Não foi possível abrir a foto. Use PNG, JPG ou WebP.'));img.src=source;});
  const scale=Math.min(1,384/image.width,384/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.65,.48]){const result=canvas.toDataURL('image/webp',quality);if(result.length<=130000)return result;}
  throw Error('Esta foto ficou grande. Escolha uma imagem menor.');
 }finally{if(typeof value!=='string')URL.revokeObjectURL(source);}
}
