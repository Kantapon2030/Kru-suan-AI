import { Router } from 'express';
import { successResponse } from '../utils/apiResponse.js';

const router = Router();

const TAXONOMY = {
  crops: [
    { id: 'durian', name: 'ทุเรียน', icon: 'forest' },
    { id: 'rubber', name: 'ยางพารา', icon: 'park' },
    { id: 'palm', name: 'ปาล์มน้ำมัน', icon: 'nature' },
    { id: 'mangosteen', name: 'มังคุด', icon: 'eco' },
    { id: 'longkong', name: 'ลองกอง', icon: 'nature_people' },
    { id: 'rambutan', name: 'เงาะ', icon: 'yard' },
    { id: 'sataw', name: 'สะตอ', icon: 'grass' },
    { id: 'turmeric', name: 'ขมิ้น', icon: 'spa' },
    { id: 'coffee', name: 'กาแฟ (โรบัสต้า)', icon: 'coffee' },
    { id: 'coconut', name: 'มะพร้าว', icon: 'sports_baseball' },
    { id: 'tomato', name: 'มะเขือเทศ', icon: 'local_florist' },
    { id: 'chili', name: 'พริก', icon: 'local_fire_department' },
    { id: 'rice', name: 'ข้าว', icon: 'grass' },
    { id: 'vegetable', name: 'ผัก', icon: 'psychiatry' },
  ],
  topics: [
    { id: 'planting', name: 'การปลูก', checked: true },
    { id: 'care', name: 'การดูแล', checked: false },
    { id: 'water', name: 'การให้น้ำ', checked: true },
    { id: 'fertilizer', name: 'การใส่ปุ๋ย', checked: false },
    { id: 'disease_pest', name: 'โรคและแมลง', checked: true },
    { id: 'harvest', name: 'การเก็บเกี่ยว', checked: false },
  ],
  stages: [
    { id: 'SEED', name: 'เมล็ดพันธุ์' },
    { id: 'SEEDLING', name: 'เพาะกล้า' },
    { id: 'PLANTING', name: 'เริ่มปลูก/เตรียมดิน' },
    { id: 'VEGETATIVE', name: 'เจริญเติบโต' },
    { id: 'FLOWERING', name: 'ออกดอก' },
    { id: 'FRUIT', name: 'ติดผล/พัฒนาผล' },
    { id: 'HARVEST', name: 'เก็บเกี่ยว' },
  ],
  regions: [
    'ภาคใต้',
    'ภาคกลาง',
    'ภาคตะวันออก',
    'ภาคตะวันออกเฉียงเหนือ',
    'ภาคเหนือ',
  ],
};

// GET /api/taxonomy
router.get('/', (req, res) => {
  return successResponse(res, TAXONOMY);
});

export default router;
