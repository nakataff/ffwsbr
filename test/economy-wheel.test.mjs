import test from 'node:test';
import assert from 'node:assert/strict';
import {WHEEL_PRIZES,prizeAngle,landingAngle} from '../js/economy-wheel.mjs';
test('the pointer ends in the server prize after at least six full turns',()=>{for(const p of WHEEL_PRIZES)for(const current of [0,89.7,350,1234.56]){const end=landingAngle(p.id,current);assert(end-current>=6*360);const angle=((360-end%360)+360)%360,index=Math.floor(angle/(360/WHEEL_PRIZES.length));assert.equal(WHEEL_PRIZES[index].id,p.id);assert.equal(end%360,prizeAngle(p.id));}assert.throws(()=>landingAngle('fake'));});
test('voucher prizes and older direct-code wins use the same wheel segment',()=>{assert.equal(WHEEL_PRIZES.at(-1).id,'voucher');assert.equal(prizeAngle('voucher'),prizeAngle('code'));assert.equal(landingAngle('voucher',42),landingAngle('code',42));});
