/**
 * Test thuần (không gọi mạng) cho bộ dịch Gemini <-> OpenAI của proxy
 * /api/ai/chat (api/_lib/ai.ts) — đợt 25/10.
 * Chạy: npx tsx scripts/test_ai_translator.ts
 */
import {
  geminiToOpenAI,
  openAiToGeminiParts,
  allLegsBadRequest,
} from '../api/_lib/ai.ts';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: any) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}
const eq = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

console.log('=== 1. geminiToOpenAI: system + user + model tool_calls ===');
{
  const { messages, tools } = geminiToOpenAI(
    [
      { role: 'user', parts: [{ text: 'Lớp 7A4 có bao nhiêu học sinh?' }] },
      {
        role: 'model',
        parts: [
          { text: 'Để tôi tra cứu.' },
          { functionCall: { name: 'get_student_count', args: { classId: '7A4' } } },
          { functionCall: { name: 'get_score_distribution', args: {} } },
        ],
      },
    ],
    'Bạn là trợ lý phân tích.',
    [{ name: 'get_student_count', description: 'Đếm học sinh', parameters: { type: 'object', properties: { classId: { type: 'string' } } } }]
  );
  check('system message đầu tiên', messages[0].role === 'system' && messages[0].content === 'Bạn là trợ lý phân tích.');
  check('user turn giữ nguyên text', messages[1].role === 'user' && messages[1].content === 'Lớp 7A4 có bao nhiêu học sinh?');
  check('model turn thành assistant', messages[2].role === 'assistant' && messages[2].content === 'Để tôi tra cứu.');
  check('2 tool_calls với id xác định', eq(messages[2].tool_calls.map((t: any) => t.id), ['call_get_student_count_0', 'call_get_score_distribution_1']), messages[2].tool_calls);
  check('arguments JSON đúng', messages[2].tool_calls[0].function.arguments === JSON.stringify({ classId: '7A4' }));
  check('tools map đúng 1 declaration', tools?.length === 1 && tools[0].function.name === 'get_student_count');
}

console.log('=== 2. geminiToOpenAI: function turn nối đúng tool_call_id ===');
{
  const { messages } = geminiToOpenAI(
    [
      { role: 'model', parts: [{ functionCall: { name: 'get_student_count', args: {} } }] },
      {
        role: 'function',
        parts: [
          { functionResponse: { name: 'get_student_count', response: { result: { count: 40 } } } } as any,
          { functionResponse: { name: 'ten_khong_ton_tai', response: { result: 'x' } } } as any,
        ],
      },
    ],
    '',
    undefined
  );
  check('không system khi prompt rỗng', messages[0].role === 'assistant');
  const toolMsgs = messages.filter((m: any) => m.role === 'tool');
  check('2 tool message', toolMsgs.length === 2, toolMsgs);
  check('tool message khớp id của model turn', toolMsgs[0].tool_call_id === 'call_get_student_count_0');
  check('content = JSON của result', toolMsgs[0].content === JSON.stringify({ count: 40 }));
  check('tên lạ fallback id call_<name>_0', toolMsgs[1].tool_call_id === 'call_ten_khong_ton_tai_0');
}

console.log('=== 3. geminiToOpenAI: không declarations -> tools undefined ===');
{
  const { tools } = geminiToOpenAI([{ role: 'user', parts: [{ text: 'hi' }] }], '', undefined);
  check('tools undefined', tools === undefined);
  const { tools: t2 } = geminiToOpenAI([], '', [{ name: 'f' }]);
  check('parameters mặc định khi thiếu', eq(t2?.[0].function.parameters, { type: 'object', properties: {} }), t2);
}

console.log('=== 4. openAiToGeminiParts: text + tool_calls ===');
{
  const parts = openAiToGeminiParts({
    message: {
      content: 'Kết quả đây.',
      tool_calls: [
        { function: { name: 'get_student_count', arguments: '{"classId":"7A4"}' } },
        { function: { name: 'x', arguments: 'không phải json' } },
      ],
    },
  });
  check('text part đầu', parts[0].text === 'Kết quả đây.');
  check('functionCall parse args đúng', eq(parts[1].functionCall, { name: 'get_student_count', args: { classId: '7A4' } }), parts[1]);
  check('arguments hỏng -> args {}', eq(parts[2].functionCall, { name: 'x', args: {} }), parts[2]);
  check('message rỗng -> không text part', openAiToGeminiParts({ message: { content: '' } }).length === 0);
}

console.log('=== 5. allLegsBadRequest ===');
{
  const mk = (status: number) => ({ leg: 'gemini', model: 'm', ok: false, status, latencyMs: 1 });
  check('mọi nấc 400 -> true', allLegsBadRequest([mk(400), mk(400)]) === true);
  check('lẫn 500 -> false', allLegsBadRequest([mk(400), mk(500)]) === false);
  check('rỗng -> false', allLegsBadRequest([]) === false);
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
