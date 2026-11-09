const p=[{key:"biology-microscope",subject:"biology",title:"Microscope — plant and animal cells",bench:"Biology → Microscope",blurb:"Prepare a wet mount, focus at low power, then identify the tissue.",prefix:"biology-microscope",worksheet:{aim:"To observe plant and animal cells under a compound microscope and identify the structures visible at 4×, 10× and 40×.",apparatus:"Compound microscope, glass slides, coverslips, onion peel, cheek smear, safranin, methylene blue, dropper, forceps, blotting paper.",procedure:`1. Peel a thin membrane from the concave side of an onion scale and mount it in a drop of safranin.
2. Lower the coverslip at an angle to avoid air bubbles.
3. Focus at 4× with the coarse knob, then switch to 10× and 40× and use only the fine knob.
4. Repeat with a cheek smear stained with methylene blue.
5. Record the field diameter and the structures visible at each objective.`,questions:[{question:"Why must the onion peel be thin and mounted in a liquid?",model:"A thick peel scatters light and stacks several cell layers, so no single layer is in focus. The liquid refractive index matches the cell and prevents drying; the coverslip flattens the specimen and excludes air."},{question:"Why does the field become darker at 40× even when the lamp is unchanged?",model:"The high-power objective has a smaller aperture and a much smaller field, so less light reaches the eye. A real microscopist opens the iris diaphragm or raises the lamp after switching up."},{question:"State one visible difference between the onion cell and the cheek cell.",model:"The onion cell has a rigid cell wall and a regular brick-like outline; the cheek cell has only a membrane, so its outline is irregular and it can change shape."}]}},{key:"physics-vernier-calipers",subject:"physics",title:"Vernier calipers",bench:"Physics → Instruments",blurb:"Read the main scale and vernier coincidence, then calculate the diameter.",prefix:"physics-vernier-calipers",worksheet:{aim:"To measure the diameter of the supplied specimens with vernier calipers and to determine the least count of the instrument.",apparatus:"Vernier calipers, four specimens (cylinder, sphere, block, thin rod), lens tissue.",procedure:`1. Close the jaws and check for zero error.
2. Grip each specimen without over-tightening the jaws.
3. Read the main scale before the vernier zero, then find the vernier division that coincides with a main-scale division.
4. Calculate reading = main scale + (vernier coincidence × least count).
5. Repeat each specimen at a different orientation and average the readings.`,questions:[{question:"Why is the least count of these calipers 0.01 cm?",model:"Ten vernier divisions span nine main-scale millimetres, so one vernier division is 0.9 mm. The difference between one main division and one vernier division is 0.1 mm, which is 0.01 cm."},{question:"What is zero error, and how would it affect the result?",model:"Zero error is a reading shown when the jaws are fully closed. A positive zero error makes every measured value too large; it must be subtracted. A negative error is added."},{question:"Why should the specimen be measured in more than one orientation?",model:"Real specimens are not perfect cylinders or spheres. Several orientations sample the variation and reduce the effect of one bad reading on the mean."}]}},{key:"physics-screw-gauge",subject:"physics",title:"Screw gauge",bench:"Physics → Instruments",blurb:"Use the pitch and circular-scale division to read a wire diameter.",prefix:"physics-screw-gauge",worksheet:{aim:"To measure the diameter of a thin wire with a screw gauge and to calculate its least count.",apparatus:"Screw gauge, thin wire, lens tissue, metre scale.",procedure:`1. Find the pitch by rotating the thimble one full turn and noting the sleeve advance.
2. Count the circular-scale divisions and calculate least count = pitch / divisions.
3. Close the gap and check zero error.
4. Place the wire between the studs and rotate the ratchet until it slips.
5. Read the sleeve and thimble, apply the zero correction, and repeat at three places.`,questions:[{question:"Why is the ratchet used instead of forcing the thimble?",model:"The ratchet slips at a set torque. It prevents over-tightening, which would compress a soft wire and give a reading smaller than the true diameter."},{question:"How is the least count calculated for this gauge?",model:"Least count = pitch ÷ number of circular-scale divisions. With a 0.5 mm pitch and 50 divisions it is 0.01 mm."},{question:"Why is the wire measured at three different places?",model:"The wire may not be uniform. Three readings show the spread and let the mean represent the wire better than one measurement."}]}},{key:"chemistry-titration",subject:"chemistry",title:"Acid–base titration",bench:"Chemistry → Titration",blurb:"Run the burette, watch the indicator, and calculate the concentration.",prefix:"chemistry-titration",worksheet:{aim:"To determine the concentration of an acid (or base) by titrating it against a standard solution and locating the endpoint.",apparatus:"Burette, pipette, conical flask, burette stand, funnel, phenolphthalein, standard solution, analyte, wash bottle.",procedure:`1. Rinse the burette with the titrant and fill it, removing the air gap below the tap.
2. Pipette a measured volume of analyte into a clean conical flask and add two drops of indicator.
3. Run the titrant in, swirling, until a permanent colour change lasts 30 seconds.
4. Record the initial and final burette readings and repeat for concordant values.
5. Calculate the concentration using the balanced equation and the mean titre.`,questions:[{question:"Why is the conical flask swirled during the titration?",model:"Swirling mixes the incoming titrant with the analyte so the reaction is complete and local excess does not produce a false early endpoint."},{question:"Why is the endpoint not exactly the same as the equivalence point?",model:"The endpoint is where the indicator changes colour, which may be slightly before or after the equivalence point. A well-chosen indicator and a slow final addition keep the difference small."},{question:"Why are concordant readings used rather than the first one?",model:"Concordant titres are within a small range and show the method is reproducible. Averaging them reduces random error from the first rough titration."}]}},{key:"chemistry-salt-analysis",subject:"chemistry",title:"Qualitative salt analysis",bench:"Chemistry → Salt Analysis",blurb:"Run tests on a salt, infer the cation and anion, then name it.",prefix:"chemistry-salt-analysis",worksheet:{aim:"To identify the cation and anion in a supplied salt and confirm the identity of the salt.",apparatus:"Salt samples, test tubes, test-tube holder, spirit lamp, dilute HCl, NaOH, NH4OH, barium chloride, ammonium oxalate, glass rod.",procedure:`1. Note the colour and solubility of the salt.
2. Add dilute HCl and record any gas, smell or precipitate.
3. Add NaOH and warm; test any gas with moist indicator paper.
4. Add the group reagent for the cation and record the precipitate.
5. Compare the observations with the qualitative analysis table and name the salt.`,questions:[{question:"Why is the flame test not used for every salt?",model:"Flame colour can be masked by a stronger emitter or by the container, and some cations do not give a clean colour. Wet tests are more reliable for those ions."},{question:"Why is the salt first tested with dilute HCl?",model:"Dilute acid detects carbonate, bicarbonate, sulphite and sulphide ions by the gas evolved. It also removes carbonate interference before the cation tests."},{question:"Why must the observations be recorded before the salt is named?",model:"The name is an inference, not an observation. Recording each test separately lets another student check the reasoning and catches a conclusion that does not follow."}]}},{key:"physics-lens-practical",subject:"physics",title:"Lens focal length",bench:"Physics → Optics",blurb:"Find the image, read the distances and calculate the focal length.",prefix:"physics-lens-practical",worksheet:{aim:"To find the focal length of a convex (or concave) lens by measuring object and image distances.",apparatus:"Lens, optical bench, illuminated object, screen, metre scale, lens holder.",procedure:`1. Arrange the object, lens and screen along the optical axis.
2. Adjust the screen until the image is sharp and record the object and image distances.
3. Repeat for at least four object distances.
4. Use 1/f = 1/v - 1/u, with the sign convention your syllabus uses.
5. Plot a graph and compare the mean focal length with the value from the graph.`,questions:[{question:"Why must the object, lens and screen be on one axis?",model:"If they are off axis the image forms to one side or is distorted, so the measured distances do not correspond to the lens formula and the focal length is wrong."},{question:"What does the sign of the image distance tell you?",model:"By the Cartesian convention a positive image distance means a real image on the far side of the lens; a negative distance means a virtual image on the same side as the object."},{question:"Why repeat the measurement at different object distances?",model:"A single pair can contain a large placement error. Several pairs, or a graph, expose outliers and give a focal length that is not tied to one reading."}]}}];function L(t){return p.find(a=>a.key===t)??p[0]}function N(t,a){return`${t}-${a}`.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)}function g(t,a){return t===a.key||t.startsWith(a.prefix)}function z(t){return{aim:t.worksheet.aim,apparatus:t.worksheet.apparatus,procedure:t.worksheet.procedure,observations:"",conclusion:"",answers:t.worksheet.questions.map(a=>({question:a.question,answer:""}))}}function s(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function b(t){return s(t).split(/\n+/).filter(Boolean).map(a=>`<p>${a}</p>`).join("")}function x(t){return Number.isFinite(t)?Math.abs(t)>=1e3?t.toExponential(2):t.toFixed(Math.abs(t)>=100?1:2).replace(/\.?0+$/,""):"—"}function $(t){if(t<60)return`${Math.round(t)} s`;const a=Math.round(t/60);return a<60?`${a} min`:`${Math.floor(a/60)} h ${a%60} min`}function W(t){const a=[];for(const n of t.observations)for(const h of n.values)a.some(c=>c.label===h.label)||a.push({label:h.label,unit:h.unit});if(!a.length)return"";const i=a.map(n=>`<th>${s(n.label)}${n.unit?` (${s(n.unit)})`:""}</th>`).join(""),l=t.observations.slice(-24).map((n,h)=>{const c=a.map(u=>{const f=n.values.find(y=>y.label===u.label);return`<td>${f?x(f.value):"—"}</td>`}).join("");return`<tr><td>${h+1}</td>${c}</tr>`}).join("");return`<table><thead><tr><th>No.</th>${i}</tr></thead><tbody>${l}</tbody></table>`}function k({name:t,progress:a,records:i,notebooks:l}){const n=new Set(a.filter(e=>e.status==="completed").map(e=>e.key)),h=new Set(a.map(e=>e.key)),c=p.filter(e=>n.has(e.key)||[...n].some(o=>g(o,e))),u=p.filter(e=>!c.includes(e)&&[...h].some(o=>g(o,e))),f=p.filter(e=>!c.includes(e)&&!u.includes(e)),y=i.reduce((e,o)=>e+o.observations.length,0),q=l.reduce((e,o)=>e+o.content.answers.filter(m=>m.answer.trim().length>0).length,0),j=l.reduce((e,o)=>e+o.entries.length,0),R=a.reduce((e,o)=>e+o.timeSeconds,0),S=new Date().toLocaleString(),T=p.map(e=>{const o=c.includes(e)?"Completed":u.includes(e)?"In progress":"Not attempted",r=a.filter(d=>g(d.key,e)).reduce((d,w)=>d+w.timeSeconds,0),v=i.filter(d=>g(N(d.subject,d.title),e)).reduce((d,w)=>d+w.observations.length,0);return`<tr><td>${s(e.title)}</td><td>${s(e.subject)}</td><td>${o}</td><td>${$(r)}</td><td>${v}</td></tr>`}).join(""),C=l.filter(e=>e.kind==="worksheet").map(e=>{const o=e.content.answers.map((r,v)=>`<div class="qa"><p class="q">${v+1}. ${s(r.question)}</p><p>${r.answer.trim()?s(r.answer):"<em>Not answered</em>"}</p></div>`).join(""),m=e.entries.map(r=>`<li><strong>${s(r.authorName)}</strong> · ${new Date(r.at).toLocaleString()}<br>${s(r.text)}</li>`).join("");return`<section class="sheet">
        <h2>${s(e.title)}</h2>
        <p class="meta">${s(e.subject)} · ${e.completedAt?"Completed":"In progress"} · updated ${new Date(e.completedAt??Date.now()).toLocaleDateString()}</p>
        <h3>Aim</h3>${b(e.content.aim)||"<p class='muted'>Not written</p>"}
        <h3>Apparatus</h3>${b(e.content.apparatus)||"<p class='muted'>Not written</p>"}
        <h3>Procedure</h3>${b(e.content.procedure)||"<p class='muted'>Not written</p>"}
        <h3>Observations</h3>${b(e.content.observations)||"<p class='muted'>No written observations</p>"}
        <h3>Questions</h3>${o||"<p class='muted'>No questions</p>"}
        <h3>Conclusion</h3>${b(e.content.conclusion)||"<p class='muted'>Not written</p>"}
        ${m?`<h3>Shared contributions</h3><ul>${m}</ul>`:""}
      </section>`}).join(""),A=i.map(e=>`<section class="sheet">
        <h2>${s(e.title)}</h2>
        <p class="meta">${s(e.subject)} · ${e.observations.length} readings${e.measured!==null?` · result ${x(e.measured)} ${s(e.resultUnit??"")}`:""}</p>
        ${W(e)}
        ${e.measured!==null&&e.accepted?`<p class="meta">Percentage error: ${(Math.abs((e.measured-e.accepted)/e.accepted)*100).toFixed(2)}%</p>`:""}
      </section>`).join("");return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Manthan lab progress</title>
<style>
  @page { margin: 16mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #24221e; line-height: 1.5; margin: 0; }
  header { border-bottom: 2px solid #24221e; padding-bottom: 14px; margin-bottom: 22px; }
  .kicker { font-family: system-ui, sans-serif; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; }
  h1 { font-size: 30px; margin: 6px 0 4px; }
  h2 { font-size: 19px; margin: 0 0 2px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; margin: 16px 0 3px; }
  p { margin: 4px 0; }
  .meta, .muted { color: #6a655c; font-size: 12px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
  .card { border: 1px solid #d7d2c8; padding: 10px; }
  .card b { display: block; font-size: 22px; }
  table { width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif; font-size: 11px; margin-top: 8px; }
  th, td { text-align: left; border-bottom: 1px solid #ddd8ce; padding: 5px 4px; }
  .sheet { break-inside: avoid; border-top: 1px solid #d7d2c8; padding-top: 14px; margin-top: 18px; }
  .qa { margin: 8px 0; }
  .q { font-weight: 600; }
  ul { padding-left: 16px; font-size: 12px; }
  footer { margin-top: 26px; border-top: 1px solid #d7d2c8; padding-top: 10px; font-family: system-ui, sans-serif; font-size: 10px; color: #6a655c; }
  @media print { .sheet { break-inside: avoid; } }
</style></head>
<body>
  <header>
    <p class="kicker">Manthan · STEM Lab</p>
    <h1>Lab progress report</h1>
    <p>${s(t||"Student")} · generated ${s(S)}</p>
  </header>
  <div class="summary">
    <div class="card"><span class="meta">Completed</span><b>${c.length} / ${p.length}</b></div>
    <div class="card"><span class="meta">In progress</span><b>${u.length}</b></div>
    <div class="card"><span class="meta">Time at the bench</span><b>${$(R)}</b></div>
    <div class="card"><span class="meta">Observations</span><b>${y}</b></div>
    <div class="card"><span class="meta">Answers saved</span><b>${q}</b></div>
    <div class="card"><span class="meta">Notebook entries</span><b>${j}</b></div>
    <div class="card"><span class="meta">Not attempted</span><b>${f.length}</b></div>
  </div>
  <table>
    <thead><tr><th>Experiment</th><th>Subject</th><th>Status</th><th>Time</th><th>Readings</th></tr></thead>
    <tbody>${T}</tbody>
  </table>
  ${C}
  ${A}
  <footer>Generated from saved bench readings and notebook entries. Empty fields are left empty, not filled in by the report.</footer>
</body></html>`}function M(t){const a=k(t),i=new Blob([a],{type:"text/html;charset=utf-8"}),l=URL.createObjectURL(i),n=document.createElement("a");n.href=l,n.download=`manthan-lab-progress-${new Date().toISOString().slice(0,10)}.html`,document.body.appendChild(n),n.click(),n.remove(),URL.revokeObjectURL(l)}function P(t){const a=k(t),i=window.open("","_blank","noopener,noreferrer");return i?(i.document.open(),i.document.write(a),i.document.close(),i.focus(),i.print(),!0):!1}export{p as E,P as a,z as b,M as d,L as f,g as m,N as p};
