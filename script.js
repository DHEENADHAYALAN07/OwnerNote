(function(){
  const intro=document.getElementById('intro'), rig=document.getElementById('rig'), plate=document.getElementById('plate'),
        bike=document.getElementById('bike'), bikeImg=document.getElementById('bikeImg'), rope=document.getElementById('rope'),
        ropePath=document.getElementById('ropePath'), dust=document.getElementById('dust'), topbar=document.getElementById('topbar');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anims=[], raf=0, running=false;

  // where the rig sits: the plate centred, just above the horizon
  function layout(){
    const W=intro.clientWidth, H=intro.clientHeight;
    const pr=plate.getBoundingClientRect(), br=bike.getBoundingClientRect();
    const gap=parseFloat(getComputedStyle(rig).gap)||40;
    const rigW=pr.width+gap+br.width, rigH=Math.max(pr.height,br.height);
    const groundY=H*0.62;                                  // wheels on the floor
    const top=groundY-rigH;
    // the whole rig (plate + Kai on his bike) fitted to the width and centred — nothing goes off the edge (as the app)
    const margin=Math.min(16,W*.03);
    const sc=Math.min(1,(W-2*margin)/rigW);
    const endX=(W-rigW*sc)/2;
    const startX=-rigW*sc-40;
    return {W,H,rigW,rigH,top,endX,startX,pr,br,gap,sc};
  }
  function drawRope(){
    const ir=intro.getBoundingClientRect(), p=plate.getBoundingClientRect(), b=bike.getBoundingClientRect();
    const x1=p.right-ir.left, y1=p.top+p.height/2-ir.top;
    const x2=b.left+b.width*0.16-ir.left, y2=b.top+b.height*0.52-ir.top;   // the luggage rack (bike flipped: rear is on the left)
    const sag=Math.min(28,Math.abs(x2-x1)*0.35);
    rope.setAttribute('width',ir.width); rope.setAttribute('height',ir.height); rope.style.left='0'; rope.style.top='0';
    ropePath.setAttribute('d',`M${x1},${y1} Q${(x1+x2)/2},${Math.max(y1,y2)+sag} ${x2},${y2}`);
  }
  function loop(){ drawRope(); raf=requestAnimationFrame(loop) }

  function finalState(){
    const L=layout();
    rig.style.transform=`translate3d(${L.endX}px,${L.top}px,0) scale(${L.sc})`;
    plate.style.transform='none'; bike.style.opacity='1'; rope.style.opacity='0';
    intro.classList.add('parked','done');
  }

  // the bike turns to dust: its own pixels, drifting off to the right and up
  function dissolve(){
    return new Promise(res=>{
      const r=bikeImg.getBoundingClientRect(), ir=intro.getBoundingClientRect(), dpr=Math.min(2,devicePixelRatio||1);
      dust.width=ir.width*dpr; dust.height=ir.height*dpr; const ctx=dust.getContext('2d'); ctx.scale(dpr,dpr);
      const off=document.createElement('canvas'); const w=Math.max(1,Math.round(r.width)), h=Math.max(1,Math.round(r.height));
      off.width=w; off.height=h; const o=off.getContext('2d');
      o.translate(w,0); o.scale(-1,1); o.drawImage(bikeImg,0,0,w,h);
      let data; try{ data=o.getImageData(0,0,w,h).data }catch(e){ bike.animate([{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(12px)'}],{duration:900,fill:'forwards'}).finished.then(res); return }
      const step=w<220?3:4, ps=[];
      for(let y=0;y<h;y+=step) for(let x=0;x<w;x+=step){
        const i=(y*w+x)*4; if(data[i+3]<120) continue;
        ps.push({x:r.left-ir.left+x,y:r.top-ir.top+y,c:`rgb(${data[i]},${data[i+1]},${data[i+2]})`,
          vx:1.2+Math.random()*3.2+(x/w)*1.5, vy:-(0.4+Math.random()*1.6), d:(x/w)*260+Math.random()*180, s:step*0.9});
      }
      bike.style.opacity='0';
      const t0=performance.now(), life=1300;
      (function frame(t){
        const el=t-t0; ctx.clearRect(0,0,ir.width,ir.height); let alive=false;
        for(const p of ps){
          const k=Math.max(0,el-p.d); const a=1-k/life; if(a<=0) continue; alive=true;
          const q=k/16; ctx.globalAlpha=a; ctx.fillStyle=k>0&&Math.random()<.08?'#6ee7b7':p.c;
          ctx.fillRect(p.x+p.vx*q+Math.sin(q/6)*2, p.y+p.vy*q-q*q*0.004, p.s*(0.6+a*0.5), p.s*(0.6+a*0.5));
        }
        if(alive) requestAnimationFrame(frame); else { ctx.clearRect(0,0,ir.width,ir.height); res() }
      })(t0);
    });
  }

  async function play(){
    if(running) return; running=true;
    anims.forEach(a=>a.cancel()); anims=[]; cancelAnimationFrame(raf);
    intro.classList.remove('parked','done'); bike.style.opacity='1'; rope.style.opacity='1'; plate.style.transform='';
    if(reduce){ finalState(); running=false; return }
    const L=layout();
    rig.style.transform=`translate3d(${L.startX}px,${L.top}px,0) scale(${L.sc})`;
    loop();
    // 1 · ride in from the left, towing the plate
    const ride=rig.animate([{transform:`translate3d(${L.startX}px,${L.top}px,0) scale(${L.sc})`},{transform:`translate3d(${L.endX+18}px,${L.top}px,0) scale(${L.sc})`,offset:.9},{transform:`translate3d(${L.endX}px,${L.top}px,0) scale(${L.sc})`}],
      {duration:2600,easing:'cubic-bezier(.22,.7,.2,1)',fill:'forwards'});
    const bounce=bike.animate([{transform:'translateY(0) rotate(0)'},{transform:'translateY(-5px) rotate(-.8deg)'},{transform:'translateY(0) rotate(0)'}],{duration:260,iterations:9});
    const tow=plate.animate([{transform:'translateY(-26px) rotate(-5deg)'},{transform:'translateY(-18px) rotate(-3deg)'},{transform:'translateY(-26px) rotate(-5deg)'}],{duration:520,iterations:5,easing:'ease-in-out'});
    anims.push(ride,bounce,tow);
    await ride.finished.catch(()=>{});
    intro.classList.add('parked');
    // 2 · the rope lets go; the plate drops into the centre
    rope.animate([{opacity:1},{opacity:0}],{duration:250,fill:'forwards'});
    tow.cancel();
    const drop=plate.animate([{transform:'translateY(-26px) rotate(-5deg)'},{transform:'translateY(8px) rotate(1.5deg)',offset:.55},{transform:'translateY(-3px) rotate(-.4deg)',offset:.78},{transform:'none'}],
      {duration:900,easing:'cubic-bezier(.3,.9,.3,1)',fill:'forwards'});
    const lean=bike.animate([{transform:'rotate(0)'},{transform:'rotate(-4deg) translateX(10px)'},{transform:'rotate(0)'}],{duration:600,easing:'ease-out'});
    anims.push(drop,lean);
    await drop.finished.catch(()=>{});
    cancelAnimationFrame(raf);
    // 3 · Kai stays parked on his bike beside the welcome
    intro.classList.add('done');
    running=false;
  }

  document.getElementById('replay').addEventListener('click',()=>{ running=false; play() });
  addEventListener('resize',()=>{ if(!running) finalState() });
  const start=()=>{ (bikeImg.decode?bikeImg.decode():Promise.resolve()).catch(()=>{}).then(()=>document.fonts.ready).then(play) };
  if(document.readyState==='complete') start(); else addEventListener('load',start);

  // the glass bar appears once the intro scrolls away
  new IntersectionObserver(([e])=>topbar.classList.toggle('show',!e.isIntersecting),{threshold:.15}).observe(intro);

  // sections rise in as they arrive (visible already if no observer runs)
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.remove('pre'); io.unobserve(e.target) } }),{threshold:.12});
  document.querySelectorAll('.reveal.pre').forEach(el=>{ const r=el.getBoundingClientRect(); if(r.top<innerHeight) el.classList.remove('pre'); else io.observe(el) });


  // ---------- page 2: the screens in 3D (coverflow) ----------
  const track=document.getElementById('cfTrack'), items=[...track.children], dots=document.getElementById('cfDots');
  items.forEach(()=>dots.appendChild(document.createElement('i')));
  function flow(){
    const mid=track.scrollLeft+track.clientWidth/2; let best=0,bd=1e9;
    items.forEach((el,i)=>{ const c=el.offsetLeft+el.offsetWidth/2, d=(c-mid)/el.offsetWidth;
      if(Math.abs(d)<bd){bd=Math.abs(d);best=i}
      const k=Math.max(-1.6,Math.min(1.6,d));
      el.style.transform=reduce?'':`rotateY(${-k*28}deg) translateZ(${-Math.abs(k)*90}px) scale(${1-Math.min(.18,Math.abs(k)*.1)})`;
      el.style.opacity=String(1-Math.min(.55,Math.abs(k)*.3)); });
    [...dots.children].forEach((d,i)=>d.classList.toggle('on',i===best));
    return best;
  }
  track.addEventListener('scroll',()=>requestAnimationFrame(flow),{passive:true});
  addEventListener('resize',flow);
  const go=n=>{ const i=Math.max(0,Math.min(items.length-1,n)); const el=items[i]; track.scrollTo({left:el.offsetLeft-(track.clientWidth-el.offsetWidth)/2,behavior:reduce?'auto':'smooth'}) };
  document.getElementById('cfPrev').addEventListener('click',()=>go(flow()-1));
  document.getElementById('cfNext').addEventListener('click',()=>go(flow()+1));
  requestAnimationFrame(()=>{ go(2); flow() });

  // ---------- page 3: lines Kai understands ----------
  // [what the owner says (Tamil in English letters — spoken in Tamil works the same), what it means, what Kai does]
  const talk=[
    {t:'Credit',items:[
      ['Kumar took 500 on credit','Kumar took ₹500 on credit','Draft: Kumar — ₹500 credit. <b>Confirm</b> saves it.'],
      ['Logesh owes 2,000 on the 5th next month','Logesh owes 2,000, due the 5th next month','Credit with its due date — <b>5th next month</b>.'],
      ['I owe ABC Traders 10,000','I owe ABC Traders 10,000','A supplier you owe: a Debit entry; Kai asks the due date.'],
      ['How much does Kumar owe?','How much does Kumar owe?','Kumar\'s balance, read from your books.']]},
    {t:'Payments',items:[
      ['Kumar paid 2,000','Kumar paid 2,000','Payment in from Kumar, set against his oldest dues.'],
      ['Selvi paid 300 by GPay','Selvi paid 300 by GPay','Paid by GPay — the mode is noted.'],
      ['The customer has paid','The customer has paid','Kai asks how much, then drafts it.'],
      ['Ramesh settled his balance','Ramesh settled up','His full balance as one payment, on Confirm.']]},
    {t:'Stock',items:[
      ['Received 25 kg of Ponni rice','25 kg of Ponni rice came in','Stock in: <b>+25 kg</b> rice.'],
      ['Received 2 boxes of Colgate','2 boxes of Colgate came in','Boxes turned into pieces by the product\'s own unit.'],
      ['Show me low-stock items','What is running low?','Every product at or below its minimum.'],
      ['How much rice is left?','How much rice is left?','What is left, in its own unit.']]},
    {t:'Stored Items',items:[
      ['I kept the key in the cupboard','I kept the key in the cupboard','Kai shows it; on <b>Confirm</b> he keeps: key → almirah.'],
      ['Where did I keep the key?','Where did I keep the key?','“In the almirah” — with the day you said it.'],
      ['I lent the drill to Ravi','I lent the drill to Ravi','Kai remembers who has it.'],
      ['Show me my stored-item list','What all have I kept?','The list of everything you told Kai.']]},
    {t:'Sales',items:[
      ['5 haircuts, 2 shaves, 3 facials','5 haircuts, 2 shaves, 3 facials','Each service with its count and Menu price.'],
      ['One haircut and one shave, paid by GPay','One haircut, one shave, paid by GPay','A Daily Sales Note line, paid by UPI.'],
      ['How much have I sold so far?','How much have I sold so far?','Today\'s total so far, by service.'],
      ['That is all for today','That\'s all for today','Kai shows the day and closes it on <b>Day close</b>.']]},
    {t:'Reminders',items:[
      ['Remind me to call Kumar tomorrow at 10','Call Kumar tomorrow at 10','An alarm on your phone, tomorrow at 10:00.'],
      ['Remind me to pay for milk at 6 PM','Remind me at 6 PM to pay for milk','Today at 6:00 PM.'],
      ['Remind me to call Murugan in 10 minutes','Remind me in 10 minutes to call Murugan','In ten minutes: call Murugan.'],
      ['What reminders do I have?','What reminders do I have?','Your open reminders.']]},
  ];
  const tabs=document.getElementById('tabs'), lines=document.getElementById('lines');
  function show(i){
    [...tabs.children].forEach((b,j)=>b.setAttribute('aria-selected',String(i===j)));
    lines.innerHTML=talk[i].items.map(([said,means,does])=>`<div class="line"><div class="bubble">“${said}”<small>${means}</small></div><div class="reply">${does}</div></div>`).join('');
  }
  talk.forEach((c,i)=>{ const b=document.createElement('button'); b.className='tab'; b.type='button'; b.setAttribute('role','tab'); b.textContent=c.t; b.addEventListener('click',()=>show(i)); tabs.appendChild(b) });
  show(0);

  // ---------- Loan Lab: accessible Coming Soon interaction ----------
  const loanModal=document.getElementById('loanModal'), openLoan=document.getElementById('openLoan'), closeLoan=document.getElementById('closeLoan'), loanOkay=document.getElementById('loanOkay');
  let loanOpener=null;
  function showLoan(){ loanOpener=document.activeElement; loanModal.classList.add('open'); loanModal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; closeLoan.focus(); }
  function hideLoan(){ loanModal.classList.remove('open'); loanModal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; if(loanOpener&&loanOpener.focus) loanOpener.focus(); }
  openLoan.addEventListener('click',showLoan); closeLoan.addEventListener('click',hideLoan); loanOkay.addEventListener('click',hideLoan);
  loanModal.addEventListener('click',e=>{ if(e.target===loanModal) hideLoan(); });
  loanModal.addEventListener('pointerdown',e=>{ if(e.target===loanModal) hideLoan(); });
  addEventListener('keydown',e=>{ if(e.key==='Escape'&&loanModal.classList.contains('open')) hideLoan(); });
  closeLoan.setAttribute('title','Close this preview');

  // ---------- contact: copy the address ----------
  document.getElementById('copyMail').addEventListener('click',e=>{
    const btn=e.currentTarget, text=document.getElementById('mailAddr').textContent;
    const done=()=>{ btn.textContent='Copied'; setTimeout(()=>btn.textContent='Copy',1600) };
    (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(done).catch(()=>{
      const r=document.createRange(); r.selectNodeContents(document.getElementById('mailAddr')); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent='Selected'; });
  });


  // ---------- Kai in 3D: the hero Kai and the companion turn to look at the cursor ----------
  const kai3d=document.getElementById('kai3d');
  const fine=matchMedia('(pointer:fine)').matches;
  let px=innerWidth/2, py=innerHeight/2, tick=false;
  function look(){
    tick=false;
    if(kai3d){ const r=kai3d.getBoundingClientRect(); const x=(px-(r.left+r.width/2))/innerWidth, y=(py-(r.top+r.height/2))/innerHeight;
      kai3d.style.transform=`rotateY(${Math.max(-1,Math.min(1,x*2))*16}deg) rotateX(${-Math.max(-1,Math.min(1,y*2))*9}deg)`; }
    if(buddyOn && !dragging){ const r=buddy.getBoundingClientRect(); const x=(px-(r.left+r.width/2))/innerWidth, y=(py-(r.top+r.height/2))/innerHeight;
      buddyImg.style.transform=`rotateY(${Math.max(-1,Math.min(1,x*2))*24}deg) rotateX(${-Math.max(-1,Math.min(1,y*2))*12}deg)`; }
  }
  if(!reduce && fine) addEventListener('pointermove',e=>{ px=e.clientX; py=e.clientY; if(!tick){ tick=true; requestAnimationFrame(look) } },{passive:true});

  // ---------- the companion: shows up after the welcome, changes with each page, can be carried anywhere ----------
  const buddy=document.getElementById('buddy'), buddyImg=document.getElementById('buddyImg'), say=document.getElementById('buddySay');
  let buddyOn=false, dragging=false, pose='curious', sayTimer=0;
  const poses={};
  ['curious','joyful','proud','thoughtful','winking','surprised','point'].forEach(p=>{ const im=new Image(); im.src=`public/images/kai-${p}.webp`; poses[p]=im });
  function setPose(p){ if(p===pose) return; pose=p; buddyImg.src=`public/images/kai-${p}.webp` }
  function speak(text,ms=4200){ say.textContent=text; say.classList.remove('hide'); clearTimeout(sayTimer); sayTimer=setTimeout(()=>say.classList.add('hide'),ms) }
  // where he stands, if you moved him before (this browser only)
  try{ const p=JSON.parse(localStorage.getItem('kaiSpot')||'null'); if(p&&isFinite(p.x)&&isFinite(p.y)) place(p.x*innerWidth,p.y*innerHeight,true) }catch(e){}
  function place(x,y,moved){
    const w=buddy.offsetWidth||110, h=buddy.offsetHeight||170;
    x=Math.max(6,Math.min(innerWidth-w-6,x)); y=Math.max(60,Math.min(innerHeight-h-6,y));
    buddy.style.left=x+'px'; buddy.style.top=y+'px'; buddy.style.right='auto'; buddy.style.bottom='auto';
    buddy.classList.toggle('left',x<innerWidth/2); if(moved) buddy.classList.add('moved');
  }
  // the page you are on decides his pose and what he says
  const beats=[
    ['#features','curious','Six things I do for your shop. Which one first?'],
    ['#inside','thoughtful','Swipe the phones — that is me at work.'],
    ['#talk','joyful','Pick a topic and try a sample phrase out loud.'],
    ['#help','winking','Need help? Write to us — we keep improving Kai.'],
    ['.band','proud','Ready when you are. Get me on Google Play!'],
    ['#loan','joyful','A new idea for your shop is on the way. Explore the Loan Lab!'],
  ];
  let heroSeen=true, introSeen=true;
  function updateOn(){ const on=!heroSeen&&!introSeen; if(on!==buddyOn){ buddyOn=on; buddy.classList.toggle('on',on); if(on) speak(beatLine||'Hi! I\'m Kai. Grab me and take me along.') } }
  let beatLine='';
  const io2=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.target===intro){ introSeen=e.isIntersecting; updateOn(); return }
    if(e.target.classList.contains('hero')){ heroSeen=e.isIntersecting; updateOn(); return }
    if(!e.isIntersecting) return;
    const b=beats.find(([sel])=>e.target.matches(sel)); if(!b) return;
    beatLine=b[2]; if(!dragging){ setPose(b[1]); if(buddyOn) speak(b[2]) }
  }),{threshold:[0,.35]});
  io2.observe(intro); io2.observe(document.querySelector('.hero'));
  beats.forEach(([sel])=>{ const el=document.querySelector(sel); if(el) io2.observe(el) });

  // drag him anywhere (mouse or finger); a tap without moving: a wink and a tip
  const tips=['Speak naturally in English — typed or spoken.','Nothing is saved until you tap Confirm.','Paid by UPI? I can note it in your Daily Cash Note.','Forgot where you stored something? Ask me and I can help you find the note.'];
  let grab=null, tipAt=0;
  buddy.addEventListener('pointerdown',e=>{
    if(!buddyOn) return; e.preventDefault(); buddy.setPointerCapture(e.pointerId);
    const r=buddy.getBoundingClientRect(); grab={x:e.clientX,y:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};
  });
  buddy.addEventListener('pointermove',e=>{
    if(!grab) return;
    if(!grab.moved && Math.hypot(e.clientX-grab.x,e.clientY-grab.y)<6) return;
    if(!grab.moved){ grab.moved=true; dragging=true; buddy.classList.add('dragging'); buddy.classList.remove('drop'); setPose('surprised'); speak('Whoa! Put me anywhere you like.',9000); buddyImg.style.transform='' }
    place(e.clientX-grab.dx,e.clientY-grab.dy,true);
  });
  const end=e=>{
    if(!grab) return; const was=grab; grab=null;
    if(was.moved){
      dragging=false; buddy.classList.remove('dragging'); void buddy.offsetWidth; buddy.classList.add('drop');
      setPose('joyful'); speak('Here is good. I will wait right here!',3000);
      setTimeout(()=>{ const b=beats.find(([,p,l])=>l===beatLine); if(b) setPose(b[1]) },3200);
      try{ const r=buddy.getBoundingClientRect(); localStorage.setItem('kaiSpot',JSON.stringify({x:r.left/innerWidth,y:r.top/innerHeight})) }catch(err){}
    } else {
      setPose('winking'); speak(tips[tipAt++%tips.length]);
      setTimeout(()=>{ const b=beats.find(([,p,l])=>l===beatLine); setPose(b?b[1]:'curious') },2400);
    }
  };
  buddy.addEventListener('pointerup',end); buddy.addEventListener('pointercancel',end);
  addEventListener('resize',()=>{ if(buddy.classList.contains('moved')){ const r=buddy.getBoundingClientRect(); place(r.left,r.top,true) } });

  // Use the cursor elements already in the document. Creating duplicates caused the
  // visible hand and the pressed hand to be different elements (the click pose looked broken).
  if (matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce) {
    const cursor=document.getElementById('ownerCursor');
    const ring=document.getElementById('ownerCursorRing');
    if(cursor && ring){
      document.body.classList.add('custom-cursor');
      let mx=innerWidth/2,my=innerHeight/2,rx=mx,ry=my,cr=0;
      const move=(e)=>{mx=e.clientX;my=e.clientY;cursor.style.left=mx+'px';cursor.style.top=my+'px'};
      addEventListener('pointermove',move,{passive:true});
      function ringLoop(){rx+=(mx-rx)*.2;ry+=(my-ry)*.2;ring.style.left=rx+'px';ring.style.top=ry+'px';cr=requestAnimationFrame(ringLoop)} ringLoop();
      document.addEventListener('pointerover',e=>{if(e.target.closest('a,button,[role="button"],input,select,textarea,.tile,.cf-item,.loan-launch,.cash-bundle')){cursor.classList.add('is-hover');ring.classList.add('is-hover')}});
      document.addEventListener('pointerout',e=>{if(e.target.closest('a,button,[role="button"],input,select,textarea,.tile,.cf-item,.loan-launch,.cash-bundle')){cursor.classList.remove('is-hover');ring.classList.remove('is-hover')}});
      addEventListener('pagehide',()=>cancelAnimationFrame(cr),{once:true});
    }
  }

  // Robot fingertip presses down like a real touch; keep it above modal layers.
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    const robot=document.querySelector('.owner-cursor'), orbit=document.querySelector('.owner-cursor-ring');
    addEventListener('pointerdown',()=>{robot?.classList.add('is-down');orbit?.classList.add('is-down')},{passive:true});
    addEventListener('pointerup',()=>{robot?.classList.remove('is-down');orbit?.classList.remove('is-down')},{passive:true});
    addEventListener('pointercancel',()=>{robot?.classList.remove('is-down');orbit?.classList.remove('is-down')},{passive:true});
  }

  // Tap the cash bundle: Kai lowers it, then a handful of notes flutter down.
  const cashBundle=document.getElementById('cashBundle');
  const moneyFallLayer=document.getElementById('moneyFallLayer');
  const cashStatus=document.getElementById('cashStatus');
  if(cashBundle && moneyFallLayer) {
    let cashDropped=false;
    cashBundle.addEventListener('click',()=>{
      if(!cashDropped) {
        cashDropped=true;
        cashBundle.classList.add('dropped');
        cashBundle.setAttribute('aria-label','Money bundle placed down. Touch again to make the notes flutter.');
        if(cashStatus){cashStatus.textContent='Kai set the cash bundle down! Touch the bundle again to release the notes.';cashStatus.classList.add('show');}
        return;
      }
      moneyFallLayer.replaceChildren();
      for(let n=0;n<12;n++){
        const note=document.createElement('span'); note.className='falling-note'; note.textContent=n%3===0?'₹':'₹';
        note.style.left=(36+Math.random()*28)+'%';
        note.style.setProperty('--dx',((Math.random()-.5)*260)+'px');
        note.style.setProperty('--dy',(120+Math.random()*200)+'px');
        note.style.setProperty('--spin',((Math.random()-.5)*720)+'deg');
        note.style.setProperty('--rot',((Math.random()-.5)*45)+'deg');
        note.style.animationDelay=(Math.random()*.22)+'s';
        moneyFallLayer.appendChild(note);
        note.addEventListener('animationend',()=>note.remove(),{once:true});
      }
      if(cashStatus){cashStatus.textContent='The cash is falling!';cashStatus.classList.add('show');}
      setTimeout(()=>cashStatus?.classList.remove('show'),1900);
    });
  }

  // Gentle 3D tilt on feature cards; avoids transforms on touch-first devices.
  if(matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce){
    document.querySelectorAll('.tile').forEach(card=>{
      card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;card.style.transform=`perspective(850px) rotateX(${(0.5-y)*5}deg) rotateY(${(x-0.5)*6}deg) translateY(-3px)`});
      card.addEventListener('pointerleave',()=>{card.style.transform=''});
    });
  }

})();

/* Future interaction layer: intro scene and its bike animation are intentionally untouched. */
(()=>{
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
 const progress=document.createElement('div');progress.className='future-progress';progress.innerHTML='<span></span>';document.body.appendChild(progress);
 const progressFill=progress.firstElementChild;
 const labels=[['#app','Start'],['#features','Features'],['#inside','App'],['#talk','Kai'],['#help','Help'],['#loan','Loan Lab']];
 const hud=document.createElement('nav');hud.className='future-hud';hud.setAttribute('aria-label','Page chapters');
 labels.forEach(([sel,label],i)=>{if(!document.querySelector(sel))return;const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.innerHTML='<span>'+label+'</span>';b.addEventListener('click',()=>document.querySelector(sel).scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}));hud.appendChild(b)});document.body.appendChild(hud);
 let scheduled=false;
 function updateScroll(){scheduled=false;const max=document.documentElement.scrollHeight-innerHeight;progressFill.style.width=(max>0?scrollY/max*100:0)+'%';hud.classList.toggle('visible',scrollY>innerHeight*.55);let active=0;labels.forEach(([sel],i)=>{const el=document.querySelector(sel);if(el&&el.getBoundingClientRect().top<innerHeight*.48)active=i});[...hud.children].forEach((b,i)=>b.classList.toggle('active',i===active));}
 addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(updateScroll)}},{passive:true});addEventListener('resize',updateScroll,{passive:true});updateScroll();
 if(fine&&!reduce){
   const spotlight=document.createElement('div');spotlight.className='future-spotlight';document.body.appendChild(spotlight);
   addEventListener('pointermove',e=>{spotlight.style.setProperty('--mx',e.clientX+'px');spotlight.style.setProperty('--my',e.clientY+'px')},{passive:true});
   document.addEventListener('pointerdown',e=>{if(e.target.closest('.intro'))return;const r=document.createElement('span');r.className='future-ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),750);for(let i=0;i<5;i++){const s=document.createElement('i');s.className='future-spark';s.style.left=e.clientX+'px';s.style.top=e.clientY+'px';const a=Math.PI*2*i/5,dist=18+Math.random()*18;s.style.setProperty('--dx',Math.cos(a)*dist+'px');s.style.setProperty('--dy',Math.sin(a)*dist+'px');document.body.appendChild(s);setTimeout(()=>s.remove(),650)}const c=document.querySelector('.owner-cursor'),ring=document.querySelector('.owner-cursor-ring');if(c)c.classList.add('is-down');if(ring)ring.classList.add('is-down');setTimeout(()=>{if(c)c.classList.remove('is-down');if(ring)ring.classList.remove('is-down')},140);},{passive:true});
   document.querySelectorAll('#app .tile').forEach(card=>card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect();card.style.setProperty('--spot-x',(e.clientX-r.left)+'px');card.style.setProperty('--spot-y',(e.clientY-r.top)+'px')}));
   /* Magnetic micro-motion only for buttons, not the intro. */
   document.querySelectorAll('#app .btn,#app .loan-launch').forEach(el=>{el.addEventListener('pointermove',e=>{if(e.buttons)return;const r=el.getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/r.width,dy=(e.clientY-r.top-r.height/2)/r.height;el.style.translate=(dx*5)+'px '+(dy*4)+'px'});el.addEventListener('pointerleave',()=>{el.style.translate=''})});
 }
})();

// Keep the press ripple separate from the shared cursor movement handler.
(function(){
 const fine=window.matchMedia&&window.matchMedia('(hover:hover) and (pointer:fine)').matches;
 const hand=document.getElementById('ownerCursor');
 if(!fine||!hand) return;
 document.addEventListener('pointerdown',e=>{
   hand.classList.add('is-press');
   const ripple=document.createElement('span');
   ripple.className='owner-click-ripple';
   ripple.style.left=e.clientX+'px';
   ripple.style.top=e.clientY+'px';
   document.body.appendChild(ripple);
   setTimeout(()=>ripple.remove(),700);
 });
 addEventListener('pointerup',()=>hand.classList.remove('is-press'));
 addEventListener('blur',()=>hand.classList.remove('is-press'));
})();
