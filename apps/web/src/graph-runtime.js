export const legacyGraphScript = String.raw`
function renderLegacyGraph(graph, options = {}) {
  if (typeof app.__kcGraphCleanup === 'function') app.__kcGraphCleanup();

  const width = 1000;
  const desktopHeight = 720;
  const inspectorNeighborLimit = 6;
  const pointers = new Map();
  let dragState = null;
  let pinchState = null;
  let layoutObserver = null;
  let canvasObserver = null;

  const state = {
    query: String(options.query || ''),
    showCardRelations: false,
    selectedKind: 'ALL',
    selectedCardId: null,
    hoveredNodeId: null,
    focusMode: false,
    filterPanelOpen: false,
    colorBy: 'category',
    layoutWidth: 1440,
    canvasCssScale: 1,
    canvasViewHeight: desktopHeight,
    viewport: { x: 0, y: 0, scale: 1 },
    filters: {
      categories: [],
      actions: [],
      tags: [],
      sourceTypes: [],
      resourceKinds: [],
      relationTypes: [],
      minimumRelevance: 1,
      semanticEnabled: false,
      semanticMode: 'top',
      semanticTopN: 6,
      semanticMaxDistance: 0.3,
      displayMode: 'dim'
    }
  };

  const palette = ['#2563eb','#7c3aed','#0891b2','#059669','#ca8a04','#ea580c','#dc2626','#db2777','#4f46e5','#475569'];
  const relevanceColors = {1:'#cbd5e1',2:'#94a3b8',3:'#38bdf8',4:'#2563eb',5:'#7c3aed'};

  function stableHash(value) {
    let hash = 2166136261;
    const textValue = String(value || '');
    for (let index = 0; index < textValue.length; index += 1) {
      hash ^= textValue.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function categoricalColor(value) { return value ? palette[stableHash(value) % palette.length] : '#64748b'; }
  function relevanceColor(value) {
    const score = Math.max(1, Math.min(5, Math.round(Number(value) || 1)));
    return relevanceColors[score];
  }
  function cardColorKey(node, mode) {
    if (node.kind !== 'card') return null;
    if (mode === 'category') return (node.categories || [])[0] || '未分類';
    if (mode === 'action') return (node.actions || [])[0] || '無 Action';
    if (mode === 'relevance') return String(Math.max(1, Math.min(5, Math.round(Number(node.relevance?.overall) || 1))));
    return null;
  }
  function cardColor(node, mode) {
    const key = cardColorKey(node, mode);
    if (!key || mode === 'none') return '#64748b';
    return mode === 'relevance' ? relevanceColor(key) : categoricalColor(key);
  }
  function colorLegend(nodes, mode) {
    if (mode === 'none') return [];
    if (mode === 'relevance') return [1,2,3,4,5].map((score) => ({key:String(score),label:'Relevance '+score,color:relevanceColor(score)}));
    const values = [...new Set(nodes.filter((node) => node.kind === 'card').map((node) => cardColorKey(node, mode)).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'zh-TW'));
    return values.map((value) => ({key:value,label:value,color:categoricalColor(value)}));
  }

  function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
  function finitePoint(node) { return Number.isFinite(Number(node?.x)) && Number.isFinite(Number(node?.y)); }
  function calculateNodeBounds(nodes) {
    const valid = (nodes || []).filter(finitePoint);
    if (!valid.length) return {minX:0,maxX:0,minY:0,maxY:0,width:0,height:0,centerX:0,centerY:0};
    const xs = valid.map((node) => Number(node.x));
    const ys = valid.map((node) => Number(node.y));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    return {minX,maxX,minY,maxY,width:maxX-minX,height:maxY-minY,centerX:(minX+maxX)/2,centerY:(minY+maxY)/2};
  }
  function fitNodesToViewport(nodes, options) {
    const viewportWidth = Number(options.width);
    const viewportHeight = Number(options.height);
    const safePadding = Math.max(0, Number(options.padding) || 0);
    const bounds = calculateNodeBounds(nodes);
    const spanX = Math.max(bounds.width, 1e-6), spanY = Math.max(bounds.height, 1e-6);
    const usableWidth = Math.max(1, viewportWidth - safePadding * 2);
    const usableHeight = Math.max(1, viewportHeight - safePadding * 2);
    const scale = Math.min(usableWidth / spanX, usableHeight / spanY);
    return (nodes || []).map((node) => !finitePoint(node) ? {...node} : ({
      ...node,
      semanticX:Number(node.x),
      semanticY:Number(node.y),
      x:viewportWidth/2+(Number(node.x)-bounds.centerX)*scale,
      y:viewportHeight/2+(Number(node.y)-bounds.centerY)*scale
    }));
  }
  function clampZoom(scale) { return clamp(Number.isFinite(Number(scale)) ? Number(scale) : .55, .55, 4); }
  function zoomAroundPoint(viewport, point, requestedScale) {
    const currentScale = clampZoom(viewport?.scale || 1);
    const nextScale = clampZoom(requestedScale);
    const x = Number(viewport?.x) || 0, y = Number(viewport?.y) || 0;
    const pointX = Number(point?.x) || 0, pointY = Number(point?.y) || 0;
    const worldX = (pointX - x) / currentScale, worldY = (pointY - y) / currentScale;
    return {scale:nextScale,x:pointX-worldX*nextScale,y:pointY-worldY*nextScale};
  }
  function fitViewportToNodes(nodes, options) {
    const valid = (nodes || []).filter(finitePoint);
    if (!valid.length) return {x:0,y:0,scale:1};
    const bounds = calculateNodeBounds(valid);
    const usableWidth = Math.max(1, Number(options.width)-options.padding*2);
    const usableHeight = Math.max(1, Number(options.height)-options.padding*2);
    const scale = clamp(Math.min(usableWidth/Math.max(bounds.width,1), usableHeight/Math.max(bounds.height,1)), options.minimumScale, options.maximumScale);
    return {scale,x:Number(options.width)/2-bounds.centerX*scale,y:Number(options.height)/2-bounds.centerY*scale};
  }
  function pointDistance(left, right) { return Math.hypot(Number(right?.x||0)-Number(left?.x||0), Number(right?.y||0)-Number(left?.y||0)); }
  function midpoint(left, right) { return {x:(Number(left?.x||0)+Number(right?.x||0))/2,y:(Number(left?.y||0)+Number(right?.y||0))/2}; }

  function normalizeList(value) { return !value ? [] : Array.isArray(value) ? value : [...value]; }
  function intersects(values, selected) {
    if (!selected?.length) return true;
    const set = new Set(values || []);
    return selected.some((item) => set.has(item));
  }
  function scalarMatches(value, selected) { return !selected?.length || selected.includes(value); }
  function relationTypesByCard() {
    const result = new Map();
    for (const edge of graph.edges || []) {
      if (edge.kind !== 'card-card') continue;
      const source = edge.source?.replace(/^card:/, ''), target = edge.target?.replace(/^card:/, '');
      if (!source || !target) continue;
      if (!result.has(source)) result.set(source, new Set());
      if (!result.has(target)) result.set(target, new Set());
      result.get(source).add(edge.type);
      result.get(target).add(edge.type);
    }
    return result;
  }
  function semanticAllowedIds() {
    if (!state.filters.semanticEnabled || !state.selectedCardId) return null;
    const allowed = new Set([state.selectedCardId]);
    const distances = graph.semantic?.distancesByCard?.[state.selectedCardId] || [];
    if (state.filters.semanticMode === 'distance') {
      for (const item of distances) if (Number(item.distance) <= Number(state.filters.semanticMaxDistance)) allowed.add(item.cardId);
    } else {
      for (const item of distances.slice(0, Math.max(1, Number(state.filters.semanticTopN)||1))) allowed.add(item.cardId);
    }
    return allowed;
  }
  function cardMatchesFilters(node) {
    if (node.kind !== 'card') return false;
    if (!intersects(node.categories || [], normalizeList(state.filters.categories))) return false;
    if (!intersects(node.actions || [], normalizeList(state.filters.actions))) return false;
    if (!intersects(node.tags || [], normalizeList(state.filters.tags))) return false;
    if (!scalarMatches(node.sourceType || null, normalizeList(state.filters.sourceTypes))) return false;
    if (!scalarMatches(node.resourceKind || null, normalizeList(state.filters.resourceKinds))) return false;
    if (Number(node.relevance?.overall || 0) < Number(state.filters.minimumRelevance || 1)) return false;
    if (state.filters.relationTypes.length) {
      const types = relationTypesByCard().get(node.entityId) || new Set();
      if (!state.filters.relationTypes.some((type) => types.has(type))) return false;
    }
    const semantic = semanticAllowedIds();
    if (semantic && !semantic.has(node.entityId)) return false;
    return true;
  }
  function nodeMatchesSearch(node) {
    const needle = String(state.query || '').trim().toLocaleLowerCase('zh-TW');
    if (!needle) return false;
    return [node.label,node.description,node.conceptType,...(node.tags||[]),...(node.categories||[]),...(node.semanticCategories||[]),...(node.actions||[]),node.sourceType,node.resourceKind]
      .filter(Boolean).join(' ').toLocaleLowerCase('zh-TW').includes(needle);
  }
  function matchingResults() {
    const filtered = new Set((graph.nodes || []).filter(cardMatchesFilters).map((node) => node.entityId));
    const needle = String(state.query || '').trim().toLocaleLowerCase('zh-TW');
    if (!needle) return {needle,cardIds:filtered,directNodeIds:new Set(),contextConceptNodeIds:connectedConcepts(filtered)};
    const directNodeIds = new Set(), searchCardIds = new Set(), directConcepts = new Set();
    for (const node of graph.nodes || []) {
      if (!nodeMatchesSearch(node)) continue;
      directNodeIds.add(node.id);
      if (node.kind === 'card') searchCardIds.add(node.entityId);
      if (node.kind === 'concept') directConcepts.add(node.id);
    }
    for (const edge of graph.edges || []) {
      if (edge.kind !== 'card-concept') continue;
      const cardId = edge.source?.startsWith('card:') ? edge.source.slice(5) : edge.target?.startsWith('card:') ? edge.target.slice(5) : null;
      const conceptId = edge.source?.startsWith('concept:') ? edge.source : edge.target?.startsWith('concept:') ? edge.target : null;
      if (cardId && conceptId && directConcepts.has(conceptId)) searchCardIds.add(cardId);
    }
    const cardIds = new Set([...filtered].filter((id) => searchCardIds.has(id)));
    const context = connectedConcepts(cardIds);
    for (const id of directConcepts) context.add(id);
    return {needle,cardIds,directNodeIds,contextConceptNodeIds:context};
  }
  function connectedConcepts(cardIds) {
    const ids = new Set();
    for (const edge of graph.edges || []) {
      if (edge.kind !== 'card-concept') continue;
      const cardId = edge.source?.startsWith('card:') ? edge.source.slice(5) : edge.target?.startsWith('card:') ? edge.target.slice(5) : null;
      const conceptId = edge.source?.startsWith('concept:') ? edge.source : edge.target?.startsWith('concept:') ? edge.target : null;
      if (cardId && conceptId && cardIds.has(cardId)) ids.add(conceptId);
    }
    return ids;
  }

  const shell = document.createElement('section');
  shell.className = 'knowledge-graph-shell page-shell';
  const hero = document.createElement('section');
  hero.className = 'graph-hero';
  const heroKicker = document.createElement('div');
  heroKicker.className = 'graph-kicker';
  heroKicker.textContent = 'SEMANTIC KNOWLEDGE MAP';
  const heroTitle = document.createElement('h1');
  heroTitle.textContent = 'Knowledge Graph';
  const heroIntro = document.createElement('p');
  heroIntro.textContent = '距離越近，主題通常越相似。可搜尋、篩選、縮放或點選知識卡探索語意鄰域；操作只改變顯示與視角，不會改動原始語意座標。';
  const stats = document.createElement('div');
  stats.className = 'graph-stats';
  for (const [value, label] of [
    [graph.stats.cards, 'Knowledge Cards'],
    [graph.stats.concepts, 'Concepts'],
    [graph.stats.cardRelations, 'Card Relations'],
    [graph.stats.cardConceptEdges, 'Card ↔ Concept']
  ]) {
    const stat = document.createElement('div');
    stat.className = 'graph-stat';
    const strong = document.createElement('strong');
    strong.textContent = String(value ?? 0);
    const span = document.createElement('span');
    span.textContent = label;
    stat.append(strong, span);
    stats.append(stat);
  }
  hero.append(heroKicker, heroTitle, heroIntro, stats);

  const controls = document.createElement('section');
  controls.className = 'graph-controls';
  const controlsHead = document.createElement('div');
  controlsHead.className = 'graph-controls__head';
  const controlsText = document.createElement('div');
  const controlsTitle = document.createElement('strong');
  controlsTitle.textContent = '探索與篩選';
  const controlsHint = document.createElement('small');
  controlsHint.textContent = '搜尋節點、調整顏色與視圖，或打開進階篩選縮小探索範圍';
  controlsText.append(controlsTitle, controlsHint);
  controlsHead.append(controlsText);

  const toolbar = document.createElement('div');
  toolbar.className = 'legacy-graph-toolbar';
  const searchWrap = document.createElement('div');
  searchWrap.className = 'graph-search';
  const searchLabel = document.createElement('span'); searchLabel.textContent = '搜尋';
  const searchInputWrap = document.createElement('div'); searchInputWrap.className = 'graph-search__input';
  const search = document.createElement('input'); search.type='search'; search.placeholder='概念、知識卡、標籤、技術關鍵字';
  const clearSearch = document.createElement('button'); clearSearch.type='button'; clearSearch.textContent='×'; clearSearch.setAttribute('aria-label','清除搜尋'); clearSearch.hidden=true;
  searchInputWrap.append(search, clearSearch); searchWrap.append(searchLabel, searchInputWrap);

  const filterControl = document.createElement('div'); filterControl.className='graph-control';
  const filterLabel = document.createElement('span'); filterLabel.textContent='篩選';
  const filterTrigger = document.createElement('button'); filterTrigger.type='button'; filterTrigger.className='graph-filter-trigger'; filterTrigger.textContent='進階篩選';
  filterControl.append(filterLabel, filterTrigger);

  const colorLabel = document.createElement('label'); colorLabel.className='graph-color-select';
  const colorText=document.createElement('span'); colorText.textContent='顏色依據';
  const colorSelect=document.createElement('select');
  [['none','無'],['category','分類'],['action','建議動作'],['relevance','關聯度']].forEach(([value,label])=>{const o=document.createElement('option');o.value=value;o.textContent=label;colorSelect.append(o);});
  colorSelect.value=state.colorBy; colorLabel.append(colorText,colorSelect);

  const viewControl=document.createElement('div'); viewControl.className='graph-control';
  const viewLabel=document.createElement('span'); viewLabel.textContent='視圖';
  const viewMode=document.createElement('div'); viewMode.className='graph-view-mode';
  const globalButton=document.createElement('button'); globalButton.type='button'; globalButton.textContent='全域地圖';
  const focusButton=document.createElement('button'); focusButton.type='button'; focusButton.textContent='聚焦模式';
  viewMode.append(globalButton,focusButton);
  viewControl.append(viewLabel,viewMode);

  const relationControl=document.createElement('div'); relationControl.className='graph-control';
  const relationControlLabel=document.createElement('span'); relationControlLabel.textContent='連線';
  const relationLabel=document.createElement('label'); relationLabel.className='graph-toggle';
  const relationToggle=document.createElement('input'); relationToggle.type='checkbox';
  const relationText=document.createElement('span'); relationText.textContent='卡片間連線';
  relationLabel.append(relationToggle,relationText);
  relationControl.append(relationControlLabel,relationLabel);

  const infoControl=document.createElement('div'); infoControl.className='graph-control';
  const infoLabel=document.createElement('span'); infoLabel.textContent='資訊';
  const details=document.createElement('details'); details.className='graph-layout-details';
  const summary=document.createElement('summary'); summary.textContent='圖譜資訊 ⓘ';
  const detailsBody=document.createElement('div');
  ['投影：'+(graph.layout?.method||'deterministic projection'),'距離：'+(graph.layout?.metric||'cosine-distance'),graph.semantic?.embeddingModel?'模型：'+graph.semantic.embeddingModel:null].filter(Boolean).forEach((value)=>{const span=document.createElement('span');span.textContent=value;detailsBody.append(span);});
  details.append(summary,detailsBody);
  infoControl.append(infoLabel,details);
  toolbar.append(searchWrap,colorLabel,filterControl,viewControl,relationControl,infoControl);

  const chips=document.createElement('div'); chips.className='graph-filter-chips';
  controls.append(controlsHead,toolbar,chips);
  const explorer=document.createElement('div'); explorer.className='graph-explorer';
  const canvasWrap=document.createElement('div'); canvasWrap.className='graph-canvas-wrap';
  const focusHint=document.createElement('div'); focusHint.className='graph-focus-hint'; focusHint.textContent='點選一張 Knowledge Card，查看它的語意鄰域'; focusHint.hidden=true;
  const zoomControls=document.createElement('div'); zoomControls.className='graph-zoom-controls';
  const zoomIn=document.createElement('button');zoomIn.type='button';zoomIn.textContent='＋';
  const zoomOut=document.createElement('button');zoomOut.type='button';zoomOut.textContent='－';
  const zoomAll=document.createElement('button');zoomAll.type='button';zoomAll.textContent='全部';
  zoomControls.append(zoomIn,zoomOut,zoomAll);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('knowledge-graph'); svg.setAttribute('viewBox','0 0 '+width+' '+desktopHeight); svg.setAttribute('role','img'); svg.setAttribute('aria-label','Knowledge semantic graph');
  const hit=document.createElementNS('http://www.w3.org/2000/svg','rect'); hit.setAttribute('class','graph-hit-area'); hit.setAttribute('x','0');hit.setAttribute('y','0');hit.setAttribute('width',String(width));hit.setAttribute('height',String(desktopHeight));
  const viewport=document.createElementNS('http://www.w3.org/2000/svg','g'); viewport.setAttribute('class','graph-viewport');
  svg.append(hit,viewport); canvasWrap.append(focusHint,zoomControls,svg); explorer.append(canvasWrap);

  const colorLegendEl=document.createElement('div'); colorLegendEl.className='graph-color-legend';
  const graphLegend=document.createElement('div'); graphLegend.className='graph-legend';
  graphLegend.innerHTML='<span><i class="legend-dot legend-dot--concept"></i>概念</span><span><i class="legend-dot legend-dot--card"></i>知識卡</span><span><i class="legend-dot legend-dot--neighbor"></i>最近語意鄰居</span>';
  shell.append(hero,controls,explorer,colorLegendEl,graphLegend);
  app.replaceChildren(shell);

  function isMobile(){return state.layoutWidth<760;}
  function canvasHeight(){return state.canvasViewHeight;}
  function positionedNodes(){return fitNodesToViewport(graph.nodes||[],{width,height:canvasHeight(),padding:(isMobile()?38:56)/Math.max(state.canvasCssScale,.25)});}
  function nodeMap(){return new Map(positionedNodes().map((node)=>[node.id,node]));}
  function selectedCardNode(){return positionedNodes().find((node)=>node.kind==='card'&&node.entityId===state.selectedCardId)||null;}
  function selectedNeighbors(){return state.selectedCardId?(graph.semantic?.neighborsByCard?.[state.selectedCardId]||[]).slice(0,inspectorNeighborLimit):[];}
  function selectedNeighborIds(){return new Set(selectedNeighbors().map((item)=>item.cardId));}
  function selectedRelatedConceptIds(){
    if(!state.selectedCardId)return new Set();
    const selected='card:'+state.selectedCardId,ids=new Set();
    for(const edge of graph.edges||[]){if(edge.kind!=='card-concept')continue;if(edge.source===selected&&edge.target.startsWith('concept:'))ids.add(edge.target);if(edge.target===selected&&edge.source.startsWith('concept:'))ids.add(edge.source);}
    return ids;
  }
  function focusNeighborIds(){return selectedNeighborIds();}
  function focusNodeIds(){
    const ids=new Set(); if(!state.selectedCardId)return ids; ids.add('card:'+state.selectedCardId);
    for(const id of focusNeighborIds())ids.add('card:'+id); for(const id of selectedRelatedConceptIds())ids.add(id); return ids;
  }
  function isSelected(node){return node.kind==='card'&&node.entityId===state.selectedCardId;}
  function isNeighbor(node){return node.kind==='card'&&focusNeighborIds().has(node.entityId);}
  function isRelatedConcept(node){return node.kind==='concept'&&selectedRelatedConceptIds().has(node.id);}
  function visibleNodes(){
    const results=matchingResults(); const selectedId=state.selectedCardId?'card:'+state.selectedCardId:null;
    return positionedNodes().filter((node)=>{
      const selected=node.id===selectedId;
      if(state.focusMode&&state.selectedCardId&&!focusNodeIds().has(node.id))return false;
      if(state.selectedKind!=='ALL'&&node.kind!==state.selectedKind&&!selected)return false;
      if(results.needle&&!((node.kind==='card'&&results.cardIds.has(node.entityId))||(node.kind==='concept'&&results.contextConceptNodeIds.has(node.id)))&&!selected)return false;
      if(activeFilterCount()&&state.filters.displayMode==='hide'&&node.kind==='card'&&!results.cardIds.has(node.entityId)&&!selected)return false;
      return true;
    });
  }
  function visibleEdges(){
    const ids=new Set(visibleNodes().map((node)=>node.id)); const selected=state.selectedCardId?'card:'+state.selectedCardId:null; const relationFilter=state.filters.relationTypes.length>0;
    return (graph.edges||[]).filter((edge)=>{
      if(!ids.has(edge.source)||!ids.has(edge.target))return false;
      if(edge.kind==='card-card'&&relationFilter&&!state.filters.relationTypes.includes(edge.type))return false;
      if(state.focusMode&&selected){if(edge.kind==='concept-concept')return false;return edge.source===selected||edge.target===selected;}
      if(selected){
        if(edge.kind==='card-concept')return edge.source===selected||edge.target===selected;
        if(edge.kind==='card-card')return state.showCardRelations||relationFilter||edge.source===selected||edge.target===selected;
        return false;
      }
      if(edge.kind==='concept-concept')return true;
      if(edge.kind==='card-card')return state.showCardRelations||relationFilter;
      return false;
    });
  }
  function activeFilterCount(){
    let count=0; ['categories','actions','tags','sourceTypes','resourceKinds','relationTypes'].forEach((key)=>{if(state.filters[key].length)count+=1;});
    if(Number(state.filters.minimumRelevance)>1)count+=1;if(state.filters.semanticEnabled)count+=1;return count;
  }
  function relationClass(type){return String(type||'unknown').replaceAll('_','-');}
  function nodeRadius(node){return node.kind==='concept'?Math.min(11,5+Number(node.degree||0)*.35):6;}
  function displayNodeRadius(node){return nodeRadius(node)/Math.max(state.viewport.scale,1);}
  function nodeHitRadius(node){const scale=Math.max(state.viewport.scale,1);return Math.max(displayNodeRadius(node)+4/scale,10/scale);}
  function shortLabel(label){const limit=isMobile()?15:20;return label.length>limit?label.slice(0,limit-1)+'…':label;}
  function nodeLabelPriority(node,results){
    if(isSelected(node))return 100;if(node.id===state.hoveredNodeId)return 95;if(results.needle&&results.directNodeIds.has(node.id))return 90;
    if(state.selectedCardId&&isNeighbor(node))return 82;if(state.selectedCardId&&isRelatedConcept(node))return 78;
    if(!state.selectedCardId&&node.kind==='concept'&&Number(node.degree||0)>=3)return 68;
    if(state.viewport.scale>=1.35&&node.kind==='concept')return 52+Math.min(Number(node.degree||0),12);
    if(state.viewport.scale>=1.9&&node.kind==='card'&&Number(node.relevance?.overall||0)>=4)return 42+Number(node.relevance?.overall||0);
    if(state.viewport.scale>=2.6&&node.kind==='card')return 28;return 0;
  }
  function labelNodeIds(nodes){
    const results=matchingResults();const candidates=nodes.map((node)=>({node,priority:nodeLabelPriority(node,results)})).filter((item)=>item.priority>0).sort((a,b)=>b.priority-a.priority||Number(b.node.degree||0)-Number(a.node.degree||0)||a.node.label.localeCompare(b.node.label,'zh-TW'));
    const occupied=[],ids=new Set(),screenScale=Math.max(state.canvasCssScale,.05);
    for(const item of candidates){const node=item.node,label=shortLabel(node.label),screenX=(state.viewport.x+node.x*state.viewport.scale)*screenScale,screenY=(state.viewport.y+node.y*state.viewport.scale)*screenScale+24,labelWidth=Math.min(230,Math.max(48,Array.from(label).length*10+12));
      const box={left:screenX-labelWidth/2-4,right:screenX+labelWidth/2+4,top:screenY-10,bottom:screenY+12};
      const overlaps=occupied.some((other)=>box.left<other.right&&box.right>other.left&&box.top<other.bottom&&box.bottom>other.top);
      if(item.priority>=78||!overlaps){ids.add(node.id);occupied.push(box);}
    }return ids;
  }

  function renderInspector(){
    explorer.querySelector('.graph-inspector')?.remove();
    document.querySelector('.graph-inspector--drawer')?.remove();
    document.querySelector('.graph-inspector-backdrop')?.remove();
    const node=selectedCardNode(); if(!node)return;
    const docked=state.layoutWidth>=(state.filterPanelOpen?1260:990);
    const inspector=document.createElement('aside'); inspector.className='graph-inspector'+(docked?'':' graph-inspector--drawer'); inspector.tabIndex=-1;
    const head=document.createElement('div');head.className='graph-inspector__header';
    const heading=document.createElement('div');const eyebrow=document.createElement('div');eyebrow.className='graph-inspector__eyebrow';eyebrow.textContent='已選取知識卡';const h2=document.createElement('h2');h2.textContent=node.label;heading.append(eyebrow,h2);
    const close=document.createElement('button');close.type='button';close.className='graph-inspector__close';close.textContent='×';close.addEventListener('click',()=>selectCard(node.entityId));head.append(heading,close);inspector.append(head);
    const description=document.createElement('p');description.className='graph-inspector__description';description.textContent=node.description||'';inspector.append(description);
    const open=document.createElement('button');open.type='button';open.className='graph-inspector__open';open.textContent='開啟知識卡 →';open.addEventListener('click',async()=>{cleanup();await renderCards();await openCard(node.entityId);});inspector.append(open);
    const taxonomy=document.createElement('div');taxonomy.className='graph-inspector__taxonomy';[...(node.categories||[]),...(node.actions||[]),node.relevance?.overall?'Relevance '+node.relevance.overall:null].filter(Boolean).forEach((value)=>{const span=document.createElement('span');span.textContent=value;taxonomy.append(span);});inspector.append(taxonomy);
    const guide=document.createElement('div');guide.className='graph-distance-guide';guide.innerHTML='<div><strong>地圖位置</strong><span>2D 語意近似位置</span></div><div><strong>下方數值</strong><span>原始餘弦距離</span></div>';inspector.append(guide);
    const title=document.createElement('div');title.className='graph-neighbors__title';title.innerHTML='<strong>最近語意鄰居</strong><span>Top '+selectedNeighbors().length+'</span>';inspector.append(title);
    const list=document.createElement('ol');list.className='graph-neighbors';
    selectedNeighbors().forEach((neighbor)=>{const li=document.createElement('li');const top=document.createElement('div');top.className='graph-neighbor__heading';const button=document.createElement('button');button.type='button';button.textContent=neighbor.label;button.addEventListener('click',()=>selectCard(neighbor.cardId));top.append(button);li.append(top);const bar=document.createElement('div');bar.className='graph-neighbor__bar';const fill=document.createElement('span');fill.style.width=Math.max(0,Math.min(100,Number(neighbor.similarity||0)*100))+'%';bar.append(fill);li.append(bar);const metrics=document.createElement('div');metrics.className='graph-neighbor__metrics';metrics.innerHTML='<span><b>相似度</b> '+Number(neighbor.similarity).toFixed(3)+'</span><span><b>距離</b> '+Number(neighbor.distance).toFixed(3)+'</span>';li.append(metrics);const relation=document.createElement('div');relation.className='graph-relation-chip'+(neighbor.relation?'':' graph-relation-chip--muted');relation.textContent=neighbor.relation?.type||'無直接關係';li.append(relation);list.append(li);});inspector.append(list);
    const note=document.createElement('p');note.className='graph-inspector__note';note.textContent='2D 圖上的距離用來建立空間直覺；需要精確比較時，以這裡的原始向量數值為準。';inspector.append(note);
    if(docked)explorer.append(inspector);else{const backdrop=document.createElement('div');backdrop.className='graph-inspector-backdrop';backdrop.addEventListener('click',()=>selectCard(node.entityId));document.body.append(backdrop);document.body.append(inspector);inspector.focus({preventScroll:true});}
  }

  function collectFacets(){
    const cards=(graph.nodes||[]).filter((node)=>node.kind==='card');
    const many=(key)=>[...new Set(cards.flatMap((node)=>node[key]||[]))].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'zh-TW'));
    const one=(key)=>[...new Set(cards.map((node)=>node[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'zh-TW'));
    const tags=new Map();cards.forEach((node)=>(node.tags||[]).forEach((tag)=>tags.set(tag,(tags.get(tag)||0)+1)));
    return {categories:many('categories'),actions:many('actions'),tags:[...tags.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-TW')),sourceTypes:one('sourceType'),resourceKinds:one('resourceKind'),relationTypes:[...new Set((graph.edges||[]).filter((edge)=>edge.kind==='card-card').map((edge)=>edge.type).filter(Boolean))].sort()};
  }

  function renderFilterPanel(){
    explorer.querySelector('.graph-filter-panel')?.remove();
    document.querySelector('.graph-filter-panel--mobile')?.remove();
    document.querySelector('.graph-filter-backdrop')?.remove();
    if(!state.filterPanelOpen)return;
    const docked=state.layoutWidth>=(state.selectedCardId?1260:940);
    const panel=document.createElement('aside');panel.className='graph-filter-panel'+(docked?'':' graph-filter-panel--mobile');panel.tabIndex=-1;
    const header=document.createElement('div');header.className='graph-filter-panel__header';const text=document.createElement('div');text.innerHTML='<strong>篩選</strong><span>'+matchingResults().cardIds.size+' / '+graph.stats.cards+' 張</span>';const close=document.createElement('button');close.type='button';close.className='graph-filter-panel__close';close.textContent='×';close.addEventListener('click',()=>{state.filterPanelOpen=false;render();});header.append(text,close);panel.append(header);
    const facets=collectFacets();
    function group(title,key,items){
      if(!items.length)return;const details=document.createElement('details');details.className='graph-filter-group';details.open=true;const summary=document.createElement('summary');summary.textContent=title;details.append(summary);const opts=document.createElement('div');opts.className='graph-filter-options';
      items.forEach((item)=>{const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=state.filters[key].includes(item);input.addEventListener('change',()=>{const list=state.filters[key],i=list.indexOf(item);if(i>=0)list.splice(i,1);else list.push(item);render();});label.append(input,document.createTextNode(item));opts.append(label);});details.append(opts);panel.append(details);
    }
    group('分類','categories',facets.categories);group('建議動作','actions',facets.actions);group('來源','sourceTypes',facets.sourceTypes);group('資源','resourceKinds',facets.resourceKinds);group('關係','relationTypes',facets.relationTypes);
    if(facets.tags.length){const details=document.createElement('details');details.className='graph-filter-group';details.open=true;const summary=document.createElement('summary');summary.textContent='標籤';details.append(summary);const tags=document.createElement('div');tags.className='graph-filter-tags';facets.tags.slice(0,50).forEach(([tag,count])=>{const button=document.createElement('button');button.type='button';button.classList.toggle('active',state.filters.tags.includes(tag));button.textContent=tag+' '+count;button.addEventListener('click',()=>{const list=state.filters.tags,i=list.indexOf(tag);if(i>=0)list.splice(i,1);else list.push(tag);render();});tags.append(button);});details.append(tags);panel.append(details);}
    const rel=document.createElement('details');rel.className='graph-filter-group';rel.open=true;const relSummary=document.createElement('summary');relSummary.textContent='最低 Relevance';const range=document.createElement('input');range.type='range';range.min='1';range.max='5';range.step='1';range.value=String(state.filters.minimumRelevance);range.addEventListener('input',()=>{state.filters.minimumRelevance=Number(range.value);render();});rel.append(relSummary,range);panel.append(rel);
    const footer=document.createElement('div');footer.className='graph-filter-panel__footer';const reset=document.createElement('button');reset.type='button';reset.className='graph-filter-reset';reset.textContent='重設';reset.addEventListener('click',()=>{Object.assign(state.filters,{categories:[],actions:[],tags:[],sourceTypes:[],resourceKinds:[],relationTypes:[],minimumRelevance:1,semanticEnabled:false,semanticMode:'top',semanticTopN:6,semanticMaxDistance:.3,displayMode:'dim'});render();});const fit=document.createElement('button');fit.type='button';fit.className='graph-filter-fit';fit.textContent='符合結果';fit.addEventListener('click',()=>fitNodesToResults());footer.append(reset,fit);panel.append(footer);
    if(docked)explorer.prepend(panel);else{const backdrop=document.createElement('div');backdrop.className='graph-filter-backdrop';backdrop.addEventListener('click',()=>{state.filterPanelOpen=false;render();});document.body.append(backdrop,panel);panel.focus({preventScroll:true});}
  }

  function renderChips(){
    chips.replaceChildren();const groups=[['categories','分類'],['actions','建議動作'],['tags','標籤'],['sourceTypes','來源'],['resourceKinds','資源'],['relationTypes','關係']];
    groups.forEach(([key,label])=>state.filters[key].forEach((value)=>{const b=document.createElement('button');b.type='button';b.textContent=label+': '+value+' ×';b.addEventListener('click',()=>{const i=state.filters[key].indexOf(value);if(i>=0)state.filters[key].splice(i,1);render();});chips.append(b);}));
    if(Number(state.filters.minimumRelevance)>1){const b=document.createElement('button');b.type='button';b.textContent='Relevance ≥ '+state.filters.minimumRelevance+' ×';b.addEventListener('click',()=>{state.filters.minimumRelevance=1;render();});chips.append(b);}
    if(activeFilterCount()||state.query){const count=document.createElement('span');count.className='graph-filter-result-count';count.textContent='符合條件 '+matchingResults().cardIds.size+' 張';chips.append(count);}
  }

  function renderLegend(){
    colorLegendEl.replaceChildren();const values=colorLegend(graph.nodes||[],state.colorBy);colorLegendEl.hidden=!values.length;if(!values.length)return;const strong=document.createElement('strong');strong.textContent='顏色：'+(state.colorBy==='category'?'Category':state.colorBy==='action'?'Action':'Relevance');const row=document.createElement('div');values.forEach((item)=>{const span=document.createElement('span');const i=document.createElement('i');i.style.background=item.color;span.append(i,document.createTextNode(item.label));row.append(span);});colorLegendEl.append(strong,row);
  }

  function renderGraphSvg(){
    const nodes=visibleNodes(),byId=new Map(nodes.map((node)=>[node.id,node])),labels=labelNodeIds(nodes);
    viewport.replaceChildren();
    const edgesGroup=document.createElementNS('http://www.w3.org/2000/svg','g');edgesGroup.setAttribute('class','graph-edges');
    visibleEdges().forEach((edge)=>{const source=byId.get(edge.source),target=byId.get(edge.target);if(!source||!target)return;const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('class','graph-edge graph-edge--'+edge.kind+(edge.kind==='card-card'?' graph-edge--relation-'+relationClass(edge.type):''));line.setAttribute('x1',source.x);line.setAttribute('y1',source.y);line.setAttribute('x2',target.x);line.setAttribute('y2',target.y);edgesGroup.append(line);});
    viewport.append(edgesGroup);
    nodes.forEach((node)=>{const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-node-id',node.id);let classes='graph-node graph-node--'+node.kind;if(isSelected(node))classes+=' graph-node--selected';if(isNeighbor(node))classes+=' graph-node--neighbor';if(isRelatedConcept(node))classes+=' graph-node--related-concept';if(state.selectedCardId&&!isSelected(node)&&!isNeighbor(node)&&!isRelatedConcept(node))classes+=' graph-node--dimmed';group.setAttribute('class',classes);group.setAttribute('transform','translate('+node.x+' '+node.y+')');if(node.kind==='card'&&state.colorBy!=='none')group.style.setProperty('--node-accent',cardColor(node,state.colorBy));
      const interactive=document.createElementNS('http://www.w3.org/2000/svg','g');interactive.setAttribute('class','graph-node-interactive');interactive.setAttribute('role','link');interactive.setAttribute('tabindex','0');interactive.setAttribute('aria-label',node.label);
      const hitCircle=document.createElementNS('http://www.w3.org/2000/svg','circle');hitCircle.setAttribute('class','graph-node-hit');hitCircle.setAttribute('r',nodeHitRadius(node));interactive.append(hitCircle);
      if(isSelected(node)){const halo=document.createElementNS('http://www.w3.org/2000/svg','circle');halo.setAttribute('class','graph-node-halo graph-node-halo--selected');halo.setAttribute('r',displayNodeRadius(node)+6/Math.max(state.viewport.scale,1));interactive.append(halo);}else if(isNeighbor(node)){const halo=document.createElementNS('http://www.w3.org/2000/svg','circle');halo.setAttribute('class','graph-node-halo graph-node-halo--neighbor');halo.setAttribute('r',displayNodeRadius(node)+4/Math.max(state.viewport.scale,1));interactive.append(halo);}
      const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');circle.setAttribute('class','graph-node-core');circle.setAttribute('r',displayNodeRadius(node));interactive.append(circle);
      if(labels.has(node.id)){const text=document.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('class','graph-node-label');text.setAttribute('y',displayNodeRadius(node)+18/state.viewport.scale);text.setAttribute('text-anchor','middle');text.style.fontSize=(12.5/Math.max(state.canvasCssScale*state.viewport.scale,.15))+'px';text.style.strokeWidth=(4/Math.max(state.canvasCssScale*state.viewport.scale,.15))+'px';text.textContent=shortLabel(node.label);interactive.append(text);}
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=node.label+' — '+(node.description||'');interactive.append(title);
      interactive.addEventListener('click',(event)=>{event.stopPropagation();activateNode(node);});
      interactive.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();activateNode(node);}});
      interactive.addEventListener('mouseenter',()=>{state.hoveredNodeId=node.id;});
      interactive.addEventListener('mouseleave',()=>{state.hoveredNodeId=null;});
      group.append(interactive);viewport.append(group);
    });
    viewport.setAttribute('transform','translate('+state.viewport.x+' '+state.viewport.y+') scale('+state.viewport.scale+')');
    svg.setAttribute('viewBox','0 0 '+width+' '+canvasHeight());
    hit.setAttribute('height',String(canvasHeight()));
  }

  function render(){
    explorer.className='graph-explorer';
    const filterDocked=state.filterPanelOpen&&state.layoutWidth>=(state.selectedCardId?1260:940);
    const inspectorDocked=Boolean(state.selectedCardId)&&state.layoutWidth>=(state.filterPanelOpen?1260:990);
    if(filterDocked)explorer.classList.add('graph-explorer--filters');
    if(inspectorDocked)explorer.classList.add('graph-explorer--inspecting');
    focusHint.hidden=!(state.focusMode&&!state.selectedCardId);
    filterTrigger.classList.toggle('active',activeFilterCount()>0);filterTrigger.replaceChildren(document.createTextNode('進階篩選'));if(activeFilterCount()){const badge=document.createElement('strong');badge.textContent=String(activeFilterCount());filterTrigger.append(badge);}
    globalButton.classList.toggle('active',!state.focusMode);focusButton.classList.toggle('active',state.focusMode);relationToggle.checked=state.showCardRelations;colorSelect.value=state.colorBy;
    clearSearch.hidden=!state.query;search.value=state.query;
    renderChips();renderFilterPanel();renderGraphSvg();renderInspector();renderLegend();
  }

  function selectCard(cardId){
    state.selectedCardId=state.selectedCardId===cardId?null:cardId;
    if(!state.selectedCardId)state.filters.semanticEnabled=false;
    if(state.focusMode&&state.selectedCardId)fitFocusedView();else if(!state.selectedCardId)state.viewport={x:0,y:0,scale:1};
    render();
  }
  function activateNode(node){
    if(node.kind==='card'){selectCard(node.entityId);return;}
    state.selectedCardId=null;state.query=node.label;search.value=node.label;render();
  }
  function fitFocusedView(){
    const nodes=visibleNodes();if(!nodes.length){state.viewport={x:0,y:0,scale:1};return;}
    state.viewport=fitViewportToNodes(nodes,{width,height:canvasHeight(),padding:isMobile()?165:140,minimumScale:1,maximumScale:isMobile()?2.35:2.8});
  }
  function fitNodesToResults(){
    const results=matchingResults();const nodes=visibleNodes().filter((node)=>node.kind==='card'?results.cardIds.has(node.entityId):results.directNodeIds.has(node.id));if(!nodes.length)return;
    state.viewport=fitViewportToNodes(nodes,{width,height:canvasHeight(),padding:isMobile()?165:140,minimumScale:1,maximumScale:isMobile()?2.7:3.2});if(isMobile())state.filterPanelOpen=false;render();
  }

  function clientToViewBox(clientX,clientY){
    const point=svg.createSVGPoint();point.x=clientX;point.y=clientY;const matrix=svg.getScreenCTM();if(!matrix)return{x:clientX,y:clientY};const transformed=point.matrixTransform(matrix.inverse());return{x:transformed.x,y:transformed.y};
  }
  function pointerPair(){return [...pointers.values()].slice(0,2);}
  function handlePointerDown(event){
    const point=clientToViewBox(event.clientX,event.clientY);
    const nodeTarget=event.target?.closest?.('.graph-node')||null;
    pointers.set(event.pointerId,point);
    if(pointers.size===1&&!nodeTarget){
      try{svg.setPointerCapture(event.pointerId);}catch{}
      dragState={pointerId:event.pointerId,lastPoint:point};
    }
    if(pointers.size>=2){
      for(const pointerId of pointers.keys()){try{svg.setPointerCapture(pointerId);}catch{}}
      const pair=pointerPair();pinchState={distance:Math.max(pointDistance(pair[0],pair[1]),1),midpoint:midpoint(pair[0],pair[1]),viewport:{...state.viewport}};dragState=null;
    }
  }
  function handlePointerMove(event){
    if(!pointers.has(event.pointerId))return;const point=clientToViewBox(event.clientX,event.clientY);pointers.set(event.pointerId,point);
    if(pointers.size>=2&&pinchState){const pair=pointerPair(),distance=Math.max(pointDistance(pair[0],pair[1]),1),mid=midpoint(pair[0],pair[1]),requested=pinchState.viewport.scale*(distance/pinchState.distance),worldX=(pinchState.midpoint.x-pinchState.viewport.x)/pinchState.viewport.scale,worldY=(pinchState.midpoint.y-pinchState.viewport.y)/pinchState.viewport.scale,zoomed=zoomAroundPoint(pinchState.viewport,pinchState.midpoint,requested);state.viewport={scale:zoomed.scale,x:mid.x-worldX*zoomed.scale,y:mid.y-worldY*zoomed.scale};renderGraphSvg();return;}
    if(dragState?.pointerId===event.pointerId){const dx=point.x-dragState.lastPoint.x,dy=point.y-dragState.lastPoint.y;state.viewport={...state.viewport,x:state.viewport.x+dx,y:state.viewport.y+dy};dragState.lastPoint=point;renderGraphSvg();}
  }
  function handlePointerEnd(event){pointers.delete(event.pointerId);try{svg.releasePointerCapture(event.pointerId);}catch{}if(pointers.size<2)pinchState=null;if(dragState?.pointerId===event.pointerId)dragState=null;}
  function handleWheel(event){event.preventDefault();const point=clientToViewBox(event.clientX,event.clientY),factor=event.deltaY<0?1.12:.89;state.viewport=zoomAroundPoint(state.viewport,point,state.viewport.scale*factor);renderGraphSvg();}
  function zoomBy(factor){state.viewport=zoomAroundPoint(state.viewport,{x:width/2,y:canvasHeight()/2},state.viewport.scale*factor);renderGraphSvg();}
  function syncCanvasScale(){const rect=svg.getBoundingClientRect();if(!rect.width||!rect.height)return;state.canvasCssScale=Math.max(.05,rect.width/width);state.canvasViewHeight=Math.max(280,Math.min(1600,width*(rect.height/rect.width)));renderGraphSvg();}
  function syncLayoutWidth(next){state.layoutWidth=Math.max(0,Number(next)||0);if(isMobile())state.focusMode=true;render();}
  function globalKeydown(event){if(event.key!=='Escape')return;if(state.filterPanelOpen&&state.layoutWidth<940){event.preventDefault();state.filterPanelOpen=false;render();return;}if(state.selectedCardId&&state.layoutWidth<(state.filterPanelOpen?1260:990)){event.preventDefault();state.selectedCardId=null;render();}}

  search.addEventListener('input',()=>{state.query=search.value;render();});
  clearSearch.addEventListener('click',()=>{state.query='';render();search.focus();});
  filterTrigger.addEventListener('click',()=>{state.filterPanelOpen=!state.filterPanelOpen;render();});
  colorSelect.addEventListener('change',()=>{state.colorBy=colorSelect.value;render();});
  globalButton.addEventListener('click',()=>{state.focusMode=false;state.viewport={x:0,y:0,scale:1};render();});
  focusButton.addEventListener('click',()=>{state.focusMode=true;if(state.selectedCardId)fitFocusedView();render();});
  relationToggle.addEventListener('change',()=>{state.showCardRelations=relationToggle.checked;render();});
  zoomIn.addEventListener('click',()=>zoomBy(1.22));zoomOut.addEventListener('click',()=>zoomBy(.82));zoomAll.addEventListener('click',()=>{state.viewport={x:0,y:0,scale:1};renderGraphSvg();});
  svg.addEventListener('pointerdown',handlePointerDown);svg.addEventListener('pointermove',handlePointerMove);svg.addEventListener('pointerup',handlePointerEnd);svg.addEventListener('pointercancel',handlePointerEnd);svg.addEventListener('wheel',handleWheel,{passive:false});svg.addEventListener('dblclick',(event)=>{if(event.target?.closest?.('.graph-node'))return;state.viewport={x:0,y:0,scale:1};renderGraphSvg();});
  window.addEventListener('keydown',globalKeydown);

  if(typeof ResizeObserver!=='undefined'){
    layoutObserver=new ResizeObserver((entries)=>{const next=entries[0]?.contentRect?.width;if(next)syncLayoutWidth(next);});layoutObserver.observe(explorer);
    canvasObserver=new ResizeObserver(()=>syncCanvasScale());canvasObserver.observe(svg);
  }
  state.layoutWidth=explorer.getBoundingClientRect().width||window.innerWidth;state.focusMode=isMobile();
  function cleanup(){layoutObserver?.disconnect();canvasObserver?.disconnect();window.removeEventListener('keydown',globalKeydown);document.querySelector('.graph-filter-backdrop')?.remove();document.querySelector('.graph-inspector-backdrop')?.remove();document.querySelector('.graph-filter-panel--mobile')?.remove();document.querySelector('.graph-inspector--drawer')?.remove();app.__kcGraphCleanup=null;}
  app.__kcGraphCleanup=cleanup;
  render();
}
`;
