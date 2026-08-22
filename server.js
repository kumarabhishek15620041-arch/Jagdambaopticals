require("dotenv").config();
const express=require("express");
const cors=require("cors");
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");

const app=express();
app.use(cors({origin:true,credentials:true}));
app.use(express.json({limit:"2mb"}));

const productSchema=new mongoose.Schema({
  name:{type:String,required:true,trim:true}, type:{type:String,required:true},
  cat:{type:String,required:true}, price:{type:Number,required:true,min:0},
  icon:{type:String,default:"👓"}, image:{type:String,default:""}, size:{type:String,default:"52-18-140"},
  description:{type:String,default:""}, active:{type:Boolean,default:true}
},{timestamps:true});
const enquirySchema=new mongoose.Schema({
  name:{type:String,required:true}, phone:{type:String,required:true},
  message:{type:String,default:""}, product:{type:String,default:""},
  status:{type:String,enum:["new","contacted","closed"],default:"new"}
},{timestamps:true});
const settingsSchema=new mongoose.Schema({
  storeName:{type:String,default:"Jagdamba Optical"}, phone:{type:String,default:""},
  whatsapp:{type:String,default:""}, address:{type:String,default:""},
  state:{type:String,default:"Delhi"}, country:{type:String,default:"India"},
  hours:{type:String,default:""}, email:{type:String,default:""},
  heroTitle:{type:String,default:"See the World More Clearly."}
},{timestamps:true});
const adminSchema=new mongoose.Schema({email:{type:String,unique:true},passwordHash:String});

const Product=mongoose.model("Product",productSchema);
const Enquiry=mongoose.model("Enquiry",enquirySchema);
const Settings=mongoose.model("Settings",settingsSchema);
const Admin=mongoose.model("Admin",adminSchema);

function auth(req,res,next){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required"});
  try{req.admin=jwt.verify(h.slice(7),process.env.JWT_SECRET);next();}
  catch(e){res.status(401).json({message:"Invalid or expired token"});}
}

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Jagdamba Optical API"}));

app.post("/api/auth/login",async(req,res)=>{
  const {email,password}=req.body;
  const admin=await Admin.findOne({email});
  if(!admin || !(await bcrypt.compare(password,admin.passwordHash))) return res.status(401).json({message:"Invalid email or password"});
  const token=jwt.sign({id:admin._id,email:admin.email},process.env.JWT_SECRET,{expiresIn:"7d"});
  res.json({token,admin:{email:admin.email}});
});

app.get("/api/products",async(req,res)=>{
  const q={active:true};
  if(req.query.category && req.query.category!=="all") q.cat=req.query.category;
  if(req.query.type && req.query.type!=="all") q.type=req.query.type;
  const products=await Product.find(q).sort({createdAt:-1});
  res.json(products);
});
app.get("/api/products/:id",async(req,res)=>{
  const p=await Product.findById(req.params.id); if(!p) return res.status(404).json({message:"Not found"}); res.json(p);
});
app.post("/api/products",auth,async(req,res)=>{res.status(201).json(await Product.create(req.body));});
app.put("/api/products/:id",auth,async(req,res)=>{
  const p=await Product.findByIdAndUpdate(req.params.id,req.body,{new:true,runValidators:true});
  if(!p) return res.status(404).json({message:"Not found"}); res.json(p);
});
app.delete("/api/products/:id",auth,async(req,res)=>{
  const p=await Product.findByIdAndUpdate(req.params.id,{active:false},{new:true});
  if(!p) return res.status(404).json({message:"Not found"}); res.json({message:"Product removed"});
});

app.post("/api/enquiries",async(req,res)=>{
  const {name,phone,message,product}=req.body;
  if(!name||!phone) return res.status(400).json({message:"Name and phone are required"});
  const e=await Enquiry.create({name,phone,message,product});
  res.status(201).json({message:"Enquiry received",enquiryId:e._id});
});
app.get("/api/enquiries",auth,async(req,res)=>res.json(await Enquiry.find().sort({createdAt:-1})));
app.patch("/api/enquiries/:id",auth,async(req,res)=>{
  const e=await Enquiry.findByIdAndUpdate(req.params.id,{status:req.body.status},{new:true});
  if(!e) return res.status(404).json({message:"Not found"}); res.json(e);
});
app.delete("/api/enquiries/:id",auth,async(req,res)=>{
  await Enquiry.findByIdAndDelete(req.params.id); res.json({message:"Deleted"});
});

app.get("/api/settings",async(req,res)=>{
  let s=await Settings.findOne(); if(!s) s=await Settings.create({});
  res.json(s);
});
app.put("/api/settings",auth,async(req,res)=>{
  let s=await Settings.findOne();
  if(!s) s=await Settings.create(req.body); else {Object.assign(s,req.body);await s.save();}
  res.json(s);
});

app.get("/api/dashboard",auth,async(req,res)=>{
  const [products,enquiries,newEnquiries]=await Promise.all([
    Product.countDocuments({active:true}),Enquiry.countDocuments(),Enquiry.countDocuments({status:"new"})
  ]);
  res.json({products,enquiries,newEnquiries});
});

async function seed(){
  await mongoose.connect(process.env.MONGODB_URI);
  let admin=await Admin.findOne({email:process.env.ADMIN_EMAIL});
  if(!admin){
    admin=await Admin.create({email:process.env.ADMIN_EMAIL,passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12)});
    console.log("Admin created:",admin.email);
  }
  if(await Product.countDocuments()===0){
    await Product.insertMany([
      {name:"Classic Black",type:"Full Rim",cat:"Men",price:699,icon:"👓"},
      {name:"Metal Aviator",type:"Round",cat:"Unisex",price:899,icon:"👓"},
      {name:"Blue Square",type:"Rectangle",cat:"Men",price:799,icon:"👓"},
      {name:"Elegant Cat Eye",type:"Cat Eye",cat:"Women",price:899,icon:"👓"},
      {name:"Smart Half Rim",type:"Half Rim",cat:"Men",price:699,icon:"👓"},
      {name:"Crystal Rimless",type:"Rimless",cat:"Unisex",price:999,icon:"👓"},
      {name:"Kids Comfort",type:"Full Rim",cat:"Kids",price:599,icon:"👓"},
      {name:"Premium Brown",type:"Full Rim",cat:"Women",price:1099,icon:"👓"}
    ]);
  }
  if(!(await Settings.findOne())) await Settings.create({});
}
const port=process.env.PORT||5000;
seed().then(()=>app.listen(port,()=>console.log(`API running on http://localhost:${port}`)))
.catch(err=>{console.error(err);process.exit(1)});
