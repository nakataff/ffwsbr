import { WorkerEntrypoint } from 'cloudflare:workers';
import worker, { recordOwnerCheckin } from './worker.js';

export class OwnerCheckin extends WorkerEntrypoint {
  checkin() {
    return recordOwnerCheckin(this.env);
  }
}

export default worker;
