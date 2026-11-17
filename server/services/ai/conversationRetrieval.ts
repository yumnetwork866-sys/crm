/** Keep the latest question first and add a bounded window for follow-up references. */
export function conversationRetrievalQuery(
  messages: { sender: string; content: string }[],
): string {
  let lastCustomerIndex = messages.length - 1;
  while (lastCustomerIndex >= 0 && messages[lastCustomerIndex].sender !== 'customer')
    lastCustomerIndex--;
  if (lastCustomerIndex < 0) return '';
  const question = messages[lastCustomerIndex].content.trim().slice(0, 2000);
  if (!question) return '';
  let remaining = 2000 - question.length;
  const context: string[] = [];
  for (const message of messages
    .slice(Math.max(0, lastCustomerIndex - 4), lastCustomerIndex)
    .reverse()) {
    if (remaining <= 1) break;
    const text = message.content.trim().slice(0, Math.min(350, remaining - 1));
    if (!text) continue;
    context.unshift(text);
    remaining -= text.length + 1;
  }
  return [question, ...context].join('\n');
}
