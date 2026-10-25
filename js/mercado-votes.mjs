/* Reuse the existing votes; one subscription per standalone page. */
import './firebase-votes.min.js?v=20260917-restore-mercado-v1';
const subscribe=window.fbLoadVotes;
let subscribed=false;
window.fbLoadVotes=()=>{if(subscribed)return;subscribed=true;return subscribe?.();};
if(typeof mercadoHasLoaded!=='undefined'&&mercadoHasLoaded)window.fbLoadVotes();
