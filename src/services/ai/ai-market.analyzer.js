import { chatCompletion } from './typhoon.client.js';
import { logger } from '../../utils/logger.js';

// Default price benchmarks per kg (THB)
const DEFAULT_PRICE_BENCHMARKS = {
  'มะเขือเทศ': { A: 45, B: 32, C: 20 },
  'ผักบุ้ง': { A: 30, B: 20, C: 15 },
  'พริก': { A: 120, B: 85, C: 50 },
  'ข้าว': { A: 16, B: 13, C: 10 },
  'กะเพรา': { A: 40, B: 28, C: 18 },
  'ทุเรียน': { A: 180, B: 140, C: 95 },
  'ยางพารา': { A: 75, B: 62, C: 48 }, // น้ำยางสด/แผ่นดิบ
  'ปาล์มน้ำมัน': { A: 6.8, B: 5.5, C: 4.2 },
  'มังคุด': { A: 110, B: 75, C: 45 },
  'ลองกอง': { A: 60, B: 40, C: 25 },
  'เงาะ': { A: 45, B: 30, C: 20 },
  'สะตอ': { A: 250, B: 180, C: 120 }, // ต่อ 100 ฝัก หรือ กก.
  'ขมิ้น': { A: 55, B: 40, C: 28 },
  'กาแฟ (โรบัสต้า)': { A: 135, B: 105, C: 75 },
  'มะพร้าว': { A: 25, B: 18, C: 12 },
};

/**
 * Estimates market price and provides yield analysis using Typhoon LLM
 */
export async function estimateMarketPrice({ cropName, quantity, qualityGrade = 'A', location = 'ภาคใต้' }) {
  try {
    const prompt = `คุณคือผู้เชี่ยวชาญด้านเศรษฐศาสตร์การเกษตรและการประเมินราคาผลผลิตในประเทศไทย
จงประเมินราคาตลาดและวิเคราะห์แนวโน้มการจำหน่ายผลผลิตต่อไปนี้:

- พืช: ${cropName}
- ปริมาณที่เก็บเกี่ยวได้: ${quantity} กก.
- เกรดคุณภาพผลผลิต: เกรด ${qualityGrade}
- ตลาด/ภูมิภาค: ${location}

คำแนะนำ:
1. ประเมินราคาขายต่อกิโลกรัม (บาท/กก.) ให้สมจริงตามฤดูกาลและเกรดคุณภาพในประเทศไทยปัจจุบัน
2. ให้คำแนะนำช่องทางการจัดจำหน่ายและช่วงเวลาขายที่เหมาะสม
3. ตอบกลับเป็น JSON เท่านั้น

โครงสร้าง JSON ที่ต้องการ:
{
  "estimatedPricePerUnit": 45,
  "unit": "บาท/กก.",
  "totalEstimatedValue": 4500,
  "marketTrend": "ราคามีแนวโน้มทรงตัว/ความต้องการตลาดสูง",
  "recommendedChannels": ["ตลาดกลางผลผลิต", "ขายส่งลานเท", "จำหน่ายออนไลน์ตรงถึงผู้บริโภค"],
  "salesAdvice": "คำแนะนำสั้นๆ 1-2 ประโยคสำหรับเกษตรกร"
}`;

    const response = await chatCompletion([
      { role: 'system', content: 'You are an agricultural market pricing engine. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2, maxTokens: 600 });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
  } catch (err) {
    logger.warn('AI Price Estimation failed, using benchmarks:', err.message);
  }

  // Benchmark fallback
  const cropPrices = DEFAULT_PRICE_BENCHMARKS[cropName] || { A: 40, B: 30, C: 20 };
  const price = cropPrices[qualityGrade] || cropPrices['A'];
  const total = Math.round(price * parseFloat(quantity || 0));

  return {
    estimatedPricePerUnit: price,
    unit: 'บาท/กก.',
    totalEstimatedValue: total,
    marketTrend: 'ราคาตามมาตรฐานตลาดท้องถิ่น',
    recommendedChannels: ['ตลาดเกษตรกรท้องถิ่น', 'ผู้รวบรวมผลผลิตประจำพื้นที่', 'ขายตรงให้ร้านอาหาร'],
    salesAdvice: `ผลผลิต ${cropName} เกรด ${qualityGrade} ควรคัดแยกขนาดและรักษาความสดก่อนส่งจำหน่าย`,
  };
}
