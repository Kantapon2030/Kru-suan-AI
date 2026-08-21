import { PrismaClient } from '@prisma/client';
import { chatCompletion } from './typhoon.client.js';
import { buildContext } from './context.builder.js';
import { buildSystemPrompt } from './prompt.templates.js';

const prisma = new PrismaClient();

export async function getUserConversations(userId) {
  return await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
}

export async function createConversation(userId, plotId = null, title = null) {
  let defaultTitle = title;
  if (!defaultTitle && plotId) {
    const plot = await prisma.plot.findUnique({ where: { id: plotId } });
    if (plot) defaultTitle = `คุยเรื่อง ${plot.name}`;
  }

  const conv = await prisma.conversation.create({
    data: {
      userId,
      plotId,
      title: defaultTitle || 'ปรึกษาครูสวน AI',
    },
  });

  // Welcome message
  await prisma.message.create({
    data: {
      conversationId: conv.id,
      role: 'assistant',
      content: 'สวัสดีครับ 👋 ผมครูสวน AI ยินดีที่ได้ช่วยดูแลสวนของคุณวันนี้ มีอะไรสอบถามผมได้เลยครับ 🌱',
    },
  });

  return conv;
}

export async function getConversationDetail(conversationId, userId) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!conversation) {
    const err = new Error('ไม่พบรายการสนทนา');
    err.statusCode = 404;
    throw err;
  }

  return conversation;
}

export async function sendMessage(userId, conversationId, userContent) {
  let conversation = null;
  if (conversationId) {
    conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    });
  }

  if (!conversation) {
    conversation = await createConversation(userId, null, 'ปรึกษาครูสวน AI');
    conversationId = conversation.id;
  }

  const userMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: userContent,
    },
  });

  const context = await buildContext(userId, conversationId, conversation.plotId, userContent);
  const systemPrompt = buildSystemPrompt(context);

  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...context.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userContent },
  ];

  const aiResponseContent = await chatCompletion(llmMessages, { maxTokens: 400, temperature: 0.35 });

  const aiMessage = await prisma.message.create({
    data: {
      conversationId,
      role: 'assistant',
      content: aiResponseContent,
      metadata: JSON.stringify({
        usedKnowledgeIds: context.knowledge?.map((k) => k.id) || [],
        plotId: conversation.plotId,
      }),
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  return { userMessage, aiMessage };
}

export async function getQuickActions(plotId) {
  const defaultActions = [
    { emoji: '☀️', text: 'วันนี้ควรดูแลสวนอย่างไรบ้าง?' },
    { emoji: '💧', text: 'สภาพอากาศแบบนี้ ควรรดน้ำเวลาไหนดี?' },
    { emoji: '🧪', text: 'บำรุงปุ๋ยอย่างไรให้พืชเจริญเติบโตดี?' },
    { emoji: '🐛', text: 'วิธีป้องกันโรคราและแมลงศัตรูพืช' },
    { emoji: '🌧️', text: 'ฝนตกชุกภาคใต้ ป้องกันรากเน่าอย่างไร?' },
  ];

  if (plotId) {
    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      include: { cropCycle: true },
    });

    if (plot) {
      const crop = plot.cropName;
      const stage = plot.cropCycle?.currentStage;
      const specific = [];

      // Southern crop specific questions
      if (crop === 'ทุเรียน') {
        if (stage === 'FLOWERING') {
          specific.push(
            { emoji: '🌼', text: 'เทคนิคกักน้ำเปิดตาดอกทุเรียนช่วงฝนชุก?' },
            { emoji: '🌸', text: 'วิธีช่วยผสมเกสรทุเรียนให้ติดผลพูเต็มสวย?' }
          );
        } else if (stage === 'FRUIT') {
          specific.push(
            { emoji: '✂️', text: 'เทคนิคตัดแต่งผลทุเรียนระยะกระป๋องนมไว้กี่ลูกดี?' },
            { emoji: '🥭', text: 'บำรุงพูทุเรียนอย่างไรให้หนามเขียวเนื้อแน่นเกรดส่งออก?' }
          );
        } else {
          specific.push(
            { emoji: '🔎', text: 'วิธีตรวจและรักษาโรครากเน่าโคนเน่าทุเรียน?' },
            { emoji: '💧', text: 'การให้น้ำทุเรียนรอบทรงพุ่มอย่างเหมาะสม' }
          );
        }
      } else if (crop === 'ยางพารา') {
        if (stage === 'HARVEST') {
          specific.push(
            { emoji: '🔪', text: 'กรีดยางอย่างไรให้น้ำยางออกดีและหน้ายางไม่ตาย?' },
            { emoji: '🪣', text: 'ราคาขี้ยางและน้ำยางสดช่วงนี้เป็นอย่างไร?' }
          );
        } else if (stage === 'FLOWERING') {
          specific.push(
            { emoji: '🍂', text: 'ช่วงยางผลัดใบต้องพักหน้ายางนานแค่ไหน?' },
            { emoji: '🧪', text: 'ใส่ปุ๋ยบำรุงต้นยางช่วงแตกใบใหม่อย่างไร?' }
          );
        } else {
          specific.push(
            { emoji: '🌿', text: 'วิธีป้องกันโรคใบร่วงชนิดใหม่และรากขาวยางพารา?' }
          );
        }
      } else if (crop === 'ปาล์มน้ำมัน') {
        if (stage === 'HARVEST') {
          specific.push(
            { emoji: '🌴', text: 'ดูอย่างไรว่าทะลายปาล์มสุกพอดีตัดได้เปอร์เซ็นต์น้ำมันสูง?' }
          );
        } else {
          specific.push(
            { emoji: '✂️', text: 'วิธีตัดแต่งทางใบปาล์มน้ำมันไม่ให้กระทบทะลาย?' },
            { emoji: '🍄', text: 'สังเกตและป้องกันโรคลำต้นเน่ากาโนเดอร์มาอย่างไร?' }
          );
        }
      } else if (crop === 'มังคุด') {
        specific.push(
          { emoji: '🟣', text: 'วิธีป้องกันมังคุดเป็นเนื้อแก้วและยางไหลช่วงฝนตก?' },
          { emoji: '🧺', text: 'เก็บเกี่ยวมังคุดระยะสายเลือดดูอย่างไร?' }
        );
      } else if (crop === 'ลองกอง') {
        specific.push(
          { emoji: '🍇', text: 'เทคนิคซอยผลลองกองให้ช่อยาวสวยผลโตหวานฉ่ำ?' }
        );
      } else if (crop === 'สะตอ') {
        specific.push(
          { emoji: '🫘', text: 'ป้องกันหนอนเจาะฝักสะตอแบบชีวภาพอย่างไร?' }
        );
      } else if (crop === 'ขมิ้น') {
        specific.push(
          { emoji: '🟡', text: 'เทคนิคพูนโคนขมิ้นชันให้ลงหัวใหญ่สารเคอร์คูมินสูง?' }
        );
      } else if (crop === 'กาแฟ (โรบัสต้า)') {
        specific.push(
          { emoji: '☕', text: 'วิธีคัดเมล็ดเชอรี่กาแฟสุกและการตากให้ได้เกรดพรีเมียม?' }
        );
      } else if (crop === 'มะเขือเทศ') {
        if (stage === 'VEGETATIVE') {
          specific.push(
            { emoji: '✂️', text: 'ทำไมต้องปลิดกิ่งแขนงใบล่างมะเขือเทศออก?' },
            { emoji: '🌿', text: 'ใบมะเขือเทศเริ่มเหลืองเกิดจากอะไรและแก้ยังไง?' }
          );
        }
      }

      if (specific.length > 0) {
        return [...specific, ...defaultActions].slice(0, 6);
      }
    }
  }

  return defaultActions.slice(0, 5);
}
