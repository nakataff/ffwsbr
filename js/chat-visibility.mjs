const KEY='cff-chat-visible-v1',EVENT='cff:chat-visibility';

export function isChatVisible(){
 try{return localStorage.getItem(KEY)!=='0';}catch{return true;}
}

export function setChatVisible(visible){
 const enabled=!!visible;
 try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}
 window.dispatchEvent(new CustomEvent(EVENT,{detail:{visible:enabled}}));
}

export function watchChatVisibility(change){
 const local=e=>change(e.detail.visible);
 const stored=e=>{if(e.key===KEY||e.key===null)change(isChatVisible());};
 window.addEventListener(EVENT,local);
 window.addEventListener('storage',stored);
 change(isChatVisible());
 return()=>{window.removeEventListener(EVENT,local);window.removeEventListener('storage',stored);};
}

// Administrative tools do not mount the public community widget.
export function isChatPageAllowed(pathname=location.pathname){
 return !/(^|\/)admin(?:[-/.]|$)/i.test(pathname);
}
