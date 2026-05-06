const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'play-store-assets')

function hexToRgb(h) {
  return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]
}
function pxy(a, r, cx, cy) { return { x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r } }

const CATS = ['#27ae60','#e74c3c','#8e44ad','#4285f4']

function drawRingCalIcon(ctx, W) {
  const CX = W/2, CY = W/2
  const R_IN = W*0.133, R_OUT = W*0.469
  const RING_W = (R_OUT - R_IN) / 4

  // Background
  const bg = ctx.createRadialGradient(CX, CY-W*0.08, W*0.08, CX, CY, W*0.55)
  bg.addColorStop(0, '#22285a'); bg.addColorStop(1, '#0d0f2a')
  ctx.fillStyle = bg
  ctx.beginPath(); ctx.roundRect(0, 0, W, W, W*0.219); ctx.fill()

  // Outer glow
  const glow = ctx.createRadialGradient(CX,CY,R_IN*2,CX,CY,R_OUT*1.1)
  glow.addColorStop(0,'rgba(66,133,244,0.12)'); glow.addColorStop(1,'rgba(66,133,244,0)')
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY,R_OUT*1.1,0,Math.PI*2); ctx.fill()

  // Category rings
  CATS.forEach((col,i) => {
    const ra=R_IN+i*RING_W, rb=ra+RING_W
    const [r,g,b]=hexToRgb(col)
    ctx.beginPath(); ctx.arc(CX,CY,rb,0,Math.PI*2); ctx.arc(CX,CY,ra,0,Math.PI*2,true)
    ctx.closePath(); ctx.fillStyle=`rgba(${r},${g},${b},0.28)`; ctx.fill()
  })

  // Spokes
  for(let m=0;m<12;m++){
    const a=-Math.PI/2+(m/12)*Math.PI*2
    const isMaj=m%3===0
    const p1=pxy(a,R_IN,CX,CY), p2=pxy(a,R_OUT,CX,CY)
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y)
    ctx.globalAlpha=isMaj?0.55:0.2; ctx.strokeStyle='#fff'
    ctx.lineWidth=isMaj?W*0.004:W*0.0016; ctx.stroke(); ctx.globalAlpha=1
  }

  // Ring outlines
  CATS.forEach((col,i) => {
    ctx.beginPath(); ctx.arc(CX,CY,R_IN+(i+1)*RING_W,0,Math.PI*2)
    ctx.strokeStyle=col+'aa'; ctx.lineWidth=W*0.003; ctx.stroke()
  })
  ctx.beginPath(); ctx.arc(CX,CY,R_IN,0,Math.PI*2)
  ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=W*0.005; ctx.stroke()
  ctx.beginPath(); ctx.arc(CX,CY,R_OUT,0,Math.PI*2)
  ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=W*0.006; ctx.stroke()

  // Elapsed arc (blue work ring ~45%)
  const eA=-Math.PI/2, eB=eA+0.45*Math.PI*2
  const [er,eg,eb]=hexToRgb('#4285f4')
  ctx.save(); ctx.beginPath()
  ctx.arc(CX,CY,R_OUT,eA,eB); ctx.arc(CX,CY,R_IN,eB,eA,true); ctx.closePath()
  ctx.fillStyle=`rgba(${er},${eg},${eb},0.2)`; ctx.fill(); ctx.restore()

  // Critical arc (red ~10%)
  const cA=-Math.PI/2+0.45*Math.PI*2, cB=cA+0.10*Math.PI*2
  ctx.save(); ctx.beginPath()
  ctx.arc(CX,CY,R_OUT,cA,cB); ctx.arc(CX,CY,R_IN,cB,cA,true); ctx.closePath()
  ctx.fillStyle='rgba(231,76,60,0.38)'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX,CY,R_OUT,cA,cB)
  ctx.strokeStyle='rgba(231,76,60,1)'; ctx.lineWidth=W*0.008; ctx.stroke(); ctx.restore()

  // Sample events
  const evs=[
    {a1:0.12,a2:0.20,ri:3,col:'#4285f4'},
    {a1:0.55,a2:0.62,ri:2,col:'#8e44ad'},
    {a1:0.75,a2:0.80,ri:1,col:'#e74c3c'},
    {a1:0.88,a2:0.96,ri:3,col:'#4285f4'},
  ]
  evs.forEach(ev => {
    const ra=R_IN+ev.ri*RING_W+W*0.004, rb=R_IN+(ev.ri+1)*RING_W-W*0.004
    const a1=-Math.PI/2+ev.a1*Math.PI*2, a2=-Math.PI/2+ev.a2*Math.PI*2
    const [r,g,b]=hexToRgb(ev.col)
    ctx.save(); ctx.beginPath()
    ctx.arc(CX,CY,rb,a1,a2); ctx.arc(CX,CY,ra,a2,a1,true); ctx.closePath()
    ctx.fillStyle=`rgba(${r},${g},${b},0.5)`; ctx.fill()
    ctx.strokeStyle=ev.col; ctx.lineWidth=W*0.005; ctx.stroke(); ctx.restore()
  })

  // Needle
  const nA=-Math.PI/2+0.52*Math.PI*2
  const n1=pxy(nA,R_IN*0.38,CX,CY), n2=pxy(nA,R_OUT+W*0.01,CX,CY)
  ctx.beginPath(); ctx.moveTo(n1.x,n1.y); ctx.lineTo(n2.x,n2.y)
  ctx.strokeStyle='#e74c3c'; ctx.lineWidth=W*0.007; ctx.lineCap='round'; ctx.stroke()
  ctx.beginPath(); ctx.arc(n2.x,n2.y,W*0.014,0,Math.PI*2); ctx.fillStyle='#e74c3c'; ctx.fill()

  // Clock face
  const CR=R_IN*0.84
  const cf=ctx.createRadialGradient(CX,CY-CR*0.15,CR*0.1,CX,CY,CR)
  cf.addColorStop(0,'#ffffff'); cf.addColorStop(1,'#dde8ff')
  ctx.beginPath(); ctx.arc(CX,CY,CR,0,Math.PI*2); ctx.fillStyle=cf; ctx.fill()
  ctx.strokeStyle='rgba(60,80,160,0.25)'; ctx.lineWidth=W*0.004; ctx.stroke()

  // Clock ticks
  for(let i=0;i<12;i++){
    const a=-Math.PI/2+(i/12)*Math.PI*2, isMaj=i%3===0
    const p1=pxy(a,CR*(isMaj?0.72:0.82),CX,CY), p2=pxy(a,CR*0.91,CX,CY)
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y)
    ctx.strokeStyle=isMaj?'rgba(30,40,120,0.7)':'rgba(30,40,120,0.35)'
    ctx.lineWidth=isMaj?W*0.005:W*0.002; ctx.stroke()
  }

  // Clock hands
  function hand(frac,len,lw,col){
    const a=-Math.PI/2+frac*Math.PI*2
    const tip=pxy(a,len,CX,CY)
    ctx.beginPath(); ctx.moveTo(CX,CY); ctx.lineTo(tip.x,tip.y)
    ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke()
  }
  hand(10.17/12,CR*0.52,W*0.009,'#1a1a3e')
  hand(2/60,CR*0.70,W*0.006,'#1a1a3e')
  hand(0.5/60,CR*0.78,W*0.0035,'#e74c3c')
  ctx.beginPath(); ctx.arc(CX,CY,W*0.01,0,Math.PI*2); ctx.fillStyle='#e74c3c'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX,CY,W*0.005,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill()
}

// ── Generate 512×512 icon ──
;(function(){
  const W=512, c=createCanvas(W,W), ctx=c.getContext('2d')
  drawRingCalIcon(ctx,W)
  const out=path.join(OUT,'ringcal-icon-512.png')
  fs.writeFileSync(out, c.toBuffer('image/png'))
  console.log('✅ icon saved:', out)
})()

// ── Generate 1024×500 feature graphic ──
;(function(){
  const W=1024, H=500, c=createCanvas(W,H), ctx=c.getContext('2d')

  // Background
  const bg=ctx.createLinearGradient(0,0,W,H)
  bg.addColorStop(0,'#0d0f2a'); bg.addColorStop(0.5,'#1a2060'); bg.addColorStop(1,'#0d0f2a')
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H)

  // Draw ring (right side, partially clipped)
  ctx.save()
  ctx.beginPath(); ctx.rect(0,0,W,H); ctx.clip()

  const CX=720, CY=250
  const R_IN=64, R_OUT=220, RING_W=(R_OUT-R_IN)/4

  const glow=ctx.createRadialGradient(CX,CY,80,CX,CY,250)
  glow.addColorStop(0,'rgba(66,133,244,0.12)'); glow.addColorStop(1,'rgba(66,133,244,0)')
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY,260,0,Math.PI*2); ctx.fill()

  CATS.forEach((col,i)=>{
    const ra=R_IN+i*RING_W, rb=ra+RING_W
    const [r,g,b]=hexToRgb(col)
    ctx.beginPath(); ctx.arc(CX,CY,rb,0,Math.PI*2); ctx.arc(CX,CY,ra,0,Math.PI*2,true)
    ctx.closePath(); ctx.fillStyle=`rgba(${r},${g},${b},0.28)`; ctx.fill()
  })
  for(let m=0;m<12;m++){
    const a=-Math.PI/2+(m/12)*Math.PI*2, isMaj=m%3===0
    const p1=pxy(a,R_IN,CX,CY), p2=pxy(a,R_OUT,CX,CY)
    ctx.beginPath(); ctx.moveTo(p1.x,p1.y); ctx.lineTo(p2.x,p2.y)
    ctx.globalAlpha=isMaj?0.55:0.2; ctx.strokeStyle='#fff'; ctx.lineWidth=isMaj?2:0.8; ctx.stroke(); ctx.globalAlpha=1
  }
  CATS.forEach((col,i)=>{
    ctx.beginPath(); ctx.arc(CX,CY,R_IN+(i+1)*RING_W,0,Math.PI*2)
    ctx.strokeStyle=col+'aa'; ctx.lineWidth=1.5; ctx.stroke()
  })
  ctx.beginPath(); ctx.arc(CX,CY,R_IN,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=2.5; ctx.stroke()
  ctx.beginPath(); ctx.arc(CX,CY,R_OUT,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=3; ctx.stroke()

  const eA=-Math.PI/2, eB=eA+0.45*Math.PI*2
  ctx.save(); ctx.beginPath(); ctx.arc(CX,CY,R_OUT,eA,eB); ctx.arc(CX,CY,R_IN,eB,eA,true); ctx.closePath()
  ctx.fillStyle='rgba(66,133,244,0.18)'; ctx.fill(); ctx.restore()

  const cA=-Math.PI/2+0.45*Math.PI*2, cB=cA+0.10*Math.PI*2
  ctx.save(); ctx.beginPath(); ctx.arc(CX,CY,R_OUT,cA,cB); ctx.arc(CX,CY,R_IN,cB,cA,true); ctx.closePath()
  ctx.fillStyle='rgba(231,76,60,0.38)'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX,CY,R_OUT,cA,cB); ctx.strokeStyle='rgba(231,76,60,1)'; ctx.lineWidth=4; ctx.stroke(); ctx.restore()

  const evs=[{a1:0.12,a2:0.20,ri:3,col:'#4285f4'},{a1:0.55,a2:0.62,ri:2,col:'#8e44ad'},{a1:0.75,a2:0.80,ri:1,col:'#e74c3c'},{a1:0.90,a2:0.97,ri:3,col:'#4285f4'}]
  evs.forEach(ev=>{
    const ra=R_IN+ev.ri*RING_W+2, rb=R_IN+(ev.ri+1)*RING_W-2
    const a1=-Math.PI/2+ev.a1*Math.PI*2, a2=-Math.PI/2+ev.a2*Math.PI*2
    const [r,g,b]=hexToRgb(ev.col)
    ctx.save(); ctx.beginPath(); ctx.arc(CX,CY,rb,a1,a2); ctx.arc(CX,CY,ra,a2,a1,true); ctx.closePath()
    ctx.fillStyle=`rgba(${r},${g},${b},0.5)`; ctx.fill(); ctx.strokeStyle=ev.col; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore()
  })

  const nA=-Math.PI/2+0.55*Math.PI*2
  const nn1=pxy(nA,R_IN*0.35,CX,CY), nn2=pxy(nA,R_OUT+6,CX,CY)
  ctx.beginPath(); ctx.moveTo(nn1.x,nn1.y); ctx.lineTo(nn2.x,nn2.y)
  ctx.strokeStyle='#e74c3c'; ctx.lineWidth=3.5; ctx.lineCap='round'; ctx.stroke()
  ctx.beginPath(); ctx.arc(nn2.x,nn2.y,7,0,Math.PI*2); ctx.fillStyle='#e74c3c'; ctx.fill()

  const CR=R_IN*0.84
  const cf=ctx.createRadialGradient(CX,CY-8,4,CX,CY,CR)
  cf.addColorStop(0,'#fff'); cf.addColorStop(1,'#dde6ff')
  ctx.beginPath(); ctx.arc(CX,CY,CR,0,Math.PI*2); ctx.fillStyle=cf; ctx.fill()
  ctx.strokeStyle='rgba(60,80,160,0.25)'; ctx.lineWidth=2; ctx.stroke()
  function hand(frac,len,lw,col){
    const a=-Math.PI/2+frac*Math.PI*2, tip=pxy(a,len,CX,CY)
    ctx.beginPath(); ctx.moveTo(CX,CY); ctx.lineTo(tip.x,tip.y)
    ctx.strokeStyle=col; ctx.lineWidth=lw; ctx.lineCap='round'; ctx.stroke()
  }
  hand(10.17/12,CR*0.52,4,'#1a1a3e'); hand(2/60,CR*0.70,2.8,'#1a1a3e'); hand(0.3/60,CR*0.78,1.6,'#e74c3c')
  ctx.beginPath(); ctx.arc(CX,CY,4.5,0,Math.PI*2); ctx.fillStyle='#e74c3c'; ctx.fill()
  ctx.beginPath(); ctx.arc(CX,CY,2,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill()
  ctx.restore()

  // Left text
  ctx.font='900 72px Arial'; ctx.fillStyle='#ffffff'; ctx.textAlign='left'; ctx.fillText('Ring',64,180)
  ctx.fillStyle='#4285f4'; ctx.fillText('Cal',64+ctx.measureText('Ring').width,180)
  ctx.font='400 26px Arial'; ctx.fillStyle='rgba(200,210,255,0.85)'; ctx.fillText('יומן חכם בצורת טבעות מעגליות',64,230)

  const pills=[{icon:'🔵',text:'יומן טבעות מעגליות'},{icon:'✅',text:'מטלות ותת-מטלות'},{icon:'📅',text:'סנכרון Google'}]
  pills.forEach((pill,i)=>{
    const px=64, py=290+i*54
    ctx.fillStyle='rgba(66,133,244,0.18)'; ctx.strokeStyle='rgba(66,133,244,0.5)'; ctx.lineWidth=1.5
    ctx.beginPath(); ctx.roundRect(px,py,320,38,19); ctx.fill(); ctx.stroke()
    ctx.font='700 20px Arial'; ctx.fillStyle='#c8d8ff'; ctx.textAlign='left'
    ctx.fillText(`${pill.icon}  ${pill.text}`,px+16,py+25)
  })

  const out2=path.join(OUT,'ringcal-feature-graphic-1024x500.png')
  fs.writeFileSync(out2, c.toBuffer('image/png'))
  console.log('✅ feature graphic saved:', out2)
})()
