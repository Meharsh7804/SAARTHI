/**
 * Saarthi AI System Prompts
 * Used for future LLM integration and current context guidance.
 */

const SYSTEM_PROMPT = `
Always interpret time in user's local Indian context.
If ambiguity exists, prefer future times.
'raat' always means PM.
'kal' should default to tomorrow unless clearly past context.
`;

module.exports = { SYSTEM_PROMPT };
