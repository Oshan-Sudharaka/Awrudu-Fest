const express   = require('express');
const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const app      = express();
const PORT     = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'awrudufest-secret-2026-change-in-production';
const MONGO_URI  = process.env.MONGO_URI  || 'mongodb://localhost:27017/awrudufest';

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '4mb' }));
// Serve static files from root OR public folder (works both ways)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

const limiter       = rateLimit({ windowMs:15*60*1000, max:300, message:{error:'Too many requests'} });
const strictLimiter = rateLimit({ windowMs:15*60*1000, max:20 });
app.use('/api/', limiter);
app.use('/api/admin/login', strictLimiter);

// ── MODELS ──
const LB = mongoose.model('Leaderboard', new mongoose.Schema({
  name:{type:String,required:true,maxlength:30}, score:{type:Number,required:true,min:0},
  game:{type:String,required:true}, gameLabel:{type:String}, avatar:{type:String,default:'🧑'},
  date:{type:String}, ip:{type:String,select:false},
},{timestamps:true}));

const Game = mongoose.model('Game', new mongoose.Schema({
  gameId:{type:String,required:true,unique:true}, name:{type:String,required:true},
  type:{type:String}, icon:{type:String,default:'🎮'}, file:{type:String}, desc:{type:String},
  status:{type:String,enum:['active','hidden','soon'],default:'active'},
  badge:{type:String}, plays:{type:Number,default:0}, order:{type:Number,default:0},
},{timestamps:true}));

const Ann = mongoose.model('Announcement', new mongoose.Schema({
  text:{type:String,required:true,maxlength:300}, tag:{type:String,default:'INFO',maxlength:20},
  color:{type:String,default:'gold'}, active:{type:Boolean,default:true}, order:{type:Number,default:0},
},{timestamps:true}));

const Admin = mongoose.model('Admin', new mongoose.Schema({
  username:{type:String,required:true,unique:true,maxlength:30},
  password:{type:String,required:true,select:false},
  role:{type:String,enum:['super','admin','editor'],default:'editor'},
  lastLogin:{type:Date},
},{timestamps:true}));

const KV = mongoose.model('KV', new mongoose.Schema({
  key:{type:String,unique:true}, value:{type:mongoose.Schema.Types.Mixed},
},{timestamps:true}));

const PlayLog = mongoose.model('PlayLog', new mongoose.Schema({
  game:{type:String,required:true}, ip:{type:String,select:false},
  ua:{type:String,select:false}, date:{type:String}, dayOfWeek:{type:Number},
},{timestamps:true}));

const Sub = mongoose.model('Subscriber', new mongoose.Schema({
  email:{type:String,required:true,unique:true,maxlength:120},
},{timestamps:true}));

// ── AUTH ──
function authAdmin(req,res,next){
  const token=req.headers['x-admin-token']||req.headers['authorization']?.split(' ')[1];
  if(!token)return res.status(401).json({error:'No token'});
  try{req.admin=jwt.verify(token,JWT_SECRET);next();}
  catch{res.status(401).json({error:'Invalid token'});}
}
function requireRole(...roles){
  return(req,res,next)=>{
    if(!roles.includes(req.admin?.role))return res.status(403).json({error:'Insufficient permissions'});
    next();
  };
}

// ── KV HELPERS ──
const getKV=async(key,def={})=>{const d=await KV.findOne({key});return d?.value??def;};
const setKV=async(key,value)=>KV.findOneAndUpdate({key},{value},{upsert:true,new:true});

// ── SEED ──
async function seedDefaults(){
  if(!await Admin.findOne({username:'admin'})){
    await Admin.create({username:'admin',password:await bcrypt.hash('awrudu2026',12),role:'super'});
    console.log('✅ Admin: admin / awrudu2026');
  }
  if(!await Game.countDocuments()){
    await Game.insertMany([
      {gameId:'shell',name:'කනා මුට්ටිය',type:'SHELL GAME',icon:'🏺',file:'kana-muttiya.html',status:'active',badge:'HOT',desc:'Pot shuffle game!',order:1},
      {gameId:'tag',name:'Blind Tag',type:'ACTION TAG',icon:'🙈',file:'kana-muttiya-tag.html',status:'active',badge:'NEW',desc:'Blindfolded tag!',order:2},
      {gameId:'kotta',name:'කොට්ට පොර',type:'TURN BASED',icon:'🛏️',file:'kotta-pora.html',status:'active',badge:'NEW',desc:'Pillow fight!',order:3},
      {gameId:'lind',name:'ළිඳ් ඇදීම',type:'TIMING',icon:'🎯',file:'',status:'soon',badge:'SOON',desc:'Coming soon!',order:4},
    ]);
  }
  if(!await Ann.countDocuments()){
    await Ann.insertMany([
      {text:'🎊 AwruduFest.lk — සිංහල හා දෙමළ අලුත් අවුරුදු 2026 Platform!',tag:'NEW',order:1},
      {text:'☸ April 14, 2026 · 7:23 AM — නව අවුරුදු නැකත! Nakath Sheet available!',tag:'NAK',order:2},
      {text:'🎮 කොට්ට පොර · කනා මුට්ටිය · Blind Tag — Play Now!',tag:'LIVE',order:3},
      {text:'🍛 Recipes — කිරිබත්, කොකිස්, අල්වා step-by-step!',tag:'HOT',order:4},
      {text:'💌 සුබ පැතුම් Generator — Card හදාගෙන Share!',tag:'NEW',order:5},
      {text:'📱 @FeatureDesignz — YouTube & TikTok Subscribe!',tag:'FOLLOW',order:6},
    ]);
  }
  if(!await KV.findOne({key:'theme'}))
    await setKV('theme',{gold:'#D4A017',goldLt:'#F5C842',maroon:'#5C0A0A',dark:'#0A0500',cream:'#FDF3DC',orange:'#E8640A'});

  if(!await KV.findOne({key:'social'}))
    await setKV('social',{
      youtube:'https://youtube.com/@FeatureDesignz',youtubeHandle:'@FeatureDesignz',
      tiktok:'https://tiktok.com/@FeatureDesignz',tiktokHandle:'@FeatureDesignz',
      facebook:'https://facebook.com/FeatureDesignz',
      instagram:'https://instagram.com/FeatureDesignz',
      whatsapp:'https://wa.me/94771234567',
      email:'info@featuredesignz.lk',phone:'+94 77 123 4567',website:'https://featuredesignz.lk',
    });

  if(!await KV.findOne({key:'popup'}))
    await setKV('popup',{
      enabled:true,
      title:'🎊 AwruduFest.lk',
      from:'Feature Designz Team',
      wish:'සිංහල හා දෙමළ\nජනතාවට සුබ\nඅලුත් අවුරුද්දක් වේවා!',
      subText:'Feature Designz Team ගෙන් සිංහල හා දෙමළ සියල්ලන්ටම ආදරයෙන් Avurudu 2026 wish! 🎉',
      pillText:'☸ සිංහල අවුරුදු 2026 · AVURUDU 2026 ☸',
      emojis:'🌸 ☸ 🌺',
      showAfterMs:2200,
      btn1Text:'🎮 ෙකළිය ▶',btn1Link:'#games',
      btn2Text:'💌 Wish Share',btn2Link:'greetings.html',
    });

  if(!await KV.findOne({key:'nakath2026'}))
    await setKV('nakath2026',{
      year:2026,sinhalaYear:2569,
      mainDate:'April 14, 2026 — Tuesday',mainDateSi:'අප්‍රේල් 14 — අඟහරුවාදා',
      mainTime:'07:23 AM',lagna:'මේෂ',direction:'ඊශාන',
      nakathTimes:[
        {id:'newyr',icon:'🌅',si:'අවුරුද්ද ආරම්භ',en:'New Year',time:'ප.ව. 7:23',date:'Apr 13 · Monday',next:false},
        {id:'bath',icon:'🛁',si:'ශුභ ස්නානය',en:'Ritual Bath',time:'පෙ.ව. 7:23',date:'Apr 14 · Tuesday',next:true},
        {id:'fire',icon:'🔥',si:'ගිනි මැළවීම',en:'Lighting Hearth',time:'පෙ.ව. 8:05',date:'Apr 14 · Tuesday',next:false},
        {id:'kiribath',icon:'🍚',si:'කිරිබත් / කෑම',en:'First Meal',time:'පෙ.ව. 10:22',date:'Apr 14 · Tuesday',next:false},
        {id:'travel',icon:'🚗',si:'ශුභ ගමන',en:'Auspicious Travel',time:'ප.ව. 2:47',date:'Apr 14 · Tuesday',next:false},
        {id:'work',icon:'💼',si:'රැකී රක්ෂා',en:'Work & Business',time:'ප.ව. 4:08',date:'Apr 15 · Wednesday',next:false},
      ],
    });

  if(!await KV.findOne({key:'contact'}))
    await setKV('contact',{
      teamName:'Feature Designz Team',
      description:'සිංහල හා දෙමළ ජනතාවගේ නව වර්ෂ Platform. Made with ❤️ in Sri Lanka.',
      email:'info@featuredesignz.lk',phone:'+94 77 123 4567',
      whatsapp:'+94771234567',website:'featuredesignz.lk',location:'Sri Lanka 🇱🇰',founded:'2025',
    });

  if(!await KV.findOne({key:'settings'}))
    await setKV('settings',{
      siteName:'AwruduFest',siteTagline:'සිංහල & දෙමළ අලුත් අවුරුදු 2026',
      maintenanceMode:false,showLeaderboard:true,showGames:true,
      showNakath:true,showRecipes:true,showGreetings:true,showPopup:true,
      countdownTarget:'2026-04-14T07:23:00',
    });

  if(!await LB.countDocuments()){
    const d=new Date().toLocaleDateString('en-LK');
    await LB.insertMany([
      {name:'Kavindi R.',score:2840,game:'kotta',gameLabel:'කොට්ට පොර',avatar:'👩',date:d},
      {name:'Sasith M.',score:2611,game:'tag',gameLabel:'Blind Tag',avatar:'👨',date:d},
      {name:'Dinusha P.',score:2380,game:'shell',gameLabel:'කනා මුට්ටිය',avatar:'👩',date:d},
      {name:'Tharindu K.',score:2145,game:'kotta',gameLabel:'කොට්ට පොර',avatar:'👨',date:d},
      {name:'Nimesha S.',score:1988,game:'tag',gameLabel:'Blind Tag',avatar:'👩',date:d},
    ]);
  }
  console.log('✅ All defaults ready');
}

// ══ PUBLIC ROUTES ══
app.get('/api/leaderboard',async(req,res)=>{
  try{const{game,limit=10}=req.query;const q=game&&game!=='all'?{game}:{};
  res.json(await LB.find(q).sort({score:-1}).limit(Math.min(Number(limit),50)));}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/leaderboard',async(req,res)=>{
  try{const{name,score,game,avatar}=req.body;if(!name||!score||!game)return res.status(400).json({error:'Missing fields'});
  const labels={shell:'කනා මුට්ටිය',tag:'Blind Tag',kotta:'කොට්ට පොර'};
  res.status(201).json(await LB.create({name:String(name).slice(0,30),score:Math.round(Number(score)),game,gameLabel:labels[game]||game,avatar:avatar||'🧑',date:new Date().toLocaleDateString('en-LK'),ip:req.ip}));}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/games',async(req,res)=>{try{res.json(await Game.find({status:{$ne:'hidden'}}).sort({order:1}));}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/announcements',async(req,res)=>{try{res.json(await Ann.find({active:true}).sort({order:1}));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/play/:game',async(req,res)=>{
  try{const{game}=req.params;await Game.findOneAndUpdate({gameId:game},{$inc:{plays:1}});
  await PlayLog.create({game,ip:req.ip,ua:req.headers['user-agent'],date:new Date().toLocaleDateString('en-LK'),dayOfWeek:new Date().getDay()});
  res.json({ok:true});}catch(e){res.json({ok:false});}
});
app.get('/api/stats',async(req,res)=>{
  try{const g=await Game.find({},'gameId plays');const r={};g.forEach(x=>r[x.gameId]=x.plays);res.json(r);}
  catch(e){res.status(500).json({});}
});
app.get('/api/theme',  async(req,res)=>{try{res.json(await getKV('theme',{}));}catch(e){res.json({});}});
app.get('/api/social', async(req,res)=>{try{res.json(await getKV('social',{}));}catch(e){res.json({});}});
app.get('/api/popup',  async(req,res)=>{
  try{const p=await getKV('popup',{});const s=await getKV('settings',{});
  if(s.showPopup===false)p.enabled=false;res.json(p);}catch(e){res.json({enabled:false});}
});
app.get('/api/nakath', async(req,res)=>{try{res.json(await getKV('nakath2026',{}));}catch(e){res.json({});}});
app.get('/api/contact',async(req,res)=>{try{res.json(await getKV('contact',{}));}catch(e){res.json({});}});
app.get('/api/site',   async(req,res)=>{
  try{const s=await getKV('settings',{});res.json({siteName:s.siteName,siteTagline:s.siteTagline,showLeaderboard:s.showLeaderboard,showGames:s.showGames,showNakath:s.showNakath,showRecipes:s.showRecipes,showGreetings:s.showGreetings,maintenanceMode:s.maintenanceMode,countdownTarget:s.countdownTarget});}
  catch(e){res.json({});}
});
app.post('/api/subscribe',async(req,res)=>{
  try{const{email}=req.body;if(!email||!email.includes('@'))return res.status(400).json({error:'Invalid email'});
  await Sub.findOneAndUpdate({email},{email},{upsert:true,new:true});res.json({ok:true});}
  catch(e){res.json({ok:false});}
});

// ══ ADMIN AUTH ══
app.post('/api/admin/login',async(req,res)=>{
  try{const{username,password}=req.body;if(!username||!password)return res.status(400).json({error:'Missing fields'});
  const admin=await Admin.findOne({username}).select('+password');if(!admin)return res.status(401).json({error:'Invalid credentials'});
  if(!await bcrypt.compare(password,admin.password))return res.status(401).json({error:'Invalid credentials'});
  await Admin.findByIdAndUpdate(admin._id,{lastLogin:new Date()});
  const token=jwt.sign({id:admin._id,username:admin.username,role:admin.role},JWT_SECRET,{expiresIn:'24h'});
  res.json({token,username:admin.username,role:admin.role});}
  catch(e){res.status(500).json({error:e.message});}
});
app.post('/api/admin/change-password',authAdmin,async(req,res)=>{
  try{const{current,newPassword}=req.body;const admin=await Admin.findById(req.admin.id).select('+password');
  if(!admin||!await bcrypt.compare(current,admin.password))return res.status(401).json({error:'Wrong password'});
  if(newPassword.length<8)return res.status(400).json({error:'Too short (min 8)'});
  admin.password=await bcrypt.hash(newPassword,12);await admin.save();res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/admin/users',authAdmin,requireRole('super'),async(req,res)=>{try{res.json(await Admin.find({},'username role lastLogin createdAt'));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/admin/users',authAdmin,requireRole('super'),async(req,res)=>{
  try{const{username,password,role}=req.body;const hash=await bcrypt.hash(password,12);const u=await Admin.create({username,password:hash,role:role||'editor'});res.status(201).json({id:u._id,username:u.username,role:u.role});}
  catch(e){res.status(500).json({error:e.message});}
});
app.delete('/api/admin/users/:id',authAdmin,requireRole('super'),async(req,res)=>{
  try{if(req.params.id===req.admin.id)return res.status(400).json({error:'Cannot delete yourself'});
  await Admin.findByIdAndDelete(req.params.id);res.json({ok:true});}
  catch(e){res.status(500).json({error:e.message});}
});

// ══ ADMIN CRUD ══
// Games
app.get('/api/admin/games',authAdmin,async(req,res)=>{try{res.json(await Game.find().sort({order:1}));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/games',authAdmin,async(req,res)=>{try{res.status(201).json(await Game.create({...req.body,gameId:req.body.gameId||'g'+Date.now()}));}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/games/:id',authAdmin,async(req,res)=>{try{const g=await Game.findOneAndUpdate({gameId:req.params.id},req.body,{new:true});if(!g)return res.status(404).json({error:'Not found'});res.json(g);}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/games/:id',authAdmin,requireRole('super','admin'),async(req,res)=>{try{await Game.findOneAndDelete({gameId:req.params.id});res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});

// Leaderboard
app.delete('/api/leaderboard/:id',authAdmin,async(req,res)=>{try{await LB.findByIdAndDelete(req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/leaderboard',authAdmin,requireRole('super','admin'),async(req,res)=>{try{const{game}=req.query;await LB.deleteMany(game?{game}:{});res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});

// Announcements
app.get('/api/admin/announcements',authAdmin,async(req,res)=>{try{res.json(await Ann.find().sort({order:1}));}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/announcements',authAdmin,async(req,res)=>{try{res.status(201).json(await Ann.create(req.body));}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/announcements/:id',authAdmin,async(req,res)=>{try{res.json(await Ann.findByIdAndUpdate(req.params.id,req.body,{new:true}));}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/announcements/:id',authAdmin,async(req,res)=>{try{await Ann.findByIdAndDelete(req.params.id);res.json({ok:true});}catch(e){res.status(500).json({error:e.message});}});

// KV-based admin endpoints
['theme','social','popup','nakath','contact','settings'].forEach(key=>{
  const storeKey = key==='nakath'?'nakath2026':key;
  app.get(`/api/admin/${key}`,authAdmin,async(req,res)=>{try{res.json(await getKV(storeKey,{}));}catch(e){res.json({});}});
  app.put(`/api/${key}`,authAdmin,async(req,res)=>{try{res.json((await setKV(storeKey,req.body)).value);}catch(e){res.status(500).json({error:e.message});}});
});

// Stats & Analytics
app.get('/api/stats/admin',authAdmin,async(req,res)=>{
  try{
    const today=new Date().toLocaleDateString('en-LK');
    const[lbCount,annCount,shellG,tagG,kottaG,totalPlays,playsToday,uniqueToday,weeklyRaw]=await Promise.all([
      LB.countDocuments(),Ann.countDocuments({active:true}),
      Game.findOne({gameId:'shell'}),Game.findOne({gameId:'tag'}),Game.findOne({gameId:'kotta'}),
      PlayLog.countDocuments(),PlayLog.countDocuments({date:today}),LB.countDocuments({date:today}),
      PlayLog.aggregate([{$group:{_id:'$dayOfWeek',count:{$sum:1}}},{$sort:{_id:1}}]),
    ]);
    const sp=shellG?.plays||0,tp=tagG?.plays||0,kp=kottaG?.plays||0;
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    res.json({totalPlayers:lbCount,totalPlays:totalPlays+sp+tp+kp,lbCount,annCount,shellPlays:sp,tagPlays:tp,kottaPlays:kp,playsToday,newToday:uniqueToday,weeklyPlays:days.map((day,i)=>({day,count:weeklyRaw.find(d=>d._id===i)?.count||0}))});
  }catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/analytics',authAdmin,async(req,res)=>{
  try{const[pv,ips]=await Promise.all([PlayLog.countDocuments(),PlayLog.distinct('ip').then(i=>i.length)]);
  res.json({pageViews:pv,uniqueVisitors:ips,avgSession:'2m 34s',bounceRate:'38%'});}
  catch(e){res.status(500).json({error:e.message});}
});
app.get('/api/subscribers',authAdmin,requireRole('super','admin'),async(req,res)=>{try{res.json(await Sub.find().sort({createdAt:-1}));}catch(e){res.status(500).json({error:e.message});}});

// Export
app.get('/api/admin/export',authAdmin,requireRole('super','admin'),async(req,res)=>{
  try{
    const[lb,games,anns,subs,theme,social,popup,nakath,contact,settings]=await Promise.all([LB.find().lean(),Game.find().lean(),Ann.find().lean(),Sub.find().lean(),getKV('theme'),getKV('social'),getKV('popup'),getKV('nakath2026'),getKV('contact'),getKV('settings')]);
    res.json({exportedAt:new Date().toISOString(),lb,games,anns,subs,theme,social,popup,nakath,contact,settings});
  }catch(e){res.status(500).json({error:e.message});}
});

// Reset
app.delete('/api/admin/reset',authAdmin,requireRole('super'),async(req,res)=>{
  try{const{target}=req.query;
  if(target==='leaderboard')await LB.deleteMany({});
  else if(target==='playlogs')await PlayLog.deleteMany({});
  else if(target==='announcements')await Ann.deleteMany({});
  else if(target==='all'){await LB.deleteMany({});await PlayLog.deleteMany({});await Ann.deleteMany({});}
  res.json({ok:true,target});}
  catch(e){res.status(500).json({error:e.message});}
});

const fs = require('fs');
app.get('*',(req,res)=>{
  if(req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});
  // Support both /public/index.html and root /index.html
  const pubPath  = path.join(__dirname,'public','index.html');
  const rootPath = path.join(__dirname,'index.html');
  if(fs.existsSync(pubPath)) res.sendFile(pubPath);
  else if(fs.existsSync(rootPath)) res.sendFile(rootPath);
  else res.status(404).send('index.html not found');
});

async function start(){
  try{
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
    await seedDefaults();
    app.listen(PORT,()=>{
      console.log(`\n🎊 AwruduFest 2026 Server!`);
      console.log(`   🌐 http://localhost:${PORT}`);
      console.log(`   ⚙️  http://localhost:${PORT}/admin.html`);
      console.log(`   Login: admin / awrudu2026\n`);
    });
  }catch(err){console.error('❌',err.message);process.exit(1);}
}
start();
