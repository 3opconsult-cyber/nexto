const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await p.goto('file://' + process.argv[2] + '#record');
  await p.waitForFunction(() => window.PING_ANIM && window.PING_ANIM.ready);
  fs.mkdirSync('frames', { recursive: true });
  const FPS = 30, N = Math.floor(await p.evaluate(() => window.PING_ANIM.duration) * FPS);
  const svg = p.locator('#svg');
  for (let i = 0; i < N; i++) {
    await p.evaluate(x => window.PING_ANIM.seek(x), i / FPS);
    await svg.screenshot({ path: `frames/${String(i).padStart(4, '0')}.png` });
  }
  await b.close();
  console.log('frames done');
})();
