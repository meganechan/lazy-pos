// Install Playwright outside the repo, set PLAYWRIGHT_MODULE to its module path.
// UI_BASE must be a local app with its own throwaway UI_DATABASE. Never use prod.
// UI_PG_CONTAINER is that disposable DB container (used only to age fixture work).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.UI_BASE;
assert.match(base || '', /^http:\/\/127\.0\.0\.1:\d+$/);
assert.match(process.env.UI_DATABASE || '', /^ui_/);
const out = process.env.UI_OUT || '/tmp/lazy-pos-ui-evidence';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const request = async (path, token, body, method = body ? 'POST' : 'GET') => {
    const r = await fetch(base + '/api' + path, { method,
      headers: { 'content-type':'application/json', authorization:'Bearer '+token },
      ...(body ? { body:JSON.stringify(body) } : {}) });
    assert.ok(r.ok, path + ' HTTP ' + r.status);
    return r.json();
  };
  const owner = await request('/auth/login','',{userId:1,pin:'1234'});
  await request('/users/2',owner.token,{name:'พลอย'},'PUT');
  await request('/attendance/check-in',owner.token,{user_id:2});
  const staff = await request('/auth/login','',{userId:2,pin:'5678'});
  const member = await request('/members',staff.token,{name:'คุณเมย์',line_user_id:'U_LOCAL_ONLY'});
  const fixture = async (withMember=true) => {
    const t = await request('/tickets',staff.token,{assigned_user_id:2,...(withMember?{member_id:member.id}:{})});
    await request(`/tickets/${t.id}/custom-item`,staff.token,{name:'เจลสี · โทนธรรมชาติ',quoted_price:650,minutes:35});
    await request(`/tickets/${t.id}/custom-item`,staff.token,{name:'ดูแลเล็บและหนัง',quoted_price:250,minutes:10});
    await request(`/tickets/${t.id}/start`,staff.token,{});
    await request(`/tickets/${t.id}/payments`,staff.token,{method:'cash',amount:200});
    return t.id;
  };
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
  try {
    for (const [name,width,height] of [['phone',390,844],['ipad',1024,768]]) {
      const id=await fixture();
      execFileSync('docker',['exec',process.env.UI_PG_CONTAINER,'psql','-U','postgres','-d',process.env.UI_DATABASE,'-c',`UPDATE ticket SET started_at=now()-interval '60 minutes' WHERE id=${Number(id)}`]);
      const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
      await context.addInitScript(({token,user})=>{localStorage.setItem('lazypos_token',token);localStorage.setItem('lazypos_user',JSON.stringify(user));},staff);
      const page=await context.newPage();
      await page.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto(`${base}/?tab=tickets&view=ticket&id=${id}`);
      await page.getByText('เจลสี · โทนธรรมชาติ').first().waitFor();
      if(process.env.UI_SCENARIO==='baseline-cash') {
        await page.getByRole('button',{name:/^เงินสด รับเป็นเงินสด/}).click();
        await page.getByRole('dialog',{name:'รับเงินสด'}).waitFor({timeout:3000});
        throw Error('baseline unexpectedly has cash confirmation');
      }
      assert.equal(await page.locator('html').getAttribute('lang'),'th');
      assert.ok(await page.getByText('โหมดสาธิต — ยังไม่ได้ส่ง LINE จริง',{exact:true}).isVisible());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow');
      if(width>=1024) {
        const boxes=await page.locator('.checkout-items, .checkout-payment').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
        assert.ok(boxes[1].x>boxes[0].x && Math.abs(boxes[1].y-boxes[0].y)<3,'iPad two columns');
      }
      await page.screenshot({path:`${out}/after-${name}-checkout.png`});
      await page.getByRole('button',{name:'ส่งสรุปราคาทาง LINE',exact:true}).click();
      await page.getByText('บันทึกยืนยันหน้าร้าน (สาธิต)',{exact:true}).waitFor();
      assert.ok(!(await page.locator('body').innerText()).includes('ส่งสรุปราคาทาง LINE แล้ว'));
      await page.goto(`${base}/?tab=queue`);
      await page.getByText('เกินเวลา',{exact:true}).waitFor();
      await page.screenshot({path:`${out}/after-${name}-queue.png`});
      await page.getByRole('button',{name:'+10 นาที',exact:true}).click();
      await page.getByRole('button',{name:'เสร็จงาน',exact:true}).click();
      await page.getByText('พร้อมรับงาน',{exact:true}).waitFor();
      await page.goto(`${base}/?tab=tickets&view=ticket&id=${id}`);
      await page.getByRole('button',{name:'รับเงินสด',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'รับเงินสด'});await dialog.waitFor();
      await page.getByLabel('รับเงิน (บาท)',{exact:true}).fill('699');
      assert.equal(await dialog.getByRole('button',{name:'ยืนยันรับเงิน ฿700'}).isDisabled(),true);
      await page.getByLabel('รับเงิน (บาท)',{exact:true}).fill('1000');
      assert.ok((await page.locator('#cash-change').innerText()).includes('฿300'));
      await page.screenshot({path:`${out}/after-${name}-cash.png`});
      const response=page.waitForResponse(r=>r.url().endsWith(`/tickets/${id}/payments`) && r.request().method()==='POST');
      await dialog.getByRole('button',{name:'ยืนยันรับเงิน ฿700'}).click();
      const paid=await response;assert.equal(paid.status(),200);assert.equal(paid.request().postDataJSON().amount,700);
      const d=await request(`/tickets/${id}`,staff.token);assert.equal(d.paid,900);assert.equal(d.status,'closed');
      // Missing recipient disables even the demo send action.
      const walkin=await fixture(false);await page.goto(`${base}/?tab=tickets&view=ticket&id=${walkin}`);
      const send=page.getByRole('button',{name:'ส่งสรุปราคาทาง LINE',exact:true});await send.waitFor();assert.equal(await send.isDisabled(),true);
      await request(`/tickets/${walkin}/finish`,staff.token,{});
      // Lists distinguish a failed load from empty data and recover via Retry.
      for(const [tab,endpoint,message] of [['members','members','โหลดสมาชิกไม่สำเร็จ'],['tickets','tickets','โหลดบิลไม่สำเร็จ']]) {
        let fail=true;
        await page.route(`**/api/${endpoint}?*`,route=>{if(fail && (endpoint !== 'tickets' || new URL(route.request().url()).searchParams.has('status'))){fail=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"local injected failure"}'});}return route.continue();});
        await page.route(`**/api/${endpoint}`,route=>{if(fail && (endpoint !== 'tickets' || new URL(route.request().url()).searchParams.has('status'))){fail=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"local injected failure"}'});}return route.continue();});
        await page.goto(`${base}/?tab=${tab}`);await page.getByRole('alert').filter({hasText:message}).waitFor();
        await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();
        await page.getByText(tab === 'members' ? 'คุณเมย์' : 'ลูกค้าทั่วไป',{exact:true}).first().waitFor();
      }
      await page.getByRole('button',{name:'เปิดบิลใหม่',exact:true}).click();
      const labels=await page.getByRole('combobox').evaluateAll(nodes=>nodes.map(n=>n.labels.length));
      assert.equal(labels.length,2);assert.ok(labels.every(Boolean),'select labels associated');
      assert.deepEqual(errors,[],'no browser runtime errors');
      console.log(`PASS ${name}: cash outstanding/change, queue actions, demo LINE, retry, labels, layout`);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
