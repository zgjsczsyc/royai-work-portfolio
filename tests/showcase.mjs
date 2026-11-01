import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 先运行 python3 serve.py；使用本机 Chrome，不需要企业账号或模型密钥。
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const failures=[],external=[],checks=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const page=await context.newPage();
page.on('pageerror',error=>failures.push(error.message));
page.on('response',response=>{if(response.status()>=400)failures.push(`${response.status()} ${response.url()}`);});
page.on('request',request=>{const url=request.url();if(/^https?:/.test(url)&&new URL(url).hostname!=='127.0.0.1')external.push(url);});
const screenshot=async(name)=>{
  await page.waitForTimeout(1200); // 等待图表更新动画，避免保存半绘制的曲线。
  return page.screenshot({path:path.join(root,'projects',name,'preview.png')});
};
try{
  await page.goto('http://127.0.0.1:8765');
  check('作品集入口包含四个网页项目',await page.locator('.grid a').count()===4);
  check('私有仓库入口先登录',await page.locator('nav a').getAttribute('href')==='https://github.com/login?return_to=%2Fzgjsczsyc%2Froyai-work-portfolio');

  await page.goto('http://127.0.0.1:8766');
  await page.waitForFunction(()=>document.querySelector('#personCount').textContent.includes('8'));
  check('日志合成样本人数为 8',parseInt(await page.locator('#personCount').innerText(),10)===8);
  check('日志工作日覆盖为 5 天',(await page.locator('#ovWorkDays').innerText()).includes('5'));
  const expectedHours=await page.evaluate(()=>window.DEMO_LOGS.filter(r=>r.process_name!=='explorer.exe').reduce((sum,r)=>sum+r.duration,0)/3600);
  const displayedHours=parseFloat(await page.locator('#ovTotalH').innerText());
  check('日志总时长与合成输入独立加总一致',Math.round(expectedHours)===displayedHours);
  await screenshot('log-analysis');
  await page.locator('[data-view="dept"]').click();
  check('部门分析可切换',await page.locator('#deptView').isVisible());
  await page.locator('[data-view="person"]').click();
  check('人员详情可切换',await page.locator('#personView').isVisible());
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#btnExport').click();
  const exportFile=await downloadEvent;
  check('日志报告可导出',exportFile.suggestedFilename().endsWith('.xlsx'));

  await page.goto('http://127.0.0.1:8767');
  await page.waitForFunction(()=>document.querySelector('#kPv').textContent!=='--');
  for(const channel of ['all','web','de']){
    await page.locator(`[data-c="${channel}"]`).click();
    await page.locator('[data-r="7"]').click();
    const result=await page.evaluate(ch=>{
      const data=window.__DEMO_DATA__,end=data.dates.length-1,start=end-6;
      const records=data.users.flatMap(u=>(ch==='web'?u.w:ch==='de'?u.e:[...u.w,...u.e]).filter(([day])=>day>=start&&day<=end));
      return {expected:records.reduce((sum,[,n])=>sum+n,0),actual:aggregate(start,end,ch).pv};
    },channel);
    check(`运营看板 ${channel} 渠道聚合一致`,result.actual===result.expected);
  }
  await page.locator('[data-c="all"]').click();await page.locator('[data-r="all"]').click();
  check('运营看板全量覆盖 60 位虚构用户',await page.locator('#kUsers').innerText()==='60');
  await screenshot('operations-dashboard');

  await page.goto('http://127.0.0.1:8768');
  await page.waitForSelector('.notification-card');
  check('通知列表初始包含两条模拟任务',await page.locator('.notification-card').count()===2);
  check('初始一条历史新结果蓝点',await page.locator('[data-testid="history-unread"]').count()===1);
  await screenshot('notification-center');
  await page.getByRole('button',{name:'全部已读'}).click();
  check('全部已读清除通知未读',await page.locator('.notification-card.unread').count()===0);
  check('全部已读保留历史结果蓝点',await page.locator('[data-testid="history-unread"]').count()===1);
  await page.locator('.notification-card').first().getByRole('button').click();
  await page.waitForSelector('[data-testid="translation-result"]');
  check('打开原对话清除历史结果蓝点',await page.locator('[data-testid="history-unread"]').count()===0);
  await page.getByRole('button',{name:'查看译文'}).click();
  check('译文明确标为本地示例',(await page.locator('pre').innerText()).includes('不是所上传文件的真实翻译结果'));
  const translatedFileEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'下载示例译文'}).click();
  check('示例译文可下载',(await translatedFileEvent).suggestedFilename()==='示例译文.txt');
  await page.getByRole('link',{name:'＋ 新建翻译任务'}).click();
  await page.locator('#filename').fill('浏览器验收示例.pdf');
  await page.getByRole('button',{name:'开始模拟翻译'}).click();
  await page.getByRole('link',{name:'← 返回通知中心'}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.notification-card').length===3,{},{timeout:12000});
  check('离开对话后任务仍完成并产生未读通知',await page.locator('.notification-card.unread').count()===1);
  await page.setViewportSize({width:390,height:844});
  check('通知中心移动端无横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1440,height:1000});

  await page.goto('http://127.0.0.1:8769');
  await page.waitForFunction(()=>window.homeStudio);
  await page.waitForTimeout(1000);
  check('房屋模型场景加载',await page.evaluate(()=>homeStudio.rooms.length>=10));
  check('房屋模型无小区名称',!(await page.locator('body').innerText()).includes('中海'));
  await screenshot('home-model');
  await page.locator('[data-mode="guest"]').click();await page.waitForTimeout(1000);
  check('隐藏床实际展开',await page.evaluate(()=>homeStudio.getSnapshot().bedAngle<.01));
  await page.locator('[data-mode="daily"]').click();await page.waitForTimeout(1000);
  check('隐藏床可恢复',await page.evaluate(()=>homeStudio.getSnapshot().bedAngle>1.56));
  await page.locator('[data-room="master"]').click();
  check('房间切换生效',await page.evaluate(()=>homeStudio.state.room==='master'));
  await page.locator('#photos').click();
  check('参考入口替换为方案图',await page.locator('#modal svg').count()===1&&await page.locator('#modal img').count()===0);
  await page.locator('#modal-close').click();
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(300);
  check('房屋模型移动端无溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check('所有页面无运行错误或失败资源',failures.length===0);
  check('展示过程没有外部网络请求',external.length===0);
  await fs.mkdir(path.join(root,'test-results'),{recursive:true});
  await fs.writeFile(path.join(root,'test-results/showcase.json'),JSON.stringify({checks,failures,external},null,2));
  console.log(JSON.stringify({passed:checks.length,failures,external},null,2));
}finally{await browser.close();}
