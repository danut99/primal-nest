import {chromium} from 'playwright-core';
import {createServer} from 'vite';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=new URL('../output/world-background/',import.meta.url);
await fs.mkdir(out,{recursive:true});
const server=await createServer({root,logLevel:'error',server:{host:'127.0.0.1',port:5209}});
await server.listen();
const browser=await chromium.launch({channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:120000});
 await page.evaluate(async()=>{const {newGame}=await import('/shared/game/index.ts');localStorage.setItem('dino-world-save-v3',JSON.stringify(newGame(Date.now(),12345)));localStorage.setItem('dino-world:first-steps','done');});
 await page.reload({waitUntil:'domcontentloaded',timeout:120000});
 await page.locator('.sky').waitFor();await page.locator('.world-loader').waitFor({state:'hidden',timeout:60000});
 const background=await page.evaluate(async()=>{const sky=document.querySelector('.sky'),style=getComputedStyle(sky),url=style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)[1],img=new Image();img.src=url;await img.decode();return {url,width:img.naturalWidth,height:img.naturalHeight,size:style.backgroundSize,clouds:sky.children.length};});
 await page.screenshot({path:fileURLToPath(new URL('desktop.png',out))});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:fileURLToPath(new URL('mobile.png',out))});
 const result={background,errors};await fs.writeFile(new URL('review.json',out),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(errors.length||background.width<2000||background.clouds)throw Error('Background review failed');
}finally{await browser.close();await server.close();}
