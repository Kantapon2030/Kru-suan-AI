import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chatCompletion } from './ai/typhoon.client.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cropsDataPath = path.join(__dirname, '../data/crops.json');
const customCropsDataPath = path.join(__dirname, '../data/custom-crops.json');

let cropsData = [];
try {
  cropsData = JSON.parse(fs.readFileSync(cropsDataPath, 'utf-8'));
} catch (e) {
  cropsData = [];
}

let customCropsData = {};
try {
  if (fs.existsSync(customCropsDataPath)) {
    customCropsData = JSON.parse(fs.readFileSync(customCropsDataPath, 'utf-8'));
  }
} catch (e) {
  customCropsData = {};
}

// 📦 Accurate Thai Crop Produce & Unit Mapping
export const CROP_PRODUCE_MAP = {
  'ทุเรียน': { emoji: '🥭', produce: 'ผลทุเรียนแก่จัด', unit: 'กก.', priceRange: '130 - 180 บาท/กก.' },
  'ยางพารา': { emoji: '🌿', produce: 'น้ำยางสด (DRC 100%)', unit: 'กก.', priceRange: '65 - 85 บาท/กก.' },
  'ปาล์มน้ำมัน': { emoji: '🌴', produce: 'ผลปาล์มน้ำมันทะลายสด', unit: 'กก.', priceRange: '5.50 - 7.20 บาท/กก.' },
  'มังคุด': { emoji: '🟣', produce: 'ผลมังคุดคัดเกรด', unit: 'กก.', priceRange: '45 - 90 บาท/กก.' },
  'ลองกอง': { emoji: '🍇', produce: 'ลองกองช่อสวย', unit: 'กก.', priceRange: '35 - 60 บาท/กก.' },
  'เงาะ': { emoji: '🔴', produce: 'เงาะโรงเรียน', unit: 'กก.', priceRange: '25 - 45 บาท/กก.' },
  'สะตอ': { emoji: '🫘', produce: 'สะตอข้าวฝักใหญ่', unit: 'ร้อยฝัก', priceRange: '250 - 450 บาท/ร้อยฝัก' },
  'ขมิ้น': { emoji: '🟡', produce: 'แง่งขมิ้นชันสด', unit: 'กก.', priceRange: '30 - 55 บาท/กก.' },
  'กาแฟ (โรบัสต้า)': { emoji: '☕', produce: 'เมล็ดกาแฟโรบัสต้าเชอร์รี่', unit: 'กก.', priceRange: '85 - 120 บาท/กก.' },
  'กาแฟ': { emoji: '☕', produce: 'เมล็ดกาแฟเชอร์รี่', unit: 'กก.', priceRange: '85 - 120 บาท/กก.' },
  'มะพร้าว': { emoji: '🥥', produce: 'มะพร้าวน้ำหอม/กะทิ', unit: 'ลูก', priceRange: '15 - 28 บาท/ลูก' },
  'มะเขือเทศ': { emoji: '🍅', produce: 'มะเขือเทศสดคัดเกรด', unit: 'กก.', priceRange: '20 - 40 บาท/กก.' },
  'พริก': { emoji: '🌶️', produce: 'พริกขี้หนูสด', unit: 'กก.', priceRange: '50 - 90 บาท/กก.' },
  'ผักบุ้ง': { emoji: '🥬', produce: 'ผักบุ้งจีนสด', unit: 'กก.', priceRange: '15 - 30 บาท/กก.' },
  'กะเพรา': { emoji: '🌿', produce: 'ใบกะเพราเขียวหอม', unit: 'กก.', priceRange: '25 - 50 บาท/กก.' },
  'ข้าว': { emoji: '🌾', produce: 'ข้าวเปลือกคุณภาพ', unit: 'ตัน', priceRange: '11,000 - 14,500 บาท/ตัน' },
  'ข้าวโพด': { emoji: '🌽', produce: 'ข้าวโพดหวานสด', unit: 'กก.', priceRange: '12 - 25 บาท/กก.' },
  'กล้วย': { emoji: '🍌', produce: 'กล้วยหอมทอง/น้ำว้า', unit: 'หวี', priceRange: '30 - 55 บาท/หวี' },
  'ส้มโอ': { emoji: '🍈', produce: 'ส้มโอทับทิมสยาม/ขาวแตงกวา', unit: 'ผล', priceRange: '80 - 180 บาท/ผล' },
  'ฝรั่ง': { emoji: '🍏', produce: 'ฝรั่งกิมจูสด', unit: 'กก.', priceRange: '25 - 45 บาท/กก.' },
  'มะม่วง': { emoji: '🥭', produce: 'มะม่วงน้ำดอกไม้', unit: 'กก.', priceRange: '40 - 70 บาท/กก.' },
  'แตงกวา': { emoji: '🥒', produce: 'แตงกวาสด', unit: 'กก.', priceRange: '15 - 28 บาท/กก.' },
  'สับปะรด': { emoji: '🍍', produce: 'สับปะรดภูเก็ต/ปัตตาเวีย', unit: 'ผล', priceRange: '20 - 35 บาท/ผล' },
};

export function getCropProduceInfo(cropName) {
  const match = Object.keys(CROP_PRODUCE_MAP).find(
    (k) => cropName && (cropName.includes(k) || k.includes(cropName))
  );
  if (match) return CROP_PRODUCE_MAP[match];

  return {
    emoji: '🌱',
    produce: `ผลผลิต ${cropName}`,
    unit: 'กก.',
    priceRange: 'ตามราคากลางตลาด',
  };
}

// 📐 Thai Land Area Unit Calculations (ไร่ / งาน / ตารางวา)
export function parseThaiArea(rai = 0, ngan = 0, sqWa = 0) {
  const r = parseFloat(rai) || 0;
  const n = parseFloat(ngan) || 0;
  const w = parseFloat(sqWa) || 0;
  return (r * 1600) + (n * 400) + (w * 4);
}

export function formatThaiArea(sqMeters) {
  if (!sqMeters || sqMeters <= 0) return 'ไม่ระบุขนาด';
  const sqM = parseFloat(sqMeters);
  const rai = Math.floor(sqM / 1600);
  const remainingAfterRai = sqM % 1600;
  const ngan = Math.floor(remainingAfterRai / 400);
  const sqWa = Math.round((remainingAfterRai % 400) / 4);

  const parts = [];
  if (rai > 0) parts.push(`${rai} ไร่`);
  if (ngan > 0) parts.push(`${ngan} งาน`);
  if (sqWa > 0) parts.push(`${sqWa} ตร.วา`);

  if (parts.length === 0) return `${sqM.toLocaleString()} ตร.ม.`;
  return parts.join(' ');
}

export const PERENNIAL_CROPS = [
  'ทุเรียน', 'ยางพารา', 'ปาล์มน้ำมัน', 'มังคุด', 'ลองกอง', 'เงาะ', 'สะตอ', 'ขมิ้น',
  'กาแฟ', 'กาแฟ (โรบัสต้า)', 'มะพร้าว', 'ส้มโอ', 'มะม่วง', 'ฝรั่ง', 'กล้วย', 'สละ',
  'โกโก้', 'ลำไย', 'ขนุน', 'ลิ้นจี่', 'กระท้อน', 'ส้ม'
];

export function isPerennialCrop(cropName) {
  if (!cropName) return false;
  return PERENNIAL_CROPS.some((c) => cropName.includes(c) || c.includes(cropName));
}

// 🥭 Mature Seasonal Cycle for Established Perennial Trees (ต้นโตเต็มวัย/ให้ผลผลิตแล้ว)
export function getMatureTreeCropDefinition(cropName, produceInfo) {
  const emoji = produceInfo?.emoji || '🥭';
  return {
    name: cropName,
    emoji: emoji,
    isMatureTree: true,
    totalDays: 365,
    stages: [
      {
        name: 'RECOVERY',
        label: 'ฟื้นฟูต้น ตัดแต่งกิ่ง และแตกใบอ่อนชุดใหม่',
        emoji: '🌿',
        days: 60,
        progress: 20,
        description: 'บำรุงฟื้นฟูสภาพต้นหลังการเก็บเกี่ยว กระตุ้นรากใหม่และใบชุดแรก',
      },
      {
        name: 'INDUCTION',
        label: 'กักน้ำและสะสมอาหารเตรียมเปิดตาดอก',
        emoji: '🌾',
        days: 45,
        progress: 45,
        description: 'งดให้น้ำชั่วคราว ปรับสัดส่วนปุ๋ยตัวท้ายเพื่อเหนี่ยวนำตาดอกให้สม่ำเสมอ',
      },
      {
        name: 'FLOWERING',
        label: 'แทงช่อดอก ผสมเกสร และติดผลอ่อน (ระยะหางแย้/เหรียญบาท)',
        emoji: '🌼',
        days: 45,
        progress: 70,
        description: 'ดูแลการบานของดอก ช่วยผสมเกสร คัดผลส่วนเกิน และให้น้ำอย่างสม่ำเสมอ',
      },
      {
        name: 'FRUIT_GROWTH',
        label: 'พัฒนาผล ขยายพู แต่งทรงผล และสะสมแป้ง/น้ำตาล',
        emoji: emoji,
        days: 60,
        progress: 88,
        description: 'บำรุงผลขยายขนาด ป้องกันหนอนเจาะผล/เพลี้ยแป้ง และควบคุมปริมาณน้ำ',
      },
      {
        name: 'HARVEST',
        label: 'เก็บเกี่ยวผลผลิตแก่จัดและตัดส่งจำหน่าย',
        emoji: '🧺',
        days: 30,
        progress: 100,
        description: 'ตรวจเช็คเปอร์เซ็นต์แป้งและความแก่จัดของผลผลิต ตัดเก็บเกี่ยวอย่างพิถีพิถัน',
      },
    ],
  };
}

export function getCropDefinition(cropName, context = {}) {
  if (!cropName) return getDefaultCropDefinition('พืชทั่วไป');

  const produceInfo = getCropProduceInfo(cropName);
  const isTree = isPerennialCrop(cropName);
  const isMature = context.isMature || context.treeStatus === 'MATURE' || (context.dayCount && context.dayCount >= 365);

  // If established perennial orchard (e.g. 6-year durian), return mature annual cycle
  if (isTree && isMature) {
    return getMatureTreeCropDefinition(cropName, produceInfo);
  }

  // 1. Check built-in list
  const crop = cropsData.find(
    (c) => c.name.toLowerCase() === cropName.toLowerCase() || cropName.toLowerCase().includes(c.name.toLowerCase())
  );
  if (crop) return crop;

  // 2. Check custom crops cache
  if (customCropsData[cropName]) {
    return customCropsData[cropName];
  }

  // 3. Heuristic / Default fallback
  return getDefaultCropDefinition(cropName);
}

export async function getOrGenerateCropDefinition(cropName, context = {}) {
  if (!cropName) return getDefaultCropDefinition('พืชทั่วไป');

  const produceInfo = getCropProduceInfo(cropName);
  const isTree = isPerennialCrop(cropName);
  const isMature = context.isMature || context.treeStatus === 'MATURE' || (context.dayCount && context.dayCount >= 365);

  if (isTree && isMature) {
    return getMatureTreeCropDefinition(cropName, produceInfo);
  }

  // Check existing
  const existing = cropsData.find(
    (c) => c.name.toLowerCase() === cropName.toLowerCase() || cropName.toLowerCase().includes(c.name.toLowerCase())
  );
  if (existing) return existing;

  if (customCropsData[cropName]) {
    return customCropsData[cropName];
  }

  // Generate with Typhoon AI
  try {
    logger.info(`Generating dynamic crop definition for: "${cropName}" using Typhoon AI...`);
    const prompt = `คุณคือผู้เชี่ยวชาญด้านพืชไร่และพืชสวนเขตร้อนในประเทศไทย
จงสร้างข้อมูลระยะการเติบโตและวงจรชีวิตที่ถูกต้องตามหลักวิชาการเกษตรไทย สำหรับพืช: "${cropName}"

ตอบกลับเป็น JSON Object ตามโครงสร้างนี้เท่านั้น (ห้ามมีข้อความอื่นนอก JSON):
{
  "name": "${cropName}",
  "emoji": "อีโมจิที่ตรงที่สุด เช่น 🥭 หรือ 🌿 หรือ 🥥",
  "totalDays": จำนวนวันรวมตั้งแต่ปลูกจนเก็บเกี่ยวรอบแรก (เป็นตัวเลขจำนวนเต็ม),
  "stages": [
    { "name": "SEED", "label": "เตรียมดินและเมล็ด/ต้นพันธุ์", "emoji": "🌰", "days": 7, "progress": 10 },
    { "name": "SEEDLING", "label": "เพาะกล้า/พักฟื้นต้นพันธุ์", "emoji": "🌱", "days": 15, "progress": 25 },
    { "name": "PLANTING", "label": "ลงแปลงปลูก", "emoji": "🌿", "days": 10, "progress": 35 },
    { "name": "VEGETATIVE", "label": "เจริญเติบโตทางลำต้นและกิ่งใบ", "emoji": "🌳", "days": 30, "progress": 60 },
    { "name": "FLOWERING", "label": "ออกดอก/แทงช่อ", "emoji": "🌼", "days": 15, "progress": 75 },
    { "name": "FRUIT", "label": "ติดผลและพัฒนาผลผลิต", "emoji": "🍈", "days": 25, "progress": 90 },
    { "name": "HARVEST", "label": "เก็บเกี่ยวผลผลิต", "emoji": "🧺", "days": 10, "progress": 100 }
  ]
}`;

    const response = await chatCompletion([
      { role: 'system', content: 'You are an agricultural expert system. Output valid JSON only.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2, maxTokens: 800 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.name && Array.isArray(parsed.stages) && parsed.stages.length >= 3) {
        customCropsData[cropName] = parsed;
        try {
          fs.writeFileSync(customCropsDataPath, JSON.stringify(customCropsData, null, 2), 'utf-8');
        } catch (saveErr) {
          logger.warn('Could not save custom crop to disk:', saveErr.message);
        }
        logger.info(`Successfully generated and cached crop definition for ${cropName}`);
        return parsed;
      }
    }
  } catch (err) {
    logger.warn(`Typhoon AI custom crop generation failed for ${cropName}:`, err.message);
  }

  const def = getDefaultCropDefinition(cropName);
  customCropsData[cropName] = def;
  return def;
}

function getDefaultCropDefinition(cropName) {
  const produceInfo = getCropProduceInfo(cropName);
  return {
    name: cropName,
    emoji: produceInfo.emoji || '🌱',
    totalDays: 90,
    stages: [
      { name: 'SEED', label: 'เตรียมดินและเมล็ด/ต้นพันธุ์', emoji: '🌰', days: 7, progress: 10 },
      { name: 'SEEDLING', label: 'เพาะกล้า', emoji: '🌱', days: 14, progress: 25 },
      { name: 'PLANTING', label: 'ลงแปลงปลูก', emoji: '🌿', days: 7, progress: 35 },
      { name: 'VEGETATIVE', label: 'เจริญเติบโต', emoji: '🌳', days: 30, progress: 65 },
      { name: 'FLOWERING', label: 'ออกดอก/ติดดอก', emoji: '🌼', days: 14, progress: 80 },
      { name: 'FRUIT', label: 'ติดผล/พัฒนา', emoji: produceInfo.emoji || '🍈', days: 14, progress: 90 },
      { name: 'HARVEST', label: 'เก็บเกี่ยวผลผลิต', emoji: '🧺', days: 10, progress: 100 },
    ],
  };
}

export function getNextStage(cropName, currentStage, context = {}) {
  const cropDef = getCropDefinition(cropName, context);
  const currentIndex = cropDef.stages.findIndex((s) => s.name === currentStage);
  if (currentIndex !== -1 && currentIndex < cropDef.stages.length - 1) {
    return cropDef.stages[currentIndex + 1];
  }
  return null;
}

export function calculateProgress(cropName, currentStage, dayCount, context = {}) {
  const cropDef = getCropDefinition(cropName, context);
  const stage = cropDef.stages.find((s) => s.name === currentStage);
  if (stage) return stage.progress;
  return Math.min(100, Math.round((dayCount / (cropDef.totalDays || 90)) * 100));
}
